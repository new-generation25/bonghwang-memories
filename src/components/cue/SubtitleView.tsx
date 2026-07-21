'use client'

/**
 * 큐 자막 — 현재 문장 강조, 지난 문장 흐리게, 전체 스크립트 펼침(§4 공통 컨트롤).
 * 오디오가 없어도(합성 클록) 동일하게 동작한다.
 */

import { useEffect, useRef, useState } from 'react'
import { Cue } from '@/lib/cues'

interface SubtitleViewProps {
  cue: Cue
  subtitleIndex: number
  /** C5_4 편지 등 — 손글씨 폰트로 한 줄씩 */
  handwriting?: boolean
}

export default function SubtitleView({
  cue,
  subtitleIndex,
  handwriting = false,
}: SubtitleViewProps) {
  const [expanded, setExpanded] = useState(false)
  const currentRef = useRef<HTMLParagraphElement | null>(null)

  // 현재 줄이 항상 보이도록 스크롤 추적
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [subtitleIndex, expanded])

  const lines = cue.subtitleLines
  const visible = expanded ? lines : lines.slice(0, subtitleIndex + 1)

  return (
    <div className="mt-3">
      <div
        className={`max-h-40 overflow-y-auto rounded-lg bg-black/5 px-4 py-3 ${
          handwriting ? 'font-pen text-[19px] leading-relaxed' : 'text-[14.5px] leading-relaxed'
        }`}
      >
        {visible.map((line, i) => {
          const isCurrent = i === subtitleIndex
          return (
            <p
              key={i}
              ref={isCurrent ? currentRef : undefined}
              className={`transition-opacity duration-300 ${
                isCurrent ? 'opacity-100 text-ink' : 'opacity-40 text-ink'
              } ${i > 0 ? 'mt-1.5' : ''}`}
            >
              {line.speaker && (
                <span className="mr-1.5 font-mono-retro text-[11px] text-teal">
                  {line.speaker}
                </span>
              )}
              {line.text}
            </p>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-[12px] text-ink60 underline underline-offset-2"
      >
        {expanded ? '자막 접기' : '전체 스크립트 보기'}
      </button>
    </div>
  )
}
