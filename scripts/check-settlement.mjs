/**
 * 정산 산식 검산 — 돈을 세는 계산만 따로 돌려본다.
 *
 * E2E는 화면이 무엇을 보여주는지를 보지, 4,500원을 60%로 나눈 값이
 * 2,700원인지는 보지 못한다. 그 계산이 틀리면 아무도 안 죽고 화면도
 * 멀쩡한 채로 청구서만 틀린다 — 그래서 여기서 따로 잰다.
 *
 * coverage.ts와 points.ts는 Firebase 없이도 도는 순수 계산이라(그러라고
 * 갈라 둔 것이다) 임시 폴더에 컴파일해 그대로 부른다. points.ts만 firebase를
 * import하므로 빈 모듈로 갈아끼운다.
 *
 *   npm run check:settlement
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const OUT = join(tmpdir(), 'bh-settlement-check')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// npx가 아니라 tsc를 node로 직접 부른다 — 윈도우에서 .cmd 실행이 막힌다
execFileSync(
  process.execPath,
  [
    join('node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/coverage.ts',
    'src/lib/points.ts',
    '--outDir',
    OUT,
    // CommonJS로 뽑는다 — ESM은 확장자 없는 './firebase'를 못 찾는다
    '--module',
    'commonjs',
    '--target',
    'es2019',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
  ],
  { stdio: 'inherit' }
)

/*
  points.ts가 부르는 것들을 껍데기로 갈아끼운다.

  여기서 보는 것은 원장 계산(pointWallet)뿐이고 그 함수는 서버를 부르지
  않는다. 그런데 모듈을 불러오는 것만으로 firebase가 딸려 오므로, 빈
  모듈을 심어 SDK를 실제로 세우지 않고 통과시킨다.
*/
writeFileSync(join(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }))
writeFileSync(
  join(OUT, 'firebase.js'),
  'module.exports = { db: null, auth: null, isFirebaseReady: () => false }\n'
)
for (const m of ['app', 'auth', 'firestore', 'analytics']) {
  mkdirSync(join(OUT, 'node_modules', 'firebase', m), { recursive: true })
  writeFileSync(
    join(OUT, 'node_modules', 'firebase', m, 'index.js'),
    'module.exports = new Proxy({}, { get: () => () => {} })\n'
  )
}
writeFileSync(
  join(OUT, 'node_modules', 'firebase', 'package.json'),
  JSON.stringify({ name: 'firebase', version: '0.0.0' })
)

const require = createRequire(pathToFileURL(join(OUT, 'check.cjs')))
const cov = require('./coverage.js')
const pts = require('./points.js')

