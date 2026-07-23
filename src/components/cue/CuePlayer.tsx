'use client'

/**
 * 큐 플레이어 — 채널별 프레임 + 공통 컨트롤(§4).
 *
 * 컨트롤: ⏪ 다시듣기(무제한) / ⏸·▶ / 자막 / ⏩(재생 15초 후 활성 — D9)
 * 오디오 파일이 없으면 합성 클록으로 자막만 진행한다.
 * iOS에서 자동재생이 거부되면 "탭해서 계속" 버튼을 보여준다.
 */

import { CUES } from '@/lib/cues'
import { endCue, pauseCue, replayCue, resumeCue, skipLine } from '@/lib/cueEngine'
import { useCue } from '@/hooks/useCue'
import CallFrame from './CallFrame'
import DeckControls from './DeckControls'
import SubtitleView from './SubtitleView'
import TapeFrame from './TapeFrame'

interface CuePlayerProps {
  /**
   * 거점 화면 배치 — 화자·거점 그림·자막을 흰 상자 하나에 담는다.
   *
   * 전에는 이 값이 '화면 높이를 채운다'는 뜻이었고, 미션이 뜨면 꺼서
   * 다른 배치로 넘어갔다. 그래서 더빙이 끝나는 순간 그림이 갑자기
   * 작아지고 프레임 모양이 바뀌었다 — 거점마다 다른 화면처럼 보였다.
   *
   * 지금은 늘 같은 상자를 쓰고, 높이는 내용에 맞춘다. 크기가 변하지
   * 않으므로 미션이 떠도 그 아래로 자연스럽게 이어진다.
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
  /**
   * 데크를 감춘다 — 미션이 화면을 덮고 있을 때.
   *
   * 데크는 화면 아래에 못박혀 있고 미션 오버레이는 그 위를 덮는다. 그래서
   * 미션이 뜨면 데크가 막 뒤에 깔린 채 아래쪽 한 줄만 비어져 나왔다 —
   * 보이는데 눌리지 않는 물건이 된다. 지금 할 일은 미션이니 아예 치운다.
   */
  deckHidden?: boolean
}

export default function CuePlayer({
  fill = false,
  center,
  endedAction,
  deckHidden = false,
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

  const deck = needsTap ? (
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
        { kind: 'rew', onClick: replayCue, ariaLabel: '다시듣기' },
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
          onClick: ended ? undefined : skipLine,
          ariaLabel: '다음 줄로 건너뛰기',
          title: '다음 문장으로 — 마지막 문장에서는 다음으로 넘어갑니다',
        },
        {
          /*
            STOP — 지금 이야기를 끝내고 다음으로 넘긴다.
            실물 데크에서 STOP은 늘 눌리는 키다. 눌리지 않는 STOP은 고장 난
            기계로 읽힌다. 끝내는 방식은 끝까지 들은 것과 같아서(endCue),
            미션이 열려야 할 자리에서는 미션이 열린다.
          */
          kind: 'stop',
          onClick: ended ? undefined : endCue,
          ariaLabel: '건너뛰고 다음으로',
          title: '지금 이야기를 끝내고 다음으로 넘어갑니다',
        },
      ]}
    />
  )

  return (
    <div className={fill ? '' : 'rounded-2xl border border-line bg-paper p-4 shadow-sm'}>
      {fill ? (
        /*
          화자 · 거점 그림 · 자막을 흰 상자 하나에 담는다.
          셋을 따로 띄우면 카드가 세 장 겹친 것처럼 보이고, 사이의 크림
          여백이 화면을 토막 낸다. 하나로 묶으면 '지금 재생 중인 한 덩어리'로
          읽히고, 그 안에서 가는 선으로만 구역을 나눈다.

          순서는 다섯 거점이 모두 같다 — 화자 · 거점 그림 · 자막 · 데크.
        */
        <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
          {/* 화자 — 누가 말하는지는 늘 위에 */}
          <div className="p-3">
            {frame}
            {progressBar}
          </div>

          {/*
            거점 그림 — 상자 폭을 꽉 채운다.

            크기는 못박는다. 예전에는 남는 높이를 그림에 내줬는데, 그러면
            대사 길이와 미션 유무에 따라 거점마다 그림이 커졌다 작아졌다
            했다. 특히 더빙이 끝나는 순간 눈에 띄게 줄어들어, 화면이
            바뀐 것처럼 보였다.

            좁게 두지 않는다. 이 화면에서 눈이 가는 곳은 그림 하나뿐이고,
            골목에서 실제 간판과 대조하는 것도 이 그림이다.
          */}
          <div className="px-3 pb-3">{center}</div>

          {/*
            자막은 그림 바로 아래. 구분선을 두지 않는다 — 화자·그림·자막이
            한 덩어리로 읽혀야 하는데, 선이 들어가면 그림과 자막이 다른
            카드처럼 갈린다.
          */}
          <div className="px-4 pb-3">{subtitles}</div>
        </div>
      ) : (
        <>
          {frame}
          {progressBar}
          {/*
            미션이 뜬 뒤에도 거점 그림은 남긴다.
            음성이 끝났다고 그림이 사라지면 '여기가 어디였지'가 다시 흐려진다 —
            정작 미션(사진 찍기·세기)을 하려고 주변을 둘러보는 건 그때다.
          */}
          {center && (
            <div className="mx-auto mt-3 w-[76%] min-w-[200px] max-w-[280px]">
              {center}
            </div>
          )}
          {subtitles}
        </>
      )}

      {/*
        각인은 실물 데크 그대로 REW · PLAY · FF · STOP이다. 한글 설명을
        새기면 키마다 글자 수가 달라 네 칸의 무게가 어긋난다 — 무엇을 하는
        키인지는 도형이 말한다. 다만 재생이 끝난 뒤의 PLAY만은 다음 단계를
        여는 키라, 무엇이 열리는지 이름을 그대로 새긴다.
      */}
      {fill ? (
        !deckHidden && <div className="deck-dock">{deck}</div>
      ) : (
        deck
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
