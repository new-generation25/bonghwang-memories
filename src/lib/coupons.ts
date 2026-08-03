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

/**
 * 쿠폰을 어디서 쓰는가.
 *
 * 세 갈래다. 참여자가 카운터 앞에서 "여기서 되나요"를 묻지 않게 하려면
 * 쿠폰마다 이 값이 분명해야 하고, 사용 처리도 이 값으로 갈린다.
 *
 *  · `shop`  특정 가게에서만 — 거점 쿠폰이 그렇다
 *  · `group` 그 무리의 가게 어디서나 — '협력 카페 공용 할인권'
 *  · `info`  안내소에서 교환 — 엽서·굿즈처럼 운영자가 직접 건네는 것
 */
export type CouponScope = 'shop' | 'group' | 'info'

export interface CouponSpec {
  id: string
  scope: CouponScope
  /**
   * 가게 문서 id — Firestore `shops/{shopId}`. `scope: 'shop'`일 때만 있다.
   *
   * 거점 쿠폰은 쿠폰 id와 같다(가게 하나에 쿠폰 하나). 그래도 따로 두는
   * 이유는, 사용 기록이 가리켜야 하는 것이 '쿠폰'이 아니라 '어느 가게에서
   * 썼나'라서다. 한 가게가 쿠폰을 둘 받게 되면 여기만 갈라주면 된다.
   */
  shopId?: string
  /**
   * 협력 가게 무리 — `scope: 'group'`일 때만 있다.
   * 가게 문서의 `group` 값과 맞는 곳이면 어디서나 쓴다.
   */
  group?: string
  /** 쿠폰을 쓸 수 있는 곳 — 참여자에게 보이는 이름 */
  shop: string
  /** 참여자에게 보이는 혜택 문구 */
  benefit: string
  /** 정산 단가(원) — 가게에 돌려줄 금액을 세는 값이다 */
  unitWon: number
  /**
   * 실물 원가(원) — 안내소에서 물건을 건네는 쿠폰(`scope: 'info'`)만 갖는다.
   *
   * `unitWon`과 다른 값이다. 그쪽은 참여자에게 매긴 값이자 가게에 돌려줄
   * 금액이고, 이것은 **우리가 실제로 치르는 값**이다. 엽서 한 장을 1,000원
   * 짜리로 보여드려도 인쇄비는 그보다 싸다.
   *
   * BEP의 뽑기 실물 원가(`gaC`)가 이 값에서 나온다. 안 적으면 액면으로
   * 대신 세는데 그건 원가를 부풀리는 쪽이라 손익이 실제보다 나빠 보인다 —
   * 값을 알게 되면 채워 넣어라. `gachaEconomics()`가 빠진 것을 일러 준다.
   */
  costWon?: number
  /** 어느 거점에서 받는지. 뽑기로 나오는 쿠폰은 거점이 없어 0이다 */
  track: number
}

/**
 * 쿠폰 카탈로그.
 * 혜택 문구와 단가는 가게와 협의해 정하는 값이라 여기 한 곳에서만 고친다.
 * `scripts/make-shop-qr.mjs`가 이 표를 읽어 가게 문서와 스티커를 만든다.
 */
export const COUPONS: Record<string, CouponSpec> = {
  // ── 거점 쿠폰 — 그 가게에서만 ──
  cp1: { id: 'cp1', scope: 'shop', shopId: 'cp1', shop: '봉황1935', benefit: '음료 1,000원 할인', unitWon: 1000, track: 1 },
  cp2: { id: 'cp2', scope: 'shop', shopId: 'cp2', shop: '미야상회', benefit: '바나나우유 500원 할인', unitWon: 500, track: 2 },
  cp3: { id: 'cp3', scope: 'shop', shopId: 'cp3', shop: '능소화 고택', benefit: '엽서 1장 증정', unitWon: 1000, track: 3 },
  cp4: { id: 'cp4', scope: 'shop', shopId: 'cp4', shop: '카페 탱자', benefit: '아메리카노 1,000원 할인', unitWon: 1000, track: 4 },
  cp5: { id: 'cp5', scope: 'shop', shopId: 'cp5', shop: '방하림', benefit: '도자기 1,000원 할인', unitWon: 1000, track: 5 },

  /*
    ── 뽑기로 나오는 쿠폰 ──

    거점 쿠폰과 달리 어느 칸에서 나올지 정해져 있지 않다. 같은 쿠폰이
    두 번 나와도 칸 번호가 발급 순번이 되어 코드가 갈린다(gacha.ts).

    `track: 0` — 거점에서 받는 것이 아니라는 표시다.
  */
  gcCafe: {
    id: 'gcCafe', scope: 'group', group: 'cafe', shop: '협력 카페 어디서나',
    benefit: '음료 1,000원 할인', unitWon: 1000, track: 0,
  },
  gcCafe2: {
    id: 'gcCafe2', scope: 'group', group: 'cafe', shop: '협력 카페 어디서나',
    benefit: '음료 2,000원 할인', unitWon: 2000, track: 0,
  },
  gcTangja: {
    id: 'gcTangja', scope: 'shop', shopId: 'cp4', shop: '카페 탱자',
    benefit: '아메리카노 무료', unitWon: 4000, track: 0,
  },
  gcBonghwang: {
    id: 'gcBonghwang', scope: 'shop', shopId: 'cp1', shop: '봉황1935',
    benefit: '음료 2,000원 할인', unitWon: 2000, track: 0,
  },
  gcPostcard: {
    id: 'gcPostcard', scope: 'info', shop: '안내소',
    benefit: '능소화 엽서 한 장', unitWon: 1000, track: 0,
  },
  gcSticker: {
    id: 'gcSticker', scope: 'info', shop: '안내소',
    benefit: '봉황동 스티커 팩', unitWon: 1000, track: 0,
  },
  gcSnack: {
    id: 'gcSnack', scope: 'info', shop: '안내소',
    benefit: '골목 간식 교환권', unitWon: 2000, track: 0,
  },
  gcPolaroid: {
    id: 'gcPolaroid', scope: 'info', shop: '안내소',
    benefit: '즉석 필름 사진 한 컷', unitWon: 3000, track: 0,
  },
  gcMixtape: {
    id: 'gcMixtape', scope: 'info', shop: '안내소',
    benefit: '아버지의 믹스테이프 — 실물 카세트', unitWon: 15000, track: 0,
  },
}

