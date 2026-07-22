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
} as const

export type PointReason = keyof typeof POINT_TABLE

export const REASON_LABEL: Record<PointReason, string> = {
  mainMission: '메인미션 완주',
  bonusMission: '보너스미션',
  specialMission: '스페셜미션',
  shareRecord: '나의 기록 공유',
  treasureLine: '보물찾기',
  survey: '완주 설문',
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

function readPending(): PointEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) || '[]')
  } catch {
    return []
  }
}

function writePending(list: PointEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list))
  } catch {
    /* 저장 실패로 흐름을 막지 않는다 */
  }
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

  const uid = auth?.currentUser?.uid
  if (!uid || !isFirebaseReady()) {
    const pending = readPending()
    if (!pending.some((p) => p.refId === refId)) writePending([...pending, entry])
    return
  }

  try {
    await writeEntry(uid, entry)
  } catch {
    // 실패하면 대기열에 넣어 다음 기회에 올린다
    const pending = readPending()
    if (!pending.some((p) => p.refId === refId)) writePending([...pending, entry])
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

/** 아직 서버에 올라가지 않은 적립 합계 — 로그인 유도 문구에 쓴다 */
export function pendingPointTotal(): number {
  return readPending().reduce((a, p) => a + p.points, 0)
}
