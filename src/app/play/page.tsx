'use client'

/**
 * S10 — 카세트 플레이어 홈: 1막의 허브.
 *
 * 트랙 리스트(잠김/진행/완료) · 릴 게이지 · 잠긴 빙고 배지 · QR 스캔.
 * 거점 진입은 오직 QR(또는 4자리 수동 코드)로만 — GPS는 재생 트리거 금지(D9),
 * 100m 접근 시 안내 토스트만 띄운다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Cassette, { CASSETTE_SCALE } from '@/components/Cassette'
import Navigation from '@/components/Navigation'
import QRGate from '@/components/QRGate'
import { useProximityNotice } from '@/hooks/useProximityNotice'
import { useTourState } from '@/hooks/useTourState'
import { dispatchQr } from '@/lib/cueEngine'
import { Station, TRACK_STATIONS, stationByTrack } from '@/lib/tracks'

/**
 * QR 표식 — 실물 QR을 축약한 모양.
 * 이모지(📷)는 카메라를 뜻해서 '사진 찍기'로 읽힐 수 있다. 거점에 붙은
 * 종이 QR과 같은 그림이어야 무엇을 찾아야 하는지 바로 안다.
 */
function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {/* 세 모서리의 찾기 표식 */}
      <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5z" />
      {/* 데이터 칸 몇 개 — 실물처럼 보이게 하는 최소한 */}
      <path d="M14 14h2v2h-2v-2zm4 0h3v2h-3v-2zm-4 4h2v3h-2v-3zm4 1h3v2h-3v-2z" />
    </svg>
  )
}

export default function PlayerHomePage() {
  const tour = useTourState()
  const router = useRouter()
  const [showScanner, setShowScanner] = useState(false)

  const completedCount = tour.tracksCompleted.length
  const progress = (completedCount / 5) * 100

  // 다음 입장 거점 — 완료된 트랙의 다음 (전부 완료면 없음)
  const nextTrack =
    completedCount >= 5 ? null : Math.max(0, ...tour.tracksCompleted) + 1
  const nextStation = nextTrack ? stationByTrack(nextTrack) : null

  const { notice, dismiss } = useProximityNotice(nextStation)

  const handleStationEnter = (station: Station) => {
    setShowScanner(false)
    dispatchQr(station.id)
    router.push(`/track/${station.track}`)
  }

  // pb-32 — 하단 탭바(84px)와 안전영역을 덮는 여백. 탭바를 쓰는 화면 공통값
  return (
    <div className="flex min-h-screen flex-col bg-cream-base pb-32">
      {/* 앱바 — 티얼 구조색. 탭바를 쓰는 화면은 모두 같은 머리를 쓴다 */}
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">SIDE A · 아버지의 믹스테이프</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">다섯 가지 소원</h1>
            <span className="shrink-0 rounded-full bg-cream/20 px-3 py-1 font-mono-retro text-[11px] font-bold">
              {completedCount} / 5
            </span>
          </div>
        </div>
      </header>

      {/* 카세트 히어로 — 릴 게이지 = 트랙 진행률 */}
      <div className="mt-3 flex justify-center">
        <Cassette
          title="아버지의 믹스테이프"
          headLeft="LOCAL MEMORIES"
          headRight={completedCount >= 5 ? 'SIDE A ✓' : 'SIDE A'}
          side={completedCount >= 5 ? 'done' : 'A'}
          progress={progress}
          spin="none"
          scale={CASSETTE_SCALE}
        />
      </div>

      {/* 트랙 리스트 */}
      <div className="mx-auto mt-4 w-full max-w-[380px] px-4">
        {TRACK_STATIONS.map((station) => {
          const done = tour.tracksCompleted.includes(station.track)
          const isNext = station.track === nextTrack
          return (
            <div
              key={station.id}
              className={`mt-2 flex items-center gap-3 rounded-xl border px-4 py-3 ${
                done
                  ? 'border-teal/40 bg-teal/10'
                  : isNext
                    ? 'border-sunset-yellow bg-paper shadow-sm'
                    : 'border-line bg-paper/60 opacity-60'
              }`}
            >
              <span className="font-mono-retro text-[13px] text-ink-60">
                {done ? '✓' : `T${station.track}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-ink">
                  {station.wish}
                </p>
                <p className="font-mono-retro text-[10.5px] text-ink-60">
                  {done
                    ? '소원 완료'
                    : isNext
                      ? `다음 거점 — ${station.name}`
                      : '잠김'}
                </p>
              </div>

              {/*
                지금 차례인 소원에만 QR 버튼이 붙는다.
                화면 아래 큰 버튼 하나로 두면 '어느 거점의 QR인지'를 버튼
                글자로 다시 설명해야 했다. 그 소원 옆에 있으면 설명이 필요 없다.
              */}
              {isNext && (
                <button
                  onClick={() => setShowScanner(true)}
                  aria-label={`${station.name} 거점 QR 스캔`}
                  /*
                    실물 QR처럼 검정. 티얼은 이 앱의 구조색이라 앱바·탭·버튼이
                    이미 쓰고 있어서, 여기까지 초록이면 '누르는 곳'이 아니라
                    '또 하나의 장식'으로 묻힌다. 검정 QR은 거점에 붙은 실물과
                    같은 그림이라 무엇을 찾아야 하는지도 같이 알려준다.
                  */
                  className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg bg-shell px-2.5 py-1.5 text-cream active:scale-95"
                >
                  <QrIcon />
                  <span className="font-mono-retro text-[9px] tracking-wider">
                    SCAN
                  </span>
                </button>
              )}
            </div>
          )
        })}

        {/*
          빙고 진입 카드는 뺐다. 하단 탭에 '빙고'가 생기면서 같은 일을
          두 곳에서 하게 됐고, 잠겼을 때의 안내도 탭 쪽이 더 정확하다
          (눌러보면 무엇을 끝내야 열리는지 말해준다).

          QR 버튼도 여기 있던 것을 지웠다 — 지금 차례인 소원 옆으로 옮겼다.
        */}
        <button
          onClick={() => router.push('/exploration')}
          className="mt-5 w-full rounded-xl border border-line bg-paper py-3 text-[13px] text-ink"
        >
          🗺 길 안내 지도 보기
        </button>
      </div>

      {/* GPS 접근 알림 — 재생 트리거 아님 (D9) */}
      {notice && (
        <div className="fixed left-1/2 top-6 z-50 w-[90%] max-w-[360px] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-teal bg-paper px-4 py-3 shadow-lg">
            <span className="text-[20px]">📍</span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-ink">{notice.stationName}</p>
              <p className="text-[12px] text-ink-60">{notice.message}</p>
            </div>
            <button onClick={dismiss} className="text-[13px] text-ink-60">
              ✕
            </button>
          </div>
        </div>
      )}

      {showScanner && nextStation && (
        <QRGate
          allowedStations={[nextStation.id]}
          onSuccess={handleStationEnter}
          onClose={() => setShowScanner(false)}
        />
      )}

      <Navigation />
    </div>
  )
}
