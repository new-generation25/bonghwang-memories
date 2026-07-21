'use client'

/**
 * 큐 플레이어 — 채널별 프레임 + 공통 컨트롤(§4).
 *
 * 컨트롤: ⏪ 다시듣기(무제한) / ⏸·▶ / 자막 / ⏩(재생 15초 후 활성 — D9)
 * 오디오 파일이 없으면 합성 클록으로 자막만 진행한다.
 * iOS에서 자동재생이 거부되면 "탭해서 계속" 버튼을 보여준다.
 */

import { CUES } from '@/lib/cues'
import {
  SKIP_AFTER_SEC,
  pauseCue,
  replayCue,
  resumeCue,
  skipCue,
} from '@/lib/cueEngine'
import { useCue } from '@/hooks/useCue'
import CallFrame from './CallFrame'
import SubtitleView from './SubtitleView'
import TapeFrame from './TapeFrame'

export default function CuePlayer() {
  const cueState = useCue()
  const { cueId, playing, elapsed, duration, subtitleIndex, skippable, ended, audioAvailable, pendingAutoChain } = cueState

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
        handwriting={cue.id === 'C5_4'}
      />

      {needsTap ? (
        <button
          type="button"
          onClick={resumeCue}
          className="mt-3 w-full rounded-xl bg-rec py-3 font-display text-[15px] text-cream"
        >
          ▶ 탭해서 계속 듣기
        </button>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={replayCue}
            className="rounded-lg border border-line px-3 py-2 text-[13px] text-ink"
            aria-label="다시듣기"
          >
            ⏪ 다시듣기
          </button>

          {!ended && (
            <button
              type="button"
              onClick={playing ? pauseCue : resumeCue}
              className="rounded-lg border border-line px-4 py-2 text-[15px] text-ink"
              aria-label={playing ? '일시정지' : '재생'}
            >
              {playing ? '⏸' : '▶'}
            </button>
          )}

          <button
            type="button"
            onClick={skipCue}
            disabled={!skippable || ended}
            className={`rounded-lg px-3 py-2 text-[13px] ${
              skippable && !ended
                ? 'border border-line text-ink'
                : 'cursor-not-allowed border border-line/50 text-ink60/50'
            }`}
            aria-label="건너뛰기"
            title={
              skippable ? '건너뛰기' : `${SKIP_AFTER_SEC}초 후 건너뛸 수 있어요`
            }
          >
            ⏩ 건너뛰기
          </button>
        </div>
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
