/**
 * 골목 가게 — 쿠폰 사용 처리.
 *
 * 쿠폰을 사용 처리하는 길은 둘인데 쓰기 경로는 하나여야 한다. 두 화면이 각자
 * setDoc을 부르면 필드 하나가 어긋나도 한쪽에서만 터지고, 규칙이 거절하는
 * 이유를 화면마다 다르게 해석하게 된다. 그래서 `redeemCoupon()` 하나로 모은다.
 *
 * 두 길:
 *  · 주(guest) — 참여자가 가게 스티커 QR을 앱으로 찍는다.
 *    스티커에 박힌 postToken을 함께 보내고, 규칙이 가게 문서의 값과 맞춘다.
 *    그 토큰을 아는 유일한 방법이 가게 앞에 서는 것이라, 이것이 '다녀왔다'의
 *    증명이 된다. 서버가 없는 앱에서 쓸 수 있는 방법이 이것뿐이다.
 *  · 보조(staff) — 가게 계정으로 로그인한 기기가 참여자 코드를 처리한다.
 *    참여자 카메라가 안 되거나 계정이 없을 때의 유일한 길이다.
 *
 * 왜 트랜잭션이 없나:
 * 규칙이 create만 열고 update를 막는다. 두 기기가 같은 코드를 동시에 찍으면
 * 두 번째는 update가 되어 규칙에서 떨어진다 — 경쟁 조건이 원천 차단된다.
 * 아래의 선조회(getDoc)는 '이미 사용됨'을 예쁘게 보여주기 위한 것일 뿐이다.
 */

