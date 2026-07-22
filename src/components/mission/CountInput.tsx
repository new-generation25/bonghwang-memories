'use client'

/**
 * M1 — 풍선초 열매 개수 입력 (count_input, 정답 7).
 * 정답이면 [사장님의 이야기 듣기] 버튼이 열린다 — 사장님 증언(B1_S)은
 * 자동재생이 아니라 사용자 탭(D4·T4)으로 재생한다.
 * 오답은 횟수 제한 없이 다시 셀 수 있다 — 미션 실패 개념이 아니다.
 */

import { useState } from 'react'
import { dispatchAction, dispatchTap, unlockAudio } from '@/lib/cueEngine'
import { useRevealOnChange } from '@/hooks/useRevealOnChange'
import { submitOnEnter } from '@/lib/submitOnEnter'
import { TRACK_MISSIONS } from '@/lib/tracks'

export default function CountInput() {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [solved, setSolved] = useState(false)
  const nextRef = useRevealOnChange<HTMLDivElement>(solved, solved)

  const answer = TRACK_MISSIONS.M1.validation?.answer ?? 7

  const handleSubmit = () => {
    if (parseInt(value, 10) === answer) {
      setSolved(true)
      dispatchAction('M1_count_ok') // 분석 이벤트용 — 큐는 탭으로 재생
    } else {
      setWrong(true)
    }
  }

  return (
    <div
      className="mt-4 rounded-2xl border border-sunset-yellow bg-paper p-5 shadow-sm"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <p className="font-mono-retro text-[10px] tracking-widest text-rec">
        MISSION 1
      </p>
      <h3 className="mt-1 text-[15px] font-bold text-ink">
        우물터 옆 풍선초, 열매가 몇 개나 열렸나요?
      </h3>
      <p className="mt-1 text-[12px] text-ink-60">
        초록색 꽈리 같은 열매를 하나씩 세어보세요.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, ''))
            setWrong(false)
          }}
          onKeyDown={submitOnEnter(handleSubmit, value.length > 0 && !solved)}
          placeholder="?"
          className="w-20 rounded-xl border border-line bg-cream px-3 py-3 text-center font-mono-retro text-[22px] text-ink outline-none focus:border-teal"
        />
        <span className="text-[14px] text-ink">개</span>
        <button
          onClick={handleSubmit}
          disabled={value.length === 0}
          className={`ml-auto rounded-xl px-5 py-3 font-display text-[14px] ${
            value.length > 0
              ? 'bg-teal text-cream'
              : 'cursor-not-allowed bg-line text-ink-60'
          }`}
        >
          확인
        </button>
      </div>

      {wrong && (
        <p className="mt-2 text-[12px] text-rec">
          음… 다시 한번 세어볼래요? 놓친 열매가 있을 거예요.
        </p>
      )}

      {solved && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[12.5px] text-ink-60">
            맞아요, 일곱 개. 가게에 그 시절을 기억하시는 사장님이 계실 거예요.
          </p>
          <div ref={nextRef} className="cta-band mt-3">
            <button
              onClick={() => {
                unlockAudio()
                dispatchTap('LISTEN')
              }}
              className="btn-teal w-full text-[14px]"
            >
              👵 사장님의 이야기 듣기 ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
