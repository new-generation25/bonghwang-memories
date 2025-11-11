'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import UserSetupModal from '@/components/UserSetupModal'

export default function IntroPage() {
  const [showButton, setShowButton] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [showUserSetup, setShowUserSetup] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)
    const timer = setTimeout(() => {
      setShowButton(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleStartJourney = async () => {
    setRequesting(true)
    
    // Check if user has set up their ID and gender
    const userId = localStorage.getItem('userId')
    const userGender = localStorage.getItem('userGender')
    
    // 🐛 임시 디버깅 코드
    console.log('=== 디버깅 정보 ===')
    console.log('userId:', userId)
    console.log('userGender:', userGender)
    console.log('조건 확인:', !userId || !userGender)
    
    if (!userId || !userGender) {
      console.log('✅ 사용자 설정 모달을 표시합니다')
      setRequesting(false)
      setShowUserSetup(true)
      console.log('showUserSetup 상태:', true)
      return
    }
    
    console.log('❌ 사용자 정보가 있어서 스토리 페이지로 이동합니다')
    
    try {
      // 🚫 위치 기능 임시 비활성화 - 다른 오류 해결 후 재활성화 예정
      console.log('🚫 위치 기능이 임시로 비활성화되어 있습니다.')
      router.push('/story')
    } catch (error) {
      console.error('Error:', error)
    }
    
    setRequesting(false)
  }

  const handleUserSetupComplete = (userId: string, gender: string) => {
    setShowUserSetup(false)
    console.log('User setup complete:', userId, 'Gender:', gender)
    router.push('/story')
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

  // 서버 사이드 렌더링 시 기본 스타일
  const containerStyle = isClient ? {
    background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))',
    minHeight: '100dvh'
  } : {
    background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))'
  }

  return (
    <div className={`${isClient ? 'h-screen w-screen' : 'min-h-screen'} flex items-center justify-center relative overflow-hidden`} style={containerStyle}>
      {/* Full Screen Hero Image with Clickable Area */}
      <div className="w-full h-full relative">
        <div 
          className="w-full h-full cursor-pointer relative"
          onClick={handleImageClick}
          style={{ animation: 'fadeIn 0.8s ease-in-out' }}
        >
          <picture>
            <source srcSet="/title.png" type="image/png" />
            <img 
              src="/title.png" 
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
          </picture>
          
          {/* 실제 반응형 버튼 오버레이 - 이미지 위에 배치 */}
          {showButton && !requesting && (
            <button
              onClick={handleStartJourney}
              className="absolute z-20"
              style={{
                // 좌표 기반 위치 설정 (X=0.21~0.79, Y=0.88~0.94)
                left: '21%',
                top: '88%',
                width: '58%', // 79% - 21% = 58%
                height: '6%',  // 94% - 88% = 6%
                // 스타일링 - 네모랗고 회색 배경에 흰색 글씨
                background: '#6B7280', // 회색 배경
                border: '2px solid #4B5563',
                borderRadius: '8px', // 살짝 둥근 모서리
                color: '#FFFFFF',
                fontFamily: 'Noto Sans KR, sans-serif',
                fontWeight: 'bold',
                fontSize: 'clamp(12px, 2.5vw, 16px)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                // 텍스트 중앙 정렬
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.background = '#4B5563'
                e.currentTarget.style.transform = 'scale(0.98)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.background = '#6B7280'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#6B7280'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.background = '#4B5563'
                e.currentTarget.style.transform = 'scale(0.98)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.background = '#6B7280'
                e.currentTarget.style.transform = 'scale(1)'
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
          

        </div>
      </div>

      {/* User Setup Modal */}
      <UserSetupModal 
        isOpen={showUserSetup}
        onComplete={handleUserSetupComplete}
      />

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
      `}</style>


    </div>
  )
}