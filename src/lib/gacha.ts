/**
 * 추억의 뽑기왕 — 보상의 한가운데.
 *
 * 흐름이 하나다:
 *
 *   빙고 한 줄  →  뽑기 한판(이용권)  →  판에서 한 칸  →  쿠폰
 *
 * **뽑기에서 나오는 것은 쿠폰이다.** 예전에는 포인트·굿즈·디지털로 갈려
 * 있었고 쿠폰은 따로 놀았는데, 참여자에게는 '받은 것'이 한 종류로 보이는
 * 편이 낫다 — 지갑을 열면 다 거기 있고, 쓰는 곳만 쿠폰마다 다르다.
 * 포인트만 예외로 남긴다. 쓸 곳이 앱 안이라 지갑에 넣을 물건이 아니다.
 *
 * 쓰는 곳은 세 갈래다(coupons.ts의 `CouponScope`) — 특정 가게 / 협력
 * 가게 공용 / 안내소 교환. 같은 쿠폰이 두 번 나와도 **칸 번호가 발급
 * 순번이 되어** 코드가 갈리므로(makeCouponCode의 serial), 예전에 가게
 * 쿠폰을 판에서 뺐던 이유(중복 저장 불가)는 사라졌다.
 *
 * 첫 줄도 이용권이다. 다섯 소원을 다 이루면 대각선이 저절로 채워지므로
 * 2막이 열리는 순간 한 장이 들어온다.
 *
 * 아래 열 가지는 **예시**다. 실제 상품과 수량은 사업자가 정한다 —
 * `slots` 합이 GACHA_SLOTS와 같기만 하면 된다(E2E가 검사한다).
 */

/** 뽑기판 칸 수 — 상품별 slots의 합이 정확히 이 값이어야 한다 */
export const GACHA_SLOTS = 50

export type PrizeTier = 'common' | 'rare' | 'legend'

export interface GachaPrize {
  id: string
  name: string
  emoji: string
  /**
   * 무엇을 받는가.
   *
   *  · `coupon` — 쿠폰 한 장. `couponId`가 카탈로그(coupons.ts)를 가리킨다.
   *    지갑에 들어가고 가게나 안내소에서 실제로 쓴다
   *  · `points` — 그 자리에서 적립되는 점수. 쓸 곳이 앱 안이라 쿠폰이 아니다
   */
  kind: 'coupon' | 'points'
  /** coupon이면 어느 쿠폰인지 — COUPONS의 키 */
  couponId?: string
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
    id: 'gcSticker',
    name: '봉황동 스티커 팩',
    emoji: '🎫',
    kind: 'coupon',
    couponId: 'gcSticker',
    slots: 8,
    tier: 'common',
    note: '안내소에서 교환하세요.',
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
    id: 'gcPostcard',
    name: '능소화 엽서 교환권',
    emoji: '📮',
    kind: 'coupon',
    couponId: 'gcPostcard',
    slots: 7,
    tier: 'common',
    note: '안내소에서 교환하세요.',
  },
  {
    id: 'gcCafe',
    name: '카페 공용 1,000원 할인권',
    emoji: '☕',
    kind: 'coupon',
    couponId: 'gcCafe',
    slots: 6,
    tier: 'common',
    note: '협력 카페 어디서나 쓸 수 있어요.',
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
    id: 'gcBonghwang',
    name: '봉황1935 음료 2,000원 할인권',
    emoji: '🥤',
    kind: 'coupon',
    couponId: 'gcBonghwang',
    slots: 5,
    tier: 'rare',
    note: '봉황1935에서만 쓸 수 있어요.',
  },
  {
    id: 'gcCafe2',
    name: '카페 공용 2,000원 할인권',
    emoji: '🧋',
    kind: 'coupon',
    couponId: 'gcCafe2',
    slots: 4,
    tier: 'rare',
    note: '협력 카페 어디서나 쓸 수 있어요.',
  },
  {
    id: 'gcSnack',
    name: '골목 간식 교환권',
    emoji: '🍢',
    kind: 'coupon',
    couponId: 'gcSnack',
    slots: 3,
    tier: 'rare',
    note: '안내소에서 교환하세요.',
  },
  {
    id: 'gcTangja',
    name: '카페 탱자 아메리카노 무료',
    emoji: '☕',
    kind: 'coupon',
    couponId: 'gcTangja',
    slots: 2,
    tier: 'rare',
    note: '카페 탱자에서만 쓸 수 있어요.',
  },
  {
    id: 'gcMixtape',
    name: '아버지의 믹스테이프 — 실물 카세트',
    emoji: '📼',
    kind: 'coupon',
    couponId: 'gcMixtape',
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
