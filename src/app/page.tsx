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
  }

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const relativeX = x / rect.width
    const relativeY = y / rect.height
    
    // 시작하기 버튼 영역 좌표 (이미지 내에서의 상대적 위치)
    // 버튼이 이미지 하단 중앙에 위치한다고 가정
    // 필요시 실제 버튼 위치에 맞게 조정 가능
    if (relativeX >= 0.2 && relativeX <= 0.8 && relativeY >= 0.75 && relativeY <= 0.95) {
      handleStartJourney()
    }
    
    // 디버깅용 - 클릭 위치 확인 (개발 시에만 사용)
    console.log(`클릭 위치: x=${relativeX.toFixed(2)}, y=${relativeY.toFixed(2)}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{
      background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))'
    }}>
      {/* Full Screen Hero Image with Clickable Area */}
      <div className="w-full h-full relative">
        <div 
          className="w-full h-full cursor-pointer relative"
          onClick={handleImageClick}
          style={{ animation: 'fadeIn 0.8s ease-in-out' }}
        >
          <img 
            src="/hero-image.png" 
            alt="봉황동 메모리즈 - 아버지의 유산을 찾아서"
            className="w-full h-full object-cover object-center"
            style={{
              filter: 'sepia(10%) contrast(1.05) brightness(1.02)'
            }}
            onError={(e) => {
              // 이미지 로딩 실패 시 기본 배경으로 대체
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.style.background = 'linear-gradient(145deg, rgba(139, 69, 19, 0.8), rgba(160, 82, 45, 0.6)), linear-gradient(to bottom, rgb(247, 243, 233), rgb(240, 230, 210))';
                parent.innerHTML = `
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="text-center">
                      <h1 class="text-6xl font-bold mb-4 text-white drop-shadow-lg" style="font-family: 'Noto Serif KR', serif;">
                        봉황동 메모리즈
                      </h1>
                      <p class="text-2xl text-white drop-shadow-md" style="font-family: 'Noto Sans KR', sans-serif;">
                        아버지의 유산을 찾아서
                      </p>
                    </div>
                  </div>
                `;
              }
            }}
          />
          
          {/* 로딩 상태 오버레이 */}
          {requesting && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
              <div className="text-white text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-xl font-bold">시작하는 중...</p>
                <p className="text-sm mt-2">권한 요청을 확인해주세요</p>
              </div>
            </div>
          )}
          
          {/* 클릭 가이드 (처음 몇 초간만 표시) */}
          {showButton && !requesting && (
            <div 
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm"
              style={{ 
                animation: 'slideUp 0.5s ease-out, fadeOut 3s ease-in-out 2s forwards'
              }}
            >
              화면을 터치하여 시작하세요
            </div>
          )}
        </div>
      </div>

      {/* CSS 애니메이션 추가 */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
          to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </div>
  )
}