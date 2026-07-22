'use client'

/**
 * 큐 자막 — 흐르는 2줄 형식.
 *
 * 기본 모드에서는 직전 문장(흐리게) + 현재 문장(강조)만 보인다.
 * 지난 문장을 전부 쌓지 않는다 — 음성과 함께 자막이 '흘러가는' 인터페이스.
 * 전체를 읽고 싶으면 '전체 스크립트 보기'로 펼친다(§5 공통 컨트롤).
 * 오디오가 없어도(합성 클록) 동일하게 동작한다.
 */

import { useEffect, useRef, useState } from 'react'
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
  const [expanded, setExpanded] = useState(false)
  const currentRef = useRef<HTMLParagraphElement | null>(null)

  // 펼침 모드에서 현재 줄이 항상 보이도록 스크롤 추적
  useEffect(() => {
    if (expanded) {
      currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [subtitleIndex, expanded])

  const lines = cue.subtitleLines
  const fontClass = handwriting
    ? 'font-pen text-[19px] leading-relaxed'
    : 'text-[14.5px] leading-relaxed'

  const renderLine = (
    line: (typeof lines)[number],
    key: number,
    opts: { current: boolean; withRef?: boolean; spaced?: boolean }
  ) => (
    <p
      key={key}
      ref={opts.withRef ? currentRef : undefined}
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

  if (expanded) {
    return (
      <div className="mt-3">
        <div className={`max-h-48 overflow-y-auto rounded-lg bg-black/5 px-4 py-3 ${fontClass}`}>
          {lines.map((line, i) =>
            renderLine(line, i, {
              current: i === subtitleIndex,
              withRef: i === subtitleIndex,
              spaced: i > 0,
            })
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-0.5 -ml-2 px-2 py-2.5 text-[12px] text-ink60 underline underline-offset-2"
        >
          자막 접기
        </button>
      </div>
    )
  }

  // 흐르는 2줄 — 직전 줄(흐림) + 현재 줄(강조). 첫 줄일 땐 현재 줄만.
  const prev = subtitleIndex > 0 ? lines[subtitleIndex - 1] : null
  const current = lines[subtitleIndex] ?? null

  return (
    <div className="mt-3">
      {/*
        고정 높이 — 글 세 줄(현재 자막 2줄 + 직전 자막 1줄) + 줄 간격 + 상하 여백.
        min-height로 두면 문장 길이에 따라 상자가 늘었다 줄었다 하면서
        아래 데크 버튼이 계속 움직인다. 높이를 못박아 버튼 위치를 고정한다.

        문장이 길어 세 줄을 넘기면 justify-end + overflow-hidden 조합으로
        직전 자막이 위로 밀려 나가고 현재 자막이 온전히 남는다 — 잘리지 않는다.
        em 기준이라 손글씨 모드(19px)에서도 같은 비율로 커진다.
      */}
      <div
        className={`flex flex-col justify-end overflow-hidden rounded-lg bg-black/5 px-4 py-3 ${fontClass}`}
        style={{ height: 'calc(4.875em + 6px + 1.5rem)' }}
        aria-live="polite"
      >
        {prev && renderLine(prev, subtitleIndex - 1, { current: false })}
        {current &&
          renderLine(current, subtitleIndex, {
            current: true,
            spaced: Boolean(prev),
          })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-1.5 text-[12px] text-ink60 underline underline-offset-2"
      >
        전체 스크립트 보기
      </button>
    </div>
  )
}
