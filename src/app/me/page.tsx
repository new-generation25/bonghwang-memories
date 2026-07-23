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
import SettingsSheet from '@/components/SettingsSheet'
import { couponSpec } from '@/lib/coupons'
import { useAuth } from '@/contexts/AuthContext'
import { useTourState } from '@/hooks/useTourState'
import {
  localPointHistory,
  POINTS_EVENT,
  REASON_LABEL,
  type PointEntry,
} from '@/lib/points'
import { TRACK_STATIONS } from '@/lib/tracks'
import { formatElapsed } from '@/lib/tourState'

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

  const doneCount = tour.tracksCompleted.length
  const recent = [...history].reverse().slice(0, 12)

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

        {/* 투어 진행도 */}
        <div className="card-paper mb-5 overflow-hidden shadow-lg">
          <div className="stripe-rule" />
          <div className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-vintage text-sm font-black text-teal-dk">
                📼 투어 진행도
              </h2>
              <span className="font-mono-retro text-[10px] text-ink-60">
                {doneCount} / 5 · {formatElapsed(tour.startTime)}
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              {TRACK_STATIONS.map((station) => {
                const done = tour.tracksCompleted.includes(station.track)
                return (
                  <div key={station.id} className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                        done ? 'bg-teal text-cream' : 'bg-line text-ink-60'
                      }`}
                    >
                      {done ? '✓' : station.track}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {station.wish}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-60">
                      {station.name}
                    </span>
                  </div>
                )
              })}
            </div>

            {tour.bingo.unlocked && (
              <p className="mt-3 border-t border-line pt-2 font-mono-retro text-[11px] text-ink-60">
                골목 빙고 {tour.bingo.cellsDone.length}칸 · {tour.bingo.lines}줄
              </p>
            )}
          </div>
        </div>

        {/* 쿠폰 */}
        <div className="card-paper mb-5 p-4 shadow-lg">
          <h2 className="font-vintage text-sm font-black text-teal-dk">
            🎟 받은 쿠폰
          </h2>
          {tour.coupons.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-60">
              아직 받은 쿠폰이 없어요 — 소원을 이루면 이야기가게 쿠폰이 쌓입니다.
            </p>
          ) : (
            /*
              쿠폰 코드만 늘어놓던 것을 실제로 쓸 수 있는 카드로 바꿨다.
              'cp1'이라는 글자를 가게에 보여줄 수는 없다 — 어느 가게에서
              무엇을 받는지, 그리고 찍을 QR이 있어야 쿠폰 구실을 한다.
            */
            <div className="mt-2">
              {tour.coupons.map((c) => {
                const spec = couponSpec(c)
                if (!spec) return null
                return <CouponCard key={c} spec={spec} uid={couponUid} />
              })}
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
