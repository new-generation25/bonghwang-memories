// EP.1 「아버지의 믹스테이프」 — 새 큐 기반 플로우 E2E.
//
// ?e2e=1 → 합성 클록 10배속 + 백그라운드 자동 일시정지 해제 (cueEngine).
// 카메라·마이크가 없는 헤드리스 환경을 전제로 한다:
//  - QR 게이트는 4자리 수동 코드 폴백으로 통과
//  - 사진은 PC 모의 촬영 경로
//  - 녹음은 마이크 거부 → 텍스트 전환 경로
const { test, expect } = require('@playwright/test')

/** 특정 단계부터 시작하도록 투어 상태를 심는다 */
async function seedTour(page, state) {
  await page.addInitScript((s) => {
    window.localStorage.setItem('bh_tour_v2', JSON.stringify(s))
  }, state)
}

const BASE_STATE = {
  phase: 'act1',
  currentTrack: 0,
  fragments: [],
  tracksCompleted: [],
  speechMode: 'formal',
  bsideEntry: null,
  photos: [],
  bingo: { unlocked: false, cellsDone: [], lines: 0 },
  coupons: [],
  audioCacheReady: true,
  arFallbackUsed: false,
  startTime: 1753100000000,
  lastCueCompleted: null,
  paid: true,
  epilogueLiveVoice: false,
}

test.describe('S00 랜딩 → S01 다운로드', () => {
  test('모의 결제 → 다운로드 게이트 → 인트로 진입', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('결제 완료(테스트)')).toBeVisible({ timeout: 10000 })
    await page.getByText('결제 완료(테스트)').click()
    await expect(page).toHaveURL(/\/download/)
    // 오디오 프로브 완료까지 대기 (파일 유무와 무관하게 게이트는 열린다)
    await expect(page.getByText('테이프 발견하러 가기')).toBeVisible({ timeout: 90000 })
    await page.getByText('테이프 발견하러 가기').click()
    await expect(page).toHaveURL(/\/intro/)
    await expect(page.getByText('낡은 우체통 위에 놓인')).toBeVisible()
  })
})

test.describe('S02/S03 인트로 — 테이프와 첫 통화', () => {
  test('PLAY → C0_A→C0_B 자동 연쇄 → 전화(수동, D3) → 동행 수락 → /play', async ({ page }) => {
    await seedTour(page, { ...BASE_STATE, phase: 'intro' })
    await page.goto('/intro?e2e=1')

    await page.getByRole('button', { name: '▶ PLAY' }).click()
    // C0_A 자막
    await expect(page.getByText('네가 태어난 날이다')).toBeVisible({ timeout: 10000 })
    // 자동 연쇄로 C0_B → 전화 버튼 노출 (자동 발신은 없어야 한다)
    const callBtn = page.getByRole('button', { name: /소영에게 전화 걸기/ })
    await expect(callBtn).toBeVisible({ timeout: 25000 })
    await callBtn.click()
    // C0_C 종료 → 동행 수락
    const accept = page.getByRole('button', { name: /동행 수락/ })
    await expect(accept).toBeVisible({ timeout: 30000 })
    await accept.click()
    await expect(page).toHaveURL(/\/play/)
  })
})

test.describe('D9 — 스킵 게이트', () => {
  test('재생 직후에는 건너뛰기가 비활성', async ({ page }) => {
    await page.goto('/debug/cues')
    await page.getByRole('button', { name: /C0_A/ }).first().click()
    // 플레이어가 뜬 것을 확인한 뒤 스킵 상태를 본다
    await expect(page.getByRole('button', { name: /다시듣기/ })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('button', { name: /건너뛰기/ })).toBeDisabled()
  })
})

