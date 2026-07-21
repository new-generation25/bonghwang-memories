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
import Cassette from '@/components/Cassette'
import Navigation from '@/components/Navigation'
import QRGate from '@/components/QRGate'
import { useProximityNotice } from '@/hooks/useProximityNotice'
import { useTourState } from '@/hooks/useTourState'
import { BINGO_LOCKED_MESSAGE } from '@/lib/cues'
import { dispatchQr } from '@/lib/cueEngine'
import { Station, TRACK_STATIONS, stationByTrack } from '@/lib/tracks'

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

  return (
    <div className="flex min-h-screen flex-col bg-cream-base pb-24">
      <header className="px-4 pt-6 text-center">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          SIDE A · 다섯 가지 소원
        </p>
      </header>

      {/* 카세트 히어로 — 릴 게이지 = 트랙 진행률 */}
      <div className="mt-3 flex justify-center">
        <Cassette
          title="아버지의 타임캡슐"
          headLeft="BONGHWANG 1988"
          headRight={completedCount >= 5 ? 'SIDE A ✓' : 'SIDE A'}
          side={completedCount >= 5 ? 'done' : 'A'}
          progress={progress}
          spin="none"
          scale={0.85}
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
            </div>
          )
        })}

        {/* 빙고 배지 — 5개 소원 완료 전 잠김 */}
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-center ${
            tour.bingo.unlocked
              ? 'border-sunset-yellow bg-sunset-yellow/15'
              : 'border-line bg-paper/60'
          }`}
        >
          {tour.bingo.unlocked ? (
            <button
              onClick={() => router.push('/treasure')}
              className="w-full font-display text-[14px] text-ink"
            >
              🎴 2막 — 골목 빙고 열기 ▶
            </button>
          ) : (
            <p className="text-[12px] text-ink-60">🔒 {BINGO_LOCKED_MESSAGE}</p>
          )}
        </div>

        {/* 액션 */}
        {nextStation && (
          <button
            onClick={() => setShowScanner(true)}
            className="btn-teal mt-5 w-full text-[15px]"
          >
            📷 거점 QR 스캔 — {nextStation.name}
          </button>
        )}
        <button
          onClick={() => router.push('/exploration')}
          className="mt-2 w-full rounded-xl border border-line bg-paper py-3 text-[13px] text-ink"
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
