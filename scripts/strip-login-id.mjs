#!/usr/bin/env node
/**
 * users 문서에서 `loginId` 칸을 걷어낸다. (한 번 돌리면 끝나는 일)
 *
 * 왜 —
 *   users는 **공개로 읽힌다**(firestore.rules의 `allow read: if true`).
 *   닉네임을 게시글·랭킹에 띄우려고 연 것인데 아이디가 함께 들어 있어,
 *   게시글의 authorUid로 문서를 열면 가입자 아이디를 통째로 긁을 수 있었다.
 *   비밀번호의 절반이 공개돼 있던 셈이다.
 *
 * 지워도 되는 이유 —
 *   아이디는 이미 내부 이메일에 들어 있다(`{아이디}@bonghwang.local`).
 *   그 이메일은 로그인한 본인만 읽으므로, 앱은 거기서 되찾아 쓴다
 *   (`src/lib/auth.ts`의 fromInternalEmail).
 *
 * **규칙보다 먼저 돌려야 한다.** firestore.rules는 update를 검사할 때
 * 병합된 결과 문서를 본다. 옛 칸이 남아 있는 채로 규칙을 게시하면 그
 * 사용자는 닉네임조차 바꿀 수 없게 된다.
 *
 * 쓰기 —
 *   node scripts/strip-login-id.mjs --dry    무엇이 지워질지만 본다
 *   node scripts/strip-login-id.mjs          실제로 지운다 (백업 파일을 먼저 남긴다)
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
    'strip-login-id'
  )
)

const snap = await db.collection('users').get()
const targets = snap.docs.filter((d) => 'loginId' in d.data())

console.log(`users 문서 ${snap.size}건 · loginId 칸이 있는 것 ${targets.length}건`)
if (targets.length === 0) {
  console.log('지울 것이 없다.')
  process.exit(0)
}

if (DRY) {
  const withValue = targets.filter((d) => d.data().loginId).length
  console.log(`값이 든 것 ${withValue}건 · 빈 문자열 ${targets.length - withValue}건`)
  console.log('(--dry 이므로 아무것도 건드리지 않았다)')
  process.exit(0)
}

/*
  되돌릴 수 있게 먼저 받아 둔다. 저장소 밖에 남긴다 — 아이디 목록이라
  커밋되면 지우려던 것을 git 이력에 새로 새기는 꼴이 된다.
*/
const backup = Object.fromEntries(targets.map((d) => [d.id, d.data().loginId ?? '']))
const out = path.join(ROOT, '..', `loginid-backup-${Date.now()}.json`)
fs.writeFileSync(out, JSON.stringify(backup, null, 1))
console.log(`되돌리기용 백업: ${out}`)

const batch = db.batch()
for (const d of targets) batch.update(d.ref, { loginId: FieldValue.delete() })
await batch.commit()

const after = await db.collection('users').get()
const left = after.docs.filter((d) => 'loginId' in d.data()).length
console.log(`지웠다. 남은 loginId 칸: ${left}건`)
console.log('이제 firestore.rules를 게시하면 된다 — firebase deploy --only firestore:rules')
process.exit(0)
