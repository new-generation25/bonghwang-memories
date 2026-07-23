'use client'

/**
 * S03 — 전체 화면 통화 인터페이스.
 *
 * 스마트폰 통화 화면을 그대로 모사한다: 상대 이름·통화 시간·프로필.
 * 자막은 화면 중앙에 문자 메시지 말풍선으로 흐른다 — 항상 2줄만 보인다.
 * 음성이 끝나면(ended) 하단에 카세트 컨트롤 바가 올라오고,
 * PLAY를 눌러야 다음 단계로 넘어간다 (D9 — 시간 기반 자동진행 금지).
 */

import { initialFor, portraitFor } from '@/lib/cast'
import { Cue, SPEAKER_NAMES } from '@/lib/cues'

interface CallScreenProps {
  cue: Cue
  playing: boolean
  elapsed: number
  subtitleIndex: number
  ended: boolean
  audioAvailable: boolean
  /** 표시용 상대 번호 — 뒤 2자리는 xx로 가린다 */
  phoneNumber: string
  onReplay: () => void
  onPause: () => void
  onResume: () => void
  onSkip?: () => void
  /** 통화 종료 후 PLAY — 다음 단계로 */
  onAdvance: () => void
  advanceLabel: string
  /** D9 — 15초가 지나 통화를 끊을 수 있는 상태 */
  skippable?: boolean
  /** 빨간 버튼 — 통화 끊기 */
  onEndCall?: () => void
}

/**
 * 통화 종료 아이콘 — 수화기.
 * 뒤집는 회전은 .call-fab.end 쪽 CSS가 한다(발신 취소 버튼과 같은 규칙).
 * 여기서 또 돌리면 두 번 돌아 엉뚱한 방향이 된다.
 */
function EndCallIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.37 2.3.57 3.5.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.57 3.5a1 1 0 0 1-.25 1l-2.22 2.3z" />
    </svg>
  )
}

/** 동행 시작 — 함께 걷는다는 뜻이라 앞으로 향하는 화살표를 쓴다 */
function StartIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12h14" />
      <path d="m12.5 6 6 6-6 6" />
    </svg>
  )
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CallScreen({
  cue,
  playing,
  elapsed,
  subtitleIndex,
  ended,
  audioAvailable,
  phoneNumber,
  onReplay,
  onPause,
  onResume,
  onSkip,
  onAdvance,
  advanceLabel,
  skippable = false,
  onEndCall,
}: CallScreenProps) {
  const lines = cue.subtitleLines
  const portrait = portraitFor(cue)
  // 문자 말풍선 — 직전 줄(흐림) + 현재 줄(강조) 2줄만
  const prev = subtitleIndex > 0 ? lines[subtitleIndex - 1] : null
  const current = lines[subtitleIndex] ?? null

  return (
    <div className="call-screen">
      {/* 상단 — 상대 정보 */}
      <div className="call-screen-head">
        <p className="call-screen-number">{phoneNumber}</p>
        <h2 className="call-screen-name">{SPEAKER_NAMES[cue.speaker]}</h2>
        <p className="call-screen-status">
          {ended ? '통화 종료' : playing ? '통화 중' : '연결됨'} ·{' '}
          {formatClock(elapsed)}
        </p>

        {/* 지금 말하는 사람의 얼굴 — 없으면 한 글자 배지로 되돌아간다 */}
        <div className="call-avatar mt-6">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="" className="call-avatar-photo" />
          ) : (
            <span>{initialFor(cue)}</span>
          )}
          {playing && <span className="call-avatar-ring" aria-hidden />}
        </div>

        {/*
          파형은 얼굴 바로 아래에 둔다.

          전에는 화면 맨 아래 종료 버튼 위에 있었다. 소리가 나오는 곳은
          상대의 얼굴인데 파형은 반대쪽 끝에서 흔들려서, 목소리와 그림이
          한 사람으로 묶이지 않았다. 얼굴 밑에 붙으면 그 사람이 지금
          말하고 있다는 표시가 된다.

          누르면 멈춘다 — 실제 통화 화면처럼 글자는 두지 않는다.
          파형이 움직이면 통화 중, 멈춰 있으면 정지다.
        */}
        <button
          type="button"
          onClick={playing ? onPause : onResume}
          className="mt-4 w-full"
          aria-label={playing ? '일시정지' : '재생'}
        >
          <span className={`call-live-wave${playing ? ' on' : ''}`} aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </button>
      </div>

      {/*
        중앙 — 문자 말풍선으로 흐르는 자막 2줄.
        누르면 다음 줄로 건너뛴다(FF). 화면에서 가장 넓고 자연스럽게 눈이 가는
        자리라 설명 없이도 손이 간다 — 안내 문구는 두지 않는다.
      */}
      <div
        className="call-screen-body"
        aria-live="polite"
        {...(!ended && onSkip
          ? {
              role: 'button' as const,
              tabIndex: 0,
              'aria-label': '다음 줄로 건너뛰기',
              onClick: onSkip,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSkip()
                }
              },
              style: { cursor: 'pointer' },
            }
          : {})}
      >
        {prev && (
          <div className="call-bubble faded">
            {prev.speaker && <span className="call-bubble-tag">{prev.speaker} </span>}
            {prev.text}
          </div>
        )}
        {current && (
          <div className="call-bubble">
            {current.speaker && (
              <span className="call-bubble-tag">{current.speaker} </span>
            )}
            {current.text}
          </div>
        )}
      </div>

      {/* 하단 — 통화 중엔 파형만, 끝나면 카세트 컨트롤 바 */}
      <div className="call-screen-foot">
        {!audioAvailable && !ended && (
          <p className="mb-2 text-center font-mono-retro text-[10.5px] text-cream/50">
            음성 준비 중 — 자막으로 진행됩니다
          </p>
        )}

        {ended ? (
          /*
            통화가 끝나면 같은 자리의 같은 버튼이 빨강에서 초록으로 넘어간다.
            '끊기'가 '시작'으로 이어지는 흐름이라 자리를 옮기지 않는다.
            (.call-fab에 색 전환을 걸어 뒀다)
          */
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={onAdvance}
              className="call-fab go"
              aria-label={advanceLabel}
            >
              <StartIcon />
            </button>
            <span className="mt-2.5 font-mono-retro text-[12px] tracking-[0.14em] text-cream/80">
              {advanceLabel}
            </span>
            {/* 다시듣기 — 놓친 말이 있을 수 있다. 글자만 작게 둔다 */}
            <button
              type="button"
              onClick={onReplay}
              className="mt-3 font-mono-retro text-[10.5px] text-cream/35"
            >
              ↺ 다시듣기
            </button>
          </div>
        ) : (
          /*
            통화 중 — 빨간 종료 버튼만. 파형은 얼굴 아래로 올렸다.
            실제 통화 화면이 그렇듯 글자는 두지 않는다.
          */
          <div className="flex flex-col items-center">
            {/*
              통화 끊기 — 15초가 지나야 나타난다(D9).
              그전에는 자리를 비워 둔다. 눌러도 안 되는 버튼을 보여주고
              왜 안 되는지 설명하는 것보다, 될 때 나타나는 편이 깔끔하다.
            */}
            {skippable && onEndCall && (
              <button
                type="button"
                onClick={onEndCall}
                className="call-fab end mt-5"
                aria-label="통화 종료"
                style={{ animation: 'fadeIn 0.35s ease-out' }}
              >
                <EndCallIcon />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
