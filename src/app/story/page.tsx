'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NarrationPlayer from '@/components/NarrationPlayer'

/**
 * CUE 0 — 소영의 전화 (EP.1 「아버지의 타임캡슐」).
 * 참여자는 '소영의 오랜 친구'. 소영이 19년 만에 돌아와 하루 동행을 부탁한다.
 * 대본: 봉황1988_모바일_음성대본_EP1.md
 */
const storyText = `여보세요… 나야, 소영이.
갑자기 연락해서 미안해. 사실은… 우리 아빠가, 기억을 조금씩 잃어가고 계셔.
근데 아빠가 딱 하나, 또렷하게 기억하는 게 있어. 내가 태어난 날. 1988년 9월 17일.
그날 아빠가 공책에다 다섯 가지 소원을 적어뒀더라고. 나랑 꼭 같이 하고 싶었던 것들.
나… 아빠가 다 잊기 전에, 그거 하나씩 이뤄드리고 싶어.
근데 혼자는 도저히 못 하겠어. 19년 만에 온 동네라 무섭기도 하고.
그래서 너한테 부탁하는 거야. 오늘 하루만… 나랑 같이 걸어줄래?`

/** 전화를 한 번이라도 끝까지 들은 사용자는 다시 타이핑을 보지 않는다 */
const STORY_SEEN_KEY = 'storyLetterSeen'

export default function StoryPage() {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showStartButton, setShowStartButton] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  // localStorage는 서버에서 읽을 수 없으므로, 확인이 끝나기 전에는 타이핑을 시작하지 않는다.
  const [checkedSeen, setCheckedSeen] = useState(false)
  const router = useRouter()

  // 첫 렌더 직후 1회: 이미 들은 전화인지 판별
  useEffect(() => {
    const seen = localStorage.getItem(STORY_SEEN_KEY) === 'true'
    if (seen) {
      setDisplayedText(storyText)
      setCurrentIndex(storyText.length)
      setShowStartButton(true)
      setIsTyping(false)
    } else {
      setIsTyping(true)
    }
    setCheckedSeen(true)
  }, [])

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

  // 통화 진행률 — 테이프 게이지와 연동
  const progress = Math.round((currentIndex / storyText.length) * 100)

  return (
    <div className="min-h-screen flex flex-col bg-cream-base">
      {/* 트랙바 — 걸려온 전화 */}
      <div className="trackbar px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between font-mono-retro text-[10px] text-sunset">
            <span>INCOMING ☎ 소영 · 19년 만의 전화</span>
            <span className="rec-dot">REC</span>
          </div>
          <h1 className="mt-1 text-[12.5px] font-bold">SIDE A · CUE 0 — 소영의 부탁</h1>
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

      {/* 소영의 목소리 — 음성 파일이 없으면 컨트롤이 표시되지 않는다 */}
      <div className="mx-auto w-full max-w-2xl px-5 pt-3">
        <NarrationPlayer id="intro-soyoung" label="소영의 목소리 · CUE 0" />
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
          {/* 통화 말풍선 지면 */}
          <div
            className="relative cursor-pointer border border-line bg-paper p-7 shadow-xl"
            style={{
              height: 'calc(100vh - 340px)',
              minHeight: '380px',
              maxHeight: '600px',
              transform: 'rotate(0.6deg)',
            }}
            onClick={handleNext}
          >
            {/* 상단 3색 밴드 — 브랜드 식별 */}
            <div className="stripe-band absolute left-0 right-0 top-0" />

            <div className="relative z-10 flex h-full flex-col justify-center overflow-hidden">
              <p className="whitespace-pre-line font-pen text-[21px] leading-[1.6] text-ink">
                {displayedText}
                {isTyping && (
                  <span className="ml-1 inline-block h-6 w-0.5 animate-pulse bg-rec align-middle" />
                )}
              </p>
            </div>
          </div>

          {showStartButton && (
            <div className="mt-7 text-center" style={{ animation: 'slideUp 0.4s ease-out' }}>
              <button onClick={handleStartExploration} className="btn-teal w-full text-lg">
                ▶ 소영과 함께 걷기
                <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                  다섯 가지 소원 · 1988년의 봉황동으로
                </small>
              </button>
            </div>
          )}

          {isTyping && (
            <p className="mt-5 text-center text-[12px] text-ink-60">
              화면을 터치하면 다음 문장으로 넘어갑니다
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
