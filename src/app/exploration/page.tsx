'use client'

/**
 * 길 안내 (보조 화면) — EP.1 개편으로 허브 역할은 /play(카세트 홈)로 넘어갔다.
 *
 * 여기서는 거점 위치만 보여준다. 미션 시작은 불가 —
 * 거점 입장은 오직 현장 QR 스캔(§4 T1)이며, GPS는 재생 트리거가 아니다(D9).
 */

import { useEffect, useState } from 'react'
import { Mission, LocationData } from '@/lib/types'
import Map from '@/components/Map'
import Navigation from '@/components/Navigation'
import { useTourState } from '@/hooks/useTourState'
import { stationByTrack } from '@/lib/tracks'

export default function GuideMapPage() {
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const tour = useTourState()

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 }
      )
    }
  }, [])

  // Map 컴포넌트는 구 'main-n' id로 완료 여부를 표시한다
  const completedMissionIds = tour.tracksCompleted.map((t) => `main-${t}`)

  const nextTrack =
    tour.tracksCompleted.length >= 5
      ? null
      : Math.max(0, ...tour.tracksCompleted) + 1
  const nextStation = nextTrack ? stationByTrack(nextTrack) : null

  // 마커 탭 — 시작 버튼 없이 위치 안내만
  const handleMissionSelect = (mission: Mission) => {
    setSelectedName(mission.title)
  }

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      {/* 앱바 — 티얼 구조색 */}
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          {/*
            다음 거점 이름은 배지로 내렸다. 제목 자리에 두면 이름 길이에 따라
            글자 크기를 17px로 낮추고 줄바꿈까지 감수해야 해서, 다른 화면의
            앱바와 머리 높이가 달라졌다. 제목은 고정, 변하는 값은 배지로.
          */}
          <span className="appbar-badge">
            {nextStation ? `다음 거점 · ${nextStation.name}` : '다섯 소원 완주'}
          </span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">길 안내</h1>
            <span className="shrink-0 rounded-full bg-cream/20 px-3 py-1 font-mono-retro text-[11px] font-bold">
              {tour.tracksCompleted.length} / 5
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        <div className="card-paper overflow-hidden shadow-lg">
          <Map
            onMissionSelect={handleMissionSelect}
            completedMissions={completedMissionIds}
            userLocation={
              userLocation
                ? { lat: userLocation.latitude, lng: userLocation.longitude }
                : undefined
            }
          />
        </div>

        {selectedName && (
          <div className="story-card mt-4 px-3 py-2.5">
            <div className="font-mono-retro text-[9px] text-rec">STATION</div>
            <p className="mt-1 text-[13px] font-bold text-ink">{selectedName}</p>
            <p className="mt-0.5 text-xs text-ink-60">
              거점에 도착하면 입구의 QR을 스캔해 입장하세요
            </p>
          </div>
        )}

        <div className="card-paper mt-4 p-4 text-center shadow-lg">
          {/* 하단 탭바에 '플레이어' 탭이 항상 있어 돌아가기 버튼은 두지 않는다 —
              중복 CTA를 없애면 안내 카드가 첫 화면 안에 들어온다 */}
          <p className="text-[12px] leading-relaxed text-ink-60">
            거점 도착 → 입구 QR 스캔 → 소영의 전화가 이어집니다.
            <br />
            100m 안에 들어오면 도착 알림을 드려요.
          </p>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
