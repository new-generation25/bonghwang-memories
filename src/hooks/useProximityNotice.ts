'use client'

/**
 * 거점 접근 알림 (§4) — GPS는 재생 트리거로 쓰지 않는다(D9).
 * 다음 거점 100m 이내 진입 시 "도착하셨나요? 입구의 QR을 찾아보세요"
 * 안내를 한 번만 띄우는 보조 장치다. 위치 권한이 없으면 조용히 아무것도 안 한다.
 */

import { useEffect, useRef, useState } from 'react'
import type { Station } from '@/lib/tracks'

const NOTICE_RADIUS_M = 100

/** Haversine 거리(m) — 구 MissionGPS에서 이관 */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface ProximityNotice {
  stationName: string
  message: string
}

export function useProximityNotice(target: Station | null): {
  notice: ProximityNotice | null
  dismiss: () => void
} {
  const [notice, setNotice] = useState<ProximityNotice | null>(null)
  /** 거점별 1회만 알린다 */
  const notified = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (
      !target?.location ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      notified.current.has(target.id)
    ) {
      return
    }

    const { lat, lng } = target.location
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const d = distanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          lat,
          lng
        )
        if (d <= NOTICE_RADIUS_M && !notified.current.has(target.id)) {
          notified.current.add(target.id)
          setNotice({
            stationName: target.name,
            message: '도착하셨나요? 입구의 QR을 찾아보세요',
          })
        }
      },
      // 권한 거부·오류는 조용히 무시 — QR 흐름에는 영향 없음
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [target])

  return { notice, dismiss: () => setNotice(null) }
}
