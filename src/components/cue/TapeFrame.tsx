'use client'

/**
 * tape 채널 프레임 (D1) — 카세트 창 + 릴 회전 + 라벨.
 * 아버지(과거)·라디오 큐가 이 프레임을 쓴다.
 */

import Cassette from '@/components/Cassette'
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

  return (
    <div className="flex flex-col items-center">
      <Cassette
        title="아버지의 타임캡슐"
        headLeft="BONGHWANG 1988"
        headRight={`SIDE ${side}`}
        side={side}
        progress={progress}
        spin={playing ? 'right' : 'none'}
        scale={0.9}
      />
      <p className="mt-2 font-mono-retro text-[11px] tracking-widest text-ink60">
        {playing ? '▶ PLAYING' : '⏸ PAUSED'} · {SPEAKER_NAMES[cue.speaker]}
        {cue.voiceAge === 'old' ? ' (현재)' : cue.voiceAge === 'young' ? ' (1988)' : ''}
      </p>
    </div>
  )
}
