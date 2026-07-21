'use client'

/**
 * 하단 네비게이션 — EP.1 구조:
 * 플레이어(/play) · 길 안내(/exploration) · 빙고(/treasure) · 소영의 친구들(/community)
 *
 * 빙고 탭은 다섯 소원 완료(phase=act2) 전까지 잠긴다.
 * prop 없이 tourState를 직접 구독한다 — 어느 페이지에서든 그냥 <Navigation />.
 */

import { useRouter, usePathname } from 'next/navigation'
import { useTourState } from '@/hooks/useTourState'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const tour = useTourState()

  const navItems = [
    {
      key: 'player',
      label: '플레이어',
      path: '/play',
      icon: '📼',
      disabled: false,
    },
    {
      key: 'map',
      label: '길 안내',
      path: '/exploration',
      icon: '🗺️',
      disabled: false,
    },
    {
      key: 'bingo',
      label: '빙고',
      path: '/treasure',
      icon: '🎴',
      disabled: !tour.bingo.unlocked,
    },
    {
      key: 'community',
      label: '친구들',
      path: '/community',
      icon: '👥',
      disabled: false,
    },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-cream shadow-[0_-4px_14px_rgba(43,36,32,0.12)]">
      {/* 상단 3색 밴드 — 브랜드 식별 장치 */}
      <div className="stripe-band" />
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          const isDisabled = item.disabled

          return (
            <button
              key={item.key}
              onClick={() => !isDisabled && router.push(item.path)}
              disabled={isDisabled}
              className={`relative flex transform flex-col items-center rounded-lg px-3 py-2 transition-all duration-150 active:scale-95 ${
                isDisabled
                  ? 'cursor-not-allowed opacity-40'
                  : isActive
                    ? 'bg-teal text-cream shadow-md'
                    : 'text-ink-60 hover:scale-105 hover:bg-cream-dp'
              }`}
            >
              <span className="mb-1 text-xl">{item.icon}</span>
              <span className="font-handwriting text-xs font-bold">
                {item.label}
              </span>

              {isDisabled && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rec text-xs text-cream">
                  🔒
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
