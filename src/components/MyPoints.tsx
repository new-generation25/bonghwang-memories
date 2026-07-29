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
import { useTourState } from '@/hooks/useTourState'
import {
  PointEntry,
  PointReason,
  REASON_LABEL,
  POINTS_EVENT,
  POINT_RULES,
  fetchPointHistory,
  localPointHistory,
  pointWallet,
} from '@/lib/points'
import PointRedeemSheet from '@/components/PointRedeemSheet'

const ORDER: PointReason[] = [
  'mainMission',
  'bonusMission',
  'treasureLine',
  'specialMission',
  'shareRecord',
  'survey',
  'campaign',
  'gacha',
]

export default function MyPoints({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth()
  const tour = useTourState()
  const [entries, setEntries] = useState<PointEntry[]>([])
  const [open, setOpen] = useState(false)
  const [redeeming, setRedeeming] = useState(false)

  /*
    로그인 전에도 쓸 수 있어야 한다 — 쿠폰이 그렇기 때문이다.

    한쪽만 로그인을 요구하면 카운터에서 "쿠폰은 되는데 포인트는 왜
    안 되냐"가 된다. 그리고 애초에 코스를 결제하지 않고 보너스 미션만
    하는 인근 주민의 동선을 막지 않기로 했는데, 그 사람에게 쓰는 자리에서
    로그인을 요구하면 결국 막는 것과 같다.

    로그인 전에는 기기의 투어 시작 시각으로 코드를 만든다(쿠폰과 같은 값).
    적립도 사용도 이 기기의 원장에만 남고, 로그인하면 한꺼번에 올라간다.
  */
  const pointUid = profile?.uid ?? `local-${tour.startTime ?? 0}`

  const load = useCallback(async () => {
    const local = localPointHistory()
    setEntries(local)

    if (!profile?.uid) return
    try {
      const remote = await fetchPointHistory(profile.uid)
      /*
        견줄 때도 **살아 있는 점수만** 센다.

        원장을 통째로 더하면 소멸한 적립이 로컬 쪽 무게를 부풀려, 서버에
        더 많은 기록이 있어도 로컬을 고른다. 오래 쉬었다 돌아온 사람일수록
        죽은 점수가 많아 이 실수가 커진다.
      */
      if (pointWallet(remote).total >= pointWallet(local).total) {
        setEntries(remote)
      }
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
  const wallet = pointWallet(entries)
  const total = wallet.total
  const byReason = ORDER.map((reason) => {
    const list = entries.filter((e) => e.reason === reason)
    return { reason, count: list.length, sum: list.reduce((a, p) => a + p.points, 0) }
  }).filter((r) => r.count > 0)

  const expiryText = wallet.nextExpiry
    ? new Date(wallet.nextExpiry).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="card-paper mb-5 overflow-hidden shadow-lg">
      <div className="stripe-rule" />
      <div className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-vintage text-sm font-black text-teal-dk">
              🎟️ 봉황 포인트
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-60">
              {profile
                ? '기록이 저장되고 있어요'
                : '로그인하면 다른 기기에서도 이어집니다'}
            </p>
          </div>
          {/* 1p = 1원이라 환산을 나란히 둔다 — 참여자가 계산하지 않게 */}
          <div className="text-right">
            <span className="block font-display text-[30px] leading-none text-teal">
              {total.toLocaleString()}
              <span className="ml-0.5 text-[14px]">P</span>
            </span>
            <span className="mt-0.5 block font-mono-retro text-[10.5px] text-ink-60">
              = {wallet.won.toLocaleString()}원
            </span>
          </div>
        </div>

        {/*
          쓸 수 있는지부터 말한다.

          문턱(3,000P)을 넘기 전에는 얼마가 모자란지가 유일하게 쓸모 있는
          정보다. 넘은 뒤에는 어디서 쓰는지가 그렇다.
        */}
        <div className="mt-3 rounded-lg border border-sunset-yellow bg-cream-base/60 p-3">
          {wallet.redeemable ? (
            <>
              <p className="text-[12.5px] leading-snug text-ink">
                제휴 가맹점에서{' '}
                <b className="text-rec">{wallet.won.toLocaleString()}원</b>처럼
                쓸 수 있어요
                <span className="mt-0.5 block text-[11px] text-ink-60">
                  가게 카운터의 스티커를 찍으면 결제 금액에서 빠져요 · 1P = 1원
                </span>
              </p>
              {/*
                쓰는 길을 화면에 둔다. 예전에는 "쓸 수 있어요"라고만 적혀
                있어서, 정작 카운터 앞에 선 사람이 무엇을 눌러야 하는지
                알 수 없었다 — 쿠폰은 지갑에 QR이 있는데 포인트는 없었다.
              */}
              <button
                onClick={() => setRedeeming(true)}
                className="btn-teal mt-2.5 w-full text-center text-[13px]"
              >
                가게에서 사용하기
              </button>
              {!profile?.uid && (
                <p className="mt-1.5 text-center text-[10.5px] text-ink-60">
                  로그인하면 다른 기기에서도 이어집니다
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[12.5px] leading-snug text-ink-60">
                <b className="text-ink">
                  {wallet.toThreshold.toLocaleString()}P
                </b>{' '}
                더 모으면 제휴 가맹점에서 쓸 수 있어요
              </p>
              {/* 남은 거리를 눈으로 — 숫자만으로는 얼마나 왔는지 모른다 */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream-dp">
                <div
                  className="h-2 rounded-full bg-sunset transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (total / POINT_RULES.minRedeem) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 font-mono-retro text-[10px] text-ink-60">
                {total.toLocaleString()} / {POINT_RULES.minRedeem.toLocaleString()}P
              </p>
            </>
          )}
        </div>

        {/* 소멸은 미리 알려야 한다 — 사라진 뒤에 알면 이월도 못 한다 */}
        {expiryText && (
          <p className="mt-2 font-mono-retro text-[10px] text-ink-60">
            적립일부터 {POINT_RULES.expiryMonths}개월 · 가장 이른 소멸 {expiryText}
          </p>
        )}

        {/* 쓴 몫은 따로 적는다 — 합계만 줄어 있으면 "왜 줄었지"가 된다 */}
        {wallet.spent > 0 && (
          <p className="mt-1 font-mono-retro text-[10px] text-ink-60">
            지금까지 가게에서 사용 {wallet.spent.toLocaleString()}P
          </p>
        )}

        {!compact && byReason.length > 0 && (
          <>
            <button
              onClick={() => setOpen((v) => !v)}
              className="mt-3 w-full text-left font-mono-retro text-[10.5px] text-ink-60"
            >
              적립 내역{' '}
              {open
                ? '접기 ▲'
                : `보기 ▼ (${byReason.reduce((n, r) => n + r.count, 0)}건)`}
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

      {redeeming && (
        <PointRedeemSheet
          uid={pointUid}
          available={total}
          onClose={() => setRedeeming(false)}
          onRedeemed={() => {
            setEntries(localPointHistory())
            void load()
          }}
        />
      )}
    </div>
  )
}
