/**
 * 랭킹 — Firestore users 컬렉션의 totalScore 내림차순.
 * Firebase 미설정 시 빈 목록을 돌려준다(화면은 로컬 점수만 표시).
 */

import { db } from './firebase'

export interface RankingEntry {
  userId: string
  nickname: string
  totalScore: number
}

const FETCH_LIMIT = 50

export async function fetchRankings(): Promise<RankingEntry[]> {
  if (!db) return []
  const { collection, getDocs, limit, orderBy, query } = await import(
    'firebase/firestore'
  )
  const q = query(
    collection(db, 'users'),
    orderBy('totalScore', 'desc'),
    limit(FETCH_LIMIT)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => {
      const data = d.data() as Partial<RankingEntry> & { uid?: string }
      return {
        userId: data.userId ?? data.uid ?? d.id,
        nickname: data.nickname ?? '이름 없는 기록자',
        totalScore:
          typeof data.totalScore === 'number' ? data.totalScore : 0,
      }
    })
    .filter((e) => e.totalScore > 0)
}

/** 내 순위 — 상위 목록 안에 있으면 등수, 없으면 null(목록 밖) */
export function findMyRank(
  rankings: RankingEntry[],
  myUserId: string | null
): number | null {
  if (!myUserId) return null
  const idx = rankings.findIndex((r) => r.userId === myUserId)
  return idx >= 0 ? idx + 1 : null
}
