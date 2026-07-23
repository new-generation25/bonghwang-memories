'use client'

/**
 * 하단 네비게이션 — EP.1 구조:
 * 플레이어(/play) · 길 안내(/exploration) · 빙고(/treasure)
 * · 소영의 친구들(/community) · 나의 기록(/me)
 *
 * 빙고 탭은 다섯 소원 완료(phase=act2) 전까지 잠긴다.
 * prop 없이 tourState를 직접 구독한다 — 어느 페이지에서든 그냥 <Navigation />.
 */

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTourState } from '@/hooks/useTourState'
import { BINGO_ALWAYS_OPEN } from '@/lib/tracks'

interface NavItem {
  key: string
  label: string
  path: string
  icon: string
  disabled: boolean
  /** 잠긴 탭을 눌렀을 때 알려줄 말 */
  lockedMessage?: string
}

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const tour = useTourState()
  const [lockedNotice, setLockedNotice] = useState<string | null>(null)

  // 안내는 잠깐 떠 있다 사라진다 — 걷는 중에 보는 화면이라 손으로 닫게 하지 않는다
  useEffect(() => {
    if (!lockedNotice) return
    const id = setTimeout(() => setLockedNotice(null), 2600)
    return () => clearTimeout(id)
  }, [lockedNotice])

  const navItems: NavItem[] = [
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
      // 골목을 돌며 도장을 찍는 놀이라 도장(🏮 등)보다 격자가 직관적이다
      icon: '🎟️',
      disabled: !tour.bingo.unlocked && !BINGO_ALWAYS_OPEN,
      lockedMessage: "'다섯 가지 소원' 이야기를 완료해야 열립니다.",
    },
    {
      key: 'community',
      label: '친구들',
      path: '/community',
      icon: '👥',
      disabled: false,
    },
    {
      key: 'me',
      label: '나의 기록',
      path: '/me',
      icon: '🧾',
      disabled: false,
    },
  ]

  // iOS PWA 전체화면에서 홈 인디케이터가 라벨을 덮지 않도록 안전영역만큼 띄운다
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-cream shadow-[0_-4px_14px_rgba(43,36,32,0.12)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/*
        잠긴 탭 안내 — 탭바 바로 위에 뜬다.
        자물쇠 배지를 없앤 대신, 눌러본 사람에게는 왜 안 열리는지 말해준다.
        배지는 늘 떠 있어 시선을 끌지만 이유를 설명하지 못했다.
      */}
      {lockedNotice && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-full left-0 right-0 mb-2 px-4"
        >
          <p
            className="mx-auto max-w-md rounded-xl bg-shell/92 px-4 py-2.5 text-center text-[12.5px] font-bold leading-snug text-cream shadow-lg"
            style={{ animation: 'slideUp 0.28s ease-out' }}
          >
            {lockedNotice}
          </p>
        </div>
      )}

      {/* 상단 3색 밴드 — 브랜드 식별 장치 */}
      <div className="stripe-band" />
      {/*
        다섯 칸을 똑같이 나눈다. justify-around는 글자 수대로 폭이 달라져
        '빙고'(2자)가 '나의 기록'(4자)보다 좁아졌고, 좁은 쪽은 43px까지
        내려가 터치 권장 크기(44px)에 못 미쳤다. 균등 분할이면 375px 기기에서
        한 칸이 73px이라 어느 탭이든 넉넉하게 눌린다.
      */}
      <div className="mx-auto grid max-w-md grid-cols-5 items-stretch px-1.5 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          const isDisabled = item.disabled

          return (
            <button
              key={item.key}
              onClick={() => {
                if (isDisabled) {
                  setLockedNotice(item.lockedMessage ?? '아직 열리지 않았습니다.')
                  return
                }
                router.push(item.path)
              }}
              // disabled를 걸지 않는다 — 눌러야 왜 안 되는지 알려줄 수 있다.
              // 대신 aria로 잠긴 상태임을 알린다.
              aria-disabled={isDisabled}
              // 탭도 눌리는 물건이다 — 잠긴 탭은 소리를 내지 않는다
              data-sfx={isDisabled ? 'off' : 'key'}
              className={`relative flex w-full transform flex-col items-center justify-center rounded-lg px-1 py-2 transition-all duration-150 active:scale-95 ${
                isDisabled
                  ? 'cursor-not-allowed text-ink-60 opacity-40'
                  : isActive
                    ? 'bg-teal text-cream shadow-md'
                    : 'text-ink-60 hover:scale-105 hover:bg-cream-dp'
              }`}
            >
              <span className="mb-1 text-xl">{item.icon}</span>
              <span className="whitespace-nowrap font-handwriting text-[11px] font-bold">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
