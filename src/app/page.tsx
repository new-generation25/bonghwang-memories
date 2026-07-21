'use client'

/**
 * S00 — 랜딩: QR 진입 · 상품 소개 · 결제.
 *
 * 결제는 모의(테스트) 버튼이다 — 실제 PG 연동 시 handleMockPay만 교체하면 된다.
 * 로그인은 커뮤니티 참여 조건일 뿐, 투어 자체는 로그인 없이 진행할 수 있다.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AuthModal from '@/components/AuthModal'
import Cassette from '@/components/Cassette'
import { useAuth } from '@/contexts/AuthContext'
import { useTourState } from '@/hooks/useTourState'
import { mutateTour } from '@/lib/tourState'

export default function LandingPage() {
  const [showButton, setShowButton] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const { profile, loading, logout } = useAuth()
  const tour = useTourState()
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 900)
    return () => clearTimeout(timer)
  }, [])

  // 진행 중인 투어가 있으면 해당 지점으로 이어간다
  const resumeTarget = (() => {
    if (!tour.paid) return null
    switch (tour.phase) {
      case 'intro':
        return '/intro'
      case 'act1':
        return '/play'
      case 'act2':
        return '/treasure'
      case 'done':
        return '/finale'
      default:
        return '/download'
    }
  })()

  /** 모의 결제 — 실제 PG 연동 지점 */
  const handleMockPay = () => {
    mutateTour({ paid: true, phase: 'intro' })
    router.push('/download')
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

          <div className="sub-band">봉황1988 EP.1 — 아버지의 타임캡슐</div>

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

      {/* 상품 소개 + 결제 — 포스터 바깥 */}
      <div className="mx-auto w-full max-w-[380px] px-4 pb-10 pt-5">
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

        {/* 구성 안내 */}
        <ul className="mt-4 space-y-1.5 rounded-xl border border-line bg-paper px-4 py-3 text-[12px] leading-relaxed text-ink">
          <li>🎧 오디오 드라마 투어 약 90분 — 이어폰 필수</li>
          <li>📼 다섯 거점 · 다섯 소원 · 숨겨진 B면 트랙</li>
          <li>📸 사진·녹음으로 완성하는 &lsquo;우리의 테이프&rsquo;</li>
          <li>🎟 거점 상점 쿠폰 + 2막 골목 빙고</li>
        </ul>

        {showButton && (
          <div style={{ animation: 'slideUp 0.4s ease-out' }}>
            {resumeTarget ? (
              <button
                onClick={() => router.push(resumeTarget)}
                className="btn-teal mt-4 w-full text-center text-[15px]"
              >
                이어서 걷기 ▶
                <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                  진행 중인 투어가 있습니다
                </small>
              </button>
            ) : (
              <button
                onClick={handleMockPay}
                className="btn-teal mt-4 w-full text-center text-[15px]"
              >
                결제 완료(테스트) ▶
                <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                  실제 결제 없이 바로 시작합니다
                </small>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 하단 3색 밴드 — 브랜드 식별 장치. 항상 화면 맨 아래에 붙는다 */}
      <div className="stripe-band mt-auto" />

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => setShowAuth(false)}
      />
    </div>
  )
}
