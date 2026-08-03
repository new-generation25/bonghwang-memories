/**
 * 충당률 정산 — 순수 계산.
 *
 * Firebase를 import하지 않는다. adminStats.ts와 같은 이유이고, 여기서는
 * 더 중하다 — 돈을 나누는 산식이라 Node에서 그대로 돌려 검증할 수 있어야
 * 하고, 화면·규칙·정산이 **같은 산식**을 보지 않으면 어느 쪽이 참인지
 * 물어볼 근거가 없어진다.
 *
 * **충당률은 참여자에게 보이지 않는다.** 이 파일의 값 중 소비자 화면에
 * 닿아도 되는 것은 하나뿐이다 — 「이 매장은 이번 달 혜택이 마감되었습니다」.
 * 누가 얼마를 부담하는지는 가게 화면과 운영사 정산 화면에서만 본다.
 */

// ---------------------------------------------------------------------------
// 등급
// ---------------------------------------------------------------------------

/**
 * 가게 등급.
 *
 *  · `free`    무료. 회비도 부담도 없다. **지금은 모든 가게가 여기 있다**
 *  · `basic`   기본 구독 — 월 1만 원
 *  · `premium` 프리미엄 구독 — 월 3만 원. 노출이 큰 대신 회비도 크다
 *
 * 세 칸을 미리 만들어 두는 이유는 나중에 옮길 자리를 지금 정해두기
 * 위해서다. 구독이 시작되면 가게마다 등급만 눌러 옮기면 되고, 그 시점
 * **이후** 사용분부터 새 값이 붙는다 — 지난 기록은 움직이지 않는다.
 */
export type MerchantTier = 'free' | 'basic' | 'premium'

export const TIER_LABEL: Record<MerchantTier, string> = {
  free: '무료',
  basic: '기본',
  premium: '프리미엄',
}

/** 계약 상태. `active`가 아니면 그 가게에서 혜택을 쓸 수 없다 */
export type ContractState = 'active' | 'paused' | 'ended'

export const CONTRACT_LABEL: Record<ContractState, string> = {
  active: '계약 중',
  paused: '일시 중지',
  ended: '종료',
}

// ---------------------------------------------------------------------------
// 설정값
// ---------------------------------------------------------------------------

/**
 * 정산 설정.
 *
 * 여기 있는 값은 전부 `config/settlement` 문서로 덮어쓸 수 있다 —
 * 등급별 충당률도, 배점도 협의로 움직이는 값이라 배포를 기다리게 하면
 * 안 된다. 아래 상수는 그 문서가 아직 없을 때의 출발점일 뿐이다.
 * (설문 문항을 코드가 아니라 `surveys` 컬렉션에 둔 것과 같은 결이다.)
 */
export interface SettlementConfig {
  /**
   * 등급별 충당률 — **정수 퍼센트**다.
   *
   * 0.6 같은 소수를 쓰지 않는 이유가 둘이다. 보안 규칙이 소수 동등 비교를
   * 믿을 수 없고, 규칙의 정수 나눗셈과 화면의 계산이 한 자리라도 어긋나면
   * 사용이 통째로 거절된다. 정수 퍼센트면 `금액 × 율 ÷ 100`이 양쪽에서
   * 똑같이 떨어진다.
   */
  coverage: Record<MerchantTier, number>
  /** 등급별 월 회비(원) */
  monthlyFee: Record<MerchantTier, number>
  /** 등급별 월 충당 상한(원) — 가게 문서에 값이 없을 때의 기본 */
  monthlyCap: Record<MerchantTier, number>
  /** 상한을 이만큼 쓰면 사장님께 알린다(%) */
  capAlertPercent: number
  /** 운영사 부담액이 당월 매출의 이 비율(%)을 넘으면 경고 — 리워드 예산 천장 */
  budgetPercent: number
  /** 2단 상품 결제 시 발급되는 쿠폰 액면(원) */
  couponFaceWon: number
  /** 포인트를 쓰기 시작할 수 있는 문턱(p) */
  minRedeemPoints: number
  /** 포인트 유효기간(개월) */
  pointExpiryMonths: number
  /** 미션 칸 하나 배점(p) */
  missionPoints: number
  /** 빙고 한 줄 배점(p) */
  linePoints: number
  /** 코스 완주 보너스(p) */
  completePoints: number
}

