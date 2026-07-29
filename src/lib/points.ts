'use client'

/**
 * 포인트 적립.
 *
 * 기존 score.ts는 localStorage의 'userId'를 보고 로그인 여부를 판단했는데,
 * 그 값을 쓰는 코드가 UI 어디에도 없어 항상 비로그인 분기로 빠졌다.
 * 결과적으로 users/{uid}.totalScore가 영원히 0이라 랭킹이 늘 비어 있었다.
 * 여기서는 Firebase Auth의 uid를 직접 본다.
 *
 * 적립은 두 곳에 남는다:
 *  · users/{uid}/points/{refId} — 적립 내역 한 건. 문서 ID가 refId라
 *    같은 미션을 두 번 완료해도 덮어쓰기가 되어 중복 적립이 안 된다.
 *  · users/{uid}.totalPoints    — 합계. 랭킹 정렬용.
 *
 * 로그인 전에 쌓인 적립은 로컬에 모아두었다가 로그인 시 한 번에 올린다
 * (flushPendingPoints). 투어 도중 로그인하는 경우가 있기 때문이다.
 */

import {
  doc,
  getDoc,
  setDoc,
  increment,
  serverTimestamp,
  collection,
  getDocs,
} from 'firebase/firestore'
import { auth, db, isFirebaseReady } from './firebase'

// ---------------------------------------------------------------------------
// 포인트 표 — 여기만 고치면 전체에 반영된다
// ---------------------------------------------------------------------------

/**
 * 포인트 표 (2026-07-29 혜택 체계).
 *
 * **1p = 1원이다.** 별도 화폐를 두지 않고 쿠폰 체계에 흡수시킨다 — 참여자가
 * 환산을 하지 않아도 되고, 가맹점은 쿠폰과 같은 방식으로 결제 금액에서
 * 뺀다. 그래서 여기 적는 숫자는 곧 원가다. 배점을 올리면 그만큼 돈이 나간다.
 */
export const POINT_TABLE = {
  /** 미션 칸 하나 — 메인·보너스 공통. 칸은 칸이라 값이 갈리지 않는다 */
  mainMission: 100,
  /** 골목 빙고 칸 하나 — 메인과 같은 값 */
  bonusMission: 100,
  /** B면 편지 잠금 해제 등 특별 성취 */
  specialMission: 100,
  /** 커뮤니티에 기록 공유 */
  shareRecord: 100,
  /** 빙고 한 줄 완성 */
  treasureLine: 500,
  /** 코스 완주 — 다섯 소원을 다 이루고 피날레까지 */
  courseComplete: 200,
  /** 완주 설문 응답 */
  survey: 200,
  /**
   * 일시한정 캠페인(축제 인증 등). 지급액이 캠페인마다 달라 표가 아니라
   * bonusMissions.ts의 값을 쓴다 — awardDynamic()으로만 적립한다.
   */
  campaign: 0,
  /**
   * 뽑기판에서 나온 포인트. 상품마다 액수가 달라 여기서도 표를 쓰지 않는다.
   *
   * campaign과 갈라 둔 이유는 화면 때문이다. 한데 묶으면 뽑기로 받은
   * 점수가 '한정 보너스미션'으로 적혀, 하지도 않은 미션을 한 것으로 읽힌다.
   */
  gacha: 0,
} as const

export type PointReason = keyof typeof POINT_TABLE

/**
 * 적립 내역에 적히는 이름.
 *
 * 참여자가 화면에서 읽는 말과 같아야 한다 — '보물찾기'는 빙고가 그 이름이던
 * 시절의 잔재라 지금 화면 어디에도 없는 말이었다.
 */
export const REASON_LABEL: Record<PointReason, string> = {
  mainMission: '메인미션 완주',
  bonusMission: '빙고 칸',
  specialMission: '스페셜미션',
  shareRecord: '나의 기록 공유',
  treasureLine: '빙고 한 줄',
  courseComplete: '코스 완주',
  survey: '완주 설문',
  campaign: '한정 보너스미션',
  gacha: '뽑기 당첨',
}

