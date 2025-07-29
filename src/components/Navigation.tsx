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
    <div className="fixed bottom-0 left-0 right-0 bg-vintage-cream border-t-2 border-sepia-300 shadow-lg z-40">
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          const isDisabled = item.disabled

          return (
            <button
              key={item.key}
              onClick={() => !isDisabled && router.push(item.path)}
              disabled={isDisabled}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : isActive
                  ? 'bg-vintage-brown text-white shadow-md'
                  : 'text-sepia-700 hover:bg-sepia-100'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-handwriting font-bold">
                {item.label}
              </span>
              
              {/* Lock icon for disabled items */}
              {isDisabled && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">🔒</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Progress indicator */}
      <div className="bg-sepia-100 px-4 py-2">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-sepia-600 mb-1">
            <span>메인 미션 진행률</span>
            <span>{completedMainMissions}/5</span>
          </div>
          <div className="w-full bg-sepia-200 rounded-full h-2">
            <div 
              className="bg-vintage-gold h-2 rounded-full transition-all duration-500"
              style={{ width: `${(completedMainMissions / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}