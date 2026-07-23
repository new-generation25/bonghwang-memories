/**
 * 관리자 집계 — 순수 계산만.
 *
 * Firebase를 import하지 않는다. 데이터 조회(admin.ts)와 분리해두면
 * 계산 로직을 Node에서 그대로 실행해 검증할 수 있고, 나중에 집계를
 * 서버(Cloud Functions)로 옮길 때도 이 파일만 재사용하면 된다.
 */

import type { AdminUser, AdminPointEntry, AdminSurveyResponse } from './admin'

/**
 * 가격 체계 (브랜드 v2.1 §5).
 *
 * 투어 자체는 무료다 — 참여자 수가 곧 매출이던 구조는 더 이상 맞지 않는다.
 * 매출은 '완주 리워드'를 구매한 사람에게서만 나오고, 그중 4,000원은
 * 골목 가게 쿠폰으로 나가므로 실제로 남는 현금은 1,000원이다.
 */
export const REWARD_PRICE = 5000
/** 리워드 중 골목 가게 쿠폰으로 나가는 몫 */
export const REWARD_COUPON_VALUE = 4000
/** 리워드 1건당 순현금 (5,000 − 4,000) */
export const REWARD_NET = REWARD_PRICE - REWARD_COUPON_VALUE

/**
 * @deprecated 무료 모델 전환 전의 티켓가(15,000원).
 * 남은 참조를 전부 옮기기 전까지만 둔다 — 새 코드에서 쓰지 말 것.
 */
export const TICKET_PRICE = REWARD_PRICE

export const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export interface PeriodStats {
  label: string
  participants: number
  finished: number
  revenue: number
  finishRate: number
}

function inRange(t: number | null, from: number): boolean {
  return typeof t === 'number' && t >= from
}

export function periodStats(users: AdminUser[], now = Date.now()): PeriodStats[] {
  const today = startOfDay(now)
  const week = today - 6 * 86400000
  const month = today - 29 * 86400000

  const build = (label: string, from: number): PeriodStats => {
    const inPeriod = users.filter((u) => u.paid && inRange(u.startedAt, from))
    const finished = inPeriod.filter((u) => u.phase === 'done').length
    return {
      label,
      participants: inPeriod.length,
      finished,
      revenue: inPeriod.length * TICKET_PRICE,
      finishRate: inPeriod.length ? Math.round((finished / inPeriod.length) * 100) : 0,
    }
  }

  return [build('오늘', today), build('최근 7일', week), build('최근 30일', month)]
}

/** 어느 트랙에서 멈췄는지 — 이탈 지점을 본다 */
export function funnel(users: AdminUser[]): { label: string; count: number }[] {
  const paid = users.filter((u) => u.paid)
  const steps = [
    { label: '결제', test: () => true },
    { label: '인트로 통과', test: (u: AdminUser) => u.phase !== 'landing' && u.phase !== 'intro' },
    { label: '트랙 1', test: (u: AdminUser) => u.tracksCompleted >= 1 },
    { label: '트랙 2', test: (u: AdminUser) => u.tracksCompleted >= 2 },
    { label: '트랙 3', test: (u: AdminUser) => u.tracksCompleted >= 3 },
    { label: '트랙 4', test: (u: AdminUser) => u.tracksCompleted >= 4 },
    { label: '트랙 5', test: (u: AdminUser) => u.tracksCompleted >= 5 },
    { label: '빙고 진입', test: (u: AdminUser) => u.phase === 'act2' || u.phase === 'done' },
    { label: '완주', test: (u: AdminUser) => u.phase === 'done' },
  ]
  return steps.map((s) => ({ label: s.label, count: paid.filter(s.test).length }))
}

/** 빙고 칸별 방문 수 — 어느 가게·장소가 인기인지 */
export function cellPopularity(
  points: AdminPointEntry[]
): { id: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const p of points) {
    if (!p.refId.startsWith('bingo-cell-')) continue
    const id = p.refId.replace('bingo-cell-', '')
    counts[id] = (counts[id] ?? 0) + 1
  }
  return Object.keys(counts)
    .map((id) => ({ id, count: counts[id] }))
    .sort((a, b) => b.count - a.count)
}

/** 시간대별 시작 분포 — 현장 인력 배치에 쓴다 */
export function hourlyStarts(users: AdminUser[]): number[] {
  const hours = new Array(24).fill(0)
  for (const u of users) {
    if (typeof u.startedAt === 'number') hours[new Date(u.startedAt).getHours()]++
  }
  return hours
}

/** 평균 완주 소요 시간(분) */
export function averageDurationMin(users: AdminUser[]): number | null {
  const done = users.filter(
    (u) => u.phase === 'done' && u.startedAt && u.finishedAt && u.finishedAt > u.startedAt
  )
  if (done.length === 0) return null
  const sum = done.reduce((a, u) => a + (u.finishedAt! - u.startedAt!), 0)
  return Math.round(sum / done.length / 60000)
}

/** 설문 집계 — 문항별 응답 분포 */
export function surveySummary(
  responses: AdminSurveyResponse[]
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const r of responses) {
    for (const [qid, ans] of Object.entries(r.answers)) {
      if (typeof ans !== 'string' && typeof ans !== 'number') continue
      const key = String(ans)
      if (!key.trim()) continue
      out[qid] = out[qid] ?? {}
      out[qid][key] = (out[qid][key] ?? 0) + 1
    }
  }
  return out
}
