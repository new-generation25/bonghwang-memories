/**
 * 일시한정 보너스 미션 — '소영의 친구들' 상단 배너에 기간 내에만 표시된다.
 *
 * 데이터만 고치면 되는 구조. 날짜는 KST 기준 ISO 문자열(절대 시각)로 적는다.
 * 운영 전환 시 Firestore 컬렉션으로 옮기기 쉽게 형태를 단순하게 유지한다.
 */

export interface BonusMission {
  id: string
  title: string
  description: string
  points: number
  /** 표시 시작 (포함) */
  startsAt: string
  /** 표시 종료 (포함) */
  endsAt: string
  emoji: string
}

export const BONUS_MISSIONS: BonusMission[] = [
  {
    id: 'bonus-retro-festival',
    title: '봉황동 레트로 축제 인증',
    description:
      '축제 현장에서 가족오락관 부스와 함께 찍은 사진을 공유하면 보너스 점수!',
    points: 100,
    startsAt: '2026-07-20T00:00:00+09:00',
    endsAt: '2026-08-03T23:59:59+09:00',
    emoji: '🎪',
  },
  {
    id: 'bonus-banana-summer',
    title: '한여름 바나나우유 릴레이',
    description: '미야상회 바나나우유 인증샷을 공유한 친구에게 30점.',
    points: 30,
    startsAt: '2026-07-01T00:00:00+09:00',
    endsAt: '2026-08-31T23:59:59+09:00',
    emoji: '🥛',
  },
]

export function activeBonusMissions(now = new Date()): BonusMission[] {
  const t = now.getTime()
  return BONUS_MISSIONS.filter(
    (m) => t >= new Date(m.startsAt).getTime() && t <= new Date(m.endsAt).getTime()
  )
}
