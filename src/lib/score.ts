/**
 * 점수 적립 — 랭킹(소영의 친구들)용.
 *
 * 점수표(구 PRD §6.1 유지): 메인 트랙 100 · 빙고 셀 30 · 빙고 줄 50.
 * 로그인 여부와 무관하게 localStorage에 누적되고,
 * 로그인 사용자는 Firestore users/{uid}.totalScore에도 반영된다(database.ts 재사용).
 */

import { completeMission } from './database'
import { db } from './firebase'

export const POINTS = {
  mainTrack: 100,
  bingoCell: 30,
  bingoLine: 50,
} as const

export function awardPoints(refId: string, points: number): void {
  if (typeof window === 'undefined') return
  const userId = window.localStorage.getItem('userId')
  if (userId && db) {
    // Firestore 반영 (completeMission이 오류 시 localStorage 폴백까지 처리)
    void completeMission(userId, refId, points).catch(() => {})
  } else {
    // 비로그인 — 로컬 누적만
    try {
      const cur = parseInt(window.localStorage.getItem('totalScore') || '0', 10)
      window.localStorage.setItem('totalScore', String(cur + points))
      const done = JSON.parse(
        window.localStorage.getItem('completedMissions') || '[]'
      ) as string[]
      if (!done.includes(refId)) {
        done.push(refId)
        window.localStorage.setItem('completedMissions', JSON.stringify(done))
      }
    } catch {
      /* 점수 적립 실패로 흐름을 막지 않는다 */
    }
  }
}

export function getLocalScore(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(window.localStorage.getItem('totalScore') || '0', 10)
}
