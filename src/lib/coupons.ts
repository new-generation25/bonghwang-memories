/**
 * 골목 가게 쿠폰.
 *
 * 참여자 화면에 QR을 띄우고, 가게에서 그 QR을 찍어 사용 처리한다.
 * 종이 없이 돌아가되 '한 번만 쓴다'는 것만은 확실해야 한다.
 *
 * 코드 구성 — BH1-{쿠폰}-{사용자 6자}-{순번 2자}{체크 2자}
 *   예) BH1-CP1-K3M9QF-237A
 *
 * 순번이 붙는 이유. 예전에는 코드가 (쿠폰, uid)로 완전히 정해져서 한 번
 * 소진되면 그 사람은 영영 그 쿠폰을 못 썼다. 사용 기록은 만들기만 되고
 * 지울 수 없으니(관리자만 삭제) 잘못 찍힌 코드를 되돌릴 방법이 없었다.
 * 가게에서 실수로 두 번 찍거나, 참여자가 QR을 미리 열어보다 소진되는
 * 일이 실제로 일어난다. 순번을 올리면 새 코드가 나온다 — 이미 발급된
 * 번호는 그대로 두고 다음 번호를 쓰는 것이라, 지난 기록도 남는다.
 *
 * 체크값은 서명이 아니다. 서버 비밀 없이 클라이언트에서 만드는 값이라
 * 마음먹으면 위조할 수 있다. 그래도 두는 이유는 두 가지다:
 *  · 손으로 코드를 부를 때 오타를 잡는다(가게에서 자주 일어난다)
 *  · 아무 문자열이나 들이미는 장난을 걸러낸다
 * 진짜 방어는 사용 기록이다 — 쓴 코드는 Firestore에 남고, 두 번째
 * 스캔은 '이미 사용됨'으로 거절된다. 쿠폰 값이 4,000원이라 이 정도면
 * 맞는 무게라고 봤다. 금액이 커지면 서버 서명으로 올려야 한다.
 */

import { TRACK_MISSIONS } from './tracks'

export interface CouponSpec {
  id: string
  /** 가게 이름 — 쿠폰을 쓸 수 있는 곳 */
  shop: string
  /** 참여자에게 보이는 혜택 문구 */
  benefit: string
  /** 어느 거점에서 받는지 */
  track: number
}

/**
 * 쿠폰 카탈로그.
 * 혜택 문구는 가게와 협의해 정하는 값이라 여기 한 곳에서만 고친다.
 */
export const COUPONS: Record<string, CouponSpec> = {
  cp1: { id: 'cp1', shop: '봉황1935', benefit: '음료 1,000원 할인', track: 1 },
  cp2: { id: 'cp2', shop: '미야상회', benefit: '바나나우유 500원 할인', track: 2 },
  cp3: { id: 'cp3', shop: '능소화 고택', benefit: '엽서 1장 증정', track: 3 },
  cp4: { id: 'cp4', shop: '카페 탱자', benefit: '아메리카노 1,000원 할인', track: 4 },
  cp5: { id: 'cp5', shop: '방하림', benefit: '도자기 1,000원 할인', track: 5 },
}

export function couponSpec(id: string): CouponSpec | null {
  return COUPONS[id] ?? null
}

/** 이 거점에서 주는 쿠폰 id */
export function couponForTrack(track: number): string | null {
  const m = Object.values(TRACK_MISSIONS).find(
    (x) => x.track === track && x.reward?.coupon
  )
  return m?.reward?.coupon ?? null
}

/** 32진수(헷갈리는 글자 제외) — 손으로 부를 때 O/0, I/1을 섞지 않는다 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function hash32(input: string): number {
  // FNV-1a. 암호학적 강도는 없다 — 오타 검출이 목적이다
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function encode(n: number, len: number): string {
  let out = ''
  let v = n
  for (let i = 0; i < len; i++) {
    out = ALPHABET[v % ALPHABET.length] + out
    v = Math.floor(v / ALPHABET.length)
  }
  return out
}

/** 사용자 식별 6자 — uid를 그대로 노출하지 않으려고 접어 쓴다 */
function userTag(uid: string): string {
  return encode(hash32(`user:${uid}`), 6)
}

function checksum(couponId: string, uid: string, serial: number): string {
  return encode(hash32(`bh1:${couponId}:${uid}:${serial}`), 2)
}

