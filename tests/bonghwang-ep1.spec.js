// EP.1 「아버지의 믹스테이프」 — 큐 기반 플로우 E2E.
//
// ?e2e=1 → 합성 클록 10배속 + 백그라운드 자동 일시정지 해제 (cueEngine).
// 카메라·마이크가 없는 헤드리스 환경을 전제로 한다:
//  - QR 게이트는 4자리 수동 코드 폴백으로 통과 (dev 빌드는 코드 입력이 기본)
//  - 사진은 PC 모의 촬영 경로
//  - 슈퍼관리자 모드는 리허설 빌드에서 계정 없이 켜진다(superAdmin.ts)
//
// 이 스위트는 dev 서버(REHEARSAL)를 전제로 한다. 프로덕션 빌드에서는
// 카메라 스캔이 켜지고 슈퍼관리자가 관리자 계정을 요구하므로 통과하지 않는다.
const { test, expect } = require('@playwright/test')

/** 특정 단계부터 시작하도록 투어 상태를 심는다 */
async function seedTour(page, state) {
  await page.addInitScript((s) => {
    window.localStorage.setItem('bh_tour_v2', JSON.stringify(s))
  }, state)
}

/** 슈퍼관리자 스위치를 미리 켠 채로 연다 */
async function seedSuperAdmin(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('bh_super_admin', '1')
  })
}

/** 기기에 쌓인 계측 이벤트 이름들 */
async function eventNames(page) {
  return page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('bh_analytics_v1') || '[]').map(
      (e) => e.name
    )
  )
}

const BASE_STATE = {
  phase: 'act1',
  currentTrack: 0,
  tracksCompleted: [],
  speechMode: 'formal',
  speechConsent: null,
  bsideEntry: null,
  photos: [],
  bingo: { unlocked: false, cellsDone: [], lines: 0 },
  coupons: [],
  hintsUsed: [],
  hiddenFound: [],
  hiddenUnlocked: false,
  entryVia: null,
  audioCacheReady: true,
  arFallbackUsed: false,
  startTime: 1753100000000,
  lastCueCompleted: null,
  paid: true,
  epilogueLiveVoice: false,
}

/** 거점 QR 게이트를 수동 코드로 통과한다 */
async function enterStation(page, code) {
  await page.getByRole('button', { name: /거점 QR 스캔/ }).click()
  await page.getByPlaceholder('0000').fill(code)
  await page.getByRole('button', { name: '입장하기' }).click()
}

test.describe('S02/S03 인트로 — 테이프와 첫 통화', () => {
  /*
    ?e2e=1의 10배속은 합성 클록에만 걸린다. 음성 파일이 있으면 실제
    길이대로 재생되므로(B0_TAPE 59초 + B0_CALL 79초) 넉넉히 기다린다.
  */
  test('PLAY → B0_TAPE → 전화(수동, D3) → B0_CALL → 동행 시작 → /play', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await seedTour(page, { ...BASE_STATE, phase: 'intro' })
    await page.goto('/intro?e2e=1')

    await page.getByRole('button', { name: '재생 — 눌러주세요' }).click()
    // B0_TAPE 자막 — 아버지의 첫 마디
    await expect(page.getByText(/잘 돌아가나, 이거/)).toBeVisible({ timeout: 15000 })

    // 자동 발신은 없어야 한다(D3) — 참여자가 직접 건다
    const callBtn = page.getByRole('button', { name: /소영에게 전화 걸기/ })
    await expect(callBtn).toBeVisible({ timeout: 90000 })
    await callBtn.click()

    // B0_CALL 종료 → 동행 시작
    const go = page.getByRole('button', { name: /동행 시작/ })
    await expect(go).toBeVisible({ timeout: 120000 })
    await go.click()
    await expect(page).toHaveURL(/\/play/)
  })
})