let failed = 0
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}\n       받은 값 ${JSON.stringify(got)}\n       기대값 ${JSON.stringify(want)}`)
  }
}

console.log('\n분담 산식 — 명세의 예시')
eq('4,500원 · 60%', cov.splitCoverage(4500, 60), {
  amountWon: 4500, coverageRate: 60, shopWon: 2700, opsWon: 1800,
})
eq('3,000p · 85%', cov.splitCoverage(3000, 85), {
  amountWon: 3000, coverageRate: 85, shopWon: 2550, opsWon: 450,
})
eq('4,500원 · 0%(신규·시범운영)', cov.splitCoverage(4500, 0), {
  amountWon: 4500, coverageRate: 0, shopWon: 0, opsWon: 4500,
})

console.log('\n분담 산식 — 어긋나면 안 되는 것')
{
  let drift = 0
  let mismatch = 0
  for (let a = 0; a <= 20000; a += 7) {
    for (const r of [0, 33, 60, 85, 99, 100]) {
      const s = cov.splitCoverage(a, r)
      // 두 몫의 합이 총액과 1원이라도 다르면 월 정산에서 설명할 수 없다
      if (s.shopWon + s.opsWon !== a) drift++
      // 보안 규칙(CEL 정수 나눗셈)과 한 자리라도 다르면 사용이 거절된다
      if (s.shopWon !== Math.trunc((a * r) / 100)) mismatch++
    }
  }
  eq('가게몫 + 운영사몫 = 총액', drift, 0)
  eq('규칙의 검산식과 일치', mismatch, 0)
}

console.log('\n시범운영 기본값')
eq('전 등급 충당률 0%', cov.DEFAULT_SETTLEMENT.coverage, { new: 0, basic: 0, premium: 0 })

console.log('\n월 상한 — 청구를 자르되 사용은 막지 않는다')
eq('막는 함수가 없다', typeof cov.wouldExceedCap, 'undefined')
{
  const st = cov.capStatus(24000, 30000)
  eq('80%에서 알림', [st.state, st.percent], ['alert', 80])
  eq('상한을 채우면 closed', cov.capStatus(31000, 30000).state, 'closed')
}

console.log('\n월 정산')
{
  const at = (d) => new Date(2026, 6, d).getTime()
  const rows = cov.settleMonth({
    merchants: [{
      shopId: 'cp1', name: '봉황1935', tier: 'basic', coverageRate: 60,
      joinedAt: null, graceUntil: null, monthlyCapWon: 3000,
      contract: 'active', active: true, feeWon: 10000,
    }],
    redemptions: [
      { shopId: 'cp1', kind: 'coupon', via: 'guest', amountWon: 4500, coverageRate: 60, shopWon: 2700, opsWon: 1800, usedAt: at(5) },
      { shopId: 'cp1', kind: 'points', via: 'staff', amountWon: 3000, coverageRate: 60, shopWon: 1800, opsWon: 1200, usedAt: at(9) },
      // 지난 달 건 — 이 달 정산에 섞이면 안 된다
      { shopId: 'cp1', kind: 'coupon', via: 'guest', amountWon: 4500, coverageRate: 60, shopWon: 2700, opsWon: 1800, usedAt: new Date(2026, 5, 9).getTime() },
    ],
    month: '2026-07',
  })
  const r = rows[0]
  eq('그 달 것만 센다', [r.count, r.couponCount, r.pointCount], [2, 1, 1])
  eq('스냅샷을 그대로 더한다', [r.amountWon, r.shopWon], [7500, 4500])
  eq('청구는 상한까지', [r.coveredWon, r.overCapWon], [3000, 1500])
  eq('넘은 몫은 운영사가', r.opsWon, 3000 + 1500)
  eq('청구 = 회비 + 청구충당', r.billedWon, 13000)
  eq('매출 유입을 함께 낸다', r.inflowWon, 7500)
  eq('이의 제기 마감은 익월 10일', new Date(cov.settlementDueAt('2026-07')).getMonth(), 7)
}

console.log('\n포인트 지갑 — 만료와 FIFO')
{
  const now = new Date(2026, 6, 30).getTime()
  const ago = (n) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d.getTime() }
  const earn = (id, points, months) => ({ refId: id, reason: 'mainMission', points, createdAt: ago(months) })
  const spend = (id, points) => ({ refId: id, reason: 'redeem', points: -points, createdAt: now })

  let w = pts.pointWallet([earn('a', 1000, 7), earn('b', 500, 1)], now)
  eq('6개월 지난 적립은 소멸', [w.total, w.expired], [500, 1000])

  w = pts.pointWallet([earn('a', 1000, 5), earn('b', 2000, 1), spend('s', 1200)], now)
  eq('FIFO — 먼저 받은 것부터', [w.total, w.spent], [1800, 1200])

  // 나중 것부터 썼다면 앞의 1,000P가 곧 만료된다. 먼저 쓰므로 그런 일이 없다
  w = pts.pointWallet([earn('a', 1000, 5), earn('b', 2000, 1), spend('s', 1000)], now)
  eq('만료 임박분이 먼저 나간다', [w.total, w.expired], [2000, 0])

  w = pts.pointWallet([earn('a', 3000, 1), spend('s', 1200)], now)
  eq('쓰고 나면 문턱 아래로', [w.redeemable, w.toThreshold], [false, 1200])

  w = pts.pointWallet([earn('a', 500, 1), spend('s', 500)], now)
  eq('전액 사용', [w.total, w.spent], [0, 500])

  eq('1p = 1원', pts.pointWallet([earn('a', 3500, 1)], now).won, 3500)

  pts.applyPointConfig({ missionPoints: 150, linePoints: 700, minRedeemPoints: 5000, pointExpiryMonths: 12 })
  eq('배점을 배포 없이 바꾼다', [pts.POINT_TABLE.mainMission, pts.POINT_TABLE.bonusMission, pts.POINT_TABLE.treasureLine], [150, 150, 700])
  eq('문턱·유효기간도', [pts.POINT_RULES.minRedeem, pts.POINT_RULES.expiryMonths], [5000, 12])
  eq('유효기간 12개월이면 7개월 전 적립도 산다', pts.pointWallet([earn('a', 1000, 7)], now).total, 1000)
}

rmSync(OUT, { recursive: true, force: true })

if (failed) {
  console.log(`\n❌ ${failed}건 어긋남`)
  process.exit(1)
}
console.log('\n✅ 정산 산식 검산 통과')
