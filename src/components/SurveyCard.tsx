'use client'

/**
 * 완주 설문 카드 — 피날레에서만 뜬다.
 *
 * 투어를 막 끝낸 직후가 응답률이 가장 높고 기억도 선명하다.
 * 이미 답했거나 로그인하지 않았으면 아무것도 렌더하지 않는다.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { POINT_TABLE } from '@/lib/points'
import {
  Survey,
  SurveyAnswers,
  fetchSurvey,
  hasResponded,
  submitSurvey,
} from '@/lib/survey'

export default function SurveyCard() {
  const { profile } = useAuth()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [state, setState] = useState<'loading' | 'form' | 'done' | 'hidden'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) {
      setState('hidden')
      return
    }
    let cancelled = false
    ;(async () => {
      const s = await fetchSurvey()
      if (cancelled) return
      if (await hasResponded(profile.uid, s.id)) {
        if (!cancelled) setState('hidden')
        return
      }
      if (!cancelled) {
        setSurvey(s)
        setState('form')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (state === 'hidden' || state === 'loading' || !survey) {
    // 완료 직후에만 감사 문구를 남긴다
    return state === 'done' ? <ThanksCard /> : null
  }

  if (state === 'done') return <ThanksCard />

  const missing = survey.questions
    .filter((q) => q.required)
    .filter((q) => answers[q.id] === undefined || answers[q.id] === '')

  const handleSubmit = async () => {
    if (!profile || busy) return
    if (missing.length > 0) {
      setError('필수 문항에 답해주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await submitSurvey(profile.uid, survey.id, answers)
      setState('done')
    } catch {
      setError('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card-paper mt-4 p-5 shadow-lg">
      <p className="font-mono-retro text-[10px] tracking-widest text-rec">
        SURVEY · +{POINT_TABLE.survey}P
      </p>
      <h3 className="mt-1 font-display text-[16px] text-ink">{survey.title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-60">{survey.intro}</p>

      <div className="mt-4 space-y-5">
        {survey.questions.map((q) => (
          <div key={q.id}>
            <p className="text-[13px] font-bold leading-snug text-ink">
              {q.label}
              {q.required && <span className="ml-1 text-rec">*</span>}
            </p>

            {q.type === 'rating' && (
              <div className="mt-2 flex gap-1.5">
                {Array.from({ length: q.max ?? 5 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                    className={`h-11 flex-1 rounded-lg border text-[15px] font-bold ${
                      answers[q.id] === n
                        ? 'border-teal bg-teal text-cream'
                        : 'border-line bg-cream text-ink-60'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'choice' && (
              <div className="mt-2 space-y-1.5">
                {(q.options ?? []).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-[12.5px] ${
                      answers[q.id] === opt
                        ? 'border-teal bg-teal/10 font-bold text-teal-dk'
                        : 'border-line bg-cream text-ink'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'text' && (
              <textarea
                value={(answers[q.id] as string) ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={2}
                maxLength={300}
                className="mt-2 w-full resize-none rounded-lg border border-line bg-cream px-3 py-2 text-[12.5px] outline-none focus:border-teal"
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rec/10 px-3 py-2 text-[11.5px] font-bold text-rec">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={busy}
        className="btn-teal mt-5 w-full text-[15px] disabled:opacity-60"
      >
        {busy ? '보내는 중…' : `설문 보내고 ${POINT_TABLE.survey}P 받기`}
      </button>
    </div>
  )
}

function ThanksCard() {
  return (
    <div
      className="card-paper mt-4 p-5 text-center shadow-lg"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <div className="text-3xl">🎁</div>
      <p className="mt-2 font-display text-[15px] text-ink">
        {POINT_TABLE.survey}P가 적립됐어요
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-60">
        답해주셔서 고맙습니다. 다음 이야기를 만드는 데 쓸게요.
      </p>
    </div>
  )
}
