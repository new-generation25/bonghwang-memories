/**
 * §11 분석 이벤트 — 경량 로컬 수집기.
 *
 * 외부 전송 없이 localStorage 링버퍼에 쌓는다. 수집 백엔드가 정해지면
 * 이 파일의 flush 지점만 연결하면 되고, 호출부는 바뀌지 않는다.
 *
 * 이벤트 명세(§11):
 *  purchase, cache_done, call_started, track_arrived{n}, mission_done{id},
 *  bundle_skipped{id}, memo_type{voice|text|skip}, upload_consent,
 *  bside_played{frag_count}, act2_entered, bingo_line{n}, coupon_used{id},
 *  finale_saved, ep2_reserved, review_written
 */

export type AnalyticsEventName =
  | 'purchase'
  | 'cache_done'
  | 'call_started'
  | 'track_arrived'
  | 'mission_done'
  | 'bundle_skipped'
  | 'memo_type'
  | 'upload_consent'
  | 'bside_played'
  | 'act2_entered'
  | 'bingo_line'
  | 'coupon_used'
  | 'finale_saved'
  | 'ep2_reserved'
  | 'review_written'

export interface AnalyticsEvent {
  name: AnalyticsEventName
  props?: Record<string, string | number | boolean>
  /** epoch ms */
  at: number
}

const STORAGE_KEY = 'bh_analytics_v1'
/** 링버퍼 상한 — 오래된 이벤트부터 밀려난다 */
const MAX_EVENTS = 500

function read(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : []
  } catch {
    return []
  }
}

export function logEvent(
  name: AnalyticsEventName,
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return
  try {
    const events = read()
    events.push({ name, props, at: Date.now() })
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(events.slice(-MAX_EVENTS))
    )
  } catch {
    // 수집 실패가 투어를 막아선 안 된다
  }
}

export function getEvents(): AnalyticsEvent[] {
  return read()
}

export function clearEvents(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
