'use client'

/**
 * call 채널 프레임 (D1) — 통화/보이스 버블: 프로필 + 파형.
 * 소영(현재)·사장님 전달 녹음이 이 프레임을 쓴다.
 */

import { initialFor, portraitFor } from '@/lib/cast'
import { Cue, SPEAKER_NAMES } from '@/lib/cues'

interface CallFrameProps {
  cue: Cue
  playing: boolean
  elapsed: number
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CallFrame({ cue, playing, elapsed }: CallFrameProps) {
  const portrait = portraitFor(cue)

  return (
    <div className="call-frame">
      <div className="flex items-center gap-3">
        {/* 프로필 — 그림이 있으면 얼굴, 없으면 한 글자 배지 */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal text-[22px] text-cream shadow-inner">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="" className="call-avatar-photo" />
          ) : (
            initialFor(cue)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] text-ink">
            {SPEAKER_NAMES[cue.speaker]}
          </p>
          <p className="font-mono-retro text-[11px] tracking-widest text-teal">
            {playing ? '통화 중' : '대기 중'} · {formatClock(elapsed)}
          </p>
        </div>
        {/* 파형 */}
        <div className={`call-wave${playing ? ' on' : ''}`} aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  )
}