/*
  D9 — 다시듣기는 무제한, 자동재생은 없다.

  '재생 15초 후 스킵'은 엔진의 skipCue()에만 남아 있고 화면에는 그 키가
  없다. 데크의 FF는 자막 한 줄 넘기기(skipLine)이고 STOP은 끝까지 들은
  것과 같게 끝낸다(endCue) — 둘 다 15초 제한을 받지 않는 것이 의도다
  ("눌리지 않는 STOP은 고장 난 기계로 읽힌다", CuePlayer 주석).
  명세(CLAUDE.md D9)와 구현이 이 대목에서 갈려 있으니, 어느 쪽을 원본으로
  둘지는 사람이 정해야 한다.
*/
test.describe('D9 — 다시듣기와 자동재생 금지', () => {
  test('재생 중에도 다시듣기는 늘 눌린다', async ({ page }) => {
    await page.goto('/debug/cues')
    await page.getByRole('button', { name: 'tap:PLAY' }).first().click()
    await expect(page.getByRole('button', { name: '다시듣기' })).toBeEnabled({
      timeout: 15000,
    })
  })

  test('거점에 들어가도 스스로 재생되지 않는다 — 탭이 있어야 시작한다', async ({
    page,
  }) => {
    await seedTour(page, {
      ...BASE_STATE,
      tracksCompleted: [1, 2, 3],
      currentTrack: 4,
      speechMode: 'casual',
      lastCueCompleted: 'B4_A',
    })
    await page.goto('/track/4?e2e=1')

    // §10 재개 화면 — 눌러야 소리가 난다
    await expect(
      page.getByRole('button', { name: /마지막 안내 다시 듣기/ })
    ).toBeVisible({ timeout: 15000 })
    expect(await page.evaluate(() => window.__bhPlaying === true)).toBe(false)
  })
})

test.describe('Track 1 — 미션 전 구간과 말 놓기 분기(D7)', () => {
  /** 코드 입장 → 개수 7 → 사장님 증언 → 사진까지. 말 놓기 물음 직전에서 멈춘다 */
  async function walkTrack1(page) {
    await page.goto('/play?e2e=1')
    await enterStation(page, '1935')

    // B1_A 종료 → 개수 입력
    const count = page.getByPlaceholder('?')
    await expect(count).toBeVisible({ timeout: 40000 })
    await count.fill('7')
    await page.getByRole('button', { name: '확인' }).click()

    // B1_OK 종료 → 사장님 이야기 듣기
    const listen = page.getByRole('button', { name: /사장님의 이야기 듣기/ })
    await expect(listen).toBeVisible({ timeout: 30000 })
    await listen.click()

    // B1_S 종료 → 사진 미션
    const shoot = page.getByRole('button', { name: /사진 찍기/ })
    await expect(shoot).toBeVisible({ timeout: 60000 })
    await shoot.click()
    await page.getByRole('button', { name: /모의 사진 촬영하기/ }).click()
    await page.getByRole('button', { name: /소영에게 사진 보내기/ }).click()
  }

  test('승낙 → B1_YES → 반말 전환', async ({ page }) => {
    await seedTour(page, { ...BASE_STATE })
    await walkTrack1(page)

    // B1_B가 물음으로 끝나면 창이 올라온다
    const ask = page.getByRole('button', { name: /그래요/ })
    await expect(ask).toBeVisible({ timeout: 60000 })
    await ask.click()

    // B1_YES 자막 — 승낙에만 나오는 대사
    await expect(page.getByText(/이제 말 놓을게/)).toBeVisible({ timeout: 20000 })

    const state = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('bh_tour_v2'))
    )
    expect(state.tracksCompleted).toContain(1)
    expect(state.speechConsent).toBe('yes')

    // D7 — 번들이 끝나야 지시자가 돌아 반말로 굳는다
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(() =>
              JSON.parse(window.localStorage.getItem('bh_tour_v2'))
            )
          ).speechMode,
        { timeout: 40000 }
      )
      .toBe('casual')
  })

  test('거절 → B1_NO → 다시 청하고, 그래도 반말로 간다', async ({ page }) => {
    await seedTour(page, { ...BASE_STATE })
    await walkTrack1(page)

    const no = page.getByRole('button', { name: /아니요/ })
    await expect(no).toBeVisible({ timeout: 60000 })
    await no.click()

    // B1_NO 자막 — 거절에만 나오는 대사
    await expect(page.getByText(/친구가 되어주면 좋겠는데/)).toBeVisible({
      timeout: 20000,
    })
    // 승낙 대사는 나오지 않는다
    await expect(page.getByText(/이제 말 놓을게/)).toHaveCount(0)

    // D7 — 거절해도 전환은 일어난다(뒤의 대사가 전부 반말이다)
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(() =>
              JSON.parse(window.localStorage.getItem('bh_tour_v2'))
            )
          ).speechMode,
        { timeout: 45000 }
      )
      .toBe('casual')

    const after = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('bh_tour_v2'))
    )
    expect(after.speechConsent).toBe('no')
  })
})

