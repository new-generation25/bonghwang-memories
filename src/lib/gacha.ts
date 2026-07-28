/**
 * 골목 뽑기 — 추가 빙고 한 줄마다 한 번.
 *
 * 첫 줄(대각선 = 다섯 소원)은 뽑기가 아니라 가게 쿠폰 다섯 장이 한 번에
 * 나온다. 거점 다섯 곳을 실제로 다녀왔으니 받는 것이고, 어느 가게가
 * 무엇을 내주는지 이미 협의된 값이라 확률에 맡길 것이 아니다.
 *
 * 두 번째 줄부터가 뽑기다. 보너스 미션으로 칸을 채워야 완성되는 줄이라,
 * 더 걸은 사람에게 돌아가는 몫이다.
 *
 * **가게 쿠폰은 뽑기판에 넣지 않는다.** 두 가지 이유다.
 *  · 이미 다섯 장을 다 가진 사람에게 같은 쿠폰이 또 나오면 꽝이 된다
 *    (tourState.coupons는 id 집합이라 같은 것을 두 번 담지 못한다).
 *  · 가게 정산은 '완주자 수 × 5장'으로 예측할 수 있어야 한다. 확률로
 *    쿠폰이 더 나가면 사장님께 드릴 금액이 매번 달라진다.
 * 뽑기 상품에 가게 혜택을 넣으려면 쿠폰 카탈로그(coupons.ts)와 가게
 * 문서(shops)를 먼저 만들어야 한다 — 그때 여기 slots만 갈아끼우면 된다.
 *
 * 아래 열 가지는 **예시**다. 실제 상품과 수량은 사업자가 정한다.
 */

/** 뽑기판 칸 수 — 상품별 slots의 합이 정확히 이 값이어야 한다 */
export const GACHA_SLOTS = 50

export type PrizeTier = 'common' | 'rare' | 'legend'

export interface GachaPrize {
  id: string
  name: string
  emoji: string
  /** 참여자에게 어떻게 건네는지 — 화면이 안내 문구를 고를 때 쓴다 */
  kind: 'points' | 'digital' | 'onsite'
  /** points 상품이면 즉시 적립할 점수 */
  points?: number
  /** 50칸 중 몇 칸을 차지하는가 — 이것이 곧 확률이다 */
  slots: number
  tier: PrizeTier
  /** 받은 뒤 무엇을 해야 하는지 한 줄 */
  note: string
}

export const GACHA_PRIZES: GachaPrize[] = [
  {
    id: 'sticker',
    name: '봉황동 스티커 팩',
    emoji: '🎫',
    kind: 'onsite',
    slots: 8,
    tier: 'common',
    note: '완주 후 안내소에서 받아 가세요.',
  },
  {
    id: 'point300',
    name: '포인트 300P',
    emoji: '✨',
    kind: 'points',
    points: 300,
    slots: 8,
    tier: 'common',
    note: '방금 적립됐어요.',
  },
  {
    id: 'postcard',
    name: '능소화 엽서 한 장',
    emoji: '📮',
    kind: 'onsite',
    slots: 7,
    tier: 'common',
    note: '완주 후 안내소에서 받아 가세요.',
  },
  {
    id: 'frame88',
    name: '1988 필름 프레임',
    emoji: '📷',
    kind: 'digital',
    slots: 6,
    tier: 'common',
    note: '사진에 씌워 쓰는 프레임이에요.',
  },
  {
    id: 'point500',
    name: '포인트 500P',
    emoji: '🎧',
    kind: 'points',
    points: 500,
    slots: 6,
    tier: 'common',
    note: '방금 적립됐어요.',
  },
  {
    id: 'badge',
    name: '골목 탐험가 뱃지',
    emoji: '🏅',
    kind: 'digital',
    slots: 5,
    tier: 'rare',
    note: '나의 기록에 남습니다.',
  },
  {
    id: 'ep2',
    name: 'EP.2 예약 3,000원 할인권',
    emoji: '🎟',
    kind: 'digital',
    slots: 4,
    tier: 'rare',
    note: '8월 예약 때 자동으로 적용돼요.',
  },
  {
    id: 'snack',
    name: '골목 간식 교환권',
    emoji: '🍢',
    kind: 'onsite',
    slots: 3,
    tier: 'rare',
    note: '완주 후 안내소에서 받아 가세요.',
  },
  {
    id: 'polaroid',
    name: '즉석 필름 사진 한 컷',
    emoji: '📸',
    kind: 'onsite',
    slots: 2,
    tier: 'rare',
    note: '안내소에서 그 자리에서 찍어 드려요.',
  },
  {
    id: 'mixtape',
    name: '아버지의 믹스테이프 — 실물 카세트',
    emoji: '📼',
    kind: 'onsite',
    slots: 1,
    tier: 'legend',
    note: '오늘 단 한 분. 안내소에서 받아 가세요.',
  },
]

