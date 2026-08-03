/**
 * BEP 모델 ↔ 시뮬레이터 화면 대조.
 *
 * 계산이 두 곳에 산다 — `src/lib/bepModel.js`(서버·검증용)와
 * `public/bep/index.html` 안의 사본(화면). 하나로 합치지 못하는 이유는
 * HTML이 빌드 없이 파일 하나로도 열려야 해서다. 대신 **28개월 × 11개
 * 항목을 전부 대조**해서 둘이 갈라지는 순간 여기서 걸리게 한다.
 *
 * 사업비 충당액(`subsidy`)도 대조 항목에 넣는다. 손익만 보면 이중 충당이
 * 다른 항목과 상쇄돼 숨을 수 있다.
 *
 * 저장된 시나리오의 kpi는 서버가 모델로 다시 계산해 넣으므로, 둘이
 * 어긋나면 화면에서 본 숫자와 저장된 숫자가 조용히 달라진다.
 *
 *   npm run check:bep
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { runModel, DEFAULTS, migrateGrants } from '../src/lib/bepModel.js'

const ROOT = process.cwd()
const HTML = path.join(ROOT, 'public', 'bep', 'index.html')
const SEED = path.join(ROOT, 'docs', 'bep', 'seed-scenario.json')

const cur = JSON.parse(fs.readFileSync(SEED, 'utf8')).params

/** 지원사업 한 건 — 인정 항목은 지침에 맞춰 굿즈만 뺀다 */
const grant = (o) => ({
  id: 'g',
  name: '초기창업패키지',
  amount: 60000000,
  start: 202701,
  end: 202712,
  prob: 1,
  cover: { emp: true, rent: 800000, kit: true, gacha: true, goods: false },
  ...o,
})

/** 분기마다 산식이 갈리므로 한 자리씩 건드려 본다 */
const CASES = [
  ['기본값', {}],
  ['확정 반영안', cur],
  ['고정상한', { ...cur, capMode: 0, cap: 60 }],
  ['직접충당', { ...cur, covMode: 0, cov27: 0.6, cov28: 0.85 }],
  ['한도적용', { ...cur, useCap: 1, limP: 10000 }],
  ['상점포인트', { ...cur, ptMode: 0 }],
  // 지원사업이 비면 종전과 완전히 같아야 한다 — 기능을 더해도 옛 계획이 안 흔들린다
  ['지원사업 없음', { ...cur, grants: [] }],
  ['2027 단일', { ...cur, grants: [grant()] }],
  ['2027+2028', {
    ...cur,
    grants: [grant(), grant({ id: 'h', name: '후속', amount: 30000000, start: 202801, end: 202812 })],
  }],
  /*
    **이 케이스가 이 기능에서 가장 깨지기 쉽다.**
    같은 기간에 같은 항목을 충당하는 사업 둘을 넣는다. pool을 안 깎으면
    두 사업이 같은 인건비를 각각 덮어 충당액이 두 배가 되는데, 합계가
    그럴듯해서 다른 케이스로는 안 걸린다. 임차료도 같은 함정이 있다 —
    사업마다 적는 월세는 같은 사무실의 같은 월세다.
  */
  ['이중충당 방지', {
    ...cur,
    grants: [
      grant({ id: 'a', amount: 99000000 }),
      grant({ id: 'b', amount: 99000000 }),
    ],
  }],
  // 옛 시나리오(subCap 단일 pool)를 열어도 값이 살아 있어야 한다
  ['구버전 마이그레이션', {
    ...cur,
    grants: migrateGrants({
      subCap: 60000000, subS: 202701, subE: 202712,
      subEmp: 1, subRent: 800000, subK: 1, subA: 1, subG: 0,
    }),
  }],
]

/** 매출·원가·고정비·손익·누적·현금·가맹점·충당률·뽑기원가·포인트원가 */
const pick = (r) => [
  r.ym,
  Math.round(r.rev),
  Math.round(r.cost),
  Math.round(r.fix),
  Math.round(r.pl),
  Math.round(r.cum),
  Math.round(r.cash),
  +r.g.toFixed(3),
  +r.cov.toFixed(4),
  Math.round(r.gaCost),
  Math.round(r.ptApp),
  Math.round(r.subsidy),
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(HTML).href)
await page.waitForFunction(() => typeof window.calc === 'function' && Array.isArray(window._rows))

let bad = 0
for (const [label, overrides] of CASES) {
  const html = await page.evaluate((o) => {
    setAll({ ...DEF, ...o })
    calc()
    return window._rows.map((r) => [
      r.ym,
      Math.round(r.rev),
      Math.round(r.cost),
      Math.round(r.fix),
      Math.round(r.pl),
      Math.round(r.cum),
      Math.round(r.cash),
      +r.g.toFixed(3),
      +r.cov.toFixed(4),
      Math.round(r.gaCost),
      Math.round(r.ptApp),
      Math.round(r.subsidy),
    ])
  }, overrides)

  const model = runModel({ ...DEFAULTS, ...overrides }).rows.map(pick)

  const diff = []
  html.forEach((h, i) => {
    h.forEach((v, j) => {
      if (v !== model[i]?.[j]) diff.push(`${h[0]} col${j}: 화면=${v} 모델=${model[i]?.[j]}`)
    })
  })

  console.log(
    label.padEnd(12),
    diff.length ? `❌ ${diff.length}건` : '✅ 완전 일치',
    diff.slice(0, 3).join(' | ')
  )
  if (diff.length) bad += 1
}

await browser.close()

if (bad) {
  console.error(`\n${bad}개 시나리오에서 화면과 모델이 갈라졌다.`)
  process.exit(1)
}
console.log(`\n${CASES.length}개 시나리오 모두 화면과 모델이 같다.`)
