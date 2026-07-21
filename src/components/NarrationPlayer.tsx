'use client'

import { useEffect, useState } from 'react'
import {
  playNarration,
  pauseNarration,
  resumeNarration,
  stopNarration,
  subscribeNarration,
  isNarrationAvailable,
  unlockAudio,
  NarrationId,
  NarrationState,
} from '@/lib/narration'

interface NarrationPlayerProps {
  id: NarrationId
  /** 컨트롤 옆에 표시할 화자 표기 — 예: "아빠의 목소리" */
  label: string
  /** 진입하자마자 재생을 시도할지. iOS는 사용자 조작이 없으면 무시된다 */
  autoPlay?: boolean
  className?: string
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * 내레이션 재생 컨트롤 — 카세트 문법(릴 회전 + 테이프 게이지)으로 표현한다.
 *
 * 음성 파일이 아직 없으면 컨트롤 자체를 숨긴다. 없는 기능을 회색 버튼으로
 * 남겨두면 고장난 것처럼 보이기 때문이다.
 */
export default function NarrationPlayer({
  id,
  label,
  autoPlay = false,
  className = '',
}: NarrationPlayerProps) {
  const [state, setState] = useState<NarrationState | null>(null)
  // null = 아직 확인 중. 확인 전에는 컨트롤을 그리지 않아 깜빡임을 막는다
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => subscribeNarration(setState), [])

  // 마운트 시 음성 파일이 실제로 있는지 먼저 확인한다.
  // 없는 기능을 버튼으로 남겨두면 고장난 것처럼 보인다.
  useEffect(() => {
    let alive = true
    isNarrationAvailable(id)
      .then((ok) => alive && setAvailable(ok))
      .catch(() => alive && setAvailable(false))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (autoPlay && available) void playNarration(id)
    // 페이지를 벗어나면 소리가 따라다니지 않도록 정리
    return () => stopNarration()
  }, [id, autoPlay, available])

  const isCurrent = state?.id === id
  const playing = Boolean(isCurrent && state?.playing)

  // 파일이 없거나 확인 전이면 컨트롤을 노출하지 않는다.
  // 파일은 있지만 재생에 실패한 경우(손상·코덱 미지원)도 마찬가지로 숨긴다 —
  // 눌러도 아무 일이 없는 버튼을 남겨두면 고장으로 보인다.
  if (!available || (isCurrent && state?.unavailable)) return null

  const progress =
    isCurrent && state && state.duration > 0
      ? (state.currentTime / state.duration) * 100
      : 0

  const handleToggle = () => {
    unlockAudio()
    if (!isCurrent) return void playNarration(id)
    if (playing) return pauseNarration()
    resumeNarration()
  }

  return (
    <div className={`trackbar rounded-lg px-3 py-2.5 ${className}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          aria-label={playing ? `${label} 일시정지` : `${label} 재생`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunset text-[13px] text-shell"
        >
          {playing ? '❚❚' : '▶'}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono-retro text-[9px] text-sunset">{label}</span>
            <span className="shrink-0 font-mono-retro text-[9px] text-cream/60">
              {isCurrent && state ? formatTime(state.currentTime) : '0:00'} /{' '}
              {isCurrent && state ? formatTime(state.duration) : '0:00'}
            </span>
          </div>

          <div className="tape-prog mt-1.5">
            <div className={`reel${playing ? ' spin' : ''}`}>
              <span className="hub" />
            </div>
            <div className="bar">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className={`reel${playing ? ' spin' : ''}`}>
              <span className="hub" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