test.describe('거점 순서 — 강제하지 않는다', () => {
  test('트랙 2·3을 건너뛰고 트랙 4로 입장할 수 있다', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      tracksCompleted: [1],
      speechMode: 'casual',
      speechConsent: 'yes',
    })
    await page.goto('/play?e2e=1')
    await enterStation(page, '8890')

    await expect(page).toHaveURL(/\/track\/4/, { timeout: 15000 })
    await expect(page.getByText(/창가 자리/)).toBeVisible({ timeout: 20000 })
  })

  test('이미 이룬 소원의 거점은 거절한다', async ({ page }) => {
    await seedTour(page, { ...BASE_STATE, tracksCompleted: [1] })
    await page.goto('/play?e2e=1')
    await enterStation(page, '1935')

    await expect(page.getByText(/이미 이뤘어요/)).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/play/)
  })
})

test.describe('F-1 J-카드 — 진행도이자 수집첩', () => {
  test('이룬 소원에 밑줄, 다섯째 줄은 아버지의 몫', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      tracksCompleted: [1, 2],
      speechMode: 'casual',
    })
    await page.goto('/play?e2e=1')

    await expect(page.getByText('SIDE A · 다섯 가지 소원')).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('2 / 4 + 1')).toBeVisible()
    await expect(page.getByText('아버지의 몫')).toBeVisible()
    // 결말을 미리 새기지 않는다
    await expect(page.getByText('다음 주, 아빠와 소영')).toHaveCount(0)
  })
})

test.describe('D10 — B면 해제 임계값 (J-카드 소원 3개)', () => {
  test('소원 3개면 해제 가능', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      tracksCompleted: [1, 2, 3],
      currentTrack: 5,
      speechMode: 'casual',
      lastCueCompleted: 'B5_T3',
    })
    /*
      §10 재개 — 마지막 큐(B5_T3)를 기준으로 잠금 게이트가 바로 올라온다.
      화면 아래 '마지막 안내 다시 듣기'는 그 게이트가 덮고 있으므로 누르지
      않는다.
    */
    await page.goto('/track/5?e2e=1')
    await expect(
      page.getByRole('button', { name: /이룬 소원 세어보기/ })
    ).toBeVisible({ timeout: 30000 })
  })

  test('소원 2개면 해제 불가', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      tracksCompleted: [1, 2],
      currentTrack: 5,
      speechMode: 'casual',
      lastCueCompleted: 'B5_T3',
    })
    await page.goto('/track/5?e2e=1')
    await expect(page.getByText(/소원이 1개 더 필요해요/)).toBeVisible({
      timeout: 30000,
    })
    await expect(
      page.getByRole('button', { name: /이룬 소원 세어보기/ })
    ).toHaveCount(0)
  })
})

/*
  슈퍼관리자 모드.

  켜는 자리는 [나의 기록 → ⚙ 설정]인데 그 시트는 로그인해야 열린다.
  E2E는 구글 OAuth를 통과할 수 없고 계정 비밀번호를 저장소에 둘 수도
  없으므로, 스위치는 저장값으로 심고 패널은 전역 이벤트로 연다 —
  설정 시트가 실제로 하는 일과 같다(SettingsSheet → openSuperAdminPanel).
*/
async function openSuperPanel(page) {
  /*
    하이드레이션 전에 쏜 이벤트는 리스너가 없어 사라진다. 패널이 뜰 때까지
    다시 쏜다 — 사용자는 버튼이 그려진 뒤에 누르므로 실제로는 없는 상황이다.
  */
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.dispatchEvent(new Event('bh:super-panel'))
        )
        return page.getByText('🔓 순서 무시 조작').isVisible()
      },
      { timeout: 20000 }
    )
    .toBe(true)
}

