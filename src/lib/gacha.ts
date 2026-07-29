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
 * 상품을 칸 수만큼 늘어놓은 기본 배열 — 섞기 전의 재료다.
 *
 * 같은 상품을 이어 붙이지 않고 하나씩 돌아가며 놓는다. 어차피 아래에서
 * 섞지만, slots 합이 모자랄 때 한쪽만 비는 것을 여기서 막는다.
 */
const BASE_POOL: string[] = (() => {
  const remaining = GACHA_PRIZES.map((p) => ({ id: p.id, left: p.slots }))
  const pool: string[] = []
  while (pool.length < GACHA_SLOTS) {
    let placed = false
    for (const item of remaining) {
      if (item.left <= 0) continue
      pool.push(item.id)
      item.left -= 1
      placed = true
      if (pool.length >= GACHA_SLOTS) break
    }
    // slots 합이 GACHA_SLOTS보다 작으면 여기서 멈춘다(설정 실수 방어)
    if (!placed) break
  }
  return pool
})()

/**
 * 시드 난수 — 같은 시드는 늘 같은 순열을 낸다(mulberry32).
 *
 * 판 배치는 **재현되어야** 한다. 저장하는 것이 뽑은 '칸 번호'뿐이라,
 * 화면을 새로 열 때 같은 배치가 나오지 않으면 어제 뽑은 상품이 오늘
 * 다른 것으로 바뀐다. 그래서 여기만은 crypto가 아니라 시드 난수다.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 문자열 → 32비트 시드 (FNV-1a) */
function seedOf(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * 이 사람의 판 — 칸 번호 → 상품 id.
 *
 * 사람마다 배치를 섞는다. 모두가 같은 판이면 누군가 한 번 열어보고
 * "17번이 카세트"라고 알리는 순간 뽑기가 아니게 된다. 고르는 재미는
 * 그대로 두고 공략만 막는 방법이 이것이다.
 *
 * 시드가 없으면(비로그인) 고정 판을 쓴다 — 그 기기 안에서만은 배치가
 * 일정해야 뽑은 상품이 흔들리지 않는다.
 */
export function boardFor(seed: string): string[] {
  const board = [...BASE_POOL]
  const rnd = mulberry32(seedOf(seed || 'bh-guest'))
  // Fisher–Yates
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[board[i], board[j]] = [board[j], board[i]]
  }
  return board
}

/**
 * 이 사람의 판 시드.
 *
 * 로그인 계정이 있으면 uid, 없으면 투어 시작 시각을 쓴다 — 쿠폰 코드가
 * 사람을 가리는 방식과 같다(coupons.ts). 로그인 전후로 시드가 바뀌면
 * 판 배치도 바뀌는데, 아직 아무 칸도 열지 않았다면 문제가 없고 이미
 * 열었다면 그 칸의 상품이 달라진다 — 그래서 열 때마다 상품을 기록으로
 * 남기지 않고 판에서 파생시키는 지금 구조에서는 **로그인을 먼저 권한다**.
 */
export function gachaSeed(uid: string | null | undefined, startTime: number | null): string {
  return uid || `local-${startTime ?? 0}`
}

export interface GachaResult {
  /** 연 칸 번호(0~49) */
  slot: number
  prize: GachaPrize
}

/**
 * 참여자가 고른 칸을 연다.
 *
 * 무작위로 뽑아주지 않는다 — 어느 칸을 열지는 사람이 정한다. 판이
 * 이미 섞여 있으므로 어느 칸을 고르든 확률은 같고, 고르는 행위만
 * 참여자의 것이 된다. 문방구 뽑기판 앞에서 손가락을 옮기던 그 순간이다.
 *
 * 연 칸은 그 사람의 판에서 사라진다(비복원). 한 사람이 얻는 이용권은
 * 최대 11장(12줄 − 첫 줄)이라 판이 마르지 않는다.
 */
export function openSlot(
  seed: string,
  slot: number,
  drawnSlots: number[]
): GachaResult | null {
  if (slot < 0 || slot >= GACHA_SLOTS) return null
  if (drawnSlots.includes(slot)) return null
  const prize = prizeById(boardFor(seed)[slot] ?? '')
  if (!prize) return null
  return { slot, prize }
}

/** 연 칸 번호들 → 상품 목록(연 순서 그대로) */
export function prizesOf(seed: string, drawnSlots: number[]): GachaPrize[] {
  const board = boardFor(seed)
  const out: GachaPrize[] = []
  for (const slot of drawnSlots) {
    const prize = prizeById(board[slot] ?? '')
    if (prize) out.push(prize)
  }
  return out
}
