'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AuthModal from '@/components/AuthModal'
import Cassette from '@/components/Cassette'
import NarrationPlayer from '@/components/NarrationPlayer'
import { useAuth } from '@/contexts/AuthContext'

export default function IntroPage() {
  const [showButton, setShowButton] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const { profile, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 900)
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
    <div className="flex min-h-screen flex-col bg-cream-base">
      {/* 로그인 상태 — 포스터를 가리지 않도록 최소한으로 */}
      <div className="mx-auto flex max-w-[420px] items-center justify-end px-4 pt-3">
        {!loading &&
          (profile ? (
            <div className="text-right">
              <span className="text-[11px] font-bold text-teal-dk">
                {profile.nickname} 기록자
              </span>
              <button
                onClick={logout}
                className="ml-2 font-mono-retro text-[9px] text-ink-60 underline"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] font-bold text-teal-dk"
            >
              로그인
            </button>
          ))}
      </div>

      {/* 키 비주얼 포스터 — 시안 2장 그대로 */}
      <div className="kv-stage mt-2 px-2" style={{ animation: 'fadeIn 0.8s ease-in-out' }}>
        <div className="kv-poster">
          <div className="sun" />
          <div className="rays" />

          <div className="tape1">BONGHWANG-DONG · GIMHAE</div>

          <h1>
            봉황
            <br />
            메모<span>리즈</span>
          </h1>

          <div className="sub-band">약속의 기록자 EP.1 — SIDE A</div>

          <div className="price-stick">
            <span>한 팀</span>
            <b>15,000</b>
            <span>원</span>
          </div>

          <div className="cass-hold">
            <Cassette
              title="아버지의 타임캡슐"
              headLeft="LOCAL MEMORIES"
              headRight="REC"
              side="A"
              progress={70}
              spin="left"
            />
          </div>

          <div className="slogan">
            <em>이 골목엔 아직</em>
            <br />
            <em>열지 않은 이야기가 있다</em>
          </div>

          <div className="qr" />

          <div className="foot">
            <span>봉황 메모리즈</span>
            <span>QR 스캔 · 즉시 시작</span>
          </div>
        </div>
      </div>

      {/* 실행 영역 — 포스터 바깥 */}
      <div className="mx-auto max-w-[380px] px-4 pb-10 pt-5">
        {/* 진입 텍스트 — 대본 C절 */}
        <p className="text-center text-[13px] font-bold leading-relaxed text-ink">
          19년 만에 고향에 돌아온 친구가,
          <br />
          당신에게 하루를 부탁했습니다.
        </p>
        <p className="mt-1 text-center text-[11px] leading-relaxed text-ink-60">
          기억을 잃어가는 아버지의 다섯 소원.
          <br />
          오늘, 소영과 함께 봉황동을 걷습니다.
        </p>

        {/* 소영의 인트로 — 음성 파일이 없으면 표시되지 않는다 */}
        <NarrationPlayer
          id="intro-soyoung"
          label="소영의 목소리 · 19년 만의 전화"
          className="mt-4"
        />

        {showButton && (
          <button
            onClick={handleStartJourney}
            className="btn-teal mt-4 w-full text-center text-[15px]"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            소영의 이야기 듣기 ▶
            <small className="mt-0.5 block text-[10px] font-normal opacity-85">
              {profile ? `${profile.nickname} 기록자로 이어가기` : '기록자 등록 후 바로 시작'}
            </small>
          </button>
        )}
      </div>

      {/* 하단 3색 밴드 — 브랜드 식별 장치. 항상 화면 맨 아래에 붙는다 */}
      <div className="stripe-band mt-auto" />

      <AuthModal isOpen={showAuth} onClose={handleAuthSkip} onSuccess={handleAuthSuccess} />
    </div>
  )
}