export function prizeById(id: string): GachaPrize | null {
  return GACHA_PRIZES.find((p) => p.id === id) ?? null
}

/**
 * 50칸 판 — 칸 번호 → 상품 id.
 *
 * 같은 상품을 이어 붙이지 않고 하나씩 돌아가며 놓는다. 뽑는 칸이 어차피
 * 무작위라 결과는 같지만, 판을 펼쳤을 때 한쪽에만 몰려 보이면 '짜여
 * 있다'는 인상을 준다.
 */
export const GACHA_BOARD: string[] = (() => {
  const remaining = GACHA_PRIZES.map((p) => ({ id: p.id, left: p.slots }))
  const board: string[] = []
  while (board.length < GACHA_SLOTS) {
    let placed = false
    for (const item of remaining) {
      if (item.left <= 0) continue
      board.push(item.id)
      item.left -= 1
      placed = true
      if (board.length >= GACHA_SLOTS) break
    }
    // slots 합이 GACHA_SLOTS보다 작으면 여기서 멈춘다(설정 실수 방어)
    if (!placed) break
  }
  return board
})()

/**
 * 진짜 무작위로 한 칸.
 *
 * Math.random()을 쓰지 않는다. 뽑기는 참여자가 결과를 납득해야 하는
 * 자리라, 브라우저가 주는 암호학적 난수를 쓴다. 나머지 연산으로 생기는
 * 치우침(modulo bias)도 걷어낸다 — 흔한 상품이 아주 조금 더 자주 나오는
 * 정도지만, 공정하다고 말하려면 그 정도도 없어야 한다.
 */
function randomBelow(n: number): number {
  if (n <= 0) return 0
  const limit = Math.floor(0xffffffff / n) * n
  const buf = new Uint32Array(1)
  for (let i = 0; i < 100; i++) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % n
  }
  // 100번 연속으로 걸릴 확률은 사실상 0이지만, 무한 반복은 만들지 않는다
  return buf[0] % n
}

export interface GachaResult {
  /** 뽑힌 칸 번호(0~49) — 판에서 어디가 열렸는지 보여줄 때 쓴다 */
  slot: number
  prize: GachaPrize
}

/**
 * 아직 열지 않은 칸 중에서 하나를 뽑는다.
 *
 * 뽑은 칸은 그 사람의 판에서 사라진다(비복원). 제비뽑기와 같은 결이라
 * 뽑을수록 남은 것이 줄어드는 것이 눈에 보인다. 한 사람이 얻을 수 있는
 * 뽑기 횟수는 최대 11회(12줄 − 첫 줄)라 판이 마르지 않는다.
 */
export function drawPrize(drawnSlots: number[]): GachaResult | null {
  const taken = new Set(drawnSlots)
  const open: number[] = []
  for (let i = 0; i < GACHA_BOARD.length; i++) {
    if (!taken.has(i)) open.push(i)
  }
  if (open.length === 0) return null

  const slot = open[randomBelow(open.length)]
  const prize = prizeById(GACHA_BOARD[slot])
  if (!prize) return null
  return { slot, prize }
}

/** 뽑은 칸 번호들 → 상품 목록(뽑은 순서 그대로) */
export function prizesOf(drawnSlots: number[]): GachaPrize[] {
  const out: GachaPrize[] = []
  for (const slot of drawnSlots) {
    const prize = prizeById(GACHA_BOARD[slot] ?? '')
    if (prize) out.push(prize)
  }
  return out
}
