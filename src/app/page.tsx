'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LocationPermissionModal from '@/components/LocationPermissionModal'

export default function IntroPage() {
  const [showButton, setShowButton] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowButton(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleStartJourney = async () => {
    setRequesting(true)
    
    try {
      // 커스텀 위치 권한 모달 표시
      setShowLocationModal(true)
    } catch (error) {
      console.error('Permission denied:', error)
      alert('위치와 카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.')
    }
    
    setRequesting(false)
  }

  const handleLocationGranted = async () => {
    setShowLocationModal(false)
    
    try {
      // 카메라 권한 요청
      if ('mediaDevices' in navigator) {
        await navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            // Stop the stream immediately after getting permission
            stream.getTracks().forEach(track => track.stop())
          })
      }

      // 스토리 페이지로 이동
      router.push('/story')
    } catch (error) {
      console.error('Camera permission denied:', error)
      alert('카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.')
    }
  }

  const handleLocationDenied = () => {
    setShowLocationModal(false)
    alert('위치 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.')
  }

  const handleLocationClose = () => {
    setShowLocationModal(false)
  }

  // 디버깅용 - 클릭 위치 확인
  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const relativeX = x / rect.width
    const relativeY = y / rect.height
    
    console.log(`클릭 위치: x=${relativeX.toFixed(2)}, y=${relativeY.toFixed(2)}`)
  }

  return (
    <div className="min-h-screen bg-vintage-paper flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-opacity='0.1'%3E%3Cpolygon fill='%23000' points='50 0 60 40 100 50 60 60 50 100 40 60 0 50 40 40'/%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          {/* App Icon */}
          <div className="mb-8">
            <div className="w-24 h-24 bg-vintage-brown rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">🏛️</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-vintage text-4xl md:text-5xl text-vintage-brown mb-6 leading-tight">
            봉황 메모리즈
          </h1>
          <h2 className="font-handwriting text-xl md:text-2xl text-sepia-700 mb-8 leading-relaxed">
            아버지의 유산을 찾아서
          </h2>

          {/* Description */}
          <div className="bg-vintage-cream border-2 border-sepia-300 rounded-lg p-6 mb-8 shadow-lg">
            <p className="font-handwriting text-lg text-sepia-700 leading-relaxed mb-4">
              봉황동의 역사와 문화를 스토리텔링과 게임형 미션을 통해 체험하는 인터랙티브 투어 앱입니다.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-sepia-600">
              <span className="flex items-center space-x-1">
                <span>📍</span>
                <span>위치 기반 미션</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>📸</span>
                <span>사진 촬영</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>🗺️</span>
                <span>지도 탐험</span>
              </span>
            </div>
          </div>

          {/* Start Button */}
          {showButton && (
            <div className="animate-fade-in">
              <button
                onClick={handleStartJourney}
                disabled={requesting}
                className={`vintage-button text-xl px-8 py-4 font-bold shadow-lg transform transition-all duration-300 hover:scale-105 active:scale-95 ${
                  requesting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {requesting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>준비 중...</span>
                  </div>
                ) : (
                  '여행 시작하기'
                )}
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 text-center">
            <p className="font-handwriting text-sm text-sepia-600 mb-2">
              💡 최적의 경험을 위해 다음 권한이 필요합니다:
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-sepia-500">
              <span>📍 위치 정보</span>
              <span>📸 카메라</span>
              <span>🗺️ 지도</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="font-handwriting text-sm text-sepia-500">
          봉황동의 추억을 담은 특별한 여행을 시작하세요
        </p>
      </div>

      {/* 커스텀 위치 권한 모달 */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onGranted={handleLocationGranted}
        onDenied={handleLocationDenied}
        onClose={handleLocationClose}
      />
    </div>
  )
}