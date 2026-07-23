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
import NicknameEditor from '@/components/NicknameEditor'
import Cassette from '@/components/Cassette'
import { useAuth } from '@/contexts/AuthContext'
import { useTourState } from '@/hooks/useTourState'
import { mutateTour, restartTour } from '@/lib/tourState'
import { clearLocalPoints } from '@/lib/points'
import { logEvent } from '@/lib/analytics'

export default function LandingPage() {
  const [showButton, setShowButton] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showNickname, setShowNickname] = useState(false)
  const { profile, loading, available, logout } = useAuth()
  const tour = useTourState()
  const router = useRouter()
  // 로그인 창을 결제 때문에 열었는지 — 로그인이 끝나면 이어서 결제로 넘어간다
  const [payAfterLogin, setPayAfterLogin] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 900)
    return () => clearTimeout(timer)
  }, [])

  /**
   * 진행 중인 투어가 있으면 이어갈 지점.
   *
   * 계정에 로그인해야 내민다. 진행도의 원본은 서버이고 이 기기의 기록은
   * 걷는 동안 신호가 끊겼을 때를 위한 임시 보관일 뿐이다. 로그인하지 않은
   * 상태에서 남의 기록이나 지난 검수 기록으로 '이어서 걷기'가 뜨면
   * 그게 누구 것인지 알 방법이 없다.
   *
   * 서버를 쓸 수 없는 환경(환경변수 미설정 등)에서는 기기 기록이 유일한
   * 원본이라 그대로 쓴다 — 그때까지 막으면 투어 자체가 진행되지 않는다.
   */
  const resumeTarget = (() => {
    if (available && !profile) return null
    if (!tour.paid) return null
    switch (tour.phase) {
      case 'intro':
        return '/intro'
      case 'act1':
        return '/play'
      case 'act2':
        return '/treasure'
      case 'done':
        // 완주 후 '다시 둘러보기'는 골목 빙고로 — 아직 못 채운 칸이 남아 있고
        // 보너스 미션도 여기서 이어진다. 피날레는 이미 본 화면이다.
        return '/treasure'
      default:
        return '/download'
    }
  })()

  /**
   * 로그아웃 — 서버 저장이 확인돼야 이 기기의 기록이 지워진다.
   * 저장에 실패했는데 조용히 넘어가면, 기록이 남은 걸 보고 다시 '로그아웃이
   * 안 된다'고 여기게 된다. 무엇이 일어났는지 말해준다.
   */
  const [logoutNote, setLogoutNote] = useState('')
  const handleLogout = async () => {
    const cleared = await logout()
    if (!cleared) {
      setLogoutNote(
        '로그아웃했지만 진행 기록을 서버에 저장하지 못해 이 기기에 남겨뒀어요. 연결을 확인하고 다시 로그인해주세요.'
      )
      setTimeout(() => setLogoutNote(''), 7000)
    }
  }

  /**
   * 이야기를 처음부터 다시 걷는다.
   *
   * 진행도는 계정에도 이어져 있어 되돌릴 수 없다 — 로그인 상태에서 지우면
   * 동기화가 서버 기록까지 같은 상태로 덮는다. 그러니 그렇게 말해준다.
   *
   * 산 것은 건드리지 않는다. 이건 환불이 아니라 다시 걷겠다는 뜻이라,
   * 결제까지 지우면 15,000원 내고 산 사람이 자기 상품에 못 들어간다.
   */
  const handleRestart = () => {
    const message = profile
      ? '이야기를 처음부터 다시 시작할까요?\n지금까지의 진행 기록은 계정에서도 지워지며 되돌릴 수 없습니다.\n구매한 이용권은 그대로 유지됩니다.'
      : '이야기를 처음부터 다시 시작할까요?\n지금까지의 진행 기록은 되돌릴 수 없습니다.'
    if (!window.confirm(message)) return

    restartTour()
    clearLocalPoints()
  }

  const finished = tour.phase === 'done'

  const resumeLabel = finished
    ? '골목 빙고에서 이어집니다'
    : '진행 중인 투어가 있습니다'

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
              {/* 닉네임을 눌러 바꾼다 — 커뮤니티에 그대로 나가는 이름이라
                  고칠 길이 있어야 한다 */}
              <button
                onClick={() => setShowNickname(true)}
                className="text-[11px] font-bold text-teal-dk underline decoration-dotted underline-offset-2"
              >
                {profile.nickname} 기록자
              </button>
              <button
                onClick={handleLogout}
                className="ml-2 font-mono-retro text-[9px] text-ink-60 underline"
              >
                로그아웃
              </button>
            </div>
          ) : null)}
      </div>

      {logoutNote && (
        <div className="mx-auto max-w-[420px] px-4">
          <p className="rounded-lg bg-rec/10 px-3 py-2 text-[11.5px] leading-snug text-rec">
            {logoutNote}
          </p>
        </div>
      )}

      {/* 키 비주얼 포스터 — 시안 2장 그대로 */}
      <div className="kv-stage mt-2 px-2" style={{ animation: 'fadeIn 0.8s ease-in-out' }}>
        <div className="kv-poster">
          <div className="sun" />
          <div className="rays" />

          {/* 지역 표기 — 우상단 (지역판 교체 지점) */}
          <div className="region-tag">BONGHWANG-DONG · GIMHAE</div>

          <h1>
            BONGHWANG
            <br />
            MEMO<span>RIES</span>
          </h1>

          {/* 대제목이 이미 봉황 메모리즈다 — 밴드는 에피소드만 (브랜드 v2.1 §1) */}
          <div className="sub-band">EP.1 「아버지의 믹스테이프」</div>

          {/* 후킹 스티커 — 이야기·미션은 전부 무료다(브랜드 v2.1 §5) */}
          <div className="price-stick">
            <b>무료</b>
            <span>시작</span>
          </div>

          <div className="cass-hold">
            <Cassette
              title="아버지의 믹스테이프"
              headLeft="LOCAL MEMORIES"
              headRight="SIDE A"
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

        </div>
      </div>

      {/* 상품 소개 — 포스터 바깥. 결제 버튼은 아래 고정 바로 뺐다 */}
      <div className="mx-auto w-full max-w-[380px] px-4 pb-32 pt-5">
        {/* 안내는 이 자리를 덮으며 올라온다 — 아래로 펼치면 첫 화면에서
            내용이 접힌 부분 밖으로 밀려 스크롤해야 보인다. */}
        <div className="relative">
          <div
            className="transition-opacity duration-200"
            style={{ opacity: showInfo ? 0 : 1 }}
            aria-hidden={showInfo}
          >
            <p className="text-center text-[13px] font-bold leading-relaxed text-ink">
              골목에서 발견한 카세트 하나,
              <br />
              그리고 손글씨 쪽지 한 장.
            </p>
            <p className="mt-1 text-center text-[11px] leading-relaxed text-ink-60">
              1988년, 아버지가 태어날 딸에게 남긴 다섯 가지 소원.
              <br />
              쪽지 속 번호로 전화를 걸면 이야기가 시작됩니다.
            </p>
          </div>

          {showInfo && (
            <div className="absolute inset-x-0 bottom-0">
              <div
                className="rounded-xl border border-line bg-paper px-4 py-3 shadow-lg"
                style={{ animation: 'guide-pull-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) both' }}
              >
                <ul className="space-y-1.5 text-[12px] leading-relaxed text-ink">
                  <li>🎧 오디오 드라마 투어 약 90분 — 이어폰 사용 권장</li>
                  <li>📼 다섯 개의 장소, 다섯 소원. 그리고 숨겨진 이야기</li>
                  <li>📸 사진·녹음으로 완성하는 &lsquo;우리의 믹스테이프&rsquo;</li>
                  <li>🎟 골목 곳곳을 다니며 빙고를 완성</li>
                </ul>

                {/* 무료·유료 비교 (브랜드 v2.1 §5).
                    '완주 리워드'는 무엇을 사는지가 안 읽혀서 '유료'로 되돌리고,
                    받는 시점은 항목 이름에 붙인다 — 결제 전에 알아야 할 조건이다. */}
                <table className="mt-3 w-full border-t border-line pt-2 text-[11.5px] text-ink">
                  <thead>
                    <tr className="text-ink-60">
                      <th className="py-1 text-left font-normal">　</th>
                      <th className="py-1 text-center font-bold text-teal-dk">무료</th>
                      <th className="py-1 text-center font-bold text-teal-dk">
                        유료
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-line/60">
                      <td className="py-1">이야기·미션 전체</td>
                      <td className="py-1 text-center">○</td>
                      <td className="py-1 text-center">○</td>
                    </tr>
                    <tr className="border-t border-line/60">
                      <td className="py-1">디지털 완주 인증</td>
                      <td className="py-1 text-center">○</td>
                      <td className="py-1 text-center">○</td>
                    </tr>
                    <tr className="border-t border-line/60">
                      <td className="py-1">골목 가게 쿠폰(완주시)</td>
                      <td className="py-1 text-center text-ink-60">—</td>
                      <td className="py-1 text-center font-bold">4,000원</td>
                    </tr>
                    <tr className="border-t border-line/60">
                      <td className="py-1">완주 기념품</td>
                      <td className="py-1 text-center text-ink-60">—</td>
                      <td className="py-1 text-center font-bold">○</td>
                    </tr>
                    <tr className="border-t border-line/60">
                      <td className="py-1 font-bold">금액</td>
                      <td className="py-1 text-center font-bold">0원</td>
                      <td className="py-1 text-center font-bold">5,000원</td>
                    </tr>
                  </tbody>
                </table>

                {/* 지급 시점·환불 — 세계관 용어 대신 일반 용어로 (§5 필수) */}
                <p className="mt-2 text-[10.5px] leading-relaxed text-ink-60">
                  쿠폰과 기념품은 <b className="text-ink">투어를 완주하신 뒤</b>{' '}
                  드립니다.{' '}
                  <a
                    href="/refund"
                    className="underline decoration-dotted underline-offset-2"
                  >
                    환불 규정
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowInfo((v) => !v)}
          className="mt-4 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-center text-[12px] font-bold text-teal-dk"
        >
          {showInfo ? '봉황 메모리즈 이용 안내 ▼' : '봉황 메모리즈 이용 안내 ▲'}
        </button>

      </div>

      {/*
        결제 CTA — 화면 하단 고정.
        포스터가 500px 고정 높이라 흐름 배치로는 작은 기기에서 첫 화면 밖으로
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
              {/* 리워드 안내 띠는 뺐다 — 같은 내용을 '이용 안내' 팝업의 비교표가
                  더 정확하게(무엇을·언제·얼마) 설명한다. 시작 버튼 바로 위에서
                  금액을 먼저 보여주면 무료로 걷는다는 사실이 흐려진다. */}
              {resumeTarget ? (
                <>
                  <button
                    onClick={() => router.push(resumeTarget)}
                    className="btn-teal w-full text-center text-[15px]"
                  >
                    {finished ? '다시 둘러보기 ▶' : '▶ 이어서 걷기'}
                    <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                      {resumeLabel}
                    </small>
                  </button>
                  {/*
                    이 화면은 기기에 남은 기록만 보고 '이어서 걷기'를 띄운다.
                    로그인과 무관하게 동작해야 하기 때문이다(등록 전에도 걸을
                    수 있다). 그 대신 남의 기록이나 지난 검수 기록이 남아 있을
                    때 빠져나올 길이 필요하다.
                  */}
                  <button
                    onClick={handleRestart}
                    className="mt-2 w-full text-center font-mono-retro text-[10px] text-ink-60 underline"
                  >
                    처음부터 시작하기
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStart}
                  className="btn-teal w-full text-center text-[15px]"
                >
                  ▶ 무료로 이야기 열기
                  <small className="mt-0.5 block text-[10px] font-normal opacity-85">
                    이야기와 미션은 전부 무료입니다
                  </small>
                </button>
              )}
            </div>
          </div>
        )}
        <div className="stripe-band" />
      </div>

      <NicknameEditor
        isOpen={showNickname}
        onClose={() => setShowNickname(false)}
      />

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
