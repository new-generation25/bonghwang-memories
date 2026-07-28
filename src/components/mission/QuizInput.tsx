'use client'

/**
 * M4q — 라디오에서 아버지가 신청한 곡 제목 맞히기.
 *
 * 이 거점은 '같이 듣기'가 소원이라 듣는 것 말고 할 일이 없었다. 아버지가
 * 딸을 '소녀'라 부르려고 그 곡을 신청했다는 것이 장면의 핵심인데, 흘려
 * 들으면 그냥 지나간다. 제목을 손으로 적어보면 한 번 더 남는다.
 *
 * 맞히면 '나의 육십 초'로 이어진다 — 퀴즈가 관문이 아니라 한 박자다.
 * 그래서 오답에 벌이 없고, 세 번 틀리면 다시 들을 길을 내민다.
 *
 * 정답 비교는 공백과 문장부호를 지우고 한다. '소녀'·'이문세 소녀'·
 * '소녀(이문세)'가 모두 같은 답이다. 걸으면서 한 손으로 치는 글자라
 * 따옴표 하나로 틀렸다고 하면 답을 알고도 막힌다.
 */

import { useState } from 'react'
import { logEvent } from '@/lib/analytics'
import { dispatchAction, replayCue, unlockAudio } from '@/lib/cueEngine'
import { useRevealOnChange } from '@/hooks/useRevealOnChange'
import { submitOnEnter } from '@/lib/submitOnEnter'
import { TRACK_MISSIONS } from '@/lib/tracks'

/** 비교용으로 다듬는다 — 공백·문장부호를 지우고 소문자로 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"''""「」『』()（）\s.,·~!?-]/g, '')
}

interface QuizInputProps {
  /** 맞히고 다음으로 넘어갈 때 — '나의 육십 초'가 그 자리에 들어온다 */
  onDone: () => void
}

export default function QuizInput({ onDone }: QuizInputProps) {
  const [value, setValue] = useState('')
  /*
    틀린 횟수는 쌓아둔다. 글자를 고칠 때마다 0으로 되돌리면 두 번째
    오답이 영영 오지 않아 '다시 듣기'가 나타나지 않는다. 지우는 것은
    빨간 문구뿐이다 — 고쳐 쓰는 중에 계속 틀렸다고 하면 성가시다.
  */
  const [wrong, setWrong] = useState(0)
  const [showWrong, setShowWrong] = useState(false)
  const [solved, setSolved] = useState(false)
  const nextRef = useRevealOnChange<HTMLDivElement>(solved, solved)

  const spec = TRACK_MISSIONS.M4q.validation
  const answerText = spec?.text ?? '소녀'
  const accepted = (spec?.accept ?? [answerText]).map(normalize)

  const handleSubmit = () => {
    if (solved || !value.trim()) return
    if (accepted.includes(normalize(value))) {
      setSolved(true)
      // 이 액션에 걸린 큐는 없다 — 계측만 남고 다음 미션은 아래 버튼이 연다
      dispatchAction('M4_quiz_ok')
    } else {
      setWrong((n) => n + 1)
      setShowWrong(true)
      // 어디서 막히는지 세는 값이다(F-7) — 오답에 벌은 없다
      logEvent('mission_wrong', { id: 'M4q' })
    }
  }

  return (
    <div
      className="mt-4 rounded-2xl border border-sunset-yellow bg-paper p-5 shadow-sm"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <p className="font-mono-retro text-[10px] tracking-widest text-rec">
        MISSION 4 · 신청곡
      </p>
      <h3 className="mt-1 text-[15px] font-bold text-ink">
        아버지가 라디오에 신청한 노래, 제목이 뭐였나요?
      </h3>
      <p className="mt-1 text-[12px] text-ink-60">
        1988년 그날, 딸에게 들려주고 싶었던 곡이에요.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          maxLength={20}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setShowWrong(false)
          }}
          onKeyDown={submitOnEnter(handleSubmit, value.trim().length > 0 && !solved)}
          placeholder="노래 제목"
          disabled={solved}
          className="min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 py-3 text-center text-[15px] text-ink outline-none focus:border-teal disabled:opacity-60"
        />
        <button
          onClick={handleSubmit}
          disabled={value.trim().length === 0 || solved}
          className={`shrink-0 rounded-xl px-5 py-3 font-display text-[14px] ${
            value.trim().length > 0 && !solved
              ? 'bg-teal text-cream'
              : 'cursor-not-allowed bg-line text-ink-60'
          }`}
        >
          확인
        </button>
      </div>

      {!solved && (showWrong || wrong >= 2) && (
        <>
          {showWrong && (
            <p className="mt-2 text-[12px] text-rec">
              음… 그 곡이 아니에요. 라디오에서 DJ가 불러준 제목이에요.
            </p>
          )}
          {/*
            두 번 틀리면 다시 들을 길을 낸다. 답을 모르는 게 아니라 못
            들은 것일 때가 많다 — 골목은 시끄럽고 이어폰이 없을 수도 있다.
          */}
          {wrong >= 2 && (
            <button
              type="button"
              onClick={() => {
                unlockAudio()
                replayCue()
              }}
              className="mt-2 text-[12px] text-teal-dk underline underline-offset-2"
            >
              ⏪ 라디오 다시 듣기
            </button>
          )}
        </>
      )}

      {solved && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[12.5px] leading-relaxed text-ink-60">
            맞아요, 이문세 「{answerText}」.
            <br />
            아빠는 딸을 그렇게 부르고 싶었던 거예요 — 영원히 웃는 소녀로.
          </p>
          <div ref={nextRef} className="cta-band mt-3">
            <button
              onClick={onDone}
              className="btn-teal w-full text-[14px]"
            >
              💌 나도 한마디 남기기 ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