// ---------------------------------------------------------------------------
// 적립
// ---------------------------------------------------------------------------

export interface PointEntry {
  refId: string
  reason: PointReason
  points: number
  createdAt: number
}

const PENDING_KEY = 'bh_pending_points_v1'
const LEDGER_KEY = 'bh_points_ledger_v1'

/** 적립 발생 시 화면에 알린다 — 토스트와 내 포인트 카드가 이걸 듣는다 */
export const POINTS_EVENT = 'bh:points'

function readList(key: string): PointEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const v = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function writeList(key: string, list: PointEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* 저장 실패로 흐름을 막지 않는다 */
  }
}

const readPending = () => readList(PENDING_KEY)
const writePending = (l: PointEntry[]) => writeList(PENDING_KEY, l)

/**
 * 로컬 원장 — 로그인 여부와 무관하게 이 기기에서 받은 적립 전부.
 * 서버를 기다리지 않고 화면에 바로 점수를 보여주기 위한 것이다.
 * 걷는 중에는 골목에서 신호가 끊기는 일이 잦아 이게 없으면 점수가 0으로 보인다.
 */
export function localPointHistory(): PointEntry[] {
  return readList(LEDGER_KEY).sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 이 기기의 쓸 수 있는 합계.
 *
 * 원장을 그대로 더하지 않는다 — 유효기간(6개월)이 지난 적립은 소멸하고
 * 이월하지 않으므로, 합계에 넣으면 쓸 수 없는 점수를 보여주게 된다.
 */
export function localPointTotal(): number {
  return pointWallet(readList(LEDGER_KEY)).total
}

/** 원장에 없으면 추가하고 true — 이미 있으면 false(중복 적립 차단) */
function appendLedger(entry: PointEntry): boolean {
  const ledger = readList(LEDGER_KEY)
  if (ledger.some((p) => p.refId === entry.refId)) return false
  writeList(LEDGER_KEY, [...ledger, entry])
  return true
}

/** 문서 ID로 쓸 수 있게 다듬는다 — refId에 슬래시가 들어가면 경로가 깨진다 */
function safeId(refId: string): string {
  return refId.replace(/[/#?[\]*]/g, '_')
}

async function writeEntry(uid: string, entry: PointEntry): Promise<boolean> {
  if (!db) return false
  const ref = doc(db, 'users', uid, 'points', safeId(entry.refId))

  // 이미 받은 적립이면 합계를 다시 올리지 않는다
  const existing = await getDoc(ref)
  if (existing.exists()) return true

  await setDoc(ref, {
    refId: entry.refId,
    reason: entry.reason,
    points: entry.points,
    createdAt: serverTimestamp(),
  })
  await setDoc(
    doc(db, 'users', uid),
    { totalPoints: increment(entry.points), lastActiveAt: serverTimestamp() },
    { merge: true }
  )
  return true
}

/**
 * 포인트 적립. refId가 같으면 몇 번을 불러도 한 번만 쌓인다.
 * 로그인 전이면 로컬에 모아두었다가 로그인 시 올린다.
 */
export async function award(refId: string, reason: PointReason): Promise<void> {
  const entry: PointEntry = {
    refId,
    reason,
    points: POINT_TABLE[reason],
    createdAt: Date.now(),
  }

  // 원장이 중복을 막는 유일한 관문이다. 이미 받은 적립이면 여기서 끝 —
  // 화면 알림도 다시 띄우지 않는다.
  if (!appendLedger(entry)) return

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(POINTS_EVENT, { detail: entry }))
  }

  const queue = () => {
    const pending = readPending()
    if (!pending.some((p) => p.refId === refId)) writePending([...pending, entry])
  }

  const uid = auth?.currentUser?.uid
  if (!uid || !isFirebaseReady()) {
    queue()
    return
  }

  try {
    await writeEntry(uid, entry)
  } catch (err) {
    /*
      실패하면 대기열에 넣어 다음 기회에 올린다.

      원인은 콘솔에 남긴다. 조용히 삼켰더니 "점수는 보이는데 랭킹에 안
      뜬다"는 증상만 남고 왜인지를 알 길이 없었다 — 화면의 점수는 로컬
      원장에서 오고 랭킹은 서버를 보기 때문에, 서버 쓰기가 막혀도 앱은
      멀쩡해 보인다.
    */
    console.error('[포인트 적립 실패]', {
      refId,
      code: (err as { code?: string })?.code,
      message: (err as { message?: string })?.message,
    })
    queue()
  }
}

/**
 * 액수가 정해지지 않은 적립의 상한.
 *
 * 표에 없는 값을 부르는 자리(캠페인·뽑기)라 화면 쪽 실수가 그대로 점수가
 * 된다. 뽑기 1등이 1,000P라 거기에 맞춘다 — 상품을 더 키우려면 이 값을
 * 먼저 올려야 한다. **말없이 버리므로**, 안 올리면 적립이 조용히 사라진다.
 */
export const MAX_DYNAMIC_AWARD = 1000

/**
 * 표에 없는 적립 — 지급액을 부르는 쪽에서 직접 받는다.
 *
 * 일시한정 캠페인(축제 인증 등)과 뽑기 당첨이 여기를 쓴다. 배너에 "+100"
 * 이라 써놓고 실제로는 아무것도 주지 않던 것을 잇는다. 사진이 정말 그
 * 부스에서 찍힌 것인지는 앱이 판별할 수 없으므로, 관리자 화면의 글 목록에서
 * 사후 확인하는 것을 전제로 한다. 지금은 포인트를 돈으로 바꿀 수 없어
 * (적립 단계까지만) 악용 위험이 낮다.
 *
 * reason을 받는 이유는 적립 내역에 적힐 이름이 갈라져야 하기 때문이다 —
 * 뽑기로 받은 점수가 '한정 보너스미션'으로 적히면 하지도 않은 미션이 된다.
 */
export async function awardDynamic(
  missionId: string,
  points: number,
  reason: Extract<PointReason, 'campaign' | 'gacha'> = 'campaign'
): Promise<void> {
  if (!Number.isInteger(points) || points <= 0 || points > MAX_DYNAMIC_AWARD) {
    return
  }

  const entry: PointEntry = {
    // refId 앞머리는 reason별로 갈라 둔다 — 같은 id가 두 갈래에서 와도 겹치지 않는다
    refId: `${reason}-${missionId}`,
    reason,
    points,
    createdAt: Date.now(),
  }
  if (!appendLedger(entry)) return

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(POINTS_EVENT, { detail: entry }))
  }

  const queue = () => {
    const pending = readPending()
    if (!pending.some((p) => p.refId === entry.refId)) {
      writePending([...pending, entry])
    }
  }

  const uid = auth?.currentUser?.uid
  if (!uid || !isFirebaseReady()) return queue()
  try {
    await writeEntry(uid, entry)
  } catch {
    queue()
  }
}

