/**
 * BEP 모델 ↔ 시뮬레이터 화면 대조.
 *
 * 계산이 두 곳에 산다 — `src/lib/bepModel.js`(서버·검증용)와
 * `public/bep/index.html` 안의 사본(화면). 하나로 합치지 못하는 이유는
 * HTML이 빌드 없이 파일 하나로도 열려야 해서다. 대신 **28개월 × 10개
 * 항목을 전부 대조**해서 둘이 갈라지는 순간 여기서 걸리게 한다.
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
import { runModel, DEFAULTS } from '../src/lib/bepModel.js'

const ROOT = process.cwd()
const HTML = path.join(ROOT, 'public', 'bep', 'index.html')
const SEED = path.join(ROOT, 'docs', 'bep', 'seed-scenario.json')

const cur = JSON.parse(fs.readFileSync(SEED, 'utf8')).params

/** 분기마다 산식이 갈리므로 한 자리씩 건드려 본다 */
const CASES = [
  ['기본값', {}],
  ['확정 반영안', cur],
  ['고정상한', { ...cur, capMode: 0, cap: 60 }],
  ['직접충당', { ...cur, covMode: 0, cov27: 0.6, cov28: 0.85 }],
  ['한도적용', { ...cur, useCap: 1, limP: 10000 }],
  ['상점포인트', { ...cur, ptMode: 0 }],
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
console.log('\n여섯 시나리오 모두 화면과 모델이 같다.')
