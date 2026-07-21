'use client'

import { useRouter, usePathname } from 'next/navigation'

interface NavigationProps {
  completedMainMissions: number
}

export default function Navigation({ completedMainMissions }: NavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    {
      key: 'story',
      label: '스토리',
      path: '/story',
      icon: '📜',
      disabled: false
    },
    {
      key: 'exploration',
      label: '탐험',
      path: '/exploration',
      icon: '🗺️',
      disabled: false
    },
    {
      key: 'treasure',
      label: '보물',
      path: '/treasure',
      icon: '💎',
      disabled: false // 테스트 모드에서는 항상 활성화
    },
    {
      key: 'community',
      label: '커뮤니티',
      path: '/community',
      icon: '👥',
      disabled: false
    }
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-cream shadow-[0_-4px_14px_rgba(43,36,32,0.12)] z-40">
      {/* 상단 3색 밴드 — 브랜드 식별 장치 */}
      <div className="stripe-band" />
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          const isDisabled = item.disabled

          return (
            <button
              key={item.key}
              onClick={() => !isDisabled && router.push(item.path)}
              disabled={isDisabled}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 transform active:scale-95 ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : isActive
                  ? 'bg-teal text-cream shadow-md'
                  : 'text-ink-60 hover:bg-cream-dp hover:scale-105'
              }`}
              style={{
                transition: 'all 0.15s ease-in-out'
              }}
              onMouseDown={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'scale(0.95)'
                }
              }}
              onMouseUp={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
              onTouchStart={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'scale(0.95)'
                }
              }}
              onTouchEnd={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-handwriting font-bold">
                {item.label}
              </span>
              
              {/* Lock icon for disabled items */}
              {isDisabled && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-rec rounded-full flex items-center justify-center">
                  <span className="text-cream text-xs">🔒</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}