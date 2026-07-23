'use client'

/**
 * 큐 자막 — 흐르는 2줄 형식.
 *
 * 직전 문장(흐리게) + 현재 문장(강조)만 보인다. 지난 문장을 전부 쌓지
 * 않는다 — 음성과 함께 자막이 '흘러가는' 인터페이스.
 * 오디오가 없어도(합성 클록) 동일하게 동작한다.
 *
 * '전체 스크립트 보기'는 뺐다. 펼치면 상자 높이가 달라져서 아래 데크가
 * 밀리고, 거점마다 프레임이 다른 모양이 됐다. 걸으면서 듣는 화면이라
 * 지난 대사를 되짚어 읽는 일도 드물다 — 그건 ⏪ 다시듣기가 맡는다.
 */

import { Cue } from '@/lib/cues'

interface SubtitleViewProps {
  cue: Cue
  subtitleIndex: number
  /** B5_LETTER 편지 등 — 손글씨 폰트 */
  handwriting?: boolean
}

export default function SubtitleView({
  cue,
  subtitleIndex,
  handwriting = false,
}: SubtitleViewProps) {
  const lines = cue.subtitleLines
  const fontClass = handwriting
    ? 'font-pen text-[19px] leading-relaxed'
    : 'text-[14.5px] leading-relaxed'

  const renderLine = (
    line: (typeof lines)[number],
    key: number,
    opts: { current: boolean; spaced?: boolean }
  ) => (
    <p
      key={key}
      className={`transition-opacity duration-500 ${
        opts.current ? 'opacity-100' : 'opacity-35'
      } text-ink ${opts.spaced ? 'mt-1.5' : ''}`}
    >
      {line.speaker && (
        // 시각 여백(mr) 외에 실제 공백도 둔다 — 스크린리더·복사 텍스트에서 라벨과 본문이 붙지 않도록
        <span className="mr-1.5 font-mono-retro text-[11px] text-teal">
          {line.speaker}{' '}
        </span>
      )}
      {line.text}
    </p>
  )

  // 흐르는 2줄 — 직전 줄(흐림) + 현재 줄(강조). 첫 줄일 땐 현재 줄만.
  const prev = subtitleIndex > 0 ? lines[subtitleIndex - 1] : null
  const current = lines[subtitleIndex] ?? null

  return (
    <div className="mt-3">
      {/*
        고정 높이 — 글 네 줄 + 줄 간격 + 상하 여백.
        데크를 화면 아래에 못박으면서 생긴 자리를 자막에 준다. 세 줄일 때는
        문장이 조금만 길어도 직전 자막이 곧바로 밀려 나갔다.
        min-height로 두면 문장 길이에 따라 상자가 늘었다 줄었다 하면서
        아래 데크 버튼이 계속 움직인다. 높이를 못박아 버튼 위치를 고정한다.

        문장이 길어 세 줄을 넘기면 justify-end + overflow-hidden 조합으로
        직전 자막이 위로 밀려 나가고 현재 자막이 온전히 남는다 — 잘리지 않는다.
        em 기준이라 손글씨 모드(19px)에서도 같은 비율로 커진다.
      */}
      <div
        className={`flex flex-col justify-end overflow-hidden rounded-lg bg-black/5 px-4 py-3 ${fontClass}`}
        style={{ height: 'calc(6.5em + 6px + 1.5rem)' }}
        aria-live="polite"
      >
        {prev && renderLine(prev, subtitleIndex - 1, { current: false })}
        {current &&
          renderLine(current, subtitleIndex, {
            current: true,
            spaced: Boolean(prev),
          })}
      </div>
    </div>
  )
}