export function couponSpec(id: string): CouponSpec | null {
  return COUPONS[id] ?? null
}

/**
 * 이 거점과 짝지어진 쿠폰 id.
 *
 * 거점을 통과할 때 쿠폰이 나오던 시절의 함수다. 지금은 쿠폰이 골목 빙고
 * 첫 줄에서 다섯 장 한꺼번에 나오므로 지급에는 쓰이지 않는다. 그래도
 * 남겨두는 것은 '이 가게가 어느 거점에 있는가'를 이 표가 유일하게
 * 말해주기 때문이다 — 인쇄물·정산 화면이 그 짝을 물어볼 수 있다.
 */
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

/** 서버 사본용 — 진행도 동기화(tourSync)가 함께 올린다 */
export function allCouponSerials(): Record<string, number> {
  return serialMap()
}

/**
 * 서버 사본을 받아 로컬과 합친다 — 기회 동기화.
 *
 * 원본은 여전히 이 기기다(가게 앞은 신호가 약해 재발급이 통신을 기다리면
 * 안 된다). 다만 기기를 바꿔 로그인하면 순번이 0부터 시작해 이미 소진된
 * 코드가 다시 나오므로, 큰 쪽으로만 올려 받는다. 순번이 겹쳐도 손해는
 * 없다 — 겹친 코드는 사용 기록이 막는다.
 */
export function mergeCouponSerials(
  remote: Record<string, number> | undefined | null
): void {
  if (!remote || typeof window === 'undefined') return
  const map = serialMap()
  let changed = false
  for (const key of Object.keys(remote)) {
    const v = Number(remote[key]) || 0
    if (v > (map[key] ?? 0)) {
      map[key] = v
      changed = true
    }
  }
  if (!changed) return
  try {
    window.localStorage.setItem(SERIAL_KEY, JSON.stringify(map))
  } catch {
    /* 저장 못 해도 다음 pull에서 다시 받는다 */
  }
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

// ---------------------------------------------------------------------------
// 포인트 사용 코드
// ---------------------------------------------------------------------------

/**
 * 포인트를 쓸 때의 코드 — `PT1-K3M9QF-237A`.
 *
 * 쿠폰과 머리를 갈라 둔 이유가 있다. 쿠폰은 액면이 정해져 있어 참여자가
 * 혼자 사용 처리할 수 있지만, 포인트는 **얼마를 쓸지가 카운터에서 정해진다.**
 * 그래서 이 코드는 가게 기기가 읽고, 금액은 사장님이 넣는다 — 그 편이
 * 실제 계산대 흐름과도 같다.
 *
 * 갈라 두면 얻는 것이 하나 더 있다. 충당률은 참여자에게 보이면 안 되는
 * 값인데, 사용 기록에는 그 값이 스냅샷으로 들어가야 한다. 쓰는 쪽이 가게
 * 기기이므로 **참여자 기기는 충당률을 알 필요도, 알 방법도 없다.**
 * 참여자가 가게 문서를 읽을 수 있게 열면 스티커 토큰이 함께 샌다.
 *
 * 쿠폰 코드와 절대 겹치지 않는다 — parseCouponCode는 BH1만 받는다.
 */
export const POINT_CODE_PREFIX = 'PT1'

export function makePointCode(uid: string, serial: number): string {
  return `${POINT_CODE_PREFIX}-${userTag(uid)}-${serialTag(serial)}${checksum('pt', uid, serial)}`
}

export interface ParsedPointCode {
  userTag: string
  serial: string
}

export function parsePointCode(raw: string): ParsedPointCode | null {
  const m = raw.trim().toUpperCase().match(/^PT1-([2-9A-Z]{6})-([2-9A-Z]{4})$/)
  if (!m) return null
  return { userTag: m[1], serial: m[2].slice(0, 2) }
}

/** 포인트 코드 QR — 쿠폰과 같은 확인 화면으로 보낸다 */
export function pointQrPayload(code: string, origin: string): string {
  return `${origin}/shop/verify?c=${encodeURIComponent(code)}`
}
