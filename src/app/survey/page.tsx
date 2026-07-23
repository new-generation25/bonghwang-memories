'use client'

/**
 * 완주 설문 — 투어를 마친 뒤 들어오는 별도 화면.
 *
 * 원래는 피날레 안에 카드로 얹혀 있었다. 피날레는 오늘 걸은 것을 돌아보는
 * 자리라 설문 문항이 그 위에 끼어들면 여운을 끊는다. 화면을 나눠서, 다 보고
 * 나온 뒤에 차분히 답하게 한다.
 *
 * 응답은 한 번만 받고 그때 포인트가 적립된다(중복은 surveyResponses 문서
 * ID로 막는다).
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SurveyCard from '@/components/SurveyCard'
import { POINT_TABLE } from '@/lib/points'

export default function SurveyPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-cream-base pb-24">
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">
            LOCAL MEMORIES · 완주 설문 · +{POINT_TABLE.survey}P
          </span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">오늘, 어떠셨어요?</h1>
            <button
              onClick={() => router.back()}
              className="shrink-0 pb-1 text-[11px] font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-5">
        <p className="text-[13px] leading-relaxed text-ink-60">
          답해주신 내용은 EP.2를 만드는 데 씁니다. 다섯 문항이면 끝나요.
        </p>

        <SurveyCard />

        <Link
          href="/community"
          className="mt-5 block w-full rounded-xl border border-line bg-paper py-3 text-center text-[13.5px] text-ink"
        >
          👥 소영의 친구들 보러 가기
        </Link>
      </div>
    </div>
  )
}
