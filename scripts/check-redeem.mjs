/**
 * 쿠폰·포인트 사용을 **끝까지** 돌려본다 — 에뮬레이터에서.
 *
 * 규칙 시험(tests/rules.test.mjs)은 규칙이 무엇을 통과시키는지 본다. 이쪽은
 * 앱이 실제로 보내는 것을 본다 — `redeemCoupon()`·`redeemPoints()`·
 * `stampPending()`을 그대로 불러서, 규칙과 클라이언트가 같은 것을 말하는지
 * 확인한다. 둘 중 하나만 맞으면 화면은 멀쩡한데 카운터에서 거절된다.
 *
 * 브라우저로 하지 않는 이유: 미리보기 창이 개발 서버(3000) 말고 다른 로컬
 * 포트에 닿지 못해 에뮬레이터를 볼 수 없다. 여기서는 같은 코드를 Node에서
 * 부르므로 그 제약이 없다.
 *
 *   npm run seed:emulator && npm run check:redeem
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'


/*
  임시 폴더가 아니라 프로젝트 안에 굽는다.

  앱 코드가 `firebase/app`을 부르는데, 프로젝트 밖에서는 node_modules를
  찾지 못한다. 여기 두면 그대로 해결되고, 끝나면 지운다(.gitignore에 있다).
*/
const OUT = join(process.cwd(), '.check-redeem')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// ---------------------------------------------------------------------------
// 앱 코드를 그대로 컴파일한다
// ---------------------------------------------------------------------------

execFileSync(
  process.execPath,
  [
    join('node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/shops.ts',
    '--outDir',
    OUT,
    '--module',
    'commonjs',
    '--target',
    'es2019',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
  ],
  { stdio: 'inherit' }
)

writeFileSync(join(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }))

/*
  `./firebase`만 갈아끼운다. 나머지는 앱의 코드 그대로다 — 갈아끼우는 것이
  늘면 무엇을 시험하는지 흐려진다. db는 아래에서 세운 에뮬레이터 것을
  넘긴다(globalThis를 지나가는 이유는 이 모듈이 동기로 불려서다).
*/
writeFileSync(
  join(OUT, 'firebase.js'),
  `Object.defineProperty(exports, 'db', { get: () => globalThis.__bhEmu.db })
Object.defineProperty(exports, 'auth', { get: () => globalThis.__bhEmu.auth })
exports.isFirebaseReady = () => true
`
)
// 계측은 여기서 볼 것이 아니다 — 서버로 보내지 않고 삼킨다
writeFileSync(join(OUT, 'analytics.js'), 'exports.logEvent = () => {}\n')

// ---------------------------------------------------------------------------
// 에뮬레이터에 붙고 손님으로 로그인한다
// ---------------------------------------------------------------------------

/*
  SDK를 **앱과 같은 사본으로** 불러야 한다.

  이 스크립트가 `import`로 받은 firebase와 컴파일된 앱 코드가 `require`로
  받는 firebase는 서로 다른 인스턴스다. 그래서 여기서 만든 Firestore를
  앱 쪽에 넘기면 "Expected first argument to collection() to be a
  CollectionReference"로 떨어진다 — 같은 클래스가 아니기 때문이다.
*/
const require = createRequire(pathToFileURL(join(OUT, 'x.cjs')))
const { initializeApp } = require('firebase/app')
const fbAuth = require('firebase/auth')
const fbStore = require('firebase/firestore')

const app = initializeApp({
  apiKey: 'fake-api-key',
  authDomain: 'localhost',
  projectId: process.env.EMU_PROJECT || 'bonghwang-memories',
  storageBucket: 'fake',
  messagingSenderId: '1',
  appId: '1',
})
const db = fbStore.getFirestore(app)
const auth = fbAuth.getAuth(app)
fbStore.connectFirestoreEmulator(db, '127.0.0.1', 8681)
fbAuth.connectAuthEmulator(auth, 'http://127.0.0.1:9399', { disableWarnings: true })
globalThis.__bhEmu = { db, auth }

let failed = 0
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(
      `  FAIL ${name}\n       받은 값 ${JSON.stringify(got)}\n       기대값 ${JSON.stringify(want)}`
    )
  }
}

