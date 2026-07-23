'use client'

/**
 * 기기 방향으로 움직이는 AR 오버레이.
 *
 * WebXR은 iOS 사파리가 지원하지 않고, 마커 인식 라이브러리는 용량이 크고
 * 오프라인 캐시(D8)에도 부담이다. 이 앱이 필요한 건 능소화가 골목 어딘가에
 * 피어 있는 것처럼 보이는 것뿐이라, 방향 센서만으로 충분하다.
 *
 * 원리: 폰을 오른쪽으로 돌리면 세상은 왼쪽으로 흐른다. 시작할 때의 자세를
 * 기준으로 잡고, 그로부터 얼마나 돌아갔는지만큼 오버레이를 반대로 민다.
 * 위치 추적이 없으니 가까운 물체에는 안 맞지만, 벽에 핀 꽃처럼 조금 떨어진
 * 대상에는 충분히 붙어 보인다.
 *
 * 센서를 못 쓰면 값이 0으로 남아 정적 프레임과 똑같아진다 — 그게 D11 폴백이다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ArTransform {
  /** 화면 폭 대비 비율 (-0.5 ~ 0.5) */
  x: number
  y: number
  /** 도 단위 */
  rotate: number
}

const ZERO: ArTransform = { x: 0, y: 0, rotate: 0 }

/** 민감도 — 1도 돌릴 때 화면 폭의 몇 %가 움직이는가 */
const K_X = 0.010
const K_Y = 0.008
const K_ROT = 0.35

/** 너무 밀려 화면 밖으로 나가지 않게 */
const LIMIT = 0.28
export const clamp = (v: number, l = LIMIT) => Math.max(-l, Math.min(l, v))

/** -180~180으로 접는다 — alpha는 0/360 경계를 넘나든다 */
export function wrap(deg: number): number {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

type PermissionCtor = {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function useArOverlay(enabled: boolean) {
  const [transform, setTransform] = useState<ArTransform>(ZERO)
  const [active, setActive] = useState(false)
  const [needsPermission, setNeedsPermission] = useState(false)
  const baseRef = useRef<{ a: number; b: number; g: number } | null>(null)

  /** 촬영 시점에 화면과 같은 값을 써야 하므로 ref로도 들고 있는다 */
  const transformRef = useRef<ArTransform>(ZERO)
  transformRef.current = transform

  const handle = useCallback((e: DeviceOrientationEvent) => {
    const a = e.alpha ?? 0
    const b = e.beta ?? 0
    const g = e.gamma ?? 0
    if (!baseRef.current) {
      baseRef.current = { a, b, g }
      return
    }
    const base = baseRef.current
    const next = {
      x: clamp(-wrap(a - base.a) * K_X),
      y: clamp(-(b - base.b) * K_Y),
      rotate: Math.max(-8, Math.min(8, -(g - base.g) * K_ROT)),
    }
    setTransform(next)
    setActive(true)
  }, [])

  /** iOS는 사용자 조작 안에서 권한을 요청해야 한다 */
  const requestAccess = useCallback(async () => {
    const Ctor = (
      typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined
    ) as unknown as PermissionCtor | undefined

    if (Ctor?.requestPermission) {
      try {
        const res = await Ctor.requestPermission()
        if (res !== 'granted') {
          setNeedsPermission(false)
          return false
        }
      } catch {
        setNeedsPermission(false)
        return false
      }
    }
    baseRef.current = null
    window.addEventListener('deviceorientation', handle)
    setNeedsPermission(false)
    return true
  }, [handle])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    if (!('DeviceOrientationEvent' in window)) return

    const Ctor = window.DeviceOrientationEvent as unknown as PermissionCtor
    if (Ctor?.requestPermission) {
      // iOS — 버튼을 눌러야 켤 수 있다
      setNeedsPermission(true)
      return
    }

    baseRef.current = null
    window.addEventListener('deviceorientation', handle)
    return () => window.removeEventListener('deviceorientation', handle)
  }, [enabled, handle])

  useEffect(() => {
    return () => window.removeEventListener('deviceorientation', handle)
  }, [handle])

  /** 지금 자세를 기준으로 다시 잡는다 */
  const recenter = useCallback(() => {
    baseRef.current = null
    setTransform(ZERO)
  }, [])

  return { transform, transformRef, active, needsPermission, requestAccess, recenter }
}
