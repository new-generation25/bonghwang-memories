'use client'

/**
 * S22 — 최종 잠금 해제 (M5b, D10).
 *
 * '기억의 조각 3개'가 'J-카드 소원 3개'로 바뀌었다(F-1). 로직은 같다 —
 * 트랙 1~4 완료 중 3개 이상이면 해제(1미션 실패 허용). 조각이라는 별도
 * 상태는 없어졌고, 여기서도 트랙 완료에서 직접 센다.
 *
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
import {
  JCARD_FILLABLE_TRACKS,
  TRACK_STATIONS,
  UNLOCK_THRESHOLD,
} from '@/lib/tracks'

export default function JCardGate() {
  const tour = useTourState()
  const [unlocking, setUnlocking] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const playRef = useRevealOnChange<HTMLDivElement>(revealed, revealed)

  const done = tour.tracksCompleted.filter((t) =>
    JCARD_FILLABLE_TRACKS.includes(t)
  )
  const count = done.length
  const canUnlock = count >= UNLOCK_THRESHOLD

  const handleUnlock = () => {
    if (!canUnlock || unlocking) return
    unlockAudio()
    setUnlocking(true)
    // 소원을 하나씩 되짚는 연출 후 해제 문구 + [B면 재생] 버튼 노출
    setTimeout(() => {
      setRevealed(true)
      // 스페셜미션 — 소원을 이뤄 B면을 연 사람에게만
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
      <h3 className="mt-1 text-[15px] font-bold text-ink">J-카드의 소원</h3>

      {/* 채울 수 있는 네 줄 — J-카드와 같은 손글씨 결 */}
      <div className="mx-auto mt-4 max-w-[260px] text-left">
        {TRACK_STATIONS.filter((s) =>
          JCARD_FILLABLE_TRACKS.includes(s.track)
        ).map((s, i) => {
          const filled = done.includes(s.track)
          return (
            <div key={s.id} className="flex items-baseline gap-2 py-1">
              <span className="font-mono-retro text-[9.5px] text-ink-60">
                A{s.track}
              </span>
              <span
                className={`min-w-0 flex-1 truncate font-pen text-[20px] ${
                  filled ? 'text-ink' : 'text-ink-60/70'
                }`}
                style={
                  filled && unlocking
                    ? { animation: 'fadeIn 0.5s ease-in', animationDelay: `${i * 0.15}s` }
                    : undefined
                }
              >
                {s.wish}
              </span>
              <span className="shrink-0 text-[12px]">{filled ? '🖋' : ''}</span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 font-mono-retro text-[12px] text-ink-60">
        {count} / {JCARD_FILLABLE_TRACKS.length} · 해제에 {UNLOCK_THRESHOLD}개 필요
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
            {unlocking ? 'J-카드를 살펴보는 중…' : '🖋 이룬 소원 세어보기'}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-line bg-cream px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-60">
            소원이 {UNLOCK_THRESHOLD - count}개 더 필요해요.
            <br />
            지나온 거점의 소원을 이루면 J-카드에 줄이 그어져요.
          </p>
        </div>
      )}
    </div>
  )
}
