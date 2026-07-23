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

interface CuePlayerProps {
  /**
   * 화면 높이를 채우는 배치.
   *
   * 거점 화면에서는 카드 하나로 뭉쳐두면 아래가 텅 빈다. 데크 키를 화면
   * 맨 아래에 고정하고(걸으면서 엄지로 닿는 자리), 자막을 그 위에,
   * 남는 가운데를 거점 사진에 내준다.
   *
   * 인트로는 쪽지·플레이어와 함께 흐르는 화면이라 기존 카드 배치를 쓴다.
   */
  fill?: boolean
  /** 가운데에 넣을 것 — 거점 그림 */
  center?: React.ReactNode
  /**
   * 재생이 끝난 뒤 PLAY 키가 할 일.
   *
   * 없으면 PLAY는 눌리지 않는 키로 남는다. 있으면 그 키가 다음 단계를
   * 여는 버튼이 된다 — 화면 아래에 따로 띠 버튼을 두지 않기 위해서다.
   * 카세트 패널이 바로 위에 있는데 아래에 또 '▶ 재생'이 있으면
   * 어느 쪽을 눌러야 하는지 헷갈린다.
   */
  endedAction?: { label: string; onClick: () => void }
}

export default function CuePlayer({
  fill = false,
  center,
  endedAction,
}: CuePlayerProps = {}) {
  const cueState = useCue()
  const { cueId, playing, elapsed, duration, subtitleIndex, ended, audioAvailable, pendingAutoChain } = cueState

  if (!cueId) return null
  const cue = CUES[cueId]
  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0
  // 자동재생 거부 상태: 오디오는 준비됐는데 시작을 못 한 경우
  const needsTap = audioAvailable && !playing && !ended && elapsed === 0

  const frame =
    cue.channel === 'tape' ? (
      <TapeFrame cue={cue} playing={playing} progress={progress} />
    ) : (
      <CallFrame cue={cue} playing={playing} elapsed={elapsed} />
    )

  const progressBar = (
    <div className="tape-prog mt-3" aria-hidden>
      <i style={{ width: `${progress}%` }} />
    </div>
  )

  const subtitles = (
    <SubtitleView
      cue={cue}
      subtitleIndex={subtitleIndex}
      handwriting={cue.id === 'B5_LETTER'}
    />
  )

  return (
    <div
      className={
        fill
          ? 'flex min-h-0 flex-1 flex-col'
          : 'rounded-2xl border border-line bg-paper p-4 shadow-sm'
      }
    >
      {fill ? (
        /*
          화자 · 거점 그림 · 자막을 흰 상자 하나에 담는다.
          셋을 따로 띄우면 카드가 세 장 겹친 것처럼 보이고, 사이의 크림
          여백이 화면을 토막 낸다. 하나로 묶으면 '지금 재생 중인 한 덩어리'로
          읽히고, 그 안에서 가는 선으로만 구역을 나눈다.
        */
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
          {/* 화자 — 누가 말하는지는 늘 위에 */}
          <div className="shrink-0 p-3">
            {frame}
            {progressBar}
          </div>

          {/*
            남는 자리는 거점 그림에.
            줄어드는 쪽은 여기다(shrink) — 자막이나 데크가 눌리면 글이
            잘리거나 키가 작아지지만, 그림은 조금 작아져도 제 구실을 한다.
          */}
          <div className="flex min-h-0 flex-1 shrink items-center justify-center overflow-hidden px-3 pb-3">
            {center}
          </div>

          {/* 자막은 데크 바로 위 — 듣는 동안 눈이 가장 오래 머무는 자리 */}
          <div className="shrink-0 border-t border-line px-4 py-3">
            {subtitles}
          </div>
        </div>
      ) : (
        <>
          {frame}
          {progressBar}
          {/*
            미션이 뜬 뒤에도 거점 그림은 남긴다.
            음성이 끝났다고 그림이 사라지면 '여기가 어디였지'가 다시 흐려진다 —
            정작 미션(사진 찍기·세기)을 하려고 주변을 둘러보는 건 그때다.
            대신 미션이 화면 밖으로 밀리지 않게 크기를 줄인다.
          */}
          {center && (
            <div className="mx-auto mt-3 w-[62%] min-w-[180px] max-w-[240px]">
              {center}
            </div>
          )}
          {subtitles}
        </>
      )}

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
              ? endedAction
                ? {
                    // 다음 단계를 여는 키 — 눈에 띄게 살린다
                    kind: 'play',
                    label: endedAction.label,
                    onClick: endedAction.onClick,
                    accent: 'go',
                    ariaLabel: endedAction.label,
                  }
                : { kind: 'play' }
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