import { deleteApp, getApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { logEvent } from './analytics'
import { db } from './firebase'
import { COUPONS, parseCouponCode, parsePointCode } from './coupons'
import {
  DEFAULT_SETTLEMENT,
  splitCoverage,
  type ContractState,
  type MerchantLike,
  type MerchantTier,
  type SettlementConfig,
} from './coverage'

/** 인쇄 스티커 QR의 머리 — scripts/make-shop-qr.mjs의 PREFIX와 같아야 한다 */
export const SHOP_QR_PREFIX = 'BHSHOP'

export interface Shop {
  shopId: string
  name: string
  couponId: string
  benefit: string
  unitWon: number
  staffUids: string[]
  active: boolean
  /**
   * 등급 — 신규 / 기본 협력 / 프리미엄.
   *
   * 등급과 율을 **둘 다** 문서에 둔다. 율을 등급에서 매번 파생하면
   * 설정표를 고치는 순간 지난 달 정산이 함께 움직이는데, 사용 기록의
   * 스냅샷은 이미 굳어 있어 두 숫자가 어긋난다. 율이 값으로 있어야
   * 보안 규칙도 한 번의 get으로 검산할 수 있다.
   */
  tier?: MerchantTier
  /** 사용 시점에 적용할 충당률(%) — 정수. 규칙이 이 값과 대조한다 */
  coverageRate?: number
  /** 가입일 */
  joinedAt?: Date | null
  /** 이 가게의 월 충당 상한(원) */
  monthlyCapWon?: number
  /** 월 회비(원) */
  monthlyFeeWon?: number
  contract?: ContractState
  /**
   * 지금의 충당률이 언제부터인가.
   *
   * 주 경로(참여자가 스티커를 찍는 길)는 사용 기록에 율을 못 남긴다 —
   * 참여자 기기가 그 값을 알 방법이 없기 때문이다. 그 기록은 가게·관리자
   * 기기가 나중에 채워 넣는데(`stampPending`), 그 사이에 충당률이 바뀌었다면
   * 지금 값을 넣으면 안 된다. 이 날짜보다 앞선 기록은 채우지 않고 남겨
   * 관리자가 손으로 판단하게 한다.
   */
  rateSince?: Date | null
  /**
   * 협력 가게 무리 — 예: `'cafe'`.
   *
   * 공용 할인권(`scope: 'group'`)이 이 값으로 통과한다. 비어 있으면
   * 그 가게는 공용 쿠폰을 받지 않는다는 뜻이다.
   */
  group?: string
  /**
   * 이 가게가 더 받는 쿠폰들 — 뽑기로 나오는 특정 가게 쿠폰이 여기 든다.
   * 규칙이 이 칸을 보고 통과시키므로 시드 문서에 없으면 교환이 거절된다.
   */
  accepts?: string[]
  /** 이 가게가 받는 공용 할인권 id들 */
  groupCoupons?: string[]
  /**
   * 카운터 스티커에 박힌 값. 참여자에게는 절대 닿지 않는다 — 규칙이
   * shops 읽기를 관리자와 그 가게 직원에게만 연다.
   * 관리자 화면이 스티커를 다시 뽑을 때 보려고 담아둔다.
   */
  postToken?: string
}

export interface ShopUse {
  code: string
  couponId: string
  shopId: string
  userTag: string
  /** 주 경로에서 쿠폰 주인. 보조 경로는 빈 문자열 */
  uid: string
  via: 'guest' | 'staff'
  usedAt: Date | null
  /** 쿠폰인가 포인트인가 — 가게 입장에서는 같은 값으로 쓰이지만 세는 칸은 다르다 */
  kind: 'coupon' | 'points'
  /** 할인 액면(원). 옛 기록에는 없어 0이다 */
  amountWon: number
  /** **사용 시점에 값으로 굳은** 충당률(%) */
  coverageRate: number
  shopWon: number
  opsWon: number
}

const toDate = (v: unknown): Date | null =>
  v instanceof Timestamp ? v.toDate() : null

const numOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

/**
 * 가게 문서를 정산이 보는 모양으로 옮긴다.
 *
 * 옛 문서에는 등급·율·상한이 없다. 없을 때 **신규(0%)로 떨어뜨리는 것**이
 * 안전한 기본값이다 — 잘못 짚어도 운영사가 더 부담할 뿐, 가게에 없는
 * 청구서를 보내지 않는다.
 */
export function toMerchant(
  shop: Shop,
  cfg: SettlementConfig = DEFAULT_SETTLEMENT
): MerchantLike {
  const tier: MerchantTier = shop.tier ?? 'free'
  const joinedAt = shop.joinedAt ? shop.joinedAt.getTime() : null
  return {
    shopId: shop.shopId,
    tier,
    coverageRate: numOr(shop.coverageRate, cfg.coverage[tier]),
    joinedAt,
    monthlyCapWon: numOr(shop.monthlyCapWon, cfg.monthlyCap[tier]),
    contract: shop.contract ?? 'active',
    active: shop.active !== false,
  }
}

/**
 * 새로 세우는 가게의 정산 칸.
 *
 * 무조건 **신규(0%)로 연다.** 가입 직후 3개월은 할인액을 운영사가 전액
 * 부담하는 기간이고, 그 사이에 가게는 이 판이 어떤 것인지 본다. 여기서
 * 기본 협력으로 열면, 아직 아무것도 받아보지 못한 가게에 첫 달부터
 * 청구서가 간다.
 */
function coverageDefaults(cfg: SettlementConfig = DEFAULT_SETTLEMENT) {
  const now = Date.now()
  return {
    tier: 'free' as MerchantTier,
    coverageRate: cfg.coverage.free,
    monthlyCapWon: cfg.monthlyCap.free,
    monthlyFeeWon: cfg.monthlyFee.free,
    contract: 'active' as ContractState,
    joinedAt: Timestamp.fromMillis(now),
    rateSince: Timestamp.fromMillis(now),
  }
}

/** 문서에서 읽어 올린 가게 — 정산에 필요한 값이 전부 채워진 꼴 */
function shopFromDoc(v: Record<string, unknown>): Shop {
  return {
    ...(v as unknown as Shop),
    joinedAt: toDate(v.joinedAt),
    rateSince: toDate(v.rateSince),
  }
}

/**
 * 스티커 QR을 뜯어본다 — `BHSHOP:cp1:AW5NAYAY`.
 *
 * 주소(URL)가 아니라 이 모양을 쓰는 이유가 있다. 홈 화면에 설치한 PWA는
 * 사파리와 저장소가 갈려서, 주소를 시스템 카메라로 찍으면 로그인도 쿠폰도
 * 없는 사파리 창이 열린다. 앱 안에서 찍게 만들려면 앱만 아는 모양이어야 한다.
 * 거점 QR(`BH88:T1`)과 결이 같아 QRScanner를 그대로 쓴다.
 */
export function parseShopQr(raw: string): { shopId: string; token: string } | null {
  const m = raw.trim().toUpperCase().match(/^BHSHOP:([A-Z0-9]+):([2-9A-Z]{8})$/)
  if (!m) return null
  return { shopId: m[1].toLowerCase(), token: m[2] }
}

export type RedeemOutcome =
  | { kind: 'ok' }
  /** 이미 쓴 쿠폰 */
  | { kind: 'used'; at: string }
  /** 규칙이 거절했거나 애초에 맞지 않는 쿠폰 — 통신 문제가 아니다 */
  | { kind: 'denied'; reason: string }
  /** 슈퍼관리자 시험용 코드 — 기록을 남기지 않는다 */
  | { kind: 'test' }
  /** 서버에 못 닿았다. 통과시키지 않는다 */
  | { kind: 'offline' }

interface RedeemOptions {
  /** 손님 쿠폰 코드 — 문서 id가 된다 */
  code: string
  /** 어느 가게에서 쓰는가 — 찍은 스티커가 말해준다 */
  shopId: string
  /** 그 가게가 든 협력 무리 — 공용 할인권을 받으려면 있어야 한다 */
  shopGroup?: string
  /** 쿠폰 주인이자 이 요청을 만든 계정. 규칙이 둘이 같은지 본다 */
  uid: string
  /** 스티커에 박힌 토큰 — 그 앞에 서 봤다는 증거 */
  token: string
}

/**
 * 쿠폰을 사용 처리한다 — 두 화면이 공유하는 단 하나의 쓰기 경로.
 *
 * 실패를 '거절'과 '통신 문제'로 반드시 가른다. 예전 코드는 모든 예외를
 * 오프라인으로 뭉갰는데, 그러면 규칙이 막은 것도 사장님께는
 * "지금은 확인할 수 없어요"로 보인다 — 신호를 찾아 밖으로 나가게 된다.
 */
export async function redeemCoupon(opts: RedeemOptions): Promise<RedeemOutcome> {
  const parsed = parseCouponCode(opts.code)
  if (!parsed) {
    return { kind: 'denied', reason: '이 앱의 쿠폰 코드가 아닙니다.' }
  }

  // 시험용 코드는 서버까지 가지 않는다. 규칙의 정규식에도 걸리지 않지만,
  // 여기서 먼저 끊어야 사장님께 "드리지 않으셔도 됩니다"를 보여줄 수 있다.
  if (parsed.isTest) return { kind: 'test' }

  /*
    쓰는 곳을 가른다(CouponScope).

     · shop  — 그 가게에서만
     · group — 그 무리에 든 가게 어디서나. 가게 문서의 group과 맞는지는
               규칙이 본다. 여기서는 형식만 통과시킨다
     · info  — 안내소 교환권. 가게 카운터에서 찍을 것이 아니다
  */
  if (parsed.spec.scope === 'info') {
    return {
      kind: 'denied',
      reason: '안내소에서 교환하는 쿠폰이에요. 가게에서는 쓸 수 없어요.',
    }
  }
  if (parsed.spec.scope === 'shop' && parsed.spec.shopId !== opts.shopId) {
    return {
      kind: 'denied',
      reason: `이 쿠폰은 ${parsed.spec.shop}에서만 쓸 수 있어요.`,
    }
  }
  if (parsed.spec.scope === 'group' && parsed.spec.group !== opts.shopGroup) {
    return {
      kind: 'denied',
      reason: `이 쿠폰은 ${parsed.spec.shop} 쓸 수 있어요 — 이 가게는 해당되지 않아요.`,
    }
  }

  if (!db) return { kind: 'offline' }

  const key = opts.code.trim().toUpperCase()
  const ref = doc(db, 'couponUses', key)

  const already = async (): Promise<RedeemOutcome | null> => {
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const at = toDate(snap.data()?.usedAt)
    return { kind: 'used', at: at ? at.toLocaleString('ko-KR') : '기록 있음' }
  }

  /*
    할인 액면은 손님 기기도 안다 — 카탈로그에 적혀 있다. 반면 충당률은
    가게 문서에만 있고 손님은 그 문서를 읽을 수 없으므로 비워 둔다.
    그 칸은 나중에 stampPending()이 채운다.
  */
  const amountWon = parsed.spec.unitWon

  try {
    const seen = await already()
    if (seen) return seen

    await setDoc(ref, {
      code: key,
      couponId: parsed.couponId,
      shopId: opts.shopId,
      userTag: parsed.userTag,
      uid: opts.uid,
      via: 'guest',
      byUid: opts.uid,
      token: opts.token,
      kind: 'coupon',
      amountWon,
      usedAt: serverTimestamp(),
    })
    logEvent('coupon_used', { id: parsed.couponId, shopId: opts.shopId })
    return { kind: 'ok' }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''

    /*
      권한 거절은 둘 중 하나다.
      · 그 사이 다른 기기가 먼저 찍었다 → update가 되어 거절 (진짜 '이미 사용됨')
      · 토큰이 틀렸거나 가게가 맞지 않다 → 처음부터 만들 수 없는 요청
      한 번 더 읽어보면 갈린다.
    */
    if (code === 'permission-denied') {
      const seen = await already().catch(() => null)
      if (seen) return seen
      return {
        kind: 'denied',
        reason: '가게 QR을 다시 찍어주세요. 확인되지 않는 요청입니다.',
      }
    }

    console.error('[쿠폰 사용 실패]', { code, key, shopId: opts.shopId })
    return { kind: 'offline' }
  }
}

// ---------------------------------------------------------------------------
// 포인트 사용 — 쿠폰과 같은 통화, 같은 기록, 같은 정산
// ---------------------------------------------------------------------------

interface RedeemPointsOptions {
  /** 손님이 만든 `PT1-…` 코드 — 문서 id가 된다 */
  code: string
  /** 얼마를 쓸지. 1p = 1원이라 그대로 포인트 수다 */
  amountWon: number
  /** 어느 가게에서 쓰는가 — 찍은 스티커가 말해준다 */
  shopId: string
  /** 포인트 주인이자 이 요청을 만든 계정 */
  uid: string
  /** 스티커에 박힌 토큰 */
  token: string
}

/**
 * 포인트를 사용 처리한다 — `redeemCoupon()`과 같은 길, 같은 기록.
 *
 * 가게 입장에서 2,000원 쿠폰과 2,000p 포인트는 같은 형태로 쓰인다. 그래서
 * 같은 컬렉션(`couponUses`)에 같은 모양으로 남긴다 — 정산이 두 갈래를
 * 따로 세면 어느 쪽이 빠졌는지 알 수 없다.
 *
 * 쿠폰과 다른 점은 둘뿐이다. 액면이 코드에 없어 **금액을 손님이 넣고**,
 * '어디서 쓰는 것'이라는 표시가 없어 어느 가게든 받는다.
 *
 * 잔액이 그만큼 남아 있는지는 부르는 화면이 본다. 서버에서 다시 재지 못하는
 * 것은 지갑이 기기의 원장이기 때문인데, 그 대신 사장님이 완료 화면의 금액을
 * 눈으로 확인한다 — 쿠폰의 체크값과 같은 무게의 방어다.
 */
export async function redeemPoints(
  opts: RedeemPointsOptions
): Promise<RedeemOutcome> {
  const parsed = parsePointCode(opts.code)
  if (!parsed) {
    return { kind: 'denied', reason: '포인트 사용 코드가 아닙니다.' }
  }

  const amountWon = Math.round(opts.amountWon)
  if (!Number.isInteger(amountWon) || amountWon <= 0) {
    return { kind: 'denied', reason: '쓸 금액을 넣어주세요.' }
  }

  if (!db) return { kind: 'offline' }

  const key = opts.code.trim().toUpperCase()
  const ref = doc(db, 'couponUses', key)

  try {
    const seen = await getDoc(ref)
    if (seen.exists()) {
      const at = toDate(seen.data()?.usedAt)
      return { kind: 'used', at: at ? at.toLocaleString('ko-KR') : '기록 있음' }
    }

    /*
      충당률은 여기서도 비워 둔다 — 손님 기기는 가게 문서를 읽지 못한다.
      stampPending()이 나중에 채운다. 상한에 닿았는지도 재지 않는다:
      상한은 청구를 자르는 장치이지 사용을 막는 장치가 아니다.
    */
    await setDoc(ref, {
      code: key,
      couponId: 'pt',
      shopId: opts.shopId,
      userTag: parsed.userTag,
      uid: opts.uid,
      via: 'guest',
      byUid: opts.uid,
      token: opts.token,
      kind: 'points',
      amountWon,
      usedAt: serverTimestamp(),
    })
    logEvent('points_used', { shopId: opts.shopId, amount: amountWon })
    return { kind: 'ok' }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'permission-denied') {
      return {
        kind: 'denied',
        reason: '확인되지 않는 요청입니다. 코드를 다시 찍어주세요.',
      }
    }
    console.error('[포인트 사용 실패]', { code, key, shopId: opts.shopId })
    return { kind: 'offline' }
  }
}