/**
 * 2026 시범운영 — **전 등급 충당률 0%.**
 *
 * 협의된 값은 기본 협력 60% · 프리미엄 85%지만, 올해는 가게에 부담을
 * 지우지 않는다. 아직 이 판이 무엇인지 보여드리지 못한 채로 청구서부터
 * 보내면 다음 해에 남을 가게가 없다. 시범운영이 끝나면 설정 화면에서
 * 등급별 값을 넣고, 가게마다 등급을 눌러 반영한다 — 그 시점 **이후**
 * 사용분부터 새 충당률이 적용되고 지난 기록은 움직이지 않는다.
 *
 * 등급 세 칸과 회비는 그래도 지금 세워 둔다. 구독이 시작되는 날 옮겨
 * 앉을 자리를 미리 만들어 두는 것이지, 지금 받는 돈이 아니다.
 */
export const DEFAULT_SETTLEMENT: SettlementConfig = {
  coverage: { free: 0, basic: 0, premium: 0 },
  monthlyFee: { free: 0, basic: 10000, premium: 30000 },
  monthlyCap: { free: 30000, basic: 30000, premium: 60000 },
  capAlertPercent: 80,
  budgetPercent: 3,
  couponFaceWon: 4500,
  minRedeemPoints: 3000,
  pointExpiryMonths: 6,
  missionPoints: 100,
  linePoints: 500,
  completePoints: 200,
}

/**
 * 설정 문서를 기본값에 겹친다.
 *
 * 관리자가 칸 하나만 고쳐 저장해도 나머지가 사라지면 안 된다. 없는 칸은
 * 기본값으로 메우고, 이상한 값(음수·문자)은 조용히 버린다 — 여기서 걸러야
 * 잘못된 율이 사용 기록에 스냅샷으로 굳는 것을 막는다.
 */
