'use client'

/**
 * 투어 전역 상태 구독 훅 — hydration 안전판.
 *
 * 서버 렌더와 클라이언트 첫 렌더는 반드시 같은 화면이어야 한다.
 * localStorage 값은 서버가 모르는 상태이므로, 첫 렌더에는 초기 상태를
 * 돌려주고 그 직후 실제 상태로 교체한다.
 *
 * 플래그가 모듈에 있는 것이 중요하다. 컴포넌트마다 따로 두면 화면을 옮길
 * 때마다 그 화면이 처음 마운트되면서 다시 false에서 시작한다. hydration은
 * 진작 끝났는데도 한 프레임 동안 빈 상태가 그려졌다 사라진다 —
 * 빙고판이 0/20으로 떴다가 채워지고, 프로덕션에서는 잠금 화면(🔒)이
 * 번쩍인 뒤 판이 나온다. 앱 전체로 한 번만 넘기면 그 깜빡임이 없다.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  INITIAL_TOUR_STATE,
  TourState,
  getTourState,
  subscribeTour,
} from '@/lib/tourState'

/** 이 앱이 한 번이라도 클라이언트에서 그려졌는지 — 화면 이동에도 유지된다 */
let appHydrated = false

function useHydrated(): boolean {
  // 초기값을 렌더 시점에 읽는다. 이미 넘어와 있으면 첫 프레임부터 true다.
  const [hydrated, setHydrated] = useState(() => appHydrated)
  useEffect(() => {
    appHydrated = true
    if (!hydrated) setHydrated(true)
  }, [hydrated])
  return hydrated
}

export function useTourState(): TourState {
  const state = useSyncExternalStore(
    (onStoreChange) => subscribeTour(onStoreChange),
    getTourState,
    () => INITIAL_TOUR_STATE
  )
  return useHydrated() ? state : INITIAL_TOUR_STATE
}

/**
 * hydration 완료 여부 — 리다이렉트 가드는 반드시 이 값이 true일 때만
 * 판단해야 한다. 첫 렌더의 초기 상태(paid=false 등)를 실제 상태로 오인해
 * 잘못 튕겨내는 것을 막는다.
 */
export function useTourHydrated(): boolean {
  return useHydrated()
}
