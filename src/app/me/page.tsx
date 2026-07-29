'use client'

/**
 * 나의 기록 — 개인 화면.
 *
 * '소영의 친구들'은 다른 사람과 만나는 광장이고, 여기는 내 것만 모은다.
 * 포인트·적립 내역·쿠폰·투어 진행도가 섞여 있으면 광장이 대시보드처럼
 * 보여서 둘을 갈랐다.
 *
 * 로그인하지 않아도 볼 수 있다 — 투어는 등록 없이도 걸을 수 있고,
 * 그때 쌓인 포인트는 로컬에 남았다가 로그인 시 서버로 올라간다.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import MyPoints from '@/components/MyPoints'
import AuthModal from '@/components/AuthModal'
import CouponCard from '@/components/CouponCard'
import JCard from '@/components/JCard'
import SettingsSheet from '@/components/SettingsSheet'
import { couponSpec } from '@/lib/coupons'
import { gachaSeed, prizesOf } from '@/lib/gacha'
import { useAuth } from '@/contexts/AuthContext'
import { useTourState } from '@/hooks/useTourState'
import {
  localPointHistory,
  POINTS_EVENT,
  REASON_LABEL,
  type PointEntry,
} from '@/lib/points'

export default function MyRecordPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const tour = useTourState()
  const [history, setHistory] = useState<PointEntry[]>([])
  const [showAuth, setShowAuth] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  /*
    쿠폰 코드의 사용자 부분.
    로그인 전에도 투어를 걸을 수 있으므로 uid가 없을 수 있다. 그때는
    기기에 남는 투어 시작 시각으로 대신한다 — 같은 기기에서는 같은 코드가
    나오고, 다른 참여자와 겹치지도 않는다.
  */
  const couponUid = profile?.uid ?? `local-${tour.startTime ?? 0}`

  // 적립은 화면을 보는 중에도 일어난다(설문 응답 등) — 이벤트로 따라간다
  useEffect(() => {
    const sync = () => setHistory(localPointHistory())
    sync()
    window.addEventListener(POINTS_EVENT, sync)
    return () => window.removeEventListener(POINTS_EVENT, sync)
  }, [])

  const recent = [...history].reverse().slice(0, 12)
  /*
    지갑 한 자리.

    거점 쿠폰과 뽑기 쿠폰을 나란히 둔다 — 참여자에게는 '받은 쿠폰'이
    한 종류이고, 다른 것은 쓰는 곳뿐이다. 카드마다 그 곳이 적혀 있다.

    뽑기 쿠폰은 칸 번호를 발급 순번으로 쓴다. 같은 쿠폰이 두 칸에서
    나와도 코드가 갈려, 한 장을 써도 나머지가 살아 있다.

    판 배치가 계정마다 다르므로 시드가 같아야 같은 상품이 나온다 —
    쿠폰 코드가 쓰는 것과 같은 값이다(로그인 전에는 기기의 투어 시작 시각).
  */
  const seed = gachaSeed(profile?.uid, tour.startTime)
  const wallet = [
    ...tour.coupons.map((id) => ({ key: id, spec: couponSpec(id), serial: undefined as number | undefined })),
    ...tour.gachaDrawn.map((slot) => {
      const prize = prizesOf(seed, [slot])[0]
      return {
        key: `g${slot}`,
        spec: prize?.kind === 'coupon' && prize.couponId ? couponSpec(prize.couponId) : null,
        serial: slot,
      }
    }),
  ].filter((x) => x.spec)
  /** 뽑기로 받은 포인트 — 지갑이 아니라 적립 내역에 남는 것들 */
  const pointPrizes = prizesOf(seed, tour.gachaDrawn).filter((p) => p.kind === 'points')

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">BONGHWANG MEMORIES · 나의 기록</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">나의 기록</h1>
            {!authLoading &&
              (profile ? (
                <button
                  onClick={() => setShowSettings(true)}
                  aria-label="내 설정 열기"
                  className="flex shrink-0 items-center gap-1 rounded-full bg-cream/20 px-3 py-1 text-[11px] font-bold"
                >
                  <span aria-hidden>⚙️</span>
                  {profile.nickname} 기록자
                </button>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="shrink-0 rounded-full bg-cream/20 px-3 py-1 text-[11px] font-bold"
                >
                  로그인
                </button>
              ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-5">
        {/* 포인트 — 이 화면의 주인공 */}
        <MyPoints />

        {/* 로그인 안내 — 기록이 이 기기에만 있다는 사실을 알린다 */}
        {!profile && !authLoading && (
          <div className="card-paper mb-5 p-4 text-center">
            <p className="text-[12px] leading-relaxed text-ink-60">
              지금 기록은 <b className="text-ink">이 기기에만</b> 저장돼 있어요.
              <br />
              로그인하면 계정에 안전하게 보관되고, 다른 기기에서도 이어집니다.
            </p>
            <button
              onClick={() => setShowAuth(true)}
              className="btn-teal mt-3 w-full py-2.5 text-[13px]"
            >
              ▶ 기록자로 로그인
            </button>
          </div>
        )}

        {/* J-카드 — 케이스 속지의 다섯 소원(F-1)이 곧 진행도다.
            같은 다섯 줄을 진행도 카드로 또 보여주면 화면이 두 번 말한다 —
            경과 시간·빙고 요약까지 J-카드가 흡수했다. */}
        <div className="mb-5">
          <JCard />
        </div>

        {/*
          뽑기로 받은 포인트. 쿠폰은 아래 지갑에 함께 들어가고, 포인트만
          여기 남는다 — 쓸 곳이 앱 안이라 가게에 내밀 물건이 아니다.
        */}
        {pointPrizes.length > 0 && (
          <div className="card-paper mb-5 p-4 shadow-lg">
            <h2 className="font-vintage text-sm font-black text-teal-dk">
              🎁 뽑기로 받은 포인트
            </h2>
            <ul className="mt-2 space-y-1.5">
              {pointPrizes.map((prize, i) => (
                <li key={`${prize.id}-${i}`} className="flex items-center gap-2.5">
                  <span className="text-[18px]" aria-hidden>
                    {prize.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                    {prize.name}
                  </span>
                  <span className="shrink-0 font-mono-retro text-[10px] text-ink-60">
                    적립됨
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 쿠폰 */}
        <div className="card-paper mb-5 p-4 shadow-lg">
          <h2 className="font-vintage text-sm font-black text-teal-dk">
            🎟 받은 쿠폰
          </h2>
          {wallet.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-60">
              아직 받은 쿠폰이 없어요 — 빙고 한 줄을 채우면 「뽑기 한판」이
              생기고, 판을 열면 쿠폰이 나옵니다.
            </p>
          ) : (
            /*
              쿠폰 코드만 늘어놓던 것을 실제로 쓸 수 있는 카드로 바꿨다.
              'cp1'이라는 글자를 가게에 보여줄 수는 없다 — 어느 가게에서
              무엇을 받는지, 그리고 찍을 QR이 있어야 쿠폰 구실을 한다.
            */
            <div className="mt-2">
              {wallet.map((item) => (
                <CouponCard
                  key={item.key}
                  spec={item.spec!}
                  uid={couponUid}
                  signedIn={Boolean(profile?.uid)}
                  fixedSerial={item.serial}
                />
              ))}
            </div>
          )}
        </div>

        {/* 적립 내역 */}
        <div className="card-paper p-4 shadow-lg">
          <h2 className="font-vintage text-sm font-black text-teal-dk">
            🧾 포인트 적립 내역
          </h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-60">
              아직 적립 내역이 없어요.
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {recent.map((entry) => (
                <li
                  key={entry.refId}
                  className="flex items-center gap-2 border-b border-line/60 py-1.5 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                    {REASON_LABEL[entry.reason] ?? entry.reason}
                  </span>
                  <span className="shrink-0 font-mono-retro text-[12px] text-teal">
                    +{entry.points}P
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => router.push('/community')}
          className="mt-5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13px] font-bold text-teal-dk"
        >
          👥 소영의 친구들 보러 가기
        </button>
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => setShowAuth(false)}
      />

      <SettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <Navigation />
    </div>
  )
}
