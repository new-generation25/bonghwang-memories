'use client'

/**
 * 길 안내 — 거점 위치를 보여주고, 거기서 바로 들어간다.
 *
 * 한동안 여기서는 위치만 보여주고 "거점에 도착하면 입구의 QR을 스캔하세요"만
 * 말했다. 현장에서 걸어본 결과 그 한 줄로는 다음에 뭘 해야 하는지 서지 않았고,
 * 지나온 거점으로 돌아갈 길도 없었다. 마커를 눌러 미션을 보고 들어간다.
 *
 * **순서는 지킨다.** 다음 차례가 아닌 거점은 요약만 보이고 잠긴다 —
 * 이야기가 거점 순서대로 이어지므로 건너뛰면 앞의 사연을 모른 채 듣게 된다.
 *
 * GPS는 여전히 재생 트리거가 아니다(D9). 100m 알림은 알림일 뿐이고,
 * 시작하는 것은 늘 사람이 누르는 순간이다.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mission, LocationData } from '@/lib/types'
import Map from '@/components/Map'
import Navigation from '@/components/Navigation'
import { useTourState } from '@/hooks/useTourState'
import { dispatchQr, unlockAudio } from '@/lib/cueEngine'
import { Station, missionsForTrack, stationByTrack, TRACK_STATIONS } from '@/lib/tracks'

export default function GuideMapPage() {
  const router = useRouter()
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [selected, setSelected] = useState<Station | null>(null)
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

  /*
    마커 탭 — Map은 구 Mission 모양으로 넘겨주므로 이름으로 거점을 되찾는다.
    Map의 데이터 모양을 바꾸면 빙고 칸까지 함께 움직여서, 여기서만 맞춘다.
  */
  const handleMissionSelect = (mission: Mission) => {
    setSelected(TRACK_STATIONS.find((s) => mission.title.includes(s.name)) ?? null)
  }

  const done = selected ? tour.tracksCompleted.includes(selected.track) : false
  /** 잠금 — 다음 차례이거나 이미 다녀온 곳만 연다 */
  const openable = selected ? done || selected.track === nextTrack : false

  /*
    지도에서 바로 입장한다.

    QR 스캔과 **같은 신호**(dispatchQr)를 보낸다 — 큐의 트리거를 바꾸지 않으므로
    번들 그래프와 D4 검사는 그대로다. 화면 전환을 먼저 걸고 신호를 뒤에 보내는
    순서도 /play와 같다. 뒤집으면 소영의 첫 문장이 지도 위에서 들리고, iOS에서는
    제스처 문맥이 끊겨 아예 안 들린다.
  */
  const enter = (station: Station) => {
    unlockAudio()
    router.push(`/track/${station.track}`)
    if (!tour.tracksCompleted.includes(station.track)) dispatchQr(station.id)
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

        {selected && (
          <div className="story-card mt-4 px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono-retro text-[9px] text-rec">
                A{selected.track} · STATION
              </span>
              {done && (
                <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[10px] text-teal">
                  다녀옴
                </span>
              )}
            </div>
            <p className="mt-1 text-[13.5px] font-bold text-ink">{selected.name}</p>
            <p className="mt-0.5 text-[12px] text-ink-60">{selected.wish}</p>

            {/* 미션 요약 — 무엇을 하게 되는지 미리 안다 */}
            <ul className="mt-2 space-y-0.5">
              {missionsForTrack(selected.track).map((m) => (
                <li key={m.id} className="text-[11.5px] text-ink-60">
                  · {m.title}
                </li>
              ))}
            </ul>

            {openable ? (
              <button
                onClick={() => enter(selected)}
                className="btn-teal mt-3 w-full text-center text-[13px]"
              >
                {done ? '이야기 다시 듣기' : '▶ 미션 시작'}
              </button>
            ) : (
              <p className="mt-3 rounded-lg bg-cream-dp px-3 py-2 text-center text-[11.5px] leading-relaxed text-ink-60">
                앞의 거점을 먼저 들러주세요.
                <br />
                이야기가 순서대로 이어집니다.
              </p>
            )}
          </div>
        )}

        <div className="card-paper mt-4 p-4 text-center shadow-lg">
          {/* 하단 탭바에 '플레이어' 탭이 항상 있어 돌아가기 버튼은 두지 않는다 —
              중복 CTA를 없애면 안내 카드가 첫 화면 안에 들어온다 */}
          <p className="text-[12px] leading-relaxed text-ink-60">
            지도의 거점을 눌러 미션을 보고 바로 들어갈 수 있어요.
            <br />
            거점 앞이라면 입구의 QR을 찍어도 됩니다.
          </p>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
