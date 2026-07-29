/**
 * 관리자 집계 — 순수 계산만.
 *
 * Firebase를 import하지 않는다. 데이터 조회(admin.ts)와 분리해두면
 * 계산 로직을 Node에서 그대로 실행해 검증할 수 있고, 나중에 집계를
 * 서버(Cloud Functions)로 옮길 때도 이 파일만 재사용하면 된다.
 */

import type {
  AdminUser,
  AdminPointEntry,
  AdminSurveyResponse,
  AdminEvent,
} from './admin'

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

// ---------------------------------------------------------------------------
// 골목 가게 정산
// ---------------------------------------------------------------------------
//
// 가게별 정산은 coverage.ts의 `settleMonth()`로 옮겼다.
//
// 예전 `shopSettlement()`는 사용 기록의 장수를 세고 카탈로그 단가를 곱해
// "돌려드릴 금액"을 냈다. 충당률이 들어오면서 그 계산이 통째로 틀렸다 —
// 할인액은 가게와 운영사가 나누어 지고, 그 비율은 **사용 시점에 굳은
// 스냅샷**이지 지금 카탈로그가 아니다. 카탈로그를 다시 곱하는 방식은
// 등급이 바뀌는 순간 지난 달 정산까지 함께 움직인다.
//
// 아래 `issuedFaceValue()`만 여기 남는다. 발행 액면은 무엇이 쓰였는지가
// 아니라 무엇을 내보냈는지라, 카탈로그를 봐야 하는 유일한 집계다.

/**
 * 기간 안에 내보낸 액면 총액 — 쿠폰 액면 + 적립 포인트.
 *
 * 사용률(쓰인 액면 ÷ 발행 액면)의 분모다. 쿠폰은 발급 기록을 따로 두지
 * 않으므로 결제 건수에서 세고, 포인트는 적립 원장을 그대로 더한다.
 */
export function issuedFaceValue(
  points: AdminPointEntry[],
  paidCount: number,
  couponFaceWon: number,
  from = 0
): number {
  const earned = points
    .filter((p) => p.points > 0 && (p.createdAt ?? 0) >= from)
    .reduce((n, p) => n + p.points, 0)
  return earned + paidCount * couponFaceWon
}

// ---------------------------------------------------------------------------
// 계측 이벤트 (F-7)
// ---------------------------------------------------------------------------

export interface EventBreakdownRow {
  name: string
  count: number
  /** 이 이벤트를 한 번이라도 낸 사람 수 — 막힘은 단계 사이 인원 낙차로 읽는다 */
  users: number
  lastAt: number | null
}

/**
 * 투어가 흐르는 순서. 이 순서로 줄 세워 보여주면 인원이 뚝 떨어지는
 * 자리가 곧 막힘 지점이다. 표에 없는 이벤트는 뒤에 발생량순으로 붙는다.
 */
const EVENT_ORDER = [
  'purchase',
  'cache_done',
  'qr_scan',
  'track_arrived',
  'mission_enter',
  'mission_wrong',
  'hint_used',
  'mission_correct',
  'mission_done',
  'hidden_found',
  'jcard_line_done',
  'memo_type',
  'bside_played',
  'act2_entered',
  'hidden_played',
  'bingo_line',
  'coupon_used',
  'reward_offer_shown',
  'reward_offer_choice',
  'finale_saved',
]

export function eventBreakdown(events: AdminEvent[]): EventBreakdownRow[] {
  const rows = new Map<string, EventBreakdownRow>()
  const uidsByName = new Map<string, Set<string>>()

  for (const e of events) {
    if (!e.name) continue
    const row = rows.get(e.name) ?? {
      name: e.name,
      count: 0,
      users: 0,
      lastAt: null,
    }
    row.count += 1
    if (e.at && (!row.lastAt || e.at > row.lastAt)) row.lastAt = e.at
    rows.set(e.name, row)

    const uids = uidsByName.get(e.name) ?? new Set<string>()
    if (e.uid) uids.add(e.uid)
    uidsByName.set(e.name, uids)
  }

  const out = Array.from(rows.values())
  for (const row of out) row.users = uidsByName.get(row.name)?.size ?? 0

  return out.sort((a, b) => {
    const ai = EVENT_ORDER.indexOf(a.name)
    const bi = EVENT_ORDER.indexOf(b.name)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return b.count - a.count
  })
}
