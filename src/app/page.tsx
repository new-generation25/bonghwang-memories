'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AuthModal from '@/components/AuthModal'
import Cassette from '@/components/Cassette'
import { useAuth } from '@/contexts/AuthContext'

export default function IntroPage() {
  const [showButton, setShowButton] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const { profile, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  // 로그인은 커뮤니티 참여 조건일 뿐, 투어 자체는 로그인 없이도 진행할 수 있다.
  const handleStartJourney = () => {
    if (profile) {
      router.push('/story')
      return
    }
    setShowAuth(true)
  }

  const handleAuthSuccess = () => {
    setShowAuth(false)
    router.push('/story')
  }

  // '나중에 하기' — 비로그인 상태로 둘러보기
  const handleAuthSkip = () => {
    setShowAuth(false)
    router.push('/story')
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream-base">
      {/* 앱바 — 티얼 구조색 + 3색 스트라이프 */}
      <header className="appbar px-4 pt-4 pb-3">
        <div className="max-w-md mx-auto">
          <span className="appbar-badge">김해 봉황동 · BONGHWANG MEMORIES</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-2xl">봉황 메모리즈</h1>

            {/* 로그인 상태 — 확인이 끝나기 전에는 아무것도 확정하지 않는다 */}
            {!loading &&
              (profile ? (
                <div className="shrink-0 pb-1 text-right">
                  <div className="text-[11px] font-bold leading-tight">
                    {profile.nickname} 기록자
                  </div>
                  <button
                    onClick={logout}
                    className="font-mono-retro text-[9px] text-cream/70 underline"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="shrink-0 rounded-full bg-cream/20 px-3 py-1 pb-1 text-[11px] font-bold"
                >
                  로그인
                </button>
              ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-5 pb-10">
        {/* 후킹 — 위, 정보 — 아래 */}
        <section className="pt-6" style={{ animation: 'fadeIn 0.8s ease-in-out' }}>
          <h2 className="font-display text-[26px] leading-[1.3] text-teal-dk">
            아버지가 남긴 기억,
            <br />
            <span className="mark-yellow">오늘 다시 재생합니다</span>
          </h2>
          <p className="mt-3 text-[13px] text-ink-60 leading-relaxed">
            봉황동 골목에 남겨진 이야기를 따라가는 미션 투어.
            <br />
            예약도 설치도 없습니다.
          </p>
        </section>

        {/* 카세트 오브제 — 지면당 1개 */}
        <section className="flex justify-center mt-6 mb-2">
          <Cassette
            title="아버지의 타임캡슐"
            headLeft="LOCAL MEMORIES"
            headRight="SIDE A"
            side="A"
            progress={95}
            spin="none"
            scale={0.92}
          />
        </section>

        {/* 3대 약속 */}
        <section className="grid grid-cols-3 gap-2 mt-8">
          {[
            { icon: '⚡', label: '예약·설치\n없음' },
            { icon: '▦', label: '25칸\n빙고 미션' },
            { icon: '◉', label: '완주 인증\n+ 기록 보관' },
          ].map((item) => (
            <div key={item.icon} className="text-center">
              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-teal bg-paper text-base">
                {item.icon}
              </span>
              <span className="block whitespace-pre-line text-[10px] font-bold leading-snug text-teal-dk">
                {item.label}
              </span>
            </div>
          ))}
        </section>

        {/* 신뢰 지표 */}
        <div className="mt-6 rounded-lg border border-dashed border-teal bg-paper px-3 py-2 text-center text-[10px] text-ink-60">
          시범 운영 12팀 · 만족도 5.0/5.0 · 재방문 의향 100%
        </div>

        {/* 주 CTA — 티얼 구조색 */}
        {showButton && (
          <button
            onClick={handleStartJourney}
            className="btn-teal mt-5 w-full text-center text-[15px]"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            ▶ PLAY — 이야기 열기
            <small className="mt-0.5 block text-[10px] font-normal opacity-85">
              {profile ? `${profile.nickname} 기록자로 이어가기` : '기록자 등록 후 바로 시작'}
            </small>
          </button>
        )}

        <p className="mt-4 text-center font-pen text-[17px] leading-snug text-ink-60">
          &ldquo;이 골목엔 아직 열지 않은 이야기가 있다&rdquo;
        </p>
      </main>

      {/* 하단 3색 밴드 — 브랜드 식별 장치 */}
      <div className="stripe-band" />

      <AuthModal
        isOpen={showAuth}
        onClose={handleAuthSkip}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}