export function mergeSettlementConfig(raw: unknown): SettlementConfig {
  const v = (raw ?? {}) as Partial<SettlementConfig>
  const num = (x: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max
      ? Math.round(x)
      : fallback

  const tierMap = (
    x: unknown,
    fallback: Record<MerchantTier, number>,
    max?: number
  ): Record<MerchantTier, number> => {
    const o = (x ?? {}) as Partial<Record<MerchantTier, number>>
    return {
      free: num(o.free, fallback.free, max),
      basic: num(o.basic, fallback.basic, max),
      premium: num(o.premium, fallback.premium, max),
    }
  }

  const d = DEFAULT_SETTLEMENT
  return {
    coverage: tierMap(v.coverage, d.coverage, 100),
    monthlyFee: tierMap(v.monthlyFee, d.monthlyFee),
    monthlyCap: tierMap(v.monthlyCap, d.monthlyCap),
    capAlertPercent: num(v.capAlertPercent, d.capAlertPercent, 100),
    budgetPercent: num(v.budgetPercent, d.budgetPercent, 100),
    couponFaceWon: num(v.couponFaceWon, d.couponFaceWon),
    minRedeemPoints: num(v.minRedeemPoints, d.minRedeemPoints),
    pointExpiryMonths: num(v.pointExpiryMonths, d.pointExpiryMonths, 120),
    missionPoints: num(v.missionPoints, d.missionPoints),
    linePoints: num(v.linePoints, d.linePoints),
    completePoints: num(v.completePoints, d.completePoints),
  }
}

/**
 * 참여자도 읽는 칸 — 배점·문턱·유효기간. 나머지는 `config/settlement`에 남는다.
 *
 * 충당률·회비·상한은 여기 넣지 않는다. 참여자에게 보이면 안 되고 가게끼리도
 * 서로의 것을 알면 안 된다(규칙이 `config/settlement`을 관리자에게만 연다).
 * 화면에 안 그리는 것으로는 부족하다 — 문서를 읽을 수 있으면 읽힌다.
 *
 * **여기(순수 계산 쪽)에 두는 이유는 서버도 같은 목록을 봐야 해서다.**
 * `settlement.ts`는 `'use client'`라 라우트 핸들러가 못 읽는다. 갈라 적으면
 * 한쪽만 고쳐져 충당률이 공개 문서로 새는 날이 온다.
 */
export const SETTLEMENT_PUBLIC_KEYS = [
  'minRedeemPoints',
  'pointExpiryMonths',
  'missionPoints',
  'linePoints',
  'completePoints',
] as const

/** 설정을 공개분과 관리자분으로 가른다 — 두 문서에 나눠 쓴다 */
export function splitSettlementConfig(cfg: SettlementConfig): {
  publicPart: Record<string, number>
  privatePart: Record<string, unknown>
} {
  const publicPart: Record<string, number> = {}
  for (const k of SETTLEMENT_PUBLIC_KEYS) publicPart[k] = cfg[k]

  const privatePart = { ...cfg } as Record<string, unknown>
  for (const k of SETTLEMENT_PUBLIC_KEYS) delete privatePart[k]

  return { publicPart, privatePart }
}

// ---------------------------------------------------------------------------
// BEP 시뮬레이터 반영안
// ---------------------------------------------------------------------------

/** 무엇이 무엇으로 바뀌는가 — 저장 전에 사람에게 보여줄 한 줄 */
export interface BepPatchChange {
  label: string
  from: number
  to: number
}

/** 반영안이 건드릴 수 있는 칸과 그 이름. 여기 없는 키는 들어와도 버린다 */
const BEP_FIELDS: [keyof SettlementConfig, string][] = [
  ['couponFaceWon', '쿠폰 액면(원)'],
  ['pointExpiryMonths', '포인트 유효기간(개월)'],
  ['missionPoints', '미션 칸 배점(P)'],
  ['linePoints', '빙고 줄 배점(P)'],
  ['completePoints', '완주 보너스(P)'],
]

const BEP_TIER_FIELDS: ['monthlyFee' | 'monthlyCap', string][] = [
  ['monthlyFee', '월 회비'],
  ['monthlyCap', '월 상한'],
]

/**
 * BEP 시뮬레이터가 복사해 준 반영안을 설정 위에 얹는다.
 *
 * **충당률은 받지 않는다.** BEP는 연차별(2027·2028)로 잡고 여기는 등급별
 * (무료·기본·프리미엄)로 잡아 옮길 대응이 없다. 게다가 지금은 시범운영이라
 * 전 등급 0%인데 확정안은 100%다 — 실수로 넘어가면 가게에 할인액 전액이
 * 청구된다. 들어와도 조용히 버리고, 버렸다는 것을 `ignored`로 알린다.
 *
 * 값을 바로 쓰지 않고 `changes`를 함께 돌려주는 이유는, 이 버튼이 **돈을
 * 바꾸는 버튼**이라서다. 쿠폰 액면 하나가 4,500에서 3,500으로 조용히
 * 내려가면 그 뒤 모든 청구서가 달라지는데 아무도 눈치채지 못한다.
 */
export function applyBepPatch(
  cfg: SettlementConfig,
  raw: unknown
): { next: SettlementConfig; changes: BepPatchChange[]; ignored: string[] } {
  const v = (raw ?? {}) as Record<string, unknown>
  const changes: BepPatchChange[] = []
  const ignored: string[] = []
  const draft: Record<string, unknown> = { ...cfg }

  const ok = (x: unknown): x is number =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0

  for (const [key, label] of BEP_FIELDS) {
    if (!ok(v[key])) continue
    const to = Math.round(v[key] as number)
    if (to !== cfg[key]) changes.push({ label, from: cfg[key] as number, to })
    draft[key] = to
  }

  for (const [key, label] of BEP_TIER_FIELDS) {
    const o = (v[key] ?? {}) as Partial<Record<MerchantTier, number>>
    const next = { ...cfg[key] }
    for (const tier of ['free', 'basic', 'premium'] as const) {
      if (!ok(o[tier])) continue
      const to = Math.round(o[tier] as number)
      if (to !== cfg[key][tier]) {
        changes.push({ label: `${label} · ${tier}`, from: cfg[key][tier], to })
      }
      next[tier] = to
    }
    draft[key] = next
  }

  if (v.coverage !== undefined) ignored.push('충당률')

  return { next: mergeSettlementConfig(draft), changes, ignored }
}

// ---------------------------------------------------------------------------
// 분담 계산
// ---------------------------------------------------------------------------

export interface CoverageSplit {
  /** 쿠폰 액면 또는 사용 포인트 수 (1p = 1원) */
  amountWon: number
  /** 이 건에 적용한 충당률(%) */
  coverageRate: number
  /** 가게 부담액 */
  shopWon: number
  /** 운영사 부담액 */
  opsWon: number
}

/**
 * 할인액을 가게 몫과 운영사 몫으로 가른다.
 *
 * 내림으로 자르고 나머지는 운영사가 진다(`opsWon = 총액 − 가게몫`). 양쪽을
 * 따로 반올림하면 합이 총액과 1원씩 어긋나는데, 그 1원이 월 정산에서
 * 수백 건 쌓이면 "왜 안 맞느냐"를 설명할 수 없다. 차이는 늘 운영사 쪽으로
 * 몰아 두는 편이 가게에 설명하기 쉽다.
 *
 * 나눗셈이 정수로 떨어지는 것이 중요하다 — 보안 규칙도 같은 식으로
 * 검산하므로, 여기서 소수를 쓰면 규칙이 사용을 거절한다.
 */
export function splitCoverage(amountWon: number, coverageRate: number): CoverageSplit {
  const amount = Math.max(0, Math.round(amountWon))
  const rate = Math.min(100, Math.max(0, Math.round(coverageRate)))
  const shopWon = Math.floor((amount * rate) / 100)
  return { amountWon: amount, coverageRate: rate, shopWon, opsWon: amount - shopWon }
}

// ---------------------------------------------------------------------------
// 가게 등급 판정
// ---------------------------------------------------------------------------

/** 충당률 판정에 필요한 가게 속성만 — Shop 전체를 끌고 오지 않는다 */
export interface MerchantLike {
  shopId: string
  tier: MerchantTier
  /** 사용 시점에 적용할 율(%). **가게 문서에 값으로 산다** */
  coverageRate: number
  /** 가입일(epoch ms) */
  joinedAt: number | null
  /** 이 가게의 월 충당 상한(원) */
  monthlyCapWon: number
  contract: ContractState
  active: boolean
}

/*
  '신규 3개월 유예'는 두지 않는다.

  명세에는 가입 후 3개월을 0%로 두는 칸이 있었는데, 지금은 **모든 가게가
  무료 등급**이라 그 칸이 하는 일이 없다. 시간이 저 혼자 등급을 바꾸는
  장치를 남겨두면, 구독이 시작된 뒤 어느 날 아무도 누르지 않았는데 가게의
  부담이 늘어난다 — 등급은 사람이 눌러서만 움직인다(`setShopTier`가 그
  시점을 `rateSince`에 남긴다).
*/

// ---------------------------------------------------------------------------
// 월 구간
// ---------------------------------------------------------------------------

/** `2026-07` — 사용 기록과 상한 집계가 같은 키를 봐야 한다 */
export function monthKey(t: number | Date = Date.now()): string {
  const d = t instanceof Date ? t : new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 그 달의 시작·끝(다음 달 1일 0시) */
export function monthRange(key: string): { from: number; to: number } {
  const [y, m] = key.split('-').map(Number)
  const from = new Date(y, m - 1, 1).getTime()
  const to = new Date(y, m, 1).getTime()
  return { from, to }
}

/** 정산 마감일 — 익월 10일 */
export function settlementDueAt(key: string): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 10, 23, 59, 59).getTime()
}