test.describe('슈퍼관리자 모드 — 순서 무시 조작', () => {
  test('조작 패널 → 트랙 5까지 완료 → 빙고 개방', async ({ page }) => {
    await seedSuperAdmin(page)
    await seedTour(page, { ...BASE_STATE })
    await page.goto('/play?e2e=1')

    await openSuperPanel(page)
    // 트랙 5까지 완료 처리 — 쿠폰은 여기서 나오지 않는다(빙고 첫 줄에서 준다)
    await page.getByRole('button', { name: '~A5' }).click()

    const state = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('bh_tour_v2'))
    )
    expect(state.tracksCompleted).toEqual([1, 2, 3, 4, 5])
    // J-카드가 트랙 완료에서 파생된다 — 별도 상태 없이 네 줄이 다 찬다
    await expect(page.getByText('4 / 4 + 1')).toBeVisible({ timeout: 10000 })

    // 빙고 열기 → 2막 화면
    await openSuperPanel(page)
    await page.getByRole('button', { name: /빙고 열기/ }).click()
    await expect(page).toHaveURL(/\/treasure/, { timeout: 15000 })
  })

  test('거점으로 이동 — QR 없이 도착 큐가 시작된다', async ({ page }) => {
    await seedSuperAdmin(page)
    await seedTour(page, { ...BASE_STATE, speechMode: 'casual' })
    await page.goto('/play?e2e=1')

    await openSuperPanel(page)
    await page.getByRole('button', { name: 'A3', exact: true }).click()

    await expect(page).toHaveURL(/\/track\/3/, { timeout: 15000 })
    // B3_A 도착 큐가 재생된다
    await expect(page.getByText(/능소화/).first()).toBeVisible({ timeout: 20000 })
  })

  test('앱바가 레드로 바뀐다 — 어느 화면에 있든 상태가 먼저 읽힌다', async ({
    page,
  }) => {
    await seedSuperAdmin(page)
    await seedTour(page, { ...BASE_STATE })
    await page.goto('/play?e2e=1')

    await expect
      .poll(
        async () =>
          await page.evaluate(() =>
            document.documentElement.classList.contains('super-admin')
          ),
        { timeout: 10000 }
      )
      .toBe(true)
  })
})

test.describe('S30 빙고 — 대각선은 다섯 소원이 채운다', () => {
  /*
    보상 흐름이 하나다 — 빙고 한 줄 → 뽑기 한판 → 판에서 한 칸 → 쿠폰.
    첫 줄도 예외가 아니다. 예전에는 여기서 가게 쿠폰 다섯 장을 한꺼번에
    냈는데, 보상 자리가 둘로 갈려 있으면 무엇으로 무엇을 받는지 흐려진다.
  */
  test('대각선만으로 1줄 · 그 줄에서 뽑기 한판이 나온다', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'act2',
      tracksCompleted: [1, 2, 3, 4, 5],
      speechMode: 'casual',
      bingo: { unlocked: true, cellsDone: [], lines: 0 },
    })
    await page.goto('/treasure?e2e=1')
    await expect(page.getByText(/1줄/).first()).toBeVisible({ timeout: 15000 })

    // 첫 줄에도 이용권이 한 장
    await expect(
      page.getByRole('button', { name: /뽑기 한판 1장 있어요/ })
    ).toBeVisible({ timeout: 15000 })

    // 쿠폰은 뽑기로만 나온다 — 줄을 채웠다고 지갑에 들어오지 않는다
    const coupons = await page.evaluate(
      () => JSON.parse(window.localStorage.getItem('bh_tour_v2')).coupons
    )
    expect(coupons).toEqual([])
  })

  test("카탈로그에 없는 옛 'bingo-line-N'은 걸러진다", async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'act2',
      tracksCompleted: [1, 2, 3, 4, 5],
      speechMode: 'casual',
      bingo: { unlocked: true, cellsDone: [], lines: 1 },
      coupons: ['cp1', 'bingo-line-1', 'bingo-line-2'],
    })
    await page.goto('/treasure?e2e=1')

    await expect
      .poll(
        async () =>
          (
            await page.evaluate(() =>
              JSON.parse(window.localStorage.getItem('bh_tour_v2'))
            )
          ).coupons.filter((c) => c.startsWith('bingo-line')),
        { timeout: 15000 }
      )
      .toEqual([])
  })
})

