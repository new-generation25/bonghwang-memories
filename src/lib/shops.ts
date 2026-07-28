/**
 * 골목 가게 — 쿠폰 사용 처리.
 *
 * 쿠폰을 태우는 길은 둘인데 쓰기 경로는 하나여야 한다. 두 화면이 각자
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

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { COUPONS, parseCouponCode } from './coupons'

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
}

const toDate = (v: unknown): Date | null =>
  v instanceof Timestamp ? v.toDate() : null

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
  /** 참여자 쿠폰 코드 — 문서 id가 된다 */
  code: string
  /** 어느 가게에서 쓰는가 */
  shopId: string
  /** 이 요청을 만든 계정. 규칙이 byUid로 대조한다 */
  byUid: string
  via: 'guest' | 'staff'
  /** 주 경로에서 쿠폰 주인의 uid */
  uid?: string
  /** 주 경로에서 스티커의 토큰 */
  token?: string
}

/**
 * 쿠폰을 태운다 — 두 화면이 공유하는 단 하나의 쓰기 경로.
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

  if (parsed.spec.shopId !== opts.shopId) {
    return {
      kind: 'denied',
      reason: `이 쿠폰은 ${parsed.spec.shop}에서만 쓸 수 있어요.`,
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

  try {
    const seen = await already()
    if (seen) return seen

    await setDoc(ref, {
      code: key,
      couponId: parsed.couponId,
      shopId: opts.shopId,
      userTag: parsed.userTag,
      uid: opts.uid ?? '',
      via: opts.via,
      byUid: opts.byUid,
      token: opts.token ?? '',
      usedAt: serverTimestamp(),
    })
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
  return snap.docs.map((d) => d.data() as Shop)
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
    }
  })
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
