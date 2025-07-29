'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const storyText = [
  "나의 소중한 아이야,",
  "",
  "이 편지를 읽고 있다면, 아빠는 이미 그곳에 있을 거야.",
  "",
  "상자 안에 있는 낡은 필름 카메라를 보렴.",
  "그리고 빛바랜 사진 한 장...",
  "",
  "나의 가장 소중한 보물을 찾고 싶다면,",
  "이 사진 속 장소에서부터 여행을 시작하렴.",
  "",
  "봉황동 곳곳에 숨겨둔 나의 기억들을 따라가다 보면,",
  "네가 진짜 보물이 무엇인지 알게 될 거야.",
  "",
  "사랑하는 아빠가"
]

export default function StoryPage() {
  const [currentLine, setCurrentLine] = useState(0)
  const [showSkip, setShowSkip] = useState(true)
  const [showStartButton, setShowStartButton] = useState(false)
  const [isTyping, setIsTyping] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (currentLine < storyText.length) {
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1)
      }, 1500) // 1.5초마다 다음 줄

      return () => clearTimeout(timer)
    } else {
      setIsTyping(false)
      setShowStartButton(true)
    }
  }, [currentLine])

  const handleSkip = () => {
    setCurrentLine(storyText.length)
    setIsTyping(false)
    setShowStartButton(true)
  }

  const handleNext = () => {
    if (currentLine < storyText.length) {
      setCurrentLine(prev => prev + 1)
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
      <div className="z-10 max-w-lg w-full">
        {/* Letter background */}
        <div className="relative bg-vintage-cream border-2 border-sepia-300 shadow-2xl p-8 transform rotate-1 min-h-[500px]">
          {/* Paper texture overlay */}
          <div className="absolute inset-0 bg-vintage-paper opacity-30 rounded"></div>
          
          {/* Letter content */}
          <div className="relative z-10 space-y-4">
            {storyText.slice(0, currentLine).map((line, index) => (
              <div key={index} className="animate-fade-in">
                {line === "" ? (
                  <div className="h-4"></div>
                ) : (
                  <p className={`font-handwriting text-lg text-sepia-800 leading-relaxed ${
                    index === currentLine - 1 && isTyping ? 'typing-effect' : ''
                  }`}>
                    {line}
                  </p>
                )}
              </div>
            ))}
            
            {/* Typing cursor */}
            {isTyping && currentLine < storyText.length && (
              <span className="inline-block w-0.5 h-6 bg-sepia-800 animate-blink ml-1"></span>
            )}
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
              className="vintage-button text-xl font-bold py-4 px-8 rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              탐험 시작하기
            </button>
          </div>
        )}

        {/* Tap to continue (when typing) */}
        {isTyping && (
          <div className="mt-6 text-center animate-fade-in">
            <button
              onClick={handleNext}
              className="text-sepia-600 hover:text-sepia-800 transition-colors duration-200 font-handwriting text-base"
            >
              화면을 터치하면 계속됩니다
            </button>
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