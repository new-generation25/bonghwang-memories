'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

export default function StoryPage() {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showSkip, setShowSkip] = useState(true)
  const [showStartButton, setShowStartButton] = useState(false)
  const [isTyping, setIsTyping] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userGender, setUserGender] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (currentIndex < storyText.length) {
      const timer = setTimeout(() => {
        setDisplayedText(storyText.slice(0, currentIndex + 1))
        setCurrentIndex(prev => prev + 1)
      }, 50) // 50ms마다 한 글자씩 일정한 속도로 타이핑

      return () => clearTimeout(timer)
    } else {
      setIsTyping(false)
      setShowStartButton(true)
    }
  }, [currentIndex])

  const handleSkip = () => {
    setDisplayedText(storyText)
    setCurrentIndex(storyText.length)
    setIsTyping(false)
    setShowStartButton(true)
  }

  const handleNext = () => {
    if (currentIndex < storyText.length) {
      // 빠른 타이핑을 위해 여러 글자씩 건너뛰기
      const skipAmount = Math.min(20, storyText.length - currentIndex)
      setCurrentIndex(prev => prev + skipAmount)
      setDisplayedText(storyText.slice(0, currentIndex + skipAmount))
    } else if (!showStartButton) {
      setIsTyping(false)
      setShowStartButton(true)
    }
  }

  const handleStartExploration = () => {
    router.push('/exploration')
  }

  return (
    <div className="min-h-screen bg-vintage-paper flex flex-col items-center justify-center p-6 relative">
      {/* Background texture */}
      <div className="absolute inset-0 bg-gradient-to-b from-sepia-50 to-sepia-100 opacity-80"></div>
      
      {/* Skip button */}
      {showSkip && isTyping && (
        <button
          onClick={handleSkip}
          className="absolute top-6 right-6 z-20 text-sepia-600 hover:text-sepia-800 transition-colors duration-200 font-handwriting text-lg"
        >
          SKIP →
        </button>
      )}

      {/* Main content */}
      <div className="z-10 max-w-2xl w-full">
        {/* Letter background */}
        <div 
          className="relative bg-vintage-cream border-2 border-sepia-300 shadow-2xl p-8 transform rotate-1 cursor-pointer"
          style={{ height: 'calc(100vh - 200px)', minHeight: '500px', maxHeight: '700px' }}
          onClick={handleNext}
        >
          {/* Paper texture overlay */}
          <div className="absolute inset-0 bg-vintage-paper opacity-30 rounded"></div>
          
          {/* Letter content */}
          <div className="relative z-10 h-full overflow-hidden flex flex-col justify-center">
            <div className="font-handwriting text-lg text-sepia-800 leading-relaxed whitespace-pre-line">
              {displayedText}
              {/* Typing cursor */}
              {isTyping && (
                <span className="inline-block w-0.5 h-6 bg-sepia-800 animate-blink ml-1"></span>
              )}
            </div>
          </div>

          {/* Vintage elements */}
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-vintage-brown rounded-full shadow-lg"></div>
          <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-vintage-gold rounded-full shadow-lg"></div>
        </div>

        {/* Start exploration button */}
        {showStartButton && (
          <div className="mt-8 text-center animate-slide-up">
            <button
              onClick={handleStartExploration}
              className="vintage-button text-2xl font-bold py-6 px-12 rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
              style={{ fontSize: '1.75rem', padding: '1.5rem 3rem' }}
            >
              탐험 시작하기
            </button>
          </div>
        )}

        {/* Tap to continue (when typing) */}
        {isTyping && (
          <div className="mt-6 text-center animate-fade-in">
            <p className="text-sepia-600 font-handwriting text-base">
              편지를 터치하면 다음 문장으로 넘어갑니다
            </p>
          </div>
        )}
      </div>

      {/* Decorative vintage items */}
      <div className="absolute bottom-8 left-8 opacity-20">
        <div className="w-12 h-8 bg-vintage-brown rounded shadow-lg transform rotate-12"></div>
      </div>
      <div className="absolute top-8 left-12 opacity-20">
        <div className="w-8 h-8 bg-vintage-gold rounded-full shadow-lg"></div>
      </div>
      <div className="absolute bottom-16 right-12 opacity-20">
        <div className="w-6 h-10 bg-sepia-600 rounded shadow-lg transform -rotate-12"></div>
      </div>
    </div>
  )
}