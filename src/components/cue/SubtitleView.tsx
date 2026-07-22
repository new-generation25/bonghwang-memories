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
        <span className="mr-1.5 font-mono-retro text-[11px] text-teal">
          {line.speaker}
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
          className="mt-1.5 text-[12px] text-ink60 underline underline-offset-2"
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
      <div
        className={`flex flex-col justify-end overflow-hidden rounded-lg bg-black/5 px-4 py-3 ${fontClass}`}
        style={{ minHeight: handwriting ? '5.6em' : '4.6em' }}
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
