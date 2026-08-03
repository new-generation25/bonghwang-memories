#!/usr/bin/env node
/**
 * users를 닫기 전에 한 번 돌린다. (한 번이면 끝난다)
 *
 * 하는 일 셋 —
 *   1. users 문서에서 `loginId` 칸을 지운다
 *   2. 이름 예약 문서를 만든다        nicknames/{key} = { uid }
 *   3. 랭킹판 문서를 만든다           rankings/{uid}  = { nickname, totalPoints }
 *
 * 왜 —
 *   users는 읽기가 공개였다. 닉네임을 랭킹에 띄우고 가입 때 이름 겹침을
 *   보려고 열어 둔 것인데, 같은 문서에 로그인 아이디·결제 여부·어디까지
 *   갔는지가 함께 들어 있었다. 프로젝트 ID와 API 키만 있으면(둘 다 앱
 *   JS에 박혀 있다) Firestore REST로 참여자 전원의 기록이 통째로 읽혔다.
 *
 *   Firestore는 칸 단위로 읽기를 막지 못한다. 그래서 밖에 보여도 되는
 *   둘만 따로 내놓고 users는 본인·관리자만 읽게 닫는다.
 *
 * **규칙 게시보다 먼저 돌려야 한다.** 두 가지 이유가 있다 —
 *   · update 규칙은 병합된 결과 문서를 본다. loginId가 남은 채로 게시하면
 *     그 사람은 닉네임조차 바꿀 수 없다
 *   · 랭킹·이름 예약 문서가 없는 채로 users를 닫으면, 그 사이 랭킹판이
 *     비고 이미 쓰는 이름이 비어 보인다
 *
 * 쓰기 —
 *   node scripts/seal-user-docs.mjs --dry    무엇이 바뀔지만 본다
 *   node scripts/seal-user-docs.mjs          실제로 쓴다
 *
 * 필요한 것 — .env.local의 FIREBASE_SERVICE_ACCOUNT
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry')

/** auth.ts·publicMirror.ts와 같은 규칙이어야 한다 */
const toNicknameKey = (n) => String(n ?? '').trim().toLowerCase().replace(/\//g, '_')

function serviceAccount() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) {
    console.error('.env.local이 없다.')
    process.exit(1)
  }
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*FIREBASE_SERVICE_ACCOUNT\s*=\s*(.*)$/.exec(line)
    if (m) return JSON.parse(m[1].trim().replace(/^["']|["']$/g, ''))
  }
  console.error('.env.local에 FIREBASE_SERVICE_ACCOUNT가 없다.')
  process.exit(1)
}

const sa = serviceAccount()
const db = getFirestore(
  initializeApp(
    {
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: String(sa.private_key).replace(/\\n/g, '\n'),
      }),
    },
    'seal-user-docs'
  )
)

const snap = await db.collection('users').get()
console.log(`users 문서 ${snap.size}건`)

const plan = []
const takenKeys = new Map()
for (const d of snap.docs) {
  const v = d.data()
  const key = toNicknameKey(v.nickname)
  /*
    같은 열쇠가 둘이면 먼저 만들어진 쪽이 이름을 가진다. 뒤엣것은 예약만
    건너뛴다 — 지금 쓰는 이름을 뺏지 않고, 다음에 바꿀 때 걸리게 둔다.
  */
  const dup = key && takenKeys.has(key)
  if (key && !dup) takenKeys.set(key, d.id)
  plan.push({
    uid: d.id,
    nickname: v.nickname ?? '',
    key,
    dup,
    hasLoginId: 'loginId' in v,
    totalPoints: typeof v.totalPoints === 'number' ? v.totalPoints : (v.totalScore ?? 0),
    isAdmin: Boolean(v.isAdmin),
  })
}

console.log(`  loginId 지울 것        ${plan.filter((p) => p.hasLoginId).length}건`)
console.log(`  이름 예약 만들 것      ${plan.filter((p) => p.key && !p.dup).length}건`)
console.log(`  랭킹 문서 만들 것      ${plan.length}건`)
const dups = plan.filter((p) => p.dup)
if (dups.length) {
  console.log(`  ⚠ 이름이 겹쳐 예약을 건너뛴 것 ${dups.length}건 — ${dups.map((p) => p.nickname).join(', ')}`)
}

if (DRY) {
  console.log('(--dry 이므로 아무것도 건드리지 않았다)')
  process.exit(0)
}

const backup = Object.fromEntries(
  snap.docs.filter((d) => 'loginId' in d.data()).map((d) => [d.id, d.data().loginId ?? ''])
)
const out = path.join(ROOT, '..', `loginid-backup-${Date.now()}.json`)
fs.writeFileSync(out, JSON.stringify(backup, null, 1))
console.log(`되돌리기용 백업: ${out}`)

const batch = db.batch()
for (const p of plan) {
  if (p.hasLoginId) {
    batch.update(db.collection('users').doc(p.uid), { loginId: FieldValue.delete() })
  }
  if (p.key && !p.dup) {
    batch.set(db.collection('nicknames').doc(p.key), { uid: p.uid, at: FieldValue.serverTimestamp() })
  }
  batch.set(
    db.collection('rankings').doc(p.uid),
    {
      uid: p.uid,
      nickname: p.nickname,
      totalPoints: p.totalPoints,
      isAdmin: p.isAdmin,
      at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}
await batch.commit()

const after = await db.collection('users').get()
const left = after.docs.filter((d) => 'loginId' in d.data()).length
const nicks = (await db.collection('nicknames').get()).size
const ranks = (await db.collection('rankings').get()).size
console.log(`끝났다. 남은 loginId ${left}건 · nicknames ${nicks}건 · rankings ${ranks}건`)
console.log('이제 규칙을 게시한다 — npx firebase deploy --only firestore:rules')
process.exit(0)
