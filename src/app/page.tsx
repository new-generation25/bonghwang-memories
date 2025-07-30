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
            alt="봉황 메모리즈 - 아버지의 유산을 찾아서"
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
                        봉황 메모리즈
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
          
          {/* 실제 반응형 버튼 오버레이 - 이미지 위에 배치 */}
          {showButton && !requesting && (
            <button
              onClick={handleStartJourney}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
              style={{
                // 이미지 내 버튼 위치에 맞게 조정 (기본값: 중앙 하단)
                left: '50%',
                top: '85%',
                // 반응형 크기
                width: 'clamp(120px, 25vw, 200px)',
                height: 'clamp(40px, 8vw, 60px)',
                // 스타일링
                background: 'linear-gradient(145deg, #DAA520, #B8860B)',
                border: '3px solid #F4F1E8',
                borderRadius: '25px',
                color: '#FFFFFF',
                fontFamily: 'Noto Sans KR, sans-serif',
                fontWeight: 'bold',
                fontSize: 'clamp(14px, 3vw, 18px)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                animation: 'buttonPulse 2s infinite'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateX(-50%) translateY(-50%) scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateX(-50%) translateY(-50%) scale(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(-50%) translateY(-50%) scale(1)'
              }}
            >
              시작하기
            </button>
          )}
          
          {/* 로딩 상태 오버레이 */}
          {requesting && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
              <div className="text-white text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-xl font-bold">시작하는 중...</p>
                <p className="text-sm mt-2">권한 요청을 확인해주세요</p>
              </div>
            </div>
          )}
          
          {/* 개발용 좌표 확인 가이드 */}
          <div 
            className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded text-xs z-10"
            style={{ 
              animation: 'fadeOut 5s ease-in-out 3s forwards'
            }}
          >
            이미지를 클릭하여 버튼 위치 확인 (콘솔 로그)
          </div>
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
          to { opacity: 0; }
        }
        @keyframes buttonPulse {
          0%, 100% { 
            box-shadow: 0 8px 16px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3), 0 0 0 0 rgba(218, 165, 32, 0.4);
          }
          50% { 
            box-shadow: 0 8px 16px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.4), 0 0 0 10px rgba(218, 165, 32, 0.1);
          }
        }
      `}</style>

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