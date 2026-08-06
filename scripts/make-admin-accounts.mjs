/**
 * 일반관리자 계정을 만든다.
 *
 *   node scripts/make-admin-accounts.mjs
 *
 * 일반관리자는 앱을 처음부터 끝까지 직접 걸어보는 등급이다(adminEmails.ts).
 * 그래서 참여자와 **똑같은 아이디·비밀번호 로그인**을 쓴다 — 구글 계정을
 * 나눠 갖지 않아도 되고, 현장에서 폰을 바꿔 가며 시험할 수 있다.
 *
 * 만드는 방식은 앱과 똑같다 — 같은 Firebase 웹 SDK로 계정을 만들고
 * `users/{uid}` 프로필 문서까지 남긴다(`auth.ts`의 signUp과 같은 모양).
 * 콘솔에서 계정만 만들면 그 문서가 없어 로그인 뒤 화면이 어긋난다.
 *
 * **문서에 `loginId`를 적지 않는다.** 규칙이 그 칸을 아예 거부한다 —
 * users는 한때 공개로 읽혔고, 거기 아이디가 있으면 비밀번호의 절반이
 * 공개된 셈이었다. 아이디는 이미 내부 이메일에 들어 있다.
 *
 * 다시 돌려도 안전하다. 이미 있는 계정은 만들지 않고 로그인만 해서 uid를
 * 확인하고, 빠진 문서만 채운다.
 *
 * 아래 표를 고쳐도 권한은 따라오지 않는다. **`adminEmails.ts`의
 * `GENERAL_ADMIN_EMAILS`에 같은 주소가 있어야** 관리자로 친다 — 이 스크립트
 * 끝에서 그것이 맞는지 검사해 알려준다.
 */

import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

const ROOT = process.cwd()

/** auth.ts의 ID_DOMAIN과 같아야 한다 */
const ID_DOMAIN = 'bonghwang.local'

/*
  시험 계정이라 비밀번호를 여기 적는다.

  가게 계정(make-shop-accounts.mjs)은 값을 gitignore된 파일에서 읽는다 —
  그쪽은 남의 가게 쿠폰을 대신 처리할 수 있어서다. 이쪽이 여는 것은 '내
  기기의 진행을 건너뛴다'뿐이고, 참여자 데이터는 슈퍼관리자에게만 열린다.

  그래도 **판매가 시작되면 지운다.** 123456은 아무나 맞힌다.
*/
const ACCOUNTS = [
  { loginId: 'test_01', password: '123456', nickname: '시험01' },
  { loginId: 'test_02', password: '123456', nickname: '시험02' },
]

// ---------------------------------------------------------------------------
// .env.local — 앱이 쓰는 것과 같은 설정을 그대로 읽는다
// ---------------------------------------------------------------------------

function readEnv() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) {
    console.error('.env.local이 없다. Firebase 설정이 있어야 계정을 만들 수 있다.')
    process.exit(1)
  }
  const env = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  const need = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ]
  const missing = need.filter((k) => !env[k])
  if (missing.length) {
    console.error(`.env.local에 없는 값: ${missing.join(', ')}`)
    process.exit(1)
  }
  return env
}

const env = readEnv()
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
})
const auth = getAuth(app)
const db = getFirestore(app)

/** publicMirror.ts의 toNicknameKey와 같아야 한다 */
const nicknameKey = (n) => n.trim().toLowerCase().replace(/\//g, '_')

const rows = []
for (const acc of ACCOUNTS) {
  const email = `${acc.loginId}@${ID_DOMAIN}`
  let uid = ''
  let made = false

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, acc.password)
    uid = cred.user.uid
    made = true
    await updateProfile(cred.user, { displayName: acc.nickname })
  } catch (err) {
    const code = err?.code ?? ''
    if (code !== 'auth/email-already-in-use') {
      console.error(`${acc.loginId}: ${code || err?.message || err}`)
      continue
    }
    // 이미 있는 계정 — 만들지 않고 로그인만 해서 uid를 확인한다
    try {
      const cred = await signInWithEmailAndPassword(auth, email, acc.password)
      uid = cred.user.uid
    } catch {
      console.error(
        `${acc.loginId}: 이미 있는 계정인데 비밀번호가 맞지 않는다.\n` +
          `  콘솔 → Authentication에서 지우고 다시 돌린다.`
      )
      continue
    }
  }

  /*
    프로필 문서·이름 예약·랭킹 자리.

    규칙이 isOwner(userId)를 요구하므로 **그 계정으로 로그인된 이 순간**에
    써야 한다. 다시 돌릴 때를 위해 이미 있으면 건너뛴다 — nicknames는
    update가 막혀 있어 덮어쓰려 들면 거부된다.

    isAdmin은 users에도 rankings에도 찍지 않는다. 앱이 로그인할 때마다
    토큰의 이메일을 보고 두 곳에 스스로 찍으므로(admin.ts의
    markAdminAccount), 여기 적으면 같은 말을 두 곳이 하게 되고 등급 표를
    고쳤을 때 한쪽만 낡는다. 점수가 0이라 첫 로그인 전에는 순위표에
    올라올 일도 없다.
  */
  try {
    const ref = doc(db, 'users', uid)
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        uid,
        nickname: acc.nickname,
        nicknameKey: nicknameKey(acc.nickname),
        provider: 'password',
        totalScore: 0,
        completedMissions: [],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      })
    }
    const nameRef = doc(db, 'nicknames', nicknameKey(acc.nickname))
    const claimed = await getDoc(nameRef)
    if (!claimed.exists()) {
      await setDoc(nameRef, { uid, at: serverTimestamp() })
    } else if (claimed.data().uid !== uid) {
      console.warn(`${acc.loginId}: 닉네임 '${acc.nickname}'은 남이 쓰고 있다 — 표를 고쳐라.`)
    }
    await setDoc(
      doc(db, 'rankings', uid),
      { uid, nickname: acc.nickname, totalPoints: 0, at: serverTimestamp() },
      { merge: true }
    )
  } catch (err) {
    console.error(`${acc.loginId}: 문서 쓰기 실패 — ${err?.code || err?.message || err}`)
  }

  rows.push({ ...acc, uid, made, email })
  await signOut(auth)
}

// ---------------------------------------------------------------------------
// 권한이 실제로 붙었는지 — 계정만 만들고 목록을 잊는 것이 이 작업의 함정이다
// ---------------------------------------------------------------------------

const src = fs.readFileSync(path.join(ROOT, 'src/lib/adminEmails.ts'), 'utf8')
const missing = rows.filter((r) => !src.includes(`'${r.email}'`))

console.log(`\n일반관리자 계정 ${rows.length}개`)
for (const r of rows) {
  console.log(
    `  ${r.loginId.padEnd(9)} ${r.nickname.padEnd(7)} ${r.uid}` +
      (r.made ? '  ← 새로 만듦' : '  (이미 있음)')
  )
}
if (missing.length) {
  console.log('\n⚠ adminEmails.ts의 GENERAL_ADMIN_EMAILS에 없다 — 그냥 참여자로 로그인된다:')
  for (const r of missing) console.log(`    '${r.email}',`)
} else {
  console.log('\n  adminEmails.ts에 모두 올라 있다 — 로그인하면 「진행 건너뛰기 모드」가 보인다.')
}
process.exit(0)
