'use client'

/**
 * 피날레에서 설문 화면으로 넘기는 안내.
 *
 * 문항 자체는 /survey에 있다. 이미 답했으면 감사 문구로 바뀐다 — 다 answered
 * 상태인데 계속 권하면 무시하는 법을 배운다.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { POINT_TABLE } from '@/lib/points'
import { fetchSurvey, hasResponded } from '@/lib/survey'

export default function SurveyLink() {
  const { profile } = useAuth()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchSurvey()
        const answered = await hasResponded(profile.uid, s.id)
        if (!cancelled) setDone(answered)
      } catch {
        /* 못 읽으면 권하는 쪽으로 둔다 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (done) {
    return (
      <div className="card-paper mt-4 p-4 text-center shadow-lg">
        <p className="text-[13px] text-ink">
          🎁 설문에 답해주셔서 고맙습니다 — {POINT_TABLE.survey}P 적립됐어요
        </p>
      </div>
    )
  }

  return (
    <Link
      href="/survey"
      className="card-paper mt-4 flex items-center gap-3 p-4 shadow-lg"
    >
      <span className="text-[26px]">📝</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-ink">
          오늘 걸은 이야기를 들려주세요
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-60">
          다섯 문항이면 끝나요 · 답하시면 {POINT_TABLE.survey}P
        </span>
      </span>
      <span className="shrink-0 font-display text-[15px] text-teal">▶</span>
    </Link>
  )
}