/** 로그인 직후 — 로그인 전에 쌓인 적립을 올린다 */
export async function flushPendingPoints(uid: string): Promise<number> {
  const pending = readPending()
  if (pending.length === 0 || !isFirebaseReady()) return 0

  const failed: PointEntry[] = []
  for (const entry of pending) {
    try {
      await writeEntry(uid, entry)
    } catch (err) {
      // 여기서 계속 실패하면 대기열이 영영 줄지 않는다 — 이유를 남긴다
      console.error('[대기 포인트 올리기 실패]', {
        refId: entry.refId,
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
      })
      failed.push(entry)
    }
  }
  writePending(failed)
  return pending.length - failed.length
}

/** 내 적립 내역 — 마이페이지·관리자 화면에서 쓴다 */
export async function fetchPointHistory(uid: string): Promise<PointEntry[]> {
  if (!db) return []
  const snap = await getDocs(collection(db, 'users', uid, 'points'))
  return snap.docs
    .map((d) => {
      const v = d.data()
      return {
        refId: v.refId ?? d.id,
        reason: (v.reason ?? 'bonusMission') as PointReason,
        points: typeof v.points === 'number' ? v.points : 0,
        createdAt: v.createdAt?.toMillis?.() ?? 0,
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 이 기기의 적립 기록을 비운다 — 로그아웃 전용.
 * 서버에 이미 올라간 뒤에만 부른다. 안 그러면 적립이 사라진다.
 */
export function clearLocalPoints(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LEDGER_KEY)
  window.localStorage.removeItem(PENDING_KEY)
  window.dispatchEvent(new CustomEvent(POINTS_EVENT))
}

/** 아직 서버에 올라가지 않은 적립 합계 — 로그인 유도 문구에 쓴다 */
export function pendingPointTotal(): number {
  return readPending().reduce((a, p) => a + p.points, 0)
}

// ---------------------------------------------------------------------------
// 포인트 사용 규칙
// ---------------------------------------------------------------------------

/**
 * 1p = 1원.
 *
 * 별도 화폐를 두지 않는다. 예전에는 모은 점수를 EP.2 예약 할인 사다리
 * (1,000P→3,000원 / 1,800P→4,500원 / 2,500P→6,000원)로 돌려줬는데, 그 표는
 * 포인트마다 값이 달라 참여자가 환산을 해야 했고 1p=1원과 정면으로 어긋난다
 * (2,500p가 6,000원이면 2.4배다). 쿠폰 체계에 흡수시켜 값을 하나로 만든다.
 */
export const POINT_TO_WON = 1

/** 이 값을 넘겨야 쓸 수 있다. 2회 방문 누적을 전제로 잡은 문턱이다 */
export const MIN_REDEEM_POINTS = 3000

/** 발급일 기준 유효기간. 경과분은 소멸하고 **이월하지 않는다** */
export const POINT_EXPIRY_MONTHS = 6

/** 적립 한 건이 소멸하는 시각 */
export function expiresAt(entry: PointEntry): number {
  const d = new Date(entry.createdAt)
  d.setMonth(d.getMonth() + POINT_EXPIRY_MONTHS)
  return d.getTime()
}

export interface PointWallet {
  /** 아직 살아 있는 포인트 — 화면에 띄우는 값은 늘 이것이다 */
  total: number
  /** 원으로 환산한 값 */
  won: number
  /** 기간이 지나 사라진 몫. 부채로 잡지 않으므로 참고용이다 */
  expired: number
  /** 지금 쓸 수 있는가 */
  redeemable: boolean
  /** 문턱까지 남은 포인트 — 이미 넘었으면 0 */
  toThreshold: number
  /** 가장 먼저 소멸할 시각 — 살아 있는 적립이 없으면 null */
  nextExpiry: number | null
}

/**
 * 원장을 유효기간으로 걸러 지금 쓸 수 있는 상태를 낸다.
 *
 * 만료를 원장에서 지우지 않고 **읽을 때마다 판정한다.** 지우면 왜 줄었는지
 * 물어볼 때 답할 근거가 없어지고, 기기마다 지운 시점이 달라 서버와 합칠 때
 * 어긋난다. 소멸분은 부채로 잡지 않으므로 회계상 지울 이유도 없다.
 */
export function pointWallet(
  entries: PointEntry[],
  now = Date.now()
): PointWallet {
  let total = 0
  let expired = 0
  let nextExpiry: number | null = null

  for (const e of entries) {
    const at = expiresAt(e)
    if (at <= now) {
      expired += e.points
      continue
    }
    total += e.points
    if (nextExpiry === null || at < nextExpiry) nextExpiry = at
  }

  return {
    total,
    won: total * POINT_TO_WON,
    expired,
    redeemable: total >= MIN_REDEEM_POINTS,
    toThreshold: Math.max(0, MIN_REDEEM_POINTS - total),
    nextExpiry,
  }
}