test.describe('골목 뽑기 — 추가 빙고 한 줄에 한 번', () => {
  /** 대각선 + 첫 행(0~4) = 2줄. 1·2·3번 칸이 act2 셀이다 */
  const TWO_LINES = {
    unlocked: true,
    cellsDone: ['bunsik', 'b02', 'byeokhwa', 'b04'],
    lines: 0,
  }

  test('두 줄이면 이용권 2장 — 한 칸을 열면 한 장이 준다', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'act2',
      tracksCompleted: [1, 2, 3, 4, 5],
      speechMode: 'casual',
      bingo: TWO_LINES,
    })
    /*
      빙고판은 받은 것을 알리기만 하고 「나의 기록」으로 보낸다 —
      판을 여는 곳은 쿠폰·포인트가 있는 자리여야 한 번에 끝난다.
    */
    await page.goto('/treasure?e2e=1')
    const notice = page.getByRole('button', { name: /뽑기 한판 2장 있어요/ })
    await expect(notice).toBeVisible({ timeout: 15000 })
    await notice.click()
    await expect(page).toHaveURL(/\/me/, { timeout: 10000 })

    const open = page.getByRole('button', { name: /뽑기 한판 2장 있어요/ })
    await expect(open).toBeVisible({ timeout: 15000 })
    await open.click()

    // 참여자가 칸을 직접 고른다 — 기계가 뽑아주지 않는다
    await page.getByRole('button', { name: '23번 칸', exact: true }).click()
    /*
      여는 연출 뒤에 결과가 선다. 이용권이 남아 있으므로 '받기'가 아니라
      '한 판 더'다 — 한 장 쓸 때마다 판을 닫으면 남은 장수를 참여자가 센다.
    */
    const again = page.getByRole('button', { name: /한 판 더/ })
    await expect(again).toBeVisible({ timeout: 15000 })
    await expect(again).toContainText('1장 남음')

    const drawn = await page.evaluate(
      () => JSON.parse(window.localStorage.getItem('bh_tour_v2')).gachaDrawn
    )
    // 고른 칸이 그대로 열려야 한다(0-based라 23번 칸 = 22)
    expect(drawn).toEqual([22])

    // 한 판 더 → 판이 그대로 열려 있고, 방금 연 칸은 '뽑음'으로 남는다
    await again.click()
    await expect(
      page.getByRole('button', { name: '23번 칸 — 이미 열었어요' })
    ).toBeDisabled()
    // 남은 이용권은 판 위에서 바로 읽힌다
    await expect(page.getByText(/🎟 이용권 1장/)).toBeVisible()

    // 닫으면 빙고판으로 — 한 장을 썼으니 한 장이 남는다
    await page.getByRole('button', { name: '닫기' }).click()
    await expect(
      page.getByRole('button', { name: /뽑기 한판 1장 있어요/ })
    ).toBeVisible({ timeout: 10000 })
  })

  /*
    뽑기에서 나오는 것은 쿠폰이다 — 지갑에 들어가 가게나 안내소에서 쓴다.
    포인트만 예외로 적립 쪽에 남는다.
  */
  test('뽑은 쿠폰은 지갑에 들어간다', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'act2',
      tracksCompleted: [1, 2, 3, 4, 5],
      speechMode: 'casual',
      bingo: { ...TWO_LINES, lines: 2 },
      // 판 배치는 계정마다 섞인다. 여기서 보는 것은 '지갑에 한 장이 섰는가'다
      gachaDrawn: [0],
    })
    await page.goto('/me?e2e=1')
    await expect(page.getByText('🎟 받은 쿠폰')).toBeVisible({ timeout: 15000 })

    /*
      뽑은 것이 어느 한쪽에는 서야 한다 — 쿠폰이면 지갑 카드로, 포인트면
      적립 쪽으로. 어느 상품이 나오는지는 판 배치(시드)에 달렸으므로
      상품 이름으로 걸지 않는다. 상품표가 바뀔 때마다 깨지기 때문이다.
    */
    const landed = page.locator(
      'button:has-text("열기"), h2:has-text("뽑기로 받은 포인트")'
    )
    await expect(landed.first()).toBeVisible({ timeout: 15000 })
  })

  test('판은 50칸 — 상품 slots 합이 모자라면 여기서 드러난다', async ({
    page,
  }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'act2',
      tracksCompleted: [1, 2, 3, 4, 5],
      speechMode: 'casual',
      // /me는 줄 판정을 다시 하지 않고 빙고판이 저장해둔 줄 수를 읽는다
      bingo: { ...TWO_LINES, lines: 2 },
    })
    await page.goto('/me?e2e=1')
    await page.getByRole('button', { name: /뽑기 한판 2장 있어요/ }).click()

    await expect(page.getByText(/닫힌 칸/)).toContainText('50', {
      timeout: 10000,
    })
    // 칸이 전부 눌리는 버튼이어야 한다 — 고르는 것이 이 놀이의 전부다
    await expect(page.getByRole('button', { name: /\d+번 칸/ })).toHaveCount(50)
  })
})

