'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NarrationPlayer from '@/components/NarrationPlayer'

const storyText = `이 편지를 쓰는 지금,
나의 기억은 하나둘 흐려져가고 있구나.
지금 내가 가지고 있는 기억은 어느 사이엔가 멈추어 버렸지만
너와 작은 손을 잡고 봉황동 골목길을 함께 거닐던 그 순간은 잊지 못할거야
너를 보내고 난 후, 아빠는 줄곧 이 동네에 남아 매일 너와의 추억을 되새겼단다.
네가 떠난 후에도 발견한 특별한 것들이 있어.
우리가 함께 다니던 그 장소들에 숨어있던 이야기들과 네가 몰랐던 봉황동의 비밀들...
아빠의 기억이 완전히 사라지기 전에, 너에게 보여주고 싶었던 것들이 있단다.
어른이 된 네 눈으로 다시 보면,
아빠가 왜 이곳을 떠나지 못했는지 알게 될 거야.
나의 기억의 마지막을 따라 다시 걸어보렴.
다시 돌아와줘서 고맙다,

사랑한다.`

/** 편지를 한 번이라도 끝까지 본 사용자는 다시 타이핑을 보지 않는다 */
const STORY_SEEN_KEY = 'storyLetterSeen'

export default function StoryPage() {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showStartButton, setShowStartButton] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  // localStorage는 서버에서 읽을 수 없으므로, 확인이 끝나기 전에는 타이핑을 시작하지 않는다.
  // (초기 state에서 바로 읽으면 SSR 결과와 어긋나 hydration 오류가 난다)
  const [checkedSeen, setCheckedSeen] = useState(false)
  const router = useRouter()

  // 첫 렌더 직후 1회: 이미 본 편지인지 판별
  useEffect(() => {
    const seen = localStorage.getItem(STORY_SEEN_KEY) === 'true'
    if (seen) {
      // 이미 본 편지 — 완료 상태로 즉시 표시
      setDisplayedText(storyText)
      setCurrentIndex(storyText.length)
      setShowStartButton(true)
      setIsTyping(false)
    } else {
      setIsTyping(true)
    }
    setCheckedSeen(true)
  }, [])

  // 편지를 끝까지 본 시점에 기록
  const markSeen = () => {
    localStorage.setItem(STORY_SEEN_KEY, 'true')
  }

  useEffect(() => {
    if (!checkedSeen || !isTyping) return

    if (currentIndex < storyText.length) {
      const timer = setTimeout(() => {
        setDisplayedText(storyText.slice(0, currentIndex + 1))
        setCurrentIndex((prev) => prev + 1)
      }, 50) // 50ms마다 한 글자씩 일정한 속도로 타이핑

      return () => clearTimeout(timer)
    }

    setIsTyping(false)
    setShowStartButton(true)
    markSeen()
  }, [currentIndex, checkedSeen, isTyping])

  const handleSkip = () => {
    setDisplayedText(storyText)
    setCurrentIndex(storyText.length)
    setIsTyping(false)
    setShowStartButton(true)
    markSeen()
  }

  const handleNext = () => {
    if (currentIndex < storyText.length) {
      // 빠른 타이핑을 위해 여러 글자씩 건너뛰기
      const skipAmount = Math.min(20, storyText.length - currentIndex)
      setCurrentIndex((prev) => prev + skipAmount)
      setDisplayedText(storyText.slice(0, currentIndex + skipAmount))
    } else if (!showStartButton) {
      setIsTyping(false)
      setShowStartButton(true)
      markSeen()
    }
  }

  const handleStartExploration = () => {
    router.push('/exploration')
  }

  // 테이프 되감기 진행률 — 편지가 곧 SIDE A의 인트로 트랙
  const progress = Math.round((currentIndex / storyText.length) * 100)

  return (
    <div className="min-h-screen flex flex-col bg-cream-base">
      {/* 트랙바 — 카세트 몸체(셸 블랙). 되감기 중임을 알린다 */}
      <div className="trackbar px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between font-mono-retro text-[10px] text-sunset">
            <span>REW ◀◀ 1988 · 아버지의 녹음분</span>
            <span className="rec-dot">REC</span>
          </div>
          <h1 className="mt-1 text-[12.5px] font-bold">SIDE A · 인트로 트랙 — 편지</h1>
          <div className="tape-prog mt-2">
            <div className="reel spin">
              <span className="hub" />
            </div>
            <div className="bar">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="reel">
              <span className="hub" />
            </div>
          </div>
        </div>
      </div>

      {/* 아빠의 목소리 — 음성 파일이 없으면 컨트롤이 표시되지 않는다 */}
      <div className="mx-auto w-full max-w-2xl px-5 pt-3">
        <NarrationPlayer id="prologue" label="아빠의 목소리 · 1988 녹음분" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-5 relative">
        {/* 건너뛰기 */}
        {isTyping && (
          <button
            onClick={handleSkip}
            className="absolute top-4 right-5 z-20 font-mono-retro text-[11px] text-ink-60 transition-colors hover:text-teal-dk"
          >
            SKIP ▶▶
          </button>
        )}

        <div className="z-10 w-full max-w-2xl">
          {/* 편지 — 크림 지면 + 티얼 괘선 */}
          <div
            className="relative cursor-pointer border border-line bg-paper p-7 shadow-xl"
            style={{
              height: 'calc(100vh - 300px)',
              minHeight: '420px',
              maxHeight: '640px',
              transform: 'rotate(0.6deg)',
            }}
            onClick={handleNext}
          >
            {/* 상단 3색 밴드 — 브랜드 식별 */}
            <div className="stripe-band absolute left-0 right-0 top-0" />

            <div className="relative z-10 flex h-full flex-col justify-center overflow-hidden">
              <p className="whitespace-pre-line font-pen text-[22px] leading-[1.6] text-ink">
                {displayedText}
                {isTyping && (
                  <span className="ml-1 inline-block h-6 w-0.5 animate-pulse bg-rec align-middle" />
                )}
              </p>
            </div>

            {/* 봉인 도장 — 레드 전용 */}
            <div className="seal absolute -bottom-4 -right-3 h-14 w-14 text-[10px]">
              기록됨
              <span className="text-[6px] font-normal tracking-widest">1988</span>
            </div>
          </div>

          {showStartButton && (
            <div className="mt-7 text-center" style={{ animation: 'slideUp 0.4s ease-out' }}>
              <button
                onClick={handleStartExploration}
                className="btn-teal w-full text-lg"
              >
                ▶ PLAY — 탐험 시작하기
                <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                  SIDE A · 25개 트랙이 기다립니다
                </small>
              </button>
            </div>
          )}

          {isTyping && (
            <p className="mt-5 text-center text-[12px] text-ink-60">
              편지를 터치하면 다음 문장으로 넘어갑니다
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