/**
 * 이 계정이 맡은 가게들.
 * 사장님 기기가 '내 가게가 어디인지'를 스스로 찾는다 — 주소에 가게를 박아두면
 * 링크가 새는 순간 남의 가게 화면이 열린다.
 */
export async function fetchMyShops(uid: string): Promise<Shop[]> {
  if (!db || !uid) return []
  const snap = await getDocs(
    query(collection(db, 'shops'), where('staffUids', 'array-contains', uid))
  )
  return snap.docs.map((d) => shopFromDoc(d.data()))
}

/**
 * 가게의 사용 내역 — 최근 것부터.
 *
 * 규칙이 목록을 문서마다 재므로 한 번에 너무 많이 부르지 않는다.
 * 정산은 월 단위인데 가게 하나가 한 달에 200장을 넘길 일이 없다.
 */
export async function fetchShopUses(shopId: string, max = 200): Promise<ShopUse[]> {
  if (!db || !shopId) return []
  const snap = await getDocs(
    query(
      collection(db, 'couponUses'),
      where('shopId', '==', shopId),
      orderBy('usedAt', 'desc'),
      fsLimit(max)
    )
  )
  return snap.docs.map((d) => {
    const v = d.data()
    return {
      code: (v.code as string) ?? d.id,
      couponId: v.couponId as string,
      shopId: v.shopId as string,
      userTag: (v.userTag as string) ?? '',
      uid: (v.uid as string) ?? '',
      via: (v.via as 'guest' | 'staff') ?? 'staff',
      usedAt: toDate(v.usedAt),
      kind: v.kind === 'points' ? 'points' : 'coupon',
      amountWon: numOr(v.amountWon, 0),
      // -1은 '아직 안 찍혔다'는 뜻이다. 0은 신규 가게(0%)의 정당한 값이라
      // 둘을 같은 값으로 두면 다 찍힌 신규 가게가 영원히 대기로 보인다.
      coverageRate: numOr(v.coverageRate, -1),
      shopWon: numOr(v.shopWon, 0),
      opsWon: numOr(v.opsWon, 0),
    }
  })
}