// ---------------------------------------------------------------------------
// 월 충당 상한
// ---------------------------------------------------------------------------

export type CapState = 'ok' | 'alert' | 'closed'

export interface CapStatus {
  state: CapState
  /** 이번 달 이미 쌓인 가게 부담액 */
  usedWon: number
  capWon: number
  /** 소진율(%) */
  percent: number
  /** 아직 받을 수 있는 가게 부담액 */
  remainWon: number
}

/**
 * 상한 소진 상태.
 *
 * 세는 것은 **가게 부담액**이지 할인 총액이 아니다. 신규(0%)는 아무리 써도
 * 가게가 지는 것이 없으므로 상한에 닿지 않는다 — 상한은 가게를 지키는
 * 장치이지 혜택을 조이는 장치가 아니다.
 */
export function capStatus(
  usedWon: number,
  capWon: number,
  alertPercent = DEFAULT_SETTLEMENT.capAlertPercent
): CapStatus {
  const cap = Math.max(0, Math.round(capWon))
  const used = Math.max(0, Math.round(usedWon))
  const percent = cap > 0 ? Math.round((used / cap) * 100) : 0
  const state: CapState = cap > 0 && used >= cap ? 'closed' : percent >= alertPercent ? 'alert' : 'ok'
  return { state, usedWon: used, capWon: cap, percent, remainWon: Math.max(0, cap - used) }
}

