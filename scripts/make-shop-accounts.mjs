/**
 * 가게 계정 다섯 개를 한 번에 만든다.
 *
 *   node scripts/make-shop-accounts.mjs
 *
 * 앱의 회원가입 화면을 다섯 번 오가며 로그아웃-가입을 되풀이하던 일을
 * 없앤다. 손으로 하면 uid를 콘솔에서 하나씩 복사해 seed.txt에 옮겨
 * 적어야 하는데, 다섯 개짜리 붙여넣기는 반드시 한 번 어긋난다.
 *
 * 만드는 방식은 앱과 똑같다 — 같은 Firebase 웹 SDK로 계정을 만들고
 * users/{uid} 프로필 문서까지 남긴다(auth.ts의 signUp과 같은 모양).
 * 콘솔에서 계정만 만들면 그 문서가 없어 로그인 뒤 화면이 어긋난다.
 *
 * 아이디·가게이름·비밀번호는 아래 표에 적혀 있고, 결과를
 * shop-qr/accounts.txt로 뽑는다. 그 폴더는 gitignore다 — 저장소에
 * 올라가면 남의 가게 쿠폰을 대신 처리할 수 있다.
 *
 * 다시 돌려도 안전하다. 이미 있는 계정은 만들지 않고 로그인만 해서
 * uid를 확인한다 — 비밀번호가 표에 고정돼 있어 사장님께 드린 종이가
 * 그대로 유효하다.
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
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'shop-qr')
const STORE = path.join(OUT, 'accounts.json')

/** auth.ts의 ID_DOMAIN과 같아야 한다 */
const ID_DOMAIN = 'bonghwang.local'

/*
  닉네임은 2~12자다. 가게 이름을 그대로 쓰되 공백은 뺀다 — 목록에서
  가게를 알아보는 것이 목적이고, 참여자에게 보일 일은 없다.

  비밀번호는 가게 이름 앞 두 글자를 영문으로 적고 2026을 붙인다.
  사장님이 외우지 않고도 칠 수 있어야 해서 이렇게 정했다.

  대신 짐작하기 쉽다는 것을 알고 쓴다. 이 계정으로 할 수 있는 일은
  '자기 가게 쿠폰을 사용 처리하는 것' 하나뿐이고, 그러려면 손님의 실제
  쿠폰 코드가 있어야 한다. 다만 규칙이 코드의 체크값까지는 보지 못하므로
  마음먹으면 기록을 부풀릴 수는 있다 — 그래서 관리자 정산에 직접/대리
  비율을 띄운다. 새는 낌새가 보이면 여기 값만 바꾸면 된다.
*/
const SHOPS = [
  { shopId: 'cp1', loginId: 'shopcp1', nickname: '봉황1935', password: '■■■■' },
  { shopId: 'cp2', loginId: 'shopcp2', nickname: '미야상회', password: '■■■■' },
  { shopId: 'cp3', loginId: 'shopcp3', nickname: '능소화고택', password: '■■■■' },
  { shopId: 'cp4', loginId: 'shopcp4', nickname: '카페탱자', password: '■■■■' },
  { shopId: 'cp5', loginId: 'shopcp5', nickname: '방하림', password: '■■■■' },
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

fs.mkdirSync(OUT, { recursive: true })
let kept = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : {}

const rows = []
for (const shop of SHOPS) {
  const email = `${shop.loginId}@${ID_DOMAIN}`
  const password = shop.password
  let uid = ''
  let made = false

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    uid = cred.user.uid
    made = true
    await updateProfile(cred.user, { displayName: shop.nickname })

    /*
      프로필 문서. 규칙이 isOwner(userId)를 요구하므로 방금 만든 계정으로
      로그인된 이 순간에 써야 한다 — 관리자 권한으로는 못 만든다.
    */
    await setDoc(doc(db, 'users', uid), {
      uid,
      loginId: shop.loginId,
      nickname: shop.nickname,
      nicknameKey: shop.nickname.trim().toLowerCase(),
      provider: 'password',
      totalScore: 0,
      completedMissions: [],
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    })
  } catch (err) {
    const code = err?.code ?? ''
    if (code === 'auth/email-already-in-use') {
      // 이미 있는 계정 — 만들지 않고 로그인만 해서 uid를 확인한다
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        uid = cred.user.uid
      } catch {
        console.error(
          `${shop.loginId}: 이미 있는 계정인데 비밀번호가 맞지 않는다.\n` +
            `  shop-qr/accounts.json이 지워졌거나 다른 자리에서 만든 계정이다.\n` +
            `  콘솔 → Authentication에서 지우고 다시 돌리거나, uid를 손으로 채운다.`
        )
        continue
      }
    } else {
      console.error(`${shop.loginId}: ${code || err?.message || err}`)
      continue
    }
  }

  kept[shop.loginId] = { password, uid, nickname: shop.nickname }
  rows.push({ ...shop, password, uid, made })
  await signOut(auth)
}

fs.writeFileSync(STORE, JSON.stringify(kept, null, 2))

// 사장님께 건넬 종이에 옮겨 적을 값
fs.writeFileSync(
  path.join(OUT, 'accounts.txt'),
  '봉황 메모리즈 — 가게 계정\n' +
    '이 파일은 저장소에 올라가지 않는다(shop-qr/ 은 gitignore).\n\n' +
    rows
      .map(
        (r) =>
          `${r.nickname}\n  아이디   ${r.loginId}\n  비밀번호 ${r.password}\n  uid      ${r.uid}\n`
      )
      .join('\n')
)

/*
  seed.txt의 STAFF 빈칸을 채운다. uid를 사람이 옮겨 적는 자리가
  남아 있으면 다섯 개 중 하나는 반드시 어긋난다.
*/
const seedPath = path.join(OUT, 'seed.txt')
if (fs.existsSync(seedPath)) {
  const filled = fs
    .readFileSync(seedPath, 'utf8')
    .split('\n')
    .map((line) => {
      // 예: `  cp1: [''],   // 봉황1935 — shopcp1 계정 uid`
      const m = /^(\s*)(cp\d+):\s*\[''\],(.*)$/.exec(line)
      if (!m) return line
      const r = rows.find((x) => x.shopId === m[2])
      return r?.uid ? `${m[1]}${m[2]}: ['${r.uid}'],${m[3]}` : line
    })
    .join('\n')
  fs.writeFileSync(seedPath, filled)
}

console.log(`가게 계정 ${rows.length}개`)
for (const r of rows) {
  console.log(`  ${r.loginId.padEnd(9)} ${r.nickname.padEnd(8)} ${r.uid}${r.made ? '  ← 새로 만듦' : '  (이미 있음)'}`)
}
console.log('\n  shop-qr/accounts.txt  아이디·비밀번호 — 사장님께 드릴 값')
console.log('  shop-qr/seed.txt      staffUids가 채워졌다. 관리자 콘솔에 붙여넣으면 된다')
process.exit(0)
