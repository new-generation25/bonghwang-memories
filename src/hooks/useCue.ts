'use client'

/**
 * 큐 재생 상태·이벤트 구독 훅.
 *
 * useCue()        — 현재 재생 상태 (자막 인덱스·스킵 가능 여부 등)
 * useCueEvents()  — 연출 지시자(cassette_flip, show_mission:* 등) 수신
 */

import { useEffect, useSyncExternalStore } from 'react'
import {
  CueEvent,
  CuePlaybackState,
  getCueState,
  subscribeCue,
  subscribeCueEvents,
} from '@/lib/cueEngine'

let serverSnapshot: CuePlaybackState | null = null
function getServerSnapshot(): CuePlaybackState {
  if (!serverSnapshot) serverSnapshot = getCueState()
  return serverSnapshot
}

export function useCue(): CuePlaybackState {
  return useSyncExternalStore(
    (onStoreChange) => subscribeCue(onStoreChange),
    getCueState,
    getServerSnapshot
  )
}

/**
 * 큐 이벤트 리스너. handler는 ref로 감싸지 않아도 되도록
 * 마운트 시점의 최신 클로저를 유지한다 — 의존성 배열에 주의.
 */
export function useCueEvents(handler: (event: CueEvent) => void) {
  useEffect(() => {
    return subscribeCueEvents(handler)
  }, [handler])
}
