/**
 * 랭킹 — users 컬렉션의 totalPoints 내림차순.
 *
 * 정렬 필드가 totalPoints인 것이 중요하다. Firestore의 orderBy는 해당 필드가
 * 없는 문서를 결과에서 아예 제외하므로, 적립은 totalPoints에 쓰면서 정렬만
 * 옛 이름(totalScore)으로 하면 랭킹이 통째로 비어버린다.
 *
 * Firebase 미설정 시 빈 목록을 돌려준다(화면은 로컬 점수만 표시).
 */

import { db } from './firebase'

export interface RankingEntry {
  userId: string
  nickname: string
  totalPoints: number
}

const FETCH_LIMIT = 50

export async function fetchRankings(): Promise<RankingEntry[]> {
  if (!db) return []
  const { collection, getDocs, limit, orderBy, query } = await import(
    'firebase/firestore'
  )
  const q = query(
    collection(db, 'users'),
    orderBy('totalPoints', 'desc'),
    limit(FETCH_LIMIT)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => {
      const data = d.data() as {
        userId?: string
        uid?: string
        nickname?: string
        totalPoints?: number
        totalScore?: number
      }
      // totalScore는 옛 필드 — 이전에 쌓인 문서가 있으면 그대로 살려준다
      const total =
        typeof data.totalPoints === 'number'
          ? data.totalPoints
          : typeof data.totalScore === 'number'
            ? data.totalScore
            : 0
      return {
        userId: data.userId ?? data.uid ?? d.id,
        nickname: data.nickname ?? '이름 없는 기록자',
        totalPoints: total,
      }
    })
    .filter((e) => e.totalPoints > 0)
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
