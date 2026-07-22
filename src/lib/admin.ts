'use client'

/**
 * 관리자 데이터 조회·집계.
 *
 * 서버가 없으므로 집계는 클라이언트에서 한다. users 컬렉션을 한 번 읽어
 * 메모리에서 계산하는 방식이라 수백~수천 명까지는 충분하다. 그보다 커지면
 * Cloud Functions로 일별 집계 문서를 만들어야 한다(그때 이 파일만 바꾸면 된다).
 *
 * 권한은 이메일로 판정한다. admins 컬렉션을 따로 두면 최초 관리자를 넣는
 * 부트스트랩이 필요한데, 구글 로그인 토큰에 이메일이 들어 있어 규칙에서
 * 바로 비교할 수 있다.
 */

import {
  collection,
  collectionGroup,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
} from 'firebase/firestore'
import { auth, db, isFirebaseReady } from './firebase'
import { PointReason } from './points'

/** 이 이메일로 로그인한 사람만 관리자 화면을 볼 수 있다 (firestore.rules와 동일) */
export const ADMIN_EMAILS = ['socialceos@gmail.com']

export function isAdminUser(): boolean {
  const email = auth?.currentUser?.email?.toLowerCase()
  return Boolean(email && ADMIN_EMAILS.includes(email))
}

// ---------------------------------------------------------------------------
// 원자료
// ---------------------------------------------------------------------------

export interface AdminUser {
  uid: string
  nickname: string
  provider: string
  totalPoints: number
  missionCount: number
  tracksCompleted: number
  bingoCells: number
  bingoLines: number
  couponCount: number
  phase: string
  paid: boolean
  startedAt: number | null
  finishedAt: number | null
  lastActiveAt: number | null
  createdAt: number | null
}

const ms = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  const t = v as { toMillis?: () => number } | null
  return t?.toMillis?.() ?? null
}

export async function fetchUsers(): Promise<AdminUser[]> {
  if (!isFirebaseReady() || !db) return []
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => {
    const v = d.data()
    return {
      uid: d.id,
      nickname: v.nickname ?? '이름 없음',
      provider: v.provider ?? '-',
      totalPoints: v.totalPoints ?? v.totalScore ?? 0,
      missionCount: v.missionCount ?? 0,
      tracksCompleted: v.tracksCompleted ?? 0,
      bingoCells: v.bingoCells ?? 0,
      bingoLines: v.bingoLines ?? 0,
      couponCount: v.couponCount ?? 0,
      phase: v.phase ?? 'landing',
      paid: Boolean(v.paid),
      startedAt: ms(v.startedAt),
      finishedAt: ms(v.finishedAt),
      lastActiveAt: ms(v.lastActiveAt),
      createdAt: ms(v.createdAt),
    }
  })
}

export interface AdminSurveyResponse {
  uid: string
  surveyId: string
  answers: Record<string, string | number>
  createdAt: number | null
}

export async function fetchSurveyResponses(): Promise<AdminSurveyResponse[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(collectionGroup(db, 'surveyResponses'))
    return snap.docs.map((d) => {
      const v = d.data()
      return {
        uid: v.uid ?? '',
        surveyId: v.surveyId ?? d.id,
        answers: v.answers ?? {},
        createdAt: ms(v.createdAt),
      }
    })
  } catch {
    // collectionGroup 색인이 없으면 실패한다 — 화면은 빈 상태로 둔다
    return []
  }
}

export interface AdminPost {
  id: string
  authorUid: string
  authorNickname: string
  missionTitle: string
  comment: string
  likes: number
  commentCount: number
  imageUrl: string
  createdAt: number | null
}

export async function fetchPosts(max = 200): Promise<AdminPost[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'posts'), orderBy('createdAt', 'desc'), fsLimit(max))
    )
    return snap.docs.map((d) => {
      const v = d.data()
      return {
        id: d.id,
        authorUid: v.authorUid ?? '',
        authorNickname: v.authorNickname ?? '이름 없음',
        missionTitle: v.missionTitle ?? '',
        comment: v.comment ?? '',
        likes: v.likes ?? 0,
        commentCount: v.commentCount ?? 0,
        imageUrl: v.imageUrl ?? '',
        createdAt: ms(v.createdAt),
      }
    })
  } catch {
    return []
  }
}

export interface AdminPointEntry {
  uid: string
  refId: string
  reason: PointReason
  points: number
  createdAt: number | null
}

export async function fetchAllPoints(): Promise<AdminPointEntry[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(collectionGroup(db, 'points'))
    return snap.docs.map((d) => {
      const v = d.data()
      // 경로: users/{uid}/points/{refId}
      const uid = d.ref.parent.parent?.id ?? ''
      return {
        uid,
        refId: v.refId ?? d.id,
        reason: (v.reason ?? 'bonusMission') as PointReason,
        points: v.points ?? 0,
        createdAt: ms(v.createdAt),
      }
    })
  } catch {
    return []
  }
}

// 집계는 adminStats.ts에 있다 — Firebase 의존이 없어 따로 검증할 수 있다
export {
  TICKET_PRICE,
  startOfDay,
  periodStats,
  funnel,
  cellPopularity,
  hourlyStarts,
  averageDurationMin,
  surveySummary,
} from './adminStats'
export type { PeriodStats } from './adminStats'
