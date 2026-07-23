'use client'

/**
 * tape 채널 프레임 (D1) — 카세트 창 + 릴 회전 + 라벨.
 * 아버지(과거)·라디오 큐가 이 프레임을 쓴다.
 */

import Cassette, { CASSETTE_SCALE } from '@/components/Cassette'
import { portraitFor } from '@/lib/cast'
import { Cue, SPEAKER_NAMES } from '@/lib/cues'

interface TapeFrameProps {
  cue: Cue
  playing: boolean
  /** 재생 진행률 0~100 */
  progress: number
}

export default function TapeFrame({ cue, playing, progress }: TapeFrameProps) {
  // B면 편지(B5_LETTER)만 SIDE B 표기. 나머지 테이프 큐(소원·라디오)는 A면.
  const side = cue.id === 'B5_LETTER' ? 'B' : 'A'
  const portrait = portraitFor(cue)

  return (
    <div className="flex flex-col items-center">
      <Cassette
        title="아버지의 믹스테이프"
        headLeft="LOCAL MEMORIES"
        headRight={`SIDE ${side}`}
        side={side}
        progress={progress}
        spin={playing ? 'right' : 'none'}
        scale={CASSETTE_SCALE}
      />
      {/*
        말하는 사람의 얼굴 — 테이프는 목소리만 나오는 채널이라 누가 말하는지가
        더 흐리다. 카세트 아래에 작게 붙여 화자를 눈으로도 잡아준다.
      */}
      <div className="mt-2 flex items-center gap-2">
        {portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover object-[center_top] ring-1 ring-line"
          />
        )}
        <p className="font-mono-retro text-[11px] tracking-widest text-ink60">
          {playing ? '▶ PLAYING' : '⏸ PAUSED'} · {SPEAKER_NAMES[cue.speaker]}
          {cue.voiceAge === 'old' ? ' (현재)' : cue.voiceAge === 'young' ? ' (1988)' : ''}
        </p>
      </div>
    </div>
  )
}