/**
 * 아직 충당률이 안 찍힌 기록에 스냅샷을 채운다.
 *
 * 주 경로(참여자가 스티커를 찍는 길)가 남긴 기록에는 율이 없다. 참여자
 * 기기가 그 값을 알 방법이 없기 때문이다 — 가게 문서를 읽히면 스티커
 * 토큰이 함께 샌다. 그래서 충당률을 아는 기기가 뒤늦게 채워 넣는다. 가게 내역
 * 화면과 관리자 정산 화면이 열릴 때마다 부른다.
 *
 * **충당률이 바뀐 뒤의 기록에는 지금 값을 채우지 않는다.** `rateSince`보다 앞선
 * 것은 건드리지 않고 세어서 돌려준다 — 지어내는 것보다 관리자가 손으로
 * 판단하는 편이 낫고, 그 숫자가 화면에 뜨면 미룰 수 없게 된다.
 */
export async function stampPending(
  shop: Shop,
  cfg: SettlementConfig = DEFAULT_SETTLEMENT
): Promise<{ stamped: number; skipped: number }> {
  if (!db) return { stamped: 0, skipped: 0 }

  const m = toMerchant(shop, cfg)
  const since = shop.rateSince ? shop.rateSince.getTime() : 0
  const uses = await fetchShopUses(shop.shopId, 500)

  let stamped = 0
  let skipped = 0
  for (const u of uses) {
    if (u.coverageRate >= 0) continue
    if (!u.usedAt || u.usedAt.getTime() < since) {
      skipped++
      continue
    }
    const s = splitCoverage(u.amountWon, m.coverageRate)
    try {
      await updateDoc(doc(db, 'couponUses', u.code), {
        coverageRate: s.coverageRate,
        shopWon: s.shopWon,
        opsWon: s.opsWon,
        stampedAt: serverTimestamp(),
      })
      stamped++
    } catch {
      // 규칙이 막으면(남의 가게·관리자 아님) 조용히 넘긴다 — 다음에 여는
      // 기기가 찍는다. 여기서 던지면 내역 화면이 통째로 안 뜬다.
      skipped++
    }
  }
  return { stamped, skipped }
}

