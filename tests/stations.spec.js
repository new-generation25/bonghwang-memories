// 다섯 거점을 처음부터 끝까지 — 현장에 나가기 전에 도는 시험.
//
// 여기서 지키려는 것은 하나다: **다섯 거점을 걸으면 쿠폰 다섯 장이
// 지갑에 들어온다.** 한동안 어디서도 들어오지 않았는데, 화면은 멀쩡해서
// 다 걷고 지갑을 열어봐야 알 수 있었다(cueEngine의 dispatchAction이
// TRACK_MISSIONS의 reward를 읽는다).
//
// 카메라·마이크가 없는 헤드리스를 전제로 한다 — 사진은 모의 촬영,
// 음성 메모는 글쓰기로 간다. 둘 다 실제 기기에서도 쓰는 길이다.
const { test, expect } = require('@playwright/test')

const BASE = {
  phase: 'act1',
  currentTrack: 0,
  tracksCompleted: [],
  // 말 놓기는 트랙 1에서 갈리므로, 2번 이후를 볼 때는 미리 넘겨둔다
  speechMode: 'casual',
  speechConsent: 'yes',
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

const seed = (page, s) =>
  page.addInitScript((v) => {
    window.localStorage.setItem('bh_tour_v2', JSON.stringify(v))
  }, s)

const coupons = (page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('bh_tour_v2')).coupons)

/**
 * 거점 QR 게이트 — 헤드리스에서는 4자리 수동 코드로 지난다.
 *
 * 단추는 소원마다 하나씩 다섯 개다. 어느 것을 눌러도 스캐너는 다섯 거점을
 * 다 받으므로 첫 줄로 연다 — 어느 거점인지는 넣는 코드가 정한다.
 */
async function enter(page, code) {
  await page.getByRole('button', { name: /거점 QR 스캔/ }).first().click()
  await page.getByPlaceholder('0000').fill(code)
  await page.getByRole('button', { name: '입장하기' }).click()
}

/** 사진 미션 — 카메라가 없으면 모의 촬영으로 간다 */
async function shoot(page) {
  const b = page.getByRole('button', { name: /사진 찍기/ })
  await expect(b).toBeVisible({ timeout: 150000 })
  await b.click()
  await page.getByRole('button', { name: /모의 사진 촬영하기/ }).click()
  await page.getByRole('button', { name: /소영에게 사진 보내기/ }).click()
}

const hasCoupon = (page, id) =>
  expect.poll(() => coupons(page), { timeout: 40000 }).toContain(id)

test.describe('다섯 거점 — 걸으면 쿠폰이 들어온다', () => {
  test('거점 1 봉황1935 — 개수 7 → 사장님 이야기 → 사진 → cp1', async ({ page }) => {
    test.setTimeout(300_000)
    // 트랙 1은 말 놓기 분기가 있는 자리라 존댓말에서 시작한다
    await seed(page, { ...BASE, speechMode: 'formal', speechConsent: null })
    await page.goto('/play?e2e=1')
    await enter(page, '1935')

    const count = page.getByPlaceholder('?')
    await expect(count).toBeVisible({ timeout: 90000 })
    await count.fill('7')
    await page.getByRole('button', { name: '확인' }).click()

    const listen = page.getByRole('button', { name: /사장님의 이야기 듣기/ })
    await expect(listen).toBeVisible({ timeout: 90000 })
    await listen.click()

    await shoot(page)
    await hasCoupon(page, 'cp1')
  })

  test('거점 2 미야상회 — 바나나우유 사진 → cp2', async ({ page }) => {
    test.setTimeout(300_000)
    await seed(page, { ...BASE, tracksCompleted: [1] })
    await page.goto('/play?e2e=1')
    await enter(page, '0917')
    await shoot(page)
    await hasCoupon(page, 'cp2')
  })

  test('거점 3 능소화 고택 — 능소화 프레임 사진 → cp3', async ({ page }) => {
    test.setTimeout(300_000)
    await seed(page, { ...BASE, tracksCompleted: [1, 2] })
    await page.goto('/play?e2e=1')
    await enter(page, '7788')
    // D11 — WebAR이 아니라 정적 프레임이 기본 경로다
    await shoot(page)
    await hasCoupon(page, 'cp3')
  })

  test('거점 4 카페 탱자 — 라디오 → 곡 제목 → 한마디 → cp4', async ({ page }) => {
    test.setTimeout(420_000)
    await seed(page, { ...BASE, tracksCompleted: [1, 2, 3] })
    await page.goto('/play?e2e=1')
    await enter(page, '8890')

    /*
      도착 안내가 끝나면 데크의 PLAY가 「이어서 재생」이 된다. 화면 아래에
      띠 버튼을 두지 않는 것이 의도다 — 대사가 "재생 버튼 눌러봐"라고
      안내한다. 현장에서 여기서 멈추는 사람이 있는지 봐야 하는 자리다.
    */
    const resume = page.getByRole('button', { name: '이어서 재생' })
    await expect(resume).toBeVisible({ timeout: 150000 })
    await resume.click()

    const answer = page.getByPlaceholder('노래 제목')
    await expect(answer).toBeVisible({ timeout: 300000 })
    await answer.fill('소녀')
    await page.getByRole('button', { name: '확인' }).click()

    // 정답 해설이 뜨고, 그 자리에서 음성 메모로 이어진다
    const next = page.getByRole('button', { name: /나도 한마디 남기기/ })
    await expect(next).toBeVisible({ timeout: 30000 })
    await next.click()

    // 마이크가 없는 기기의 길 — 실제 기기에서도 쓰는 경로다
    await page.getByRole('button', { name: /글로 남기기/ }).click()
    const memo = page.locator('textarea')
    await expect(memo).toBeVisible({ timeout: 15000 })
    await memo.fill('오늘 아빠 목소리를 처음 다시 들었다.')
    await page.getByRole('button', { name: /이 마음 담기/ }).click()
    await hasCoupon(page, 'cp4')
  })

  test('거점 5 방하림 — 포스터 → 증언 → 소원 세기 → cp5', async ({ page }) => {
    test.setTimeout(420_000)
    await seed(page, { ...BASE, tracksCompleted: [1, 2, 3, 4] })
    await page.goto('/play?e2e=1')
    await enter(page, '0625')
    await shoot(page)

    const ask = page.getByRole('button', { name: /여쭤|물어|사장님/ })
    await expect(ask).toBeVisible({ timeout: 240000 })
    await ask.click()

    const count = page.getByRole('button', { name: /이룬 소원 세어보기/ })
    await expect(count).toBeVisible({ timeout: 300000 })
    await count.click()
    await hasCoupon(page, 'cp5')
  })

  test('오디오 잠금이 CSP에 막히지 않는다', async ({ page }) => {
    /*
      무음 잠금 해제가 data: URI였을 때 CSP(media-src 'self' blob:)가 막았고,
      catch가 그것을 삼켜 '풀린 줄 알고' 다음 큐를 틀었다 — 아이폰에서
      소리가 안 나는 자리였다. 파일로 옮긴 뒤 다시 막히지 않는지 본다.
    */
    const blocked = []
    page.on('console', (m) => {
      if (m.type() === 'error' && /Refused to load media|오디오 잠금 해제 실패/.test(m.text())) {
        blocked.push(m.text().slice(0, 120))
      }
    })
    await seed(page, { ...BASE, tracksCompleted: [1, 2] })
    await page.goto('/play?e2e=1')
    await enter(page, '7788')
    await page.waitForTimeout(8000)
    expect(blocked).toEqual([])
  })
})
