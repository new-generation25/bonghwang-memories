'use client'

/**
 * 투어 전역 상태 구독 훅 — hydration 안전판.
 *
 * 서버 렌더와 클라이언트 첫 렌더는 반드시 같은 화면이어야 한다.
 * localStorage 값은 서버가 모르는 상태이므로, 마운트 전에는 초기 상태를
 * 돌려주고 마운트 직후 실제 상태로 교체한다(잠금 화면이 잠깐 보일 수 있지만
 * hydration 불일치 오류보다 낫다).
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  INITIAL_TOUR_STATE,
  TourState,
  getTourState,
  subscribeTour,
} from '@/lib/tourState'

export function useTourState(): TourState {
  const state = useSyncExternalStore(
    (onStoreChange) => subscribeTour(onStoreChange),
    getTourState,
    () => INITIAL_TOUR_STATE
  )
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated ? state : INITIAL_TOUR_STATE
}

/**
 * hydration 완료 여부 — 리다이렉트 가드는 반드시 이 값이 true일 때만
 * 판단해야 한다. 첫 렌더의 초기 상태(paid=false 등)를 실제 상태로 오인해
 * 잘못 튕겨내는 것을 막는다.
 */
export function useTourHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