/** 쿠폰 하나가 이미 쓰였는지 — 참여자 지갑이 회색으로 바꿀 때 쓴다 */
export async function isCouponUsed(code: string): Promise<boolean> {
  if (!db || !code) return false
  try {
    return (await getDoc(doc(db, 'couponUses', code.toUpperCase()))).exists()
  } catch {
    // 확인 못 했다고 '안 썼다'로 보이면 곤란하지만, 여기서 막으면 지갑이
    // 통째로 안 뜬다. 실제 방어는 사용 시점의 규칙이다.
    return false
  }
}

/** 가게 이름 — 사용 기록에는 표시 문자열을 남기지 않으므로 여기서 만든다 */
export function shopName(shopId: string): string {
  return COUPONS[shopId]?.shop ?? shopId
}

/**
 * 가게 문서 심기 — 관리자만.
 *
 * postToken이 들어 있어 코드에 박아둘 수 없다(클라이언트 번들은 누구나 읽는다).
 * 그렇다고 콘솔에 붙여넣게 하면 크롬이 막고, 거기서 불러오는 SDK는 페이지의
 * 것과 달라 앱을 또 세워야 한다. 관리자 화면의 입력칸으로 받으면 둘 다 없다 —
 * 이미 관리자로 로그인한 세션이 그대로 쓴다.
 *
 * 값은 scripts/make-shop-qr.mjs가 shop-qr/shops.json으로 뽑는다.
 */