/**
 * 상한은 **청구를 자르는 장치이지 사용을 막는 장치가 아니다.**
 *
 * 명세는 상한에 닿으면 그 달의 사용을 차단하라고 했는데, 그렇게 하지
 * 않는다. 상한에 닿을 만큼 쓴 참여자는 그만큼 자주 온 손님이라는 뜻이고,
 * 카운터에서 돌려보내면 그 손님을 잃는다. 문턱·상한 같은 숫자는 예산을
 * 가정해 본 값이지 손님에게 들이밀 규칙이 아니다.
 *
 * 가게는 여전히 보호된다 — 넘은 몫은 청구에서 빠지고 운영사가 진다
 * (`settleMonth`의 `coveredWon`·`overCapWon`). 막지 않아도 가게가 더
 * 내는 일은 없다.
 *
 * 그래서 이 파일에는 '막는' 함수가 없다. `capStatus()`는 사장님 화면의
 * 게이지와 80% 알림, 그리고 청구액을 자르는 데만 쓴다.
 */

// ---------------------------------------------------------------------------
// 정산 집계
// ---------------------------------------------------------------------------

/** 사용 기록 한 건 — 정산이 보는 최소 모양 */
export interface RedemptionLike {
  shopId: string
  /** 쿠폰인가 포인트인가 */
  kind: 'coupon' | 'points'
  via: 'guest' | 'staff'
  amountWon: number
  /** **사용 시점에 값으로 복사된** 율. 지금 가게 등급을 조인하지 않는다 */
  coverageRate: number
  shopWon: number
  opsWon: number
  usedAt: number | null
}

export interface SettlementRow {
  shopId: string
  name: string
  tier: MerchantTier
  /** 지금 가게에 걸린 율 — 표시용이다. 금액은 스냅샷으로만 센다 */
  currentRate: number
  /** 사용 건수 */
  count: number
  couponCount: number
  pointCount: number
  guest: number
  staff: number
  /** 할인 총액(액면 합) */
  amountWon: number
  /** 가게 부담액 합 — 스냅샷을 그대로 더한 값 */
  shopWon: number
  /** 운영사 부담액 합 */
  opsWon: number
  /**
   * 실제로 청구하는 충당액 = min(부담액 합, 월 상한).
   *
   * 상한을 넘겨 찍힌 건이 생길 수 있다. 참여자가 직접 찍는 주 경로에서는
   * 참여자 기기가 그 가게의 상한을 알 수 없기 때문이다(가게 문서를 못
   * 읽는다 — 읽히면 스티커 토큰이 샌다). 막지 못한 것을 청구까지 하면
   * 상한이 약속이 아니게 되므로, **넘은 몫은 운영사가 진다.**
   */
  coveredWon: number
  /** 상한을 넘어 운영사로 넘어간 몫 */
  overCapWon: number
  /** 월 회비 */
  feeWon: number
  /** 가게에 청구할 총액 = 회비 + 청구 충당액 */
  billedWon: number
  /** QR 스캔 수 — 충당액 대비 무엇을 받았는지 함께 보여줘야 한다 */
  scans: number
  /**
   * 충당액 대비 매출 유입액.
   *
   * 가게가 "얼마를 냈는가"만 보면 이탈한다. 쿠폰·포인트는 결제 금액에서
   * 깎이는 것이라, 그만큼의 결제가 실제로 일어났다는 뜻이다 — 할인 총액을
   * 가게에 들어온 매출의 하한으로 본다(실제 결제액은 더 크다).
   */
  inflowWon: number
  capWon: number
  cap: CapStatus
}

/** 가게 이름·등급·회비를 정산 줄에 붙이기 위한 최소 정보 */
export interface SettlementMerchant extends MerchantLike {
  name: string
  feeWon: number
}

/**
 * 월 정산 — 가게별 한 줄.
 *
 * **금액은 전부 스냅샷에서 온다.** 지금 가게 등급을 조인해서 다시 계산하면
 * 등급이 바뀐 순간 지난 달 정산이 통째로 틀어진다(명세가 금지한 구현이다).
 * `currentRate`는 화면에 "지금 이 가게는 60%"를 적기 위한 값일 뿐, 어떤
 * 금액 계산에도 들어가지 않는다.
 *
 * 스냅샷이 없는 옛 기록은 `amountWon`이 0이라 저절로 빠진다 — 개편 전
 * 기록에는 누가 얼마를 부담했는지가 없어 지어낼 수 없다.
 */