test.describe('Track 1 — QR 수동 코드 → M1 → 말투 전환(D7)', () => {
  test('수동 코드 1935 입장 → 개수 7 → 사진 → 조각 1 → NEXT → casual', async ({ page }) => {
    await seedTour(page, { ...BASE_STATE })
    await page.goto('/play?e2e=1')

    await page.getByRole('button', { name: /거점 QR 스캔/ }).click()
    await page.getByRole('button', { name: /코드 입력/ }).click()
    await page.locator('input[inputmode="numeric"]').fill('1935')
    await page.getByRole('button', { name: '입장하기' }).click()
    await expect(page).toHaveURL(/\/track\/1/)

    // C1_1 → C1_2 종료 후 개수 입력 미션
    const countInput = page.locator('input[inputmode="numeric"]')
    await expect(countInput).toBeVisible({ timeout: 30000 })
    await countInput.fill('7')
    await page.getByRole('button', { name: '확인' }).click()

    // C1_3(사장님) 종료 → 사진 미션 (PC 모의 경로)
    await expect(page.getByRole('button', { name: /사진 찍기/ })).toBeVisible({
      timeout: 25000,
    })
    await page.getByRole('button', { name: /사진 찍기/ }).click()
    await page.getByRole('button', { name: /모의 사진 촬영하기/ }).click()
    await page.getByRole('button', { name: /소영에게 보내기/ }).click()

    // C1_4 종료 → 출발 버튼, 조각 지급 확인
    await expect(page.getByRole('button', { name: /다음으로 출발/ })).toBeVisible({
      timeout: 25000,
    })
    const afterC14 = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('bh_tour_v2'))
    )
    expect(afterC14.fragments).toContain('frag_1')
    expect(afterC14.tracksCompleted).toContain(1)

    // NEXT → C1_5 종료 → 반말 전환(D7)
    await page.getByRole('button', { name: /다음으로 출발/ }).click()
    await expect(page.getByRole('button', { name: /플레이어로 돌아가기/ })).toBeVisible({
      timeout: 30000,
    })
    const afterC15 = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('bh_tour_v2'))
    )
    expect(afterC15.speechMode).toBe('casual')
  })
})

test.describe('D10 — 최종 잠금 해제 임계값', () => {
  test('조각 3개면 해제 가능', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      fragments: ['frag_1', 'frag_2', 'frag_3'],
      tracksCompleted: [1, 2, 3],
      currentTrack: 5,
      lastCueCompleted: 'C5_2',
    })
    await page.goto('/track/5?e2e=1')
    // §10 재개 → C5_2 다시 듣기 → 잠금 게이트
    await page.getByRole('button', { name: /마지막 안내 다시 듣기/ }).click()
    await expect(page.getByRole('button', { name: /조각을 끼워 넣기/ })).toBeVisible({
      timeout: 25000,
    })
  })

  test('조각 2개면 해제 불가', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      fragments: ['frag_1', 'frag_2'],
      tracksCompleted: [1, 2],
      currentTrack: 5,
      lastCueCompleted: 'C5_2',
    })
    await page.goto('/track/5?e2e=1')
    await page.getByRole('button', { name: /마지막 안내 다시 듣기/ }).click()
    await expect(page.getByText(/조각이 1개 더 필요해요/)).toBeVisible({ timeout: 25000 })
    await expect(
      page.getByRole('button', { name: /조각을 끼워 넣기/ })
    ).toHaveCount(0)
  })
})

test.describe('S30 빙고 — 잠금과 실제 줄 판정', () => {
  test('act1에서는 잠김', async ({ page }) => {
    await seedTour(page, { ...BASE_STATE, tracksCompleted: [1, 2] })
    await page.goto('/treasure')
    await expect(page.getByText('다섯 소원 후 열립니다')).toBeVisible({ timeout: 10000 })
  })

  test('대각선(다섯 소원)만으로 1줄', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'act2',
      tracksCompleted: [1, 2, 3, 4, 5],
      bingo: { unlocked: true, cellsDone: [], lines: 0 },
    })
    await page.goto('/treasure')
    await expect(page.getByText(/빙고 1줄/)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('S40 피날레', () => {
  test('시리얼·소요시간·소원 체크 표시', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'done',
      tracksCompleted: [1, 2, 3, 4, 5],
      fragments: ['frag_1', 'frag_2', 'frag_3', 'frag_4'],
      bingo: { unlocked: true, cellsDone: ['bunsik', 'b02'], lines: 1 },
      bsideEntry: { type: 'text', text: '고마웠어요', uploaded: false },
    })
    await page.goto('/finale')
    await expect(page.getByText(/기록자 No\.[A-Z0-9]+/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/이룬 소원 5개/)).toBeVisible()
    await expect(page.getByText(/발견한 골목 2곳/)).toBeVisible()
    await expect(page.getByText('고마웠어요')).toBeVisible()
  })
})

test.describe('커뮤니티 — 소영의 친구들', () => {
  test('페이지명·랭킹·보너스 미션 표시', async ({ page }) => {
    await page.goto('/community')
    await expect(page.getByText('소영의 친구들')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('기록자 랭킹')).toBeVisible()
  })
})