export async function seedShops(raw: string): Promise<{ ok: string[]; fail: string[] }> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')

  let list: unknown
  try {
    list = JSON.parse(raw)
  } catch {
    throw new Error('JSON 형식이 아닙니다. shops.json을 통째로 붙여넣었는지 보세요.')
  }
  if (!Array.isArray(list)) throw new Error('배열이어야 합니다. shops.json 전체를 붙여넣으세요.')

  const ok: string[] = []
  const fail: string[] = []

  for (const item of list as Shop[]) {
    // 규칙이 대조하는 값들이라 하나만 비어도 나중에 사용 처리가 통째로 막힌다
    if (!item?.shopId || !item?.couponId || !item?.postToken) {
      fail.push(`${item?.shopId ?? '?'} — shopId·couponId·postToken 중 빠진 값`)
      continue
    }
    try {
      /*
        이미 있는 가게에는 등급·율·가입일을 다시 심지 않는다. 다시 심으면
        신규 유예가 처음부터 다시 흐르고, 이미 프리미엄인 가게가 조용히
        신규로 내려앉는다 — 시드는 문서를 세우는 도구이지 계약을 되돌리는
        도구가 아니다.
      */
      const before = await getDoc(doc(db, 'shops', item.shopId))
      const coverage = before.exists() ? {} : coverageDefaults()

      await setDoc(doc(db, 'shops', item.shopId), {
        shopId: item.shopId,
        name: item.name ?? item.shopId,
        couponId: item.couponId,
        benefit: item.benefit ?? '',
        unitWon: Number(item.unitWon ?? 0),
        postToken: item.postToken,
        staffUids: Array.isArray(item.staffUids) ? item.staffUids.filter(Boolean) : [],
        active: item.active !== false,
        /*
          그룹·추가 쿠폰을 받아 넣는다. 규칙은 이 두 칸을 보고 그룹·뽑기
          쿠폰을 통과시키는데, 시드 문서에 없어서 교환 시점에 거절되던
          것을 여기서 잇는다.
        */
        group: item.group ?? '',
        accepts: Array.isArray(item.accepts) ? item.accepts : [],
        groupCoupons: Array.isArray(item.groupCoupons) ? item.groupCoupons : [],
        ...coverage,
      })
      ok.push(`${item.shopId} ${item.name ?? ''}`)
    } catch (err) {
      const code = (err as { code?: string })?.code ?? ''
      fail.push(`${item.shopId} — ${code || '쓰지 못했습니다'}`)
    }
  }
  return { ok, fail }
}

// ---------------------------------------------------------------------------
// 관리자 — 가게 관리
// ---------------------------------------------------------------------------

/** 가게 전부. 규칙상 관리자만 목록을 볼 수 있다 */
export async function fetchAllShops(): Promise<Shop[]> {
  if (!db) return []
  const snap = await getDocs(query(collection(db, 'shops'), orderBy('shopId')))
  return snap.docs.map((d) => shopFromDoc(d.data()))
}

/** 문 닫은 가게는 사용 처리를 막는다 — 규칙이 active를 본다 */
export async function setShopActive(shopId: string, active: boolean): Promise<void> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')
  await updateDoc(doc(db, 'shops', shopId), { active })
}

/**
 * 빠진 칸만 채운다 — 「가게 문서 보수」.
 *
 * 시드된 문서에 `accepts`·`groupCoupons`가 없어 그룹·뽑기 쿠폰이 교환
 * 시점에 거절되고, 등급 칸이 없어 정산이 신규로 읽던 것을 한 번에 잇는다.
 *
 * **있는 값은 건드리지 않는다.** 다시 심기(seedShops)는 문서를 세우는
 * 도구라 등급과 가입일을 되돌릴 수 있고, 무엇보다 관리자가 shops.json을
 * 찾아 붙여넣어야 한다 — 그 파일은 외장하드를 따라다녀서 자리를 옮기면
 * 없다. 여기서는 이미 서버에 있는 문서를 보고 빈 칸만 메운다.
 *
 * 카탈로그가 말해줄 수 있는 것만 채운다. 스티커 토큰은 만들지 않는다 —
 * 없다면 인쇄물과 짝이 맞지 않는다는 뜻이고, 새로 만들면 이미 붙어 있는
 * 스티커가 죽는다.
 */