const cred = await fbAuth.signInWithEmailAndPassword(
  auth,
  'walker@bonghwang.local',
  'test1234'
).catch((e) => {
  console.error(
    '\n손님 계정으로 로그인하지 못했습니다. 먼저 심으세요:\n' +
      '  npm run seed:emulator\n\n' +
      e.message
  )
  process.exit(1)
})
const uid = cred.user.uid

const shops = require('./shops.js')
const { makeCouponCode, makePointCode } = require('./coupons.js')

/** 심은 스티커 값 — scripts/seed-emulator.mjs와 같아야 한다 */
const TOKEN = 'AW5NAYAY'

console.log('\n쿠폰 — 손님이 스티커를 찍는다')
{
  // 순번을 바꿔 매번 새 코드를 쓴다. 원장은 서버에 남으므로 다시 돌려도 겹치지 않게
  const serial = Math.floor(Date.now() / 1000) % 900
  const code = makeCouponCode('cp1', uid, false, serial)

  const wrong = await shops.redeemCoupon({
    code,
    shopId: 'cp1',
    uid,
    token: 'ZZZZZZZZ',
  })
  eq('토큰이 틀리면 거절한다', wrong.kind, 'denied')

  const ok = await shops.redeemCoupon({ code, shopId: 'cp1', uid, token: TOKEN })
  eq('토큰이 맞으면 사용된다', ok.kind, 'ok')

  const again = await shops.redeemCoupon({ code, shopId: 'cp1', uid, token: TOKEN })
  eq('두 번은 안 된다', again.kind, 'used')

  eq('지갑이 사용됨으로 바뀐다', await shops.isCouponUsed(code), true)
}

console.log('\n포인트 — 같은 길, 금액만 손님이 넣는다')
{
  const serial = Math.floor(Date.now() / 1000) % 900
  const code = makePointCode(uid, serial)

  const zero = await shops.redeemPoints({
    code,
    amountWon: 0,
    shopId: 'cp1',
    uid,
    token: TOKEN,
  })
  eq('금액이 없으면 거절한다', zero.kind, 'denied')

  const ok = await shops.redeemPoints({
    code,
    amountWon: 3000,
    shopId: 'cp1',
    uid,
    token: TOKEN,
  })
  eq('3,000P가 사용된다', ok.kind, 'ok')

  // 쿠폰과 달리 어디서나 쓴다 — 다른 가게에서도 통과해야 한다
  const other = await shops.redeemPoints({
    code: makePointCode(uid, (serial + 1) % 900),
    amountWon: 1000,
    shopId: 'cp2',
    uid,
    token: 'BC6MBZBZ',
  })
  eq('다른 가게에서도 쓴다', other.kind, 'ok')
}

console.log('\n충당률 — 가게가 나중에 채운다')
{
  // 가게 계정으로 갈아탄다. 손님은 가게 문서를 읽지 못해 채울 수 없다
  const shopCred = await fbAuth.signInWithEmailAndPassword(
    auth,
    'shopcp1@bonghwang.local',
    'test1234'
  )
  const mine = await shops.fetchMyShops(shopCred.user.uid)
  eq('사장님이 자기 가게를 찾는다', mine.length, 1)

  const before = await shops.fetchShopUses('cp1')
  const pending = before.filter((u) => u.coverageRate < 0).length
  if (pending === 0) {
    failed++
    console.log('  FAIL 채울 것이 없다 — 손님 경로가 충당률을 비워 두지 않았다')
  } else {
    console.log(`  ok   비어 있는 기록 ${pending}건을 찾았다`)
  }

  const r = await shops.stampPending(mine[0])
  eq('전부 채웠다', r.stamped >= pending, true)

  const after = await shops.fetchShopUses('cp1')
  eq('빈 칸이 남지 않았다', after.filter((u) => u.coverageRate < 0).length, 0)
  // 시범운영 0% — 가게 부담은 0이고 전액 운영사가 진다
  eq(
    '0%라 가게 부담이 없다',
    after.every((u) => u.shopWon === 0 && u.opsWon === u.amountWon),
    true
  )

  const points = after.filter((u) => u.kind === 'points')
  eq('포인트 사용이 금액과 함께 남았다', points.some((u) => u.amountWon === 3000), true)
}

rmSync(OUT, { recursive: true, force: true })

if (failed) {
  console.log(`\n❌ ${failed}건 어긋남`)
  process.exit(1)
}
console.log('\n✅ 쿠폰·포인트 사용이 끝까지 돌았습니다')
process.exit(0)