/** 순번 2자 — 32진수라 00~ZZ까지 1,024장. 한 쿠폰을 그만큼 다시 낼 일은 없다 */
function serialTag(serial: number): string {
  return encode(serial % 1024, 2)
}

/**
 * 발급 순번 보관.
 *
 * 기기에만 둔다. 서버에 두면 쿠폰을 새로 내는 데 통신이 필요한데, 정작
 * 다시 내야 하는 자리는 가게 앞이고 거기 신호가 약한 골목이 많다.
 * 순번이 어긋나도 손해가 없다 — 코드가 겹치지만 않으면 되고, 겹치면
 * 사용 기록이 막는다.
 */
const SERIAL_KEY = 'bh_coupon_serial_v1'

function serialMap(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(SERIAL_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** 지금 유효한 순번 — 한 번도 다시 내지 않았으면 0 */
export function couponSerial(couponId: string, uid: string): number {
  return serialMap()[`${couponId}:${uid}`] ?? 0
}

/**
 * 다음 번호로 넘긴다 — 새 코드가 나온다.
 *
 * 이미 발급된 번호는 그대로 둔다. 되돌리는 것이 아니라 다음 장을 뜯는
 * 것이라, 앞 번호의 사용 기록도 그대로 남는다.
 */
export function reissueCoupon(couponId: string, uid: string): number {
  const key = `${couponId}:${uid}`
  const map = serialMap()
  const next = (map[key] ?? 0) + 1
  map[key] = next
  try {
    window.localStorage.setItem(SERIAL_KEY, JSON.stringify(map))
  } catch {
    /* 저장 못 해도 이번 화면에서는 새 코드가 보인다 */
  }
  return next
}

/**
 * 참여자 화면에 띄울 쿠폰 코드.
 *
 * test를 주면 접두사가 BH1T가 된다. 슈퍼관리자가 순서를 건너뛰며 받은
 * 쿠폰이 그것이다 — 확인 화면이 알아보고 사용 기록을 남기지 않는다.
 *
 * serial을 생략하면 지금 순번을 읽어 쓴다. 가게에서 잘못 찍혀 소진된
 * 코드는 reissueCoupon으로 다음 번호를 받으면 된다.
 */
export function makeCouponCode(
  couponId: string,
  uid: string,
  test = false,
  serial?: number
): string {
  const prefix = test ? 'BH1T' : 'BH1'
  const n = serial ?? couponSerial(couponId, uid)
  return `${prefix}-${couponId.toUpperCase()}-${userTag(uid)}-${serialTag(n)}${checksum(couponId, uid, n)}`
}

export interface ParsedCoupon {
  couponId: string
  userTag: string
  spec: CouponSpec
  /** 몇 번째로 발급된 코드인지 — 가게 화면에 참고로 보인다 */
  serial: string
  /** 시험용 코드 — 사용 기록을 남기지 않는다 */
  isTest: boolean
}

/**
 * 가게에서 찍은 코드를 뜯어본다.
 * 형식이나 체크값이 어긋나면 null — 사용 처리로 넘어가지 않는다.
 */
export function parseCouponCode(raw: string): ParsedCoupon | null {
  const code = raw.trim().toUpperCase()
  const m = code.match(/^BH1(T?)-([A-Z0-9]+)-([2-9A-Z]{6})-([2-9A-Z]{4})$/)
  if (!m) return null

  const [, testFlag, rawId, tag, tail] = m
  const couponId = rawId.toLowerCase()
  const spec = COUPONS[couponId]
  if (!spec) return null

  /*
    꼬리 4자는 순번 2 + 체크값 2다. 체크값은 uid를 알아야 다시 만들 수
    있는데 가게 화면에는 uid가 없다. 그래서 형식만 보고, 진짜 검증은
    사용 기록(Firestore)이 맡는다 — 코드 전체가 문서 ID라 순번이 다르면
    다른 문서가 되고, 같으면 두 번째 스캔이 막힌다.
  */
  return {
    couponId,
    userTag: tag,
    serial: tail.slice(0, 2),
    spec,
    isTest: testFlag === 'T',
  }
}

/** 쿠폰 QR에 담을 값 — 가게 기기가 열 확인 화면 주소 */
export function couponQrPayload(code: string, origin: string): string {
  return `${origin}/shop/verify?c=${encodeURIComponent(code)}`
}
