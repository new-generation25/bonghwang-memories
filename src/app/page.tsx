'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function IntroPage() {
  const [showButton, setShowButton] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowButton(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleStartJourney = async () => {
    setRequesting(true)
    
    // PC Testing Mode - Skip permission requests
    setTimeout(() => {
      router.push('/story')
      setRequesting(false)
    }, 1000)

    // Original permission request code (disabled for PC testing)
    // TODO: Re-enable for mobile testing
    /*
    try {
      // Request location permission
      if ('geolocation' in navigator) {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 600000
          })
        })
      }

      // Request camera permission
      if ('mediaDevices' in navigator) {
        await navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            // Stop the stream immediately after getting permission
            stream.getTracks().forEach(track => track.stop())
          })
      }

      // Navigate to story page
      router.push('/story')
    } catch (error) {
      console.error('Permission denied:', error)
      alert('위치와 카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.')
    }
    
    setRequesting(false)
    */
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-vintage-paper relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-sepia-100 to-sepia-200 opacity-50"></div>
      
      {/* Vintage desk items */}
      <div className="absolute top-20 left-10 w-16 h-16 opacity-30">
        <div className="w-full h-full bg-vintage-brown rounded-full shadow-lg"></div>
      </div>
      <div className="absolute top-32 right-16 w-12 h-8 opacity-30">
        <div className="w-full h-full bg-sepia-600 rounded shadow-lg"></div>
      </div>
      <div className="absolute bottom-32 left-20 w-10 h-16 opacity-30">
        <div className="w-full h-full bg-vintage-gold rounded-sm shadow-lg"></div>
      </div>

      {/* Main content */}
      <div className="z-10 text-center px-6 max-w-md">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-vintage text-vintage-brown mb-4 animate-fade-in">
            봉황동 메모리즈
          </h1>
          <p className="text-xl font-handwriting text-sepia-700 animate-fade-in">
            아버지의 유산을 찾아서
          </p>
        </div>

        {/* Vintage letter illustration */}
        <div className="mb-12 animate-slide-up">
          <div className="relative mx-auto w-64 h-40 bg-vintage-cream border-2 border-sepia-400 shadow-lg transform rotate-1">
            <div className="absolute top-4 left-4 right-4 bottom-4 p-2">
              <div className="w-full h-2 bg-sepia-300 mb-2 rounded"></div>
              <div className="w-3/4 h-2 bg-sepia-300 mb-2 rounded"></div>
              <div className="w-5/6 h-2 bg-sepia-300 mb-2 rounded"></div>
              <div className="w-1/2 h-2 bg-sepia-300 rounded"></div>
            </div>
            {/* Vintage camera icon */}
            <div className="absolute -top-2 -right-2 w-8 h-6 bg-vintage-brown rounded shadow-lg"></div>
          </div>
        </div>

        {/* Start button */}
        {showButton && (
          <div className="animate-slide-up">
            <button
              onClick={handleStartJourney}
              disabled={requesting}
              className={`vintage-button text-lg font-bold py-4 px-8 rounded-xl shadow-xl ${
                requesting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-2xl'
              }`}
            >
              {requesting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>시작하는 중...</span>
                </div>
              ) : (
                '아버지의 유산 찾기'
              )}
            </button>
            
            <p className="text-sm text-sepia-600 mt-4 font-handwriting">
              💻 PC 테스트 모드 (모바일에서 모든 기능 체험 가능)
            </p>
          </div>
        )}
      </div>

      {/* Decorative elements */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="flex space-x-2 opacity-40">
          <div className="w-2 h-2 bg-vintage-gold rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-vintage-gold rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-vintage-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  )
}