/**
 * §11 분석 이벤트 — 경량 로컬 수집기.
 *
 * localStorage 링버퍼에 쌓고, 같은 이벤트를 telemetry.ts의 서버 큐에도
 * 넣는다(배치 전송). 호출부는 logEvent 하나만 안다 — 백엔드가 바뀌어도
 * 화면 코드는 그대로다.
 *
 * 이벤트 명세(§11):
 *  purchase, cache_done, call_started, track_arrived{n}, mission_done{id},
 *  bundle_skipped{id}, memo_type{voice|text|skip}, upload_consent,
 *  bside_played{wish_count}, act2_entered, bingo_line{n}, coupon_used{id},
 *  finale_saved, ep2_reserved, review_written
 *
 * 게임 요소 보강(F-7) 추가분:
 *  qr_scan{station,via}, mission_enter{track,kind}, mission_wrong{id},
 *  mission_correct{id}, hint_used{step}, jcard_line_done{track},
 *  hidden_found{id,during}, hidden_played{id},
 *  reward_offer_shown, reward_offer_choice{tier}
 */

import { queueTelemetry } from './telemetry'

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
  // 판을 다시 깔았다 — 어느 자리에서 막혔는지, 값을 치렀는지
  | 'board_shuffled'
  | 'coupon_used'
  // 포인트도 가게에서 쓰이는 값이라 쿠폰과 나란히 센다. 갈라 둔 이유는
  // 액면이 정해진 쿠폰과 달리 금액이 카운터에서 정해져서다 — 한데 묶으면
  // '한 건'의 무게가 달라 사용률을 못 읽는다
  | 'points_used'
  | 'finale_saved'
  | 'ep2_reserved'
  | 'review_written'
  // 게임 요소 보강(F-7) — 랭킹 부문1은 mission_enter→mission_correct 간격을 잰다
  | 'qr_scan'
  | 'mission_enter'
  | 'mission_wrong'
  | 'mission_correct'
  | 'hint_used'
  | 'jcard_line_done'
  | 'hidden_found'
  | 'hidden_played'
  | 'reward_offer_shown'
  | 'reward_offer_choice'
  // 보상 — 쿠폰은 빙고 첫 줄에 다섯 장, 그 뒤로는 줄마다 뽑기 한 번
  | 'coupon_granted'
  | 'gacha_drawn'

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
  // 서버 큐 — 배치로 모아 보낸다. 비로그인은 로그인 때 올라간다
  queueTelemetry(name, props)
}

export function getEvents(): AnalyticsEvent[] {
  return read()
}

export function clearEvents(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
