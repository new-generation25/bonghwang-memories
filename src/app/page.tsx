'use client'

/**
 * S00 — 랜딩: QR 진입 · 상품 소개 · 결제.
 *
 * 결제는 모의(테스트) 버튼이다 — 실제 PG 연동 시 handleMockPay만 교체하면 된다.
 * 시작하려면 기록자 등록이 필요하다 — 구매 이력·진행도가 계정에 묶여 저장된다.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AuthModal from '@/components/AuthModal'
import Cassette from '@/components/Cassette'
import { useAuth } from '@/contexts/AuthContext'
import { useTourState } from '@/hooks/useTourState'
import { mutateTour } from '@/lib/tourState'
import { logEvent } from '@/lib/analytics'

export default function LandingPage() {
  const [showButton, setShowButton] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const { profile, loading, available, logout } = useAuth()
  const tour = useTourState()
  const router = useRouter()
  // 로그인 창을 결제 때문에 열었는지 — 로그인이 끝나면 이어서 결제로 넘어간다
  const [payAfterLogin, setPayAfterLogin] = useState(false)

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
    logEvent('purchase', { mock: true })
    mutateTour({ paid: true, phase: 'intro' })
    router.push('/download')
  }

  /**
   * 시작 — 기록자 등록을 먼저 거친다.
   *
   * 구매 이력과 투어 진행도는 계정(uid)에 묶여 저장된다. 등록 없이 결제하면
   * 기기를 바꾸거나 브라우저 데이터를 지웠을 때 산 것을 되찾을 방법이 없고,
   * 5천원 → 1.5만원 업그레이드도 "이미 낸 사람"을 알아볼 수 없다.
   * 단, Firebase가 꺼진 환경(환경변수 미설정)에서는 흐름을 막지 않는다.
   */
  const handleStart = () => {
    if (profile || !available) {
      handleMockPay()
      return
    }
    setPayAfterLogin(true)
    setShowAuth(true)
  }

  /** 등록·로그인 완료 → 결제하려던 참이었다면 이어서 진행 */
  const handleAuthSuccess = () => {
    setShowAuth(false)
    if (payAfterLogin) {
      setPayAfterLogin(false)
      handleMockPay()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream-base">
      {/*
        로그인 버튼은 두지 않는다 — 시작 버튼을 누르면 등록 화면이 뜬다.
        이미 로그인한 사람에게만 누구로 접속 중인지 알려준다(로그아웃 경로 겸용).
      */}
      <div className="mx-auto flex h-8 max-w-[420px] items-center justify-end px-4 pt-3">
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
          ) : null)}
      </div>

      {/* 키 비주얼 포스터 — 시안 2장 그대로 */}
      <div className="kv-stage mt-2 px-2" style={{ animation: 'fadeIn 0.8s ease-in-out' }}>
        <div className="kv-poster">
          <div className="sun" />
          <div className="rays" />

          <div className="tape1">BONGHWANG-DONG · GIMHAE</div>

          <h1>
            BONGHWANG
            <br />
            MEMO<span>RIES</span>
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
              spin="both"
            />
          </div>

          <div className="slogan">
            <em>이 골목엔 아직</em>
            <br />
            <em>열지 않은 이야기가 있다</em>
          </div>

          <div className="foot">
            <span>봉황 메모리즈</span>
            <span>AUDIO DRAMA TOUR</span>
          </div>
        </div>
      </div>

      {/* 상품 소개 — 포스터 바깥. 결제 버튼은 아래 고정 바로 뺐다 */}
      <div className="mx-auto w-full max-w-[380px] px-4 pb-32 pt-5">
        <p className="text-center text-[13px] font-bold leading-relaxed text-ink">
          골목에 남겨진 카세트테이프 하나,
          <br />
          그리고 손글씨 쪽지 한 장.
        </p>
        <p className="mt-1 text-center text-[11px] leading-relaxed text-ink-60">
          1988년, 아버지가 태어날 딸에게 남긴 다섯 가지 소원.
          <br />
          쪽지 속 번호로 전화를 걸면 이야기가 시작됩니다.
        </p>

        {/* 구성 안내 — 기본은 접혀 있고 버튼으로 펼친다 */}
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="mt-4 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-center text-[12px] font-bold text-teal-dk"
        >
          {showInfo ? '구성·이용 안내 접기 ▲' : '구성·이용 안내 보기 ▼'}
        </button>
        {showInfo && (
          <ul
            className="mt-2 space-y-1.5 rounded-xl border border-line bg-paper px-4 py-3 text-[12px] leading-relaxed text-ink"
            style={{ animation: 'fadeIn 0.25s ease-in-out' }}
          >
            <li>🎧 오디오 드라마 투어 약 90분 — 이어폰 필수</li>
            <li>📼 다섯 거점 · 다섯 소원 · 숨겨진 B면 트랙</li>
            <li>📸 사진·녹음으로 완성하는 &lsquo;우리의 테이프&rsquo;</li>
            <li>🎟 거점 상점 쿠폰 + 2막 골목 빙고</li>
          </ul>
        )}

      </div>

      {/*
        결제 CTA — 화면 하단 고정.
        포스터가 532px 고정 높이라 흐름 배치로는 작은 기기에서 첫 화면 밖으로
        밀린다(iPhone SE 기준 753px 지점). 이 화면은 유일한 전환 지점이고
        하단 탭바도 없어 겹칠 대상이 없다. 3색 밴드도 여기 함께 붙여
        다른 화면들과 같은 fixed 정책으로 맞춘다.
      */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        {showButton && (
          <div
            className="bg-cream-base/95 px-4 pb-3 pt-3 backdrop-blur-sm"
            style={{
              animation: 'slideUp 0.4s ease-out',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
            }}
          >
            <div className="mx-auto w-full max-w-[380px]">
              {resumeTarget ? (
                <button
                  onClick={() => router.push(resumeTarget)}
                  className="btn-teal w-full text-center text-[15px]"
                >
                  이어서 걷기 ▶
                  <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                    진행 중인 투어가 있습니다
                  </small>
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  className="btn-teal w-full text-center text-[15px]"
                >
                  결제 완료(테스트) ▶
                  <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                    실제 결제 없이 바로 시작합니다
                  </small>
                </button>
              )}
            </div>
          </div>
        )}
        <div className="stripe-band" />
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => {
          setShowAuth(false)
          setPayAfterLogin(false)
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}