export async function repairShops(
  cfg: SettlementConfig = DEFAULT_SETTLEMENT
): Promise<{ fixed: string[]; noToken: string[] }> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')

  const fixed: string[] = []
  const noToken: string[] = []

  for (const shop of await fetchAllShops()) {
    const patch: Record<string, unknown> = {}

    // 그 가게에서 더 받는 쿠폰 — 카탈로그가 shopId로 가리키는 것들
    const accepts = Object.values(COUPONS)
      .filter((c) => c.scope === 'shop' && c.shopId === shop.shopId && c.id !== shop.couponId)
      .map((c) => c.id)
    if (accepts.length && !(shop.accepts ?? []).length) patch.accepts = accepts

    // 공용 할인권 — 그 가게가 든 무리의 것
    if (shop.group) {
      const groupCoupons = Object.values(COUPONS)
        .filter((c) => c.scope === 'group' && c.group === shop.group)
        .map((c) => c.id)
      if (groupCoupons.length && !(shop.groupCoupons ?? []).length) {
        patch.groupCoupons = groupCoupons
      }
    }

    if (!shop.tier) {
      const now = Date.now()
      patch.tier = 'free'
      patch.coverageRate = cfg.coverage.free
      patch.monthlyCapWon = cfg.monthlyCap.free
      patch.monthlyFeeWon = cfg.monthlyFee.free
      patch.contract = shop.contract ?? 'active'
      patch.joinedAt = shop.joinedAt ?? Timestamp.fromMillis(now)
      patch.rateSince = shop.rateSince ?? Timestamp.fromMillis(now)
    }

    if (!shop.postToken) noToken.push(`${shop.shopId} ${shop.name ?? ''}`)
    if (Object.keys(patch).length === 0) continue

    await updateDoc(doc(db, 'shops', shop.shopId), patch)
    fixed.push(`${shop.shopId} — ${Object.keys(patch).join('·')}`)
  }

  return { fixed, noToken }
}

/**
 * 등급을 바꾼다 — 율·회비·상한이 함께 움직인다.
 *
 * `rateSince`를 지금으로 찍는 것이 이 함수의 핵심이다. 이 값이 없으면
 * 아직 안 찍힌 지난 기록에 새 율이 소급돼 버린다. 이미 채워진 기록은
 * 스냅샷이라 무슨 짓을 해도 움직이지 않는다 — 그게 스냅샷을 두는 이유다.
 */
export async function setShopTier(
  shopId: string,
  tier: MerchantTier,
  cfg: SettlementConfig = DEFAULT_SETTLEMENT
): Promise<void> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')
  await updateDoc(doc(db, 'shops', shopId), {
    tier,
    coverageRate: cfg.coverage[tier],
    monthlyCapWon: cfg.monthlyCap[tier],
    monthlyFeeWon: cfg.monthlyFee[tier],
    rateSince: serverTimestamp(),
  })
}

/** 계약 상태 — `active`가 아니면 그 가게에서 혜택을 쓸 수 없다 */
export async function setShopContract(
  shopId: string,
  contract: ContractState
): Promise<void> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')
  await updateDoc(doc(db, 'shops', shopId), { contract })
}

/** 그 가게만 상한을 달리 잡을 때 — 등급 기본값을 덮어쓴다 */
export async function setShopCap(shopId: string, capWon: number): Promise<void> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')
  await updateDoc(doc(db, 'shops', shopId), {
    monthlyCapWon: Math.max(0, Math.round(capWon)),
  })
}

export async function removeShopStaff(shopId: string, uid: string): Promise<void> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')
  await updateDoc(doc(db, 'shops', shopId), { staffUids: arrayRemove(uid) })
}

/** auth.ts의 ID_DOMAIN과 같아야 한다 — 앱이 아이디를 이 꼴로 바꿔 저장한다 */
const ID_DOMAIN = 'bonghwang.local'

/** 스티커 토큰용 32진수 — 쿠폰 코드와 같은 표. 헷갈리는 글자(O/0, I/1)가 없다 */
const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function newPostToken(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < 8; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length]
  return out
}