export function settleMonth(opts: {
  merchants: SettlementMerchant[]
  redemptions: RedemptionLike[]
  /** 가게별 QR 스캔 수 */
  scansByShop?: Record<string, number>
  month?: string
  alertPercent?: number
}): SettlementRow[] {
  const month = opts.month ?? monthKey()
  const { from, to } = monthRange(month)
  const alertPercent = opts.alertPercent ?? DEFAULT_SETTLEMENT.capAlertPercent

  const rows = new Map<string, SettlementRow>()
  for (const m of opts.merchants) {
    rows.set(m.shopId, {
      shopId: m.shopId,
      name: m.name,
      tier: m.tier,
      currentRate: m.coverageRate,
      count: 0,
      couponCount: 0,
      pointCount: 0,
      guest: 0,
      staff: 0,
      amountWon: 0,
      shopWon: 0,
      opsWon: 0,
      coveredWon: 0,
      overCapWon: 0,
      feeWon: m.feeWon,
      billedWon: m.feeWon,
      scans: opts.scansByShop?.[m.shopId] ?? 0,
      inflowWon: 0,
      capWon: m.monthlyCapWon,
      cap: capStatus(0, m.monthlyCapWon, alertPercent),
    })
  }

  for (const r of opts.redemptions) {
    if (!r.shopId) continue
    const at = r.usedAt ?? 0
    if (at < from || at >= to) continue
    const row = rows.get(r.shopId)
    if (!row) continue
    row.count += 1
    if (r.kind === 'points') row.pointCount += 1
    else row.couponCount += 1
    if (r.via === 'guest') row.guest += 1
    else row.staff += 1
    row.amountWon += r.amountWon
    row.shopWon += r.shopWon
    row.opsWon += r.opsWon
  }

  for (const row of Array.from(rows.values())) {
    row.inflowWon = row.amountWon
    row.coveredWon = row.capWon > 0 ? Math.min(row.shopWon, row.capWon) : row.shopWon
    row.overCapWon = row.shopWon - row.coveredWon
    row.opsWon += row.overCapWon
    row.billedWon = row.feeWon + row.coveredWon
    row.cap = capStatus(row.shopWon, row.capWon, alertPercent)
  }

  // Array.from을 쓰는 이유는 tsconfig target이 낮아 Map 순회 전개가 막혀서다
  return Array.from(rows.values())
}

// ---------------------------------------------------------------------------
// 운영사 리포트
// ---------------------------------------------------------------------------

export interface CoverageReport {
  /** 발행한 액면 총액 — 쿠폰 액면 + 적립 포인트 */
  issuedWon: number
  /** 실제로 쓰인 액면 총액 */
  usedWon: number
  shopWon: number
  opsWon: number
  /** 안 쓰고 소멸한 액면 */
  expiredWon: number
  /** 사용률(%) */
  useRate: number
  /** 운영사 부담이 매출의 몇 %인가 */
  opsShareOfRevenue: number
  /** 예산 천장을 넘었는가 */
  overBudget: boolean
}

/**
 * 기간 리포트.
 *
 * `revenueWon`은 코스 결제 매출이다. **가게 충당액은 여기 들어가지 않는다** —
 * 그것은 매출이 아니라 운영사 원가의 차감 항목이라, 매출로 계상하면
 * 재무제표가 부풀려진다. 비용 계정에 올리는 것은 `opsWon`뿐이다.
 */
export function coverageReport(opts: {
  redemptions: RedemptionLike[]
  issuedWon: number
  expiredWon: number
  revenueWon: number
  budgetPercent?: number
}): CoverageReport {
  let usedWon = 0
  let shopWon = 0
  let opsWon = 0
  for (const r of opts.redemptions) {
    usedWon += r.amountWon
    shopWon += r.shopWon
    opsWon += r.opsWon
  }
  const budgetPercent = opts.budgetPercent ?? DEFAULT_SETTLEMENT.budgetPercent
  const opsShare = opts.revenueWon > 0 ? (opsWon / opts.revenueWon) * 100 : 0

  return {
    issuedWon: opts.issuedWon,
    usedWon,
    shopWon,
    opsWon,
    expiredWon: opts.expiredWon,
    useRate: opts.issuedWon > 0 ? Math.round((usedWon / opts.issuedWon) * 100) : 0,
    opsShareOfRevenue: Math.round(opsShare * 10) / 10,
    overBudget: opsShare > budgetPercent,
  }
}
