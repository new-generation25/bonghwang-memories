'use client'

/**
 * 내 포인트 카드.
 *
 * 로컬 원장을 먼저 그리고, 로그인돼 있으면 서버 값으로 덮어쓴다. 골목에서
 * 신호가 끊겨도 점수가 0으로 보이지 않게 하려는 것이다 — 걷는 도중에 보는
 * 화면이라 로딩 스피너를 오래 띄우면 안 된다.
 *
 * 서버 합계가 로컬보다 크면 서버를 쓴다(다른 기기에서 걸은 기록). 반대로
 * 로컬이 크면 아직 안 올라간 적립이 있다는 뜻이라 로컬을 쓴다.
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  PointEntry,
  PointReason,
  REASON_LABEL,
  POINTS_EVENT,
  ep2Discount,
  fetchPointHistory,
  localPointHistory,
} from '@/lib/points'

const ORDER: PointReason[] = [
  'mainMission',
  'bonusMission',
  'treasureLine',
  'specialMission',
  'shareRecord',
  'survey',
  'campaign',
]

export default function MyPoints({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<PointEntry[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const local = localPointHistory()
    setEntries(local)

    if (!profile?.uid) return
    try {
      const remote = await fetchPointHistory(profile.uid)
      const localSum = local.reduce((a, p) => a + p.points, 0)
      const remoteSum = remote.reduce((a, p) => a + p.points, 0)
      if (remoteSum >= localSum) setEntries(remote)
    } catch {
      /* 서버를 못 읽으면 로컬 그대로 둔다 */
    }
  }, [profile?.uid])

  useEffect(() => {
    load()
    const onAward = () => setEntries(localPointHistory())
    window.addEventListener(POINTS_EVENT, onAward)
    return () => window.removeEventListener(POINTS_EVENT, onAward)
  }, [load])

  // localStorage를 렌더 중에 읽으면 서버(0)와 클라이언트(실제 점수)가 달라져
  // 히드레이션이 깨진다. 값은 반드시 useEffect로 들어온 state에서만 읽는다.
  const total = entries.reduce((a, p) => a + p.points, 0)
  const byReason = ORDER.map((reason) => {
    const list = entries.filter((e) => e.reason === reason)
    return { reason, count: list.length, sum: list.reduce((a, p) => a + p.points, 0) }
  }).filter((r) => r.count > 0)

  const ep2 = ep2Discount(total)

  return (
    <div className="card-paper mb-5 overflow-hidden shadow-lg">
      <div className="stripe-rule" />
      <div className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-vintage text-sm font-black text-teal-dk">
              🎟️ 내 포인트
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-60">
              {profile
                ? '기록이 저장되고 있어요'
                : '로그인하면 다른 기기에서도 이어집니다'}
            </p>
          </div>
          <span className="font-display text-[30px] leading-none text-teal">
            {total.toLocaleString()}
            <span className="ml-0.5 text-[14px]">P</span>
          </span>
        </div>

        {/* EP.2 할인 — 지금 단계에서 포인트가 실제로 바뀌는 유일한 통로 */}
        <div className="mt-3 rounded-lg border border-sunset-yellow bg-cream-base/60 p-3">
          {ep2.discount > 0 ? (
            <p className="text-[12.5px] leading-snug text-ink">
              EP.2 예약 시{' '}
              <b className="text-rec">{ep2.discount.toLocaleString()}원 할인</b>{' '}
              적용돼요
              {ep2.toNext !== null && (
                <span className="mt-0.5 block text-[11px] text-ink-60">
                  {ep2.toNext.toLocaleString()}P 더 모으면{' '}
                  {ep2.nextDiscount?.toLocaleString()}원 할인
                </span>
              )}
            </p>
          ) : (
            <p className="text-[12.5px] leading-snug text-ink-60">
              {ep2.toNext?.toLocaleString()}P 더 모으면 EP.2 예약{' '}
              <b className="text-ink">{ep2.nextDiscount?.toLocaleString()}원 할인</b>
            </p>
          )}
        </div>

        {!compact && byReason.length > 0 && (
          <>
            <button
              onClick={() => setOpen((v) => !v)}
              className="mt-3 w-full text-left font-mono-retro text-[10.5px] text-ink-60"
            >
              적립 내역 {open ? '접기 ▲' : `보기 ▼ (${entries.length}건)`}
            </button>
            {open && (
              <ul className="mt-2 space-y-1.5">
                {byReason.map((r) => (
                  <li
                    key={r.reason}
                    className="flex items-center justify-between text-[12px]"
                  >
                    <span className="text-ink">
                      {REASON_LABEL[r.reason]}
                      <span className="ml-1 text-ink-60">×{r.count}</span>
                    </span>
                    <span className="font-display text-teal">
                      +{r.sum.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {total === 0 && (
          <p className="mt-3 text-center text-[12px] text-ink-60">
            미션을 완주하면 포인트가 쌓입니다
          </p>
        )}
      </div>
    </div>
  )
}