/**
 * 가게와 계정을 한 번에 — 관리자 화면의 「＋ 가게 추가」.
 *
 * 등록과 계정이 따로 놀 이유가 없다. 가게 하나에 사장님 하나가 보통이고,
 * 나눠 놓으면 "가게는 있는데 계정이 없다"는 어정쩡한 상태를 관리자가
 * 이해해야 한다.
 *
 * 가게 문서가 이미 있으면 그대로 두고 계정만 붙인다 — 토큰이 바뀌면
 * 이미 카운터에 붙은 스티커가 죽기 때문에, 있는 가게를 다시 추가해도
 * 토큰은 절대 갈리지 않는다.
 *
 * 나중에 서버(Route Handler + Admin SDK)로 옮길 때는 이 함수 몸통을
 * fetch('/api/admin/shops', ...)로 갈아끼우면 된다 — 화면은 이 함수만 안다.
 */
export async function addShop(opts: {
  couponId: string
  name: string
  benefit: string
  unitWon: number
  loginId: string
  password: string
}): Promise<{ shopId: string; postToken: string; uid: string }> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')
  const shopId = opts.couponId

  const ref = doc(db, 'shops', shopId)
  const existing = await getDoc(ref)

  let postToken: string
  if (existing.exists()) {
    postToken = (existing.data() as Shop).postToken ?? newPostToken()
  } else {
    postToken = newPostToken()
    await setDoc(ref, {
      shopId,
      name: opts.name.trim(),
      couponId: opts.couponId,
      benefit: opts.benefit.trim(),
      unitWon: Number(opts.unitWon) || 0,
      postToken,
      staffUids: [],
      active: true,
      group: '',
      accepts: [],
      groupCoupons: [],
      ...coverageDefaults(),
    })
  }

  const uid = await createShopAccount({
    loginId: opts.loginId,
    password: opts.password,
    nickname: opts.name.trim().replace(/\s+/g, '').slice(0, 12),
    shopId,
  })

  return { shopId, postToken, uid }
}

/**
 * 가게 계정을 만들고 그 가게 직원으로 등록한다.
 *
 * 보조 앱 인스턴스를 따로 세우는 이유가 있다. 기본 인스턴스로 계정을 만들면
 * Firebase Auth가 **새 사용자로 로그인을 갈아치운다** — 관리자가 자기 화면에서
 * 로그아웃되는 셈이다. 보조 인스턴스는 세션이 따로라 본 화면이 흔들리지 않는다.
 *
 * 프로필 문서는 규칙이 isOwner를 요구하므로 그 보조 세션으로 써야 한다.
 * staffUids에 넣는 것은 관리자만 할 수 있으니 본 세션으로 쓴다.
 */
export async function createShopAccount(opts: {
  loginId: string
  password: string
  nickname: string
  shopId: string
}): Promise<string> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')

  const loginId = opts.loginId.trim().toLowerCase()
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(loginId)) {
    throw new Error('아이디는 영문·숫자·밑줄 4~20자입니다.')
  }
  if (opts.password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.')
  const nickname = opts.nickname.trim()
  if (nickname.length < 2 || nickname.length > 12) {
    throw new Error('가게 이름(닉네임)은 2~12자입니다.')
  }

  const secondary = initializeApp(getApp().options, `shop-${Date.now()}`)
  try {
    const cred = await createUserWithEmailAndPassword(
      getAuth(secondary),
      `${loginId}@${ID_DOMAIN}`,
      opts.password
    )
    const uid = cred.user.uid
    await updateProfile(cred.user, { displayName: nickname })

    await setDoc(doc(getFirestore(secondary), 'users', uid), {
      uid,
      loginId,
      nickname,
      nicknameKey: nickname.toLowerCase(),
      provider: 'password',
      totalScore: 0,
      completedMissions: [],
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    })

    // 관리자 세션으로 — 가게 문서는 관리자만 고칠 수 있다
    await updateDoc(doc(db, 'shops', opts.shopId), { staffUids: arrayUnion(uid) })
    return uid
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'auth/email-already-in-use') {
      throw new Error('이미 있는 아이디입니다. 다른 아이디를 쓰거나, 아래 목록에서 확인하세요.')
    }
    if (code === 'not-found') {
      throw new Error('그 가게 문서가 아직 없습니다. 먼저 「가게 문서 심기」를 하세요.')
    }
    throw new Error(code || (err instanceof Error ? err.message : '계정을 만들지 못했습니다.'))
  } finally {
    // 보조 세션을 남겨두면 다음 작업에서 누구로 쓰는지 헷갈린다
    await deleteApp(secondary).catch(() => {})
  }
}