test.describe('S40 피날레', () => {
  test('시리얼 · 4+1 소원 · B면 메시지', async ({ page }) => {
    await seedTour(page, {
      ...BASE_STATE,
      phase: 'done',
      tracksCompleted: [1, 2, 3, 4, 5],
      speechMode: 'casual',
      bingo: { unlocked: true, cellsDone: ['bunsik', 'b02'], lines: 1 },
      bsideEntry: { type: 'text', text: '고마웠어요', uploaded: false },
    })
    await page.goto('/finale')
    await expect(page.getByText(/기록자 No\.[A-Z0-9]+/)).toBeVisible({
      timeout: 15000,
    })
    // 다섯째 소원은 유보된다(§6 B5_F)
    await expect(page.getByText(/이룬 소원 4\+1개/)).toBeVisible()
    await expect(page.getByText('고마웠어요')).toBeVisible()
  })
})

test.describe('F-7 계측 — 화면 진입과 정답이 기록된다', () => {
  test('mission_enter · mission_correct · qr_scan', async ({ page }) => {
    await seedTour(page, { ...BASE_STATE })
    await page.goto('/play?e2e=1')
    await enterStation(page, '1935')

    const count = page.getByPlaceholder('?')
    await expect(count).toBeVisible({ timeout: 40000 })

    // 틀린 답 → mission_wrong
    await count.fill('3')
    await page.getByRole('button', { name: '확인' }).click()
    await expect(page.getByText(/다시 한번 세어볼래요/)).toBeVisible()

    await count.fill('7')
    await page.getByRole('button', { name: '확인' }).click()

    await expect
      .poll(async () => await eventNames(page), { timeout: 20000 })
      .toEqual(
        expect.arrayContaining([
          'qr_scan',
          'track_arrived',
          'mission_enter',
          'mission_wrong',
          'mission_correct',
        ])
      )
  })
})

test.describe('커뮤니티 — 소영의 친구들', () => {
  test('페이지명·랭킹 표시', async ({ page }) => {
    await page.goto('/community')
    await expect(page.getByText('소영의 친구들').first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(/기록자 랭킹/)).toBeVisible()
  })
})

