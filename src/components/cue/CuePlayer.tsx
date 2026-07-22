'use client'

/**
 * 큐 플레이어 — 채널별 프레임 + 공통 컨트롤(§4).
 *
 * 컨트롤: ⏪ 다시듣기(무제한) / ⏸·▶ / 자막 / ⏩(재생 15초 후 활성 — D9)
 * 오디오 파일이 없으면 합성 클록으로 자막만 진행한다.
 * iOS에서 자동재생이 거부되면 "탭해서 계속" 버튼을 보여준다.
 */

import { CUES } from '@/lib/cues'
import { pauseCue, replayCue, resumeCue, skipLine } from '@/lib/cueEngine'
import { useCue } from '@/hooks/useCue'
import CallFrame from './CallFrame'
import DeckControls from './DeckControls'
import SubtitleView from './SubtitleView'
import TapeFrame from './TapeFrame'

export default function CuePlayer() {
  const cueState = useCue()
  const { cueId, playing, elapsed, duration, subtitleIndex, ended, audioAvailable, pendingAutoChain } = cueState

  if (!cueId) return null
  const cue = CUES[cueId]
  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0
  // 자동재생 거부 상태: 오디오는 준비됐는데 시작을 못 한 경우
  const needsTap = audioAvailable && !playing && !ended && elapsed === 0

  return (
    <div className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
      {cue.channel === 'tape' ? (
        <TapeFrame cue={cue} playing={playing} progress={progress} />
      ) : (
        <CallFrame cue={cue} playing={playing} elapsed={elapsed} />
      )}

      {/* 진행 바 */}
      <div className="tape-prog mt-3" aria-hidden>
        <i style={{ width: `${progress}%` }} />
      </div>

      <SubtitleView
        cue={cue}
        subtitleIndex={subtitleIndex}
        handwriting={cue.id === 'B5_LETTER'}
      />

      {needsTap ? (
        <DeckControls
          className="mt-3"
          keys={[
            { kind: 'rew' },
            { kind: 'play', label: '탭해서 계속', onClick: resumeCue },
            { kind: 'ff' },
            { kind: 'stop' },
          ]}
        />
      ) : (
        <DeckControls
          className="mt-3"
          keys={[
            { kind: 'rew', label: '다시듣기', onClick: replayCue, ariaLabel: '다시듣기' },
            ended
              ? { kind: 'play' }
              : playing
                ? { kind: 'pause', onClick: pauseCue, ariaLabel: '일시정지' }
                : { kind: 'play', onClick: resumeCue, ariaLabel: '재생' },
            {
              // FF — 재생 중에도 한 줄씩 넘긴다. 마지막 줄이면 다음 단계로.
              kind: 'ff',
              label: '다음 줄',
              onClick: ended ? undefined : skipLine,
              ariaLabel: '다음 줄로 건너뛰기',
              title: '다음 문장으로 — 마지막 문장에서는 다음으로 넘어갑니다',
            },
            { kind: 'stop' },
          ]}
        />
      )}

      {!audioAvailable && !ended && (
        <p className="mt-2 text-center font-mono-retro text-[10.5px] text-ink60">
          음성 준비 중 — 자막으로 진행됩니다
        </p>
      )}
      {pendingAutoChain && (
        <p className="mt-2 text-center font-mono-retro text-[10.5px] text-teal">
          잠시 후 이어집니다…
        </p>
      )}
    </div>
  )
}
