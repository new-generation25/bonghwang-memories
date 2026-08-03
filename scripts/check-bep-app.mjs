/**
 * 앱 ↔ BEP 대조 — 시뮬레이터의 기본값이 앱이 실제로 내보내는 것과 같은가.
 *
 * `check:bep`은 모델(bepModel.js)과 화면(bep/index.html) 두 사본을 맞춰 본다.
 * 둘이 아무리 같아도 **앱이 다른 것을 나눠 주고 있으면** 손익은 틀린다.
 *
 * 실제로 틀려 있었다. 8/2 확정안은 뽑기 실물을 15%·1,500원으로 잡았는데
 * 판은 50칸 중 19칸(38%)이 안내소 교환 실물이다. 상품표를 고칠 때마다
 * 사람이 BEP를 따라 고칠 것이라고 기대하면 안 된다 — 아무도 안 고친다.
 *
 * 여기서 막는 것과 알리기만 하는 것을 갈랐다.
 *  · **막는다** — 상품표에서 기계적으로 나오는 값(뽑기). 사람이 정할 여지가 없다
 *  · **알린다** — 협의로 정하는 값(쿠폰 액면·포인트 배점). 다른 데는 이유가
 *    있을 수 있다. 예컨대 쿠폰 액면은 2단 상품 기준으로 세운 값이라
 *    거점 쿠폰 합계와 같을 의무가 없다
 *
 *   npm run check:bep:app
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

import { DEFAULTS } from '../src/lib/bepModel.js'

const OUT = join(tmpdir(), 'bh-bep-app-check')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// npx가 아니라 tsc를 node로 직접 부른다 — 윈도우에서 .cmd 실행이 막힌다
execFileSync(
  process.execPath,
  [
    join('node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/gacha.ts',
    'src/lib/coupons.ts',
    '--outDir',
    OUT,
    // CommonJS로 뽑는다 — ESM은 확장자 없는 './coupons'를 못 찾는다
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

const require = createRequire(import.meta.url)
const { gachaEconomics } = require(join(OUT, 'gacha.js'))
const { COUPONS } = require(join(OUT, 'coupons.js'))

const ga = gachaEconomics()
const won = (n) => Math.round(n).toLocaleString('ko-KR')

/* ── 막는 것 — 상품표에서 기계적으로 나오는 값 ── */

const blocking = [
  ['gaP', '뽑기 실물 당첨 비중', DEFAULTS.gaP, ga.physicalShare, 0.005],
  ['gaC', '뽑기 실물 평균 원가', DEFAULTS.gaC, ga.avgPhysicalCost, 1],
]

let failed = 0
console.log('── 상품표에서 나오는 값 (어긋나면 막는다)')
for (const [key, label, bep, app, tol] of blocking) {
  const ok = Math.abs(bep - app) <= tol
  if (!ok) failed += 1
  console.log(
    `   ${ok ? '✅' : '❌'} ${key.padEnd(5)} ${label.padEnd(18)} BEP ${String(bep).padStart(8)}   앱 ${String(app).padStart(8)}`
  )
}

if (ga.missingCost.length) {
  console.log(
    `\n   ⚠️  원가(costWon)를 안 적은 실물이 ${ga.missingCost.length}개 있어 액면으로 대신 셌다: ${ga.missingCost.join(' ')}`
  )
  console.log('      액면은 원가보다 크므로 손익이 실제보다 나빠 보인다. 값을 알면 coupons.ts에 채워라.')
}

/* ── 알리는 것 — 협의로 정하는 값 ── */

const stationFace = Object.values(COUPONS)
  .filter((c) => c.track > 0)
  .reduce((n, c) => n + c.unitWon, 0)

console.log('\n── 협의로 정하는 값 (다를 수 있다 — 알리기만 한다)')
console.log(
  `   쿠폰 액면        BEP ${won(DEFAULTS.cp).padStart(8)}원   앱 거점 쿠폰 합계 ${won(stationFace).padStart(8)}원`
)
console.log(
  `   한 판 가게 쿠폰 액면 기대값  ${won(ga.shopCouponFacePerDraw)}원  ·  포인트 기대값 ${won(ga.pointsPerDraw)}p`
)
console.log(
  `   └ 뽑기 ${DEFAULTS.gaN}판이면 팀당 쿠폰 ${won(ga.shopCouponFacePerDraw * DEFAULTS.gaN)}원 · 포인트 ${won(ga.pointsPerDraw * DEFAULTS.gaN)}p가 더 나간다.`
)
console.log('     BEP의 useCpn·pointEconomics는 이것을 안 세고 있다 — 거점 쿠폰과 미션 적립만 본다.')

if (failed) {
  console.log(`\n❌ ${failed}개가 앱과 어긋난다. bepModel.js와 bep/index.html의 기본값을 고쳐라.`)
  process.exit(1)
}
console.log('\n✅ 상품표에서 나오는 값은 BEP와 같다.')
