'use client'

/**
 * S03 — 전체 화면 통화 인터페이스.
 *
 * 스마트폰 통화 화면을 그대로 모사한다: 상대 이름·통화 시간·프로필.
 * 자막은 화면 중앙에 문자 메시지 말풍선으로 흐른다 — 항상 2줄만 보인다.
 * 음성이 끝나면(ended) 하단에 카세트 컨트롤 바가 올라오고,
 * PLAY를 눌러야 다음 단계로 넘어간다 (D9 — 시간 기반 자동진행 금지).
 */

import { Cue, SPEAKER_NAMES } from '@/lib/cues'
import DeckControls from './DeckControls'

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
}: CallScreenProps) {
  const lines = cue.subtitleLines
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

        <div className="call-avatar mt-6">
          <span>{cue.speaker === 'soyoung' ? '소' : '📞'}</span>
          {playing && <span className="call-avatar-ring" aria-hidden />}
        </div>
      </div>

      {/* 중앙 — 문자 말풍선으로 흐르는 자막 2줄 */}
      <div className="call-screen-body" aria-live="polite">
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
          /* 음성이 끝나면 카세트 컨트롤 바가 올라온다 — PLAY를 눌러야 다음으로 */
          <div style={{ animation: 'slideUp 0.4s ease-out' }}>
            <p className="mb-2 text-center font-mono-retro text-[10.5px] text-cream/60">
              ▶ PLAY를 눌러 계속
            </p>
            <DeckControls
              keys={[
                { kind: 'rew', label: '다시듣기', onClick: onReplay, ariaLabel: '다시듣기' },
                {
                  kind: 'play',
                  label: advanceLabel,
                  onClick: onAdvance,
                  accent: 'go',
                  ariaLabel: advanceLabel,
                },
                { kind: 'ff' },
                { kind: 'stop' },
              ]}
            />
          </div>
        ) : (
          /* 통화 중에는 컨트롤 없이 파형만 — 탭 한 번으로 일시정지·재개 */
          <button
            type="button"
            onClick={playing ? onPause : onResume}
            className="w-full"
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
            <span className="mt-1 block text-center font-mono-retro text-[10.5px] text-cream/45">
              {playing ? '통화 중 — 탭하면 잠시 멈춤' : '탭하면 이어서 듣기'}
            </span>
          </button>
        )}

        {/* 한 줄씩 빨리감기 — 마지막 문장에서는 통화가 끝난다 */}
        {!ended && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-2 block w-full text-center font-mono-retro text-[11px] text-cream/40 underline underline-offset-4"
          >
            다음 줄 ⏩
          </button>
        )}
      </div>
    </div>
  )
}
