'use client'

/**
 * S22 — 최종 잠금 해제 (M5b, D10).
 *
 * 기억의 조각 슬롯 4개. 3개 이상이면 해제 가능(1미션 실패 허용).
 * 해제 → "B면의 마지막 트랙이 발견되었습니다." → [▶ B면 재생] 버튼 노출.
 * B면 편지(B5_LETTER)는 자동재생이 아니라 사용자 탭(user_tap:BSIDE)으로만
 * 시작한다 — 편지는 참여자가 직접 재생 버튼을 눌러야 하는 순간이다(D9·T4).
 */

import { useState } from 'react'
import { UNLOCK_MESSAGE } from '@/lib/cues'
import { dispatchAction, dispatchTap, unlockAudio } from '@/lib/cueEngine'
import { award } from '@/lib/points'
import { useRevealOnChange } from '@/hooks/useRevealOnChange'
import { useTourState } from '@/hooks/useTourState'
import { ALL_FRAGMENTS, UNLOCK_THRESHOLD } from '@/lib/tracks'

export default function UnlockGate() {
  const tour = useTourState()
  const [unlocking, setUnlocking] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const playRef = useRevealOnChange<HTMLDivElement>(revealed, revealed)

  const count = tour.fragments.length
  const canUnlock = count >= UNLOCK_THRESHOLD

  const handleUnlock = () => {
    if (!canUnlock || unlocking) return
    unlockAudio()
    setUnlocking(true)
    // 조각이 릴에 끼워지는 연출 후 해제 문구 + [B면 재생] 버튼 노출
    setTimeout(() => {
      setRevealed(true)
      // 스페셜미션 — 조각을 모아 B면을 연 사람에게만
      void award('special-bside-unlock', 'specialMission')
      // 상태 기록·분석용 — v2에서 큐 재생은 아래 BSIDE 탭이 담당한다
      dispatchAction('unlock_done')
    }, 900)
  }

  const handlePlayBside = () => {
    unlockAudio()
    dispatchTap('BSIDE')
  }

  return (
    <div
      className="mt-4 rounded-2xl border border-sunset-yellow bg-paper p-5 text-center shadow-sm"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <p className="font-mono-retro text-[10px] tracking-widest text-rec">
        SIDE B · LOCKED
      </p>
      <h3 className="mt-1 text-[15px] font-bold text-ink">기억의 조각</h3>

      {/* 조각 슬롯 4개 */}
      <div className="mt-4 flex items-center justify-center gap-3">
        {ALL_FRAGMENTS.map((frag, i) => {
          const filled = tour.fragments.includes(frag)
          return (
            <div
              key={frag}
              className={`frag-slot${filled ? ' filled' : ''}`}
              style={filled && unlocking ? { animationDelay: `${i * 0.15}s` } : undefined}
            >
              {filled ? '📼' : ''}
            </div>
          )
        })}
      </div>

      <p className="mt-3 font-mono-retro text-[12px] text-ink-60">
        {count} / {ALL_FRAGMENTS.length} · 해제에 {UNLOCK_THRESHOLD}개 필요
      </p>

      {revealed ? (
        <div style={{ animation: 'fadeIn 1s ease-in-out' }}>
          <p className="mt-4 font-pen text-[21px] text-ink">{UNLOCK_MESSAGE}</p>
          <div ref={playRef} className="cta-band mt-3">
            <button
              onClick={handlePlayBside}
              className="w-full rounded-xl bg-rec py-3.5 font-display text-[15px] text-cream"
            >
              ▶ B면 재생 — 아버지의 편지
            </button>
          </div>
        </div>
      ) : canUnlock ? (
        <div className="cta-band mt-4">
          <button
            onClick={handleUnlock}
            disabled={unlocking}
            className="w-full rounded-xl bg-shell py-3.5 font-display text-[15px] text-cream disabled:opacity-70"
          >
            {unlocking ? '릴에 조각을 끼우는 중…' : '🔓 조각을 끼워 넣기'}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-line bg-cream px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-60">
            조각이 {UNLOCK_THRESHOLD - count}개 더 필요해요.
            <br />
            지나온 거점의 소원을 이루면 조각을 얻을 수 있어요.
          </p>
        </div>
      )}
    </div>
  )
}
