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

export const POINT_TABLE = {
  /** 다섯 소원 각 거점 완주 */
  mainMission: 300,
  /** 골목 빙고 칸 하나 */
  bonusMission: 50,
  /** B면 편지 잠금 해제 등 특별 성취 */
  specialMission: 100,
  /** 커뮤니티에 기록 공유 */
  shareRecord: 100,
  /** 빙고 한 줄 완성 */
  treasureLine: 50,
  /** 완주 설문 응답 */
  survey: 200,
  /**
   * 일시한정 캠페인(축제 인증 등). 지급액이 캠페인마다 달라 표가 아니라
   * bonusMissions.ts의 값을 쓴다 — awardCampaign()으로만 적립한다.
   */
  campaign: 0,
} as const

export type PointReason = keyof typeof POINT_TABLE

export const REASON_LABEL: Record<PointReason, string> = {
  mainMission: '메인미션 완주',
  bonusMission: '보너스미션',
  specialMission: '스페셜미션',
  shareRecord: '나의 기록 공유',
  treasureLine: '보물찾기',
  survey: '완주 설문',
  campaign: '한정 보너스미션',
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

export function localPointTotal(): number {
  return readList(LEDGER_KEY).reduce((a, p) => a + p.points, 0)
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
  } catch {
    // 실패하면 대기열에 넣어 다음 기회에 올린다
    queue()
  }
}

/**
 * 일시한정 캠페인 적립 — 지급액을 캠페인 정의에서 직접 받는다.
 *
 * 배너에 "+100"이라 써놓고 실제로는 아무것도 주지 않던 것을 잇는다.
 * 사진이 정말 그 부스에서 찍힌 것인지는 앱이 판별할 수 없으므로, 관리자
 * 화면의 글 목록에서 사후 확인하는 것을 전제로 한다. 지금은 포인트를 돈으로
 * 바꿀 수 없어(적립 단계까지만) 악용 위험이 낮다.
 */
export async function awardCampaign(
  missionId: string,
  points: number
): Promise<void> {
  if (!Number.isInteger(points) || points <= 0 || points > 500) return

  const entry: PointEntry = {
    refId: `campaign-${missionId}`,
    reason: 'campaign',
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
    } catch {
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
// EP.2 할인
// ---------------------------------------------------------------------------

/**
 * 모은 포인트를 EP.2 예약 할인으로 돌려준다.
 *
 * 포인트 사용(상점 결제)은 아직 만들지 않기로 했으므로, 지금 단계에서 포인트가
 * 실제로 무언가로 바뀌는 유일한 통로다. 이게 없으면 적립이 숫자놀이로 끝난다.
 *
 * 기준선을 1,000P로 잡은 이유: 메인미션 다섯 곳(1,500P)만 걸어도 닿는다.
 * 완주한 사람은 예외 없이 할인을 받고, 빙고·공유·설문까지 한 사람은 한 단계
 * 더 간다. 티켓 15,000원 대비 20~40% 선이라 EP.2 재구매 유인으로 충분하다.
 */
export const EP2_DISCOUNT_TIERS = [
  { min: 2500, discount: 6000, label: '완주 + 골목 탐험' },
  { min: 1800, discount: 4500, label: '완주 + 기록 공유' },
  { min: 1000, discount: 3000, label: '완주' },
] as const

export interface Ep2Discount {
  discount: number
  label: string
  /** 다음 단계까지 남은 포인트 — 최고 단계면 null */
  toNext: number | null
  nextDiscount: number | null
}

export function ep2Discount(points: number): Ep2Discount {
  const tier = EP2_DISCOUNT_TIERS.find((t) => points >= t.min)
  const idx = tier ? EP2_DISCOUNT_TIERS.indexOf(tier) : EP2_DISCOUNT_TIERS.length
  const next = idx > 0 ? EP2_DISCOUNT_TIERS[idx - 1] : null

  return {
    discount: tier?.discount ?? 0,
    label: tier?.label ?? '',
    toNext: next ? next.min - points : null,
    nextDiscount: next ? next.discount : null,
  }
}