/*
  혜택 사용 — 카운터 앞까지.

  실제로 사용 처리하는 마지막 한 걸음(Firestore 쓰기)은 여기서 밟지 않는다.
  운영 데이터베이스에 시험 기록을 남기게 되고, 가게 계정 로그인이
  필요해 헤드리스에서 재현되지 않는다. 대신 **그 앞까지의 모든 갈림길**을
  본다 — 참여자가 카운터에 서기까지 무엇을 보고 무엇을 누르는가.

  여기서 지키려는 것 하나: **참여자 화면 어디에도 충당률이 없다.**
*/
test.describe('혜택 사용 — 쿠폰과 포인트', () => {
  /** 로컬 원장에 적립을 심는다 — 지갑 계산은 이 원장에서 나온다 */
  async function seedPoints(page, entries) {
    await page.addInitScript((list) => {
      window.localStorage.setItem('bh_points_ledger_v1', JSON.stringify(list))
    }, entries)
  }

  const earn = (refId, points, daysAgo = 1) => ({
    refId,
    reason: 'mainMission',
    points,
    createdAt: Date.now() - daysAgo * 86400000,
  })

  const DONE_STATE = {
    ...BASE_STATE,
    phase: 'act2',
    tracksCompleted: [1, 2, 3, 4, 5],
    speechMode: 'casual',
    bingo: { unlocked: true, cellsDone: ['bunsik', 'b02'], lines: 1 },
  }

  /*
    쿠폰은 주 경로(참여자가 스티커를 찍기)에 **로그인이 필요하다.**
    규칙이 사용 기록의 uid를 요청 계정과 대조하기 때문이다 — 로그인 없이
    만든 요청은 그 대조를 통과할 수 없다. 그래서 로그인 전에는 QR과 코드만
    띄우고 사장님이 대신 처리하는 길로 보낸다.

    포인트는 반대다. 어차피 가게 기기가 사용 처리하므로 참여자 로그인이 필요 없다.
  */
  test('쿠폰 — 로그인 전에는 사장님께 보여줄 코드가 뜬다', async ({ page }) => {
    await seedTour(page, { ...DONE_STATE, coupons: ['cp1'] })
    await page.goto('/me?e2e=1')

    await expect(page.getByText('🎟 받은 쿠폰')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: '열기' }).first().click()

    await expect(page.getByText(/쿠폰을 직접 쓰려면 로그인이 필요해요/)).toBeVisible({
      timeout: 10000,
    })
    // 로그인 전이라도 쓸 길은 남아야 한다 — 사장님이 이 QR을 찍는다
    await expect(page.getByAltText(/쿠폰 QR/)).toBeVisible({ timeout: 10000 })
    // 여는 것만으로는 아무것도 소모되지 않는다
    await expect(page.getByRole('button', { name: '접기' })).toBeVisible()
  })

  /*
    찍었다고 곧바로 사용 처리하지 않는다.

    카메라는 손에 들고 있으면 저 혼자 읽는 물건이라, 스티커 근처에 켜 둔
    것만으로 쿠폰이 없어졌었다. 되돌리는 길은 새 번호를 뜯는 것뿐이라
    (사용 기록은 관리자만 지운다) 예방이 유일한 방어다.

    로그인이 필요한 화면이라 여기서는 시트를 직접 세워 확인한다.
  */
  test('쿠폰 — 쓰기 전에 무엇을 어디서 쓰는지 묻는다', async ({ page }) => {
    await seedTour(page, { ...DONE_STATE, coupons: ['cp1'] })
    await page.goto('/me?e2e=1')
    await expect(page.getByText('🎟 받은 쿠폰')).toBeVisible({ timeout: 15000 })

    /*
      쿠폰 코드에서 확인 화면까지의 문구를 본다. 실제 시트는 로그인 뒤에
      열리므로, 여기서는 그 화면이 보여줄 두 값(가게·혜택)이 카탈로그에서
      제대로 나오는지를 지갑 카드로 확인한다 — 확인 화면은 같은 값을 쓴다.
    */
    await page.getByRole('button', { name: '열기' }).first().click()
    await expect(page.getByText('봉황1935').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('음료 1,000원 할인').first()).toBeVisible()
  })

  test('포인트 — 문턱 아래에서는 남은 거리만 보인다', async ({ page }) => {
    await seedTour(page, DONE_STATE)
    await seedPoints(page, [earn('m1', 1800)])
    await page.goto('/me?e2e=1')

    await expect(page.getByText(/1,200P/).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/더 모으면/)).toBeVisible()
    // 아직 쓸 수 없으므로 쓰는 버튼도 없어야 한다
    await expect(
      page.getByRole('button', { name: '가게에서 사용하기' })
    ).toHaveCount(0)
  })

  test('포인트 — 문턱을 넘으면 코드가 뜬다', async ({ page }) => {
    await seedTour(page, DONE_STATE)
    await seedPoints(page, [earn('m1', 2000), earn('m2', 1500)])
    await page.goto('/me?e2e=1')

    // 1p = 1원이라 환산을 나란히 둔다 — 참여자가 계산하지 않게
    await expect(page.getByText('= 3,500원').first()).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: '가게에서 사용하기' }).click()

    /*
      금액 칸은 참여자 화면에 없다. 얼마를 쓸지는 카운터에서 정해지는
      값이고, 사장님이 확인하지 않은 숫자가 그대로 기록이 되면 안 된다.
    */
    await expect(page.getByText(/쓸 금액은 사장님이 넣습니다/)).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('spinbutton')).toHaveCount(0)

    // 코드는 PT1로 시작한다 — 쿠폰 코드(BH1)와 섞이지 않는다
    await expect(page.getByText(/^PT1-[2-9A-Z]{6}-[2-9A-Z]{4}$/)).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByAltText('포인트 사용 코드')).toBeVisible({
      timeout: 10000,
    })
  })

  test('포인트 — FIFO로 깎이고, 쓴 몫이 따로 적힌다', async ({ page }) => {
    await seedTour(page, DONE_STATE)
    /*
      5개월 전 1,000P(곧 만료) + 어제 3,000P, 그중 1,000P를 이미 썼다.
      먼저 받은 것부터 깎이므로 남는 것은 어제 받은 3,000P다.
    */
    await seedPoints(page, [
      earn('old', 1000, 150),
      earn('new', 3000, 1),
      {
        refId: 'redeem-PT1-AAAAAA-2222',
        reason: 'redeem',
        points: -1000,
        createdAt: Date.now() - 3600000,
      },
    ])
    await page.goto('/me?e2e=1')

    await expect(page.getByText('= 3,000원').first()).toBeVisible({
      timeout: 15000,
    })
    // 합계만 줄어 있으면 "왜 줄었지"가 된다 — 쓴 몫을 따로 적는다
    await expect(page.getByText(/가게에서 사용 1,000P/)).toBeVisible()
  })

  test('참여자 화면에는 충당률이 없다', async ({ page }) => {
    await seedTour(page, { ...DONE_STATE, coupons: ['cp1'] })
    await seedPoints(page, [earn('m1', 3500)])
    await page.goto('/me?e2e=1')
    await expect(page.getByText('🎟 받은 쿠폰')).toBeVisible({ timeout: 15000 })

    /*
      충당률은 백엔드 정산 로직이다. 화면에 안 그리는 것만으로는 부족해
      참여자 기기가 가게 문서를 읽지 못하게 규칙으로 막았는데, 그 원칙이
      화면에서도 지켜지는지 여기서 본다.
    */
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/충당/)
    expect(body).not.toMatch(/운영사 부담/)
    expect(body).not.toMatch(/가게 부담/)
  })

  test('가게 확인 화면은 로그인 없이 열리지 않는다', async ({ page }) => {
    // 이 한 줄이 '참여자가 자기 폰에서 스스로 사용 처리하는' 구멍을 닫는다
    await page.goto('/shop/verify?c=PT1-AAAAAA-2222')
    await expect(page.getByText('가게 로그인')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('spinbutton')).toHaveCount(0)
  })
})
