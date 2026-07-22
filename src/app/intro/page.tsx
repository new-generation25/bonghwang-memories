'use client'

/**
 * S02 + S03 — 테이프 발견·재생 → 첫 통화 (D3: 쪽지 구조).
 *
 * 흐름: 발견 텍스트 + 쪽지 앞면 → [▶ PLAY](user_tap) → B0_TAPE(아버지 목소리만)
 *      → 종료 시 쪽지 뒷면(전화번호) + 📞 버튼 노출(show_call_button)
 *      → [전화 걸기](user_tap — 자동 발신 금지) → B0_CALL
 *      → [동행 수락] → phase=act1 · startTime 기록 → /play
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import CuePlayer from '@/components/cue/CuePlayer'
import { useCue, useCueEvents } from '@/hooks/useCue'
import { useTourHydrated, useTourState } from '@/hooks/useTourState'
import { S02_DISCOVERY_TEXT, NOTE_FRONT_TEXT, NOTE_PHONE_LABEL } from '@/lib/cues'
import { dispatchTap, stopCue } from '@/lib/cueEngine'
import { mutateTour } from '@/lib/tourState'

type Step = 'discovery' | 'tape' | 'call'

export default function IntroPage() {
  const router = useRouter()
  const tour = useTourState()
  const cueState = useCue()
  const [step, setStep] = useState<Step>('discovery')
  const [callButtonVisible, setCallButtonVisible] = useState(false)

  // 결제 없이 직접 진입하면 랜딩으로 — hydration 전의 초기 상태로 판단하지 않는다
  const hydrated = useTourHydrated()
  useEffect(() => {
    if (hydrated && !tour.paid) router.replace('/')
  }, [hydrated, tour.paid, router])

  // C0_B 종료 → 전화 버튼 노출 (자동 발신 금지 — D3)
  useCueEvents(
    useCallback((event) => {
      if (event.directive === 'show_call_button') setCallButtonVisible(true)
    }, [])
  )

  const handlePlay = () => {
    setStep('tape')
    dispatchTap('PLAY')
  }

  const handleCall = () => {
    setStep('call')
    setCallButtonVisible(false)
    dispatchTap('CALL')
  }

  const handleAccept = () => {
    stopCue()
    mutateTour({
      phase: 'act1',
      startTime: tour.startTime ?? Date.now(),
    })
    router.push('/play')
  }

  const callEnded =
    step === 'call' && cueState.cueId === 'B0_CALL' && cueState.ended

  return (
    <div className="flex min-h-screen flex-col bg-cream-base px-4 py-8">
      <p className="text-center font-mono-retro text-[11px] tracking-[0.25em] text-teal">
        EP.1 아버지의 타임캡슐
      </p>

      {step === 'discovery' && (
        <div
          className="mx-auto mt-10 w-full max-w-[360px]"
          style={{ animation: 'fadeIn 0.8s ease-in-out' }}
        >
          {/* S02 발견 장면 — 명세 원문 */}
          <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm">
            {S02_DISCOVERY_TEXT.map((line, i) => (
              <p
                key={i}
                className={`leading-relaxed text-ink ${
                  i === 0 ? '' : 'mt-3'
                } ${i >= 2 ? 'font-pen text-[19px]' : 'text-[14px]'}`}
              >
                {line}
              </p>
            ))}
          </div>

          {/* 쪽지 앞면 (D3) — 손글씨, 살짝 기울여 실물 느낌 */}
          <div
            className="mt-4 rounded-sm border border-line bg-cream px-5 py-4 shadow-sm"
            style={{ transform: 'rotate(-1.2deg)' }}
          >
            <p className="font-pen text-[19px] leading-relaxed text-ink">
              {NOTE_FRONT_TEXT}
            </p>
          </div>

          <button
            onClick={handlePlay}
            className="mt-6 w-full rounded-xl bg-shell py-4 font-display text-[17px] text-cream shadow-md"
          >
            ▶ PLAY — 눌러주세요
          </button>
        </div>
      )}

      {(step === 'tape' || step === 'call') && (
        <div className="mx-auto mt-6 w-full max-w-[380px]">
          <CuePlayer />

          {callButtonVisible && (
            <div style={{ animation: 'slideUp 0.4s ease-out' }}>
              {/* 쪽지 뒷면 (D3) — 전화번호 */}
              <div
                className="mt-5 rounded-sm border border-line bg-cream px-5 py-4 text-center shadow-sm"
                style={{ transform: 'rotate(0.8deg)' }}
              >
                <p className="font-pen text-[16px] text-ink-60">부탁이 있습니다. — 딸 소영</p>
                <p className="mt-1 font-mono-retro text-[20px] tracking-[0.15em] text-ink underline decoration-dotted underline-offset-4">
                  010 - ____ - ____
                </p>
              </div>

              <button
                onClick={handleCall}
                className="mt-4 w-full rounded-xl bg-rec py-4 font-display text-[16px] text-cream shadow-md"
              >
                📞 {NOTE_PHONE_LABEL}
              </button>
            </div>
          )}

          {callEnded && (
            <button
              onClick={handleAccept}
              className="btn-teal mt-5 w-full text-[15px]"
              style={{ animation: 'slideUp 0.4s ease-out' }}
            >
              같이 걸을게요 — 동행 수락 ▶
            </button>
          )}
        </div>
      )}

      <div className="stripe-band fixed bottom-0 left-0 right-0" />
    </div>
  )
}
