'use client'

/**
 * 가게 사용 내역.
 *
 * 사장님이 정산을 믿으려면 스스로 셀 수 있어야 한다. 운영자가 알려주는
 * 숫자만 있으면 "그날 몇 장이었더라"를 확인할 방법이 없다.
 *
 * **부담액만 보여주면 안 된다.** 가게가 "얼마를 냈는가"만 보면 이탈하고,
 * "얼마를 받았는가"를 함께 봐야 유지된다 — 그래서 충당액 옆에 늘 매출
 * 유입액과 방문 수를 나란히 둔다. 이 화면의 배치가 그 원칙이다.
 *
 * 충당률(%)은 여기서만 보인다. 참여자 화면에는 어디에도 없다.
 *
 * 남의 가게 내역은 보이지 않는다. 규칙이 staffUids로 막고, 화면도
 * 계정으로 가게를 찾아온다(주소에 가게를 박지 않는다).
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import {
  CONTRACT_LABEL,
  DEFAULT_SETTLEMENT,
  TIER_LABEL,
  capStatus,
  monthKey,
} from '@/lib/coverage'
import {
  fetchMyShops,
  fetchShopUses,
  stampPending,
  toMerchant,
  type Shop,
  type ShopUse,
} from '@/lib/shops'
import { fetchShopSettlements, type SettlementDoc } from '@/lib/settlement'

const won = (n: number) => `${n.toLocaleString()}원`

export default function ShopHistoryPage() {
  const { profile, loading: authLoading } = useAuth()
  const [shop, setShop] = useState<Shop | null>(null)
  const [uses, setUses] = useState<ShopUse[]>([])
  const [bills, setBills] = useState<SettlementDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!profile?.uid) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    void (async () => {
      try {
        const mine = (await fetchMyShops(profile.uid))[0] ?? null
        if (!alive) return
        setShop(mine)
        if (!mine) return

        /*
          주 경로(손님이 스티커를 직접 찍은 것)가 남긴 기록에는 충당률이
          비어 있다 — 손님 기기는 그 값을 알 수 없다. 율을 아는 기기가
          찍어야 하는데, 그 기기가 이것이다. 화면을 열 때마다 채운다.
        */
        await stampPending(mine).catch(() => null)
        if (!alive) return

        const [list, past] = await Promise.all([
          fetchShopUses(mine.shopId),
          fetchShopSettlements(mine.shopId),
        ])
        if (!alive) return
        setUses(list)
        setBills(past)
      } catch (e) {
        /*
          이 화면이 처음 열릴 때 Firestore가 복합 색인을 요구한다
          (shopId 오름차순 + usedAt 내림차순). 오류 메시지에 만들기 링크가
          들어 있으므로 통째로 보여준다 — 감추면 원인을 찾을 길이 없다.
        */
        if (alive) setErr(e instanceof Error ? e.message : '내역을 불러오지 못했습니다.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [profile?.uid])

  const sum = useMemo(() => {
    const now = new Date()
    const month = monthKey(now)
    const sameDay = (d: Date) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()

    const dated = uses.filter((u) => u.usedAt)
    const thisMonth = dated.filter((u) => monthKey(u.usedAt as Date) === month)

    const m = shop ? toMerchant(shop) : null
    const shopWon = thisMonth.reduce((n, u) => n + u.shopWon, 0)
    const inflow = thisMonth.reduce((n, u) => n + u.amountWon, 0)
    const feeWon = shop?.monthlyFeeWon ?? DEFAULT_SETTLEMENT.monthlyFee[m?.tier ?? 'new']

    return {
      today: dated.filter((u) => sameDay(u.usedAt as Date)).length,
      count: thisMonth.length,
      points: thisMonth.filter((u) => u.kind === 'points').length,
      shopWon,
      inflow,
      feeWon,
      billed: feeWon + Math.min(shopWon, m?.monthlyCapWon ?? shopWon),
      pending: thisMonth.filter((u) => u.coverageRate < 0).length,
      cap: capStatus(shopWon, m?.monthlyCapWon ?? 0),
      merchant: m,
    }
  }, [uses, shop])

  return (
    <div className="flex min-h-screen flex-col bg-cream-base px-5 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <p className="text-center font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          봉황 메모리즈 · 사용 내역
        </p>

        {authLoading || loading ? (
          <p className="mt-16 text-center font-display text-[18px] text-ink-60">
            불러오는 중…
          </p>
        ) : !shop ? (
          <div className="mt-10 rounded-2xl border-2 border-rec bg-rec/10 px-5 py-10 text-center">
            <p className="text-[44px] leading-none" aria-hidden>
              🔒
            </p>
            <p className="mt-4 font-display text-[20px] text-rec">가게 계정이 아닙니다</p>
            <Link
              href="/shop/verify"
              className="mt-4 inline-block text-[13px] text-teal-dk underline underline-offset-2"
            >
              가게 로그인으로
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-2 text-center font-display text-[20px] text-ink">
              {shop.name}
            </h1>
            <p className="mt-1 text-center font-mono-retro text-[10.5px] text-ink-60">
              {TIER_LABEL[sum.merchant?.tier ?? 'new']} · 충당률{' '}
              {sum.merchant?.coverageRate ?? 0}%
              {sum.merchant && sum.merchant.contract !== 'active' && (
                <span className="text-rec"> · {CONTRACT_LABEL[sum.merchant.contract]}</span>
              )}
            </p>

            {/*
              받은 것을 먼저 세운다.

              충당액을 맨 위에 두면 이 화면이 청구서로 읽힌다. 이번 달에
              몇 분이 오셨고 얼마가 결제로 들어왔는지가 먼저 나와야, 그
              아래 부담액이 "그중 얼마"로 읽힌다.
            */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat label="오늘" value={`${sum.today}건`} />
              <Stat label="이번 달" value={`${sum.count}건`} />
              <Stat label="매출 유입" value={won(sum.inflow)} tone="good" />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="가게 부담" value={won(sum.shopWon)} />
              <Stat label="월 회비" value={won(sum.feeWon)} />
              <Stat label="청구 예정" value={won(sum.billed)} tone="bill" />
            </div>

            <p className="mt-2 text-center text-[10.5px] leading-snug text-ink-60">
              손님이 쓰신 <b className="text-ink">{won(sum.inflow)}</b>이 결제로
              들어오고, 그중 <b className="text-ink">{won(sum.shopWon)}</b>을 가게가
              나눠 부담합니다. 나머지는 운영사가 냅니다.
            </p>

            {/* ── 이번 달 상한 ── */}
            {sum.cap.capWon > 0 && (
              <div
                className={`mt-4 rounded-xl border px-3 py-3 ${
                  sum.cap.state === 'closed'
                    ? 'border-rec bg-rec/10'
                    : sum.cap.state === 'alert'
                      ? 'border-sunset-yellow bg-sunset-yellow/15'
                      : 'border-line bg-paper'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">
                    이번 달 부담 상한
                  </span>
                  <span className="font-mono-retro text-[11px] text-ink">
                    {won(sum.cap.usedWon)} / {won(sum.cap.capWon)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream-dp">
                  <div
                    className={`h-2 rounded-full ${
                      sum.cap.state === 'closed'
                        ? 'bg-rec'
                        : sum.cap.state === 'alert'
                          ? 'bg-sunset'
                          : 'bg-teal'
                    }`}
                    style={{ width: `${Math.min(100, sum.cap.percent)}%` }}
                  />
                </div>
                {/*
                  80%를 넘으면 알린다. 다 쓴 뒤에 알면 손님을 돌려보낸 다음이라
                  늦다 — 미리 알아야 상한을 올릴지 이야기할 수 있다.
                */}
                {sum.cap.state === 'alert' && (
                  <p className="mt-2 text-[11.5px] leading-snug text-ink">
                    상한의 {sum.cap.percent}%를 쓰셨습니다. 다 차면 이번 달 남은
                    기간 동안 이 가게에서는 쿠폰·포인트를 쓸 수 없어요.
                    <b className="text-ink"> 상한을 올리시려면 운영사에 알려주세요.</b>
                  </p>
                )}
                {sum.cap.state === 'closed' && (
                  <p className="mt-2 text-[11.5px] leading-snug text-rec">
                    이번 달 상한을 다 쓰셨습니다. 다음 달 1일에 다시 열립니다 —
                    그때까지 손님께는 다른 제휴 매장을 안내해 주세요.
                  </p>
                )}
              </div>
            )}

            {sum.pending > 0 && (
              <p className="mt-3 rounded-xl border border-line bg-cream-dp px-3 py-2 text-[11px] leading-snug text-ink-60">
                아직 정산에 반영되지 않은 기록이 {sum.pending}건 있습니다. 이
                화면을 열면 자동으로 반영되니, 잠시 뒤 새로 고쳐 보세요.
              </p>
            )}

            {err && (
              <p className="mt-4 break-all rounded-xl border border-rec bg-rec/10 px-3 py-2 text-[11px] leading-relaxed text-rec">
                {err}
              </p>
            )}

            {/* ── 지난 청구서 ── */}
            {bills.length > 0 && (
              <>
                <h2 className="mt-7 font-mono-retro text-[11px] tracking-[0.2em] text-ink-60">
                  지난 청구서
                </h2>
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
                  {bills.slice(0, 6).map((b) => (
                    <li key={b.id} className="px-3 py-2.5 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-retro text-ink">{b.month}</span>
                        <span className="font-bold text-ink">
                          {won(b.feeWon + b.coveredWon)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-ink-60">
                        회비 {won(b.feeWon)} + 충당 {won(b.coveredWon)} · 매출 유입{' '}
                        {won(b.inflowWon)} · {b.count}건
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10.5px] leading-relaxed text-ink-60">
                  마감 후 <b className="text-ink">5영업일</b> 안에 이의를 말씀해
                  주세요.
                </p>
              </>
            )}

            <h2 className="mt-7 font-mono-retro text-[11px] tracking-[0.2em] text-ink-60">
              최근 사용
            </h2>
            {uses.length === 0 ? (
              <p className="mt-2 text-[12px] text-ink-60">아직 사용된 혜택이 없어요.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
                {uses.slice(0, 60).map((u) => (
                  <li
                    key={u.code}
                    className="flex items-center gap-2 px-3 py-2.5 text-[12px]"
                  >
                    <span className="flex-1 text-ink">
                      {u.usedAt
                        ? u.usedAt.toLocaleString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '기록 있음'}
                    </span>
                    {/* 포인트는 액면이 매번 다르다 — 금액을 적어야 알아본다 */}
                    <span className="shrink-0 font-mono-retro text-[11px] text-ink">
                      {u.amountWon > 0 ? won(u.amountWon) : '—'}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono-retro text-[10px] ${
                        u.kind === 'points'
                          ? 'bg-teal/15 text-teal-dk'
                          : 'bg-cream-dp text-ink-60'
                      }`}
                    >
                      {u.kind === 'points' ? '포인트' : '쿠폰'}
                    </span>
                    {/*
                      직접/대리를 구분해 둔다. 한 가게 기록이 전부 '대리'로
                      쌓이면 손님이 오지 않았는데 처리한 것일 수 있다 —
                      관리자 정산 화면도 이 비율을 본다.
                    */}
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono-retro text-[10px] ${
                        u.via === 'guest'
                          ? 'bg-teal/15 text-teal-dk'
                          : 'bg-sunset-yellow/25 text-ink-60'
                      }`}
                    >
                      {u.via === 'guest' ? '직접' : '대리'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href="/shop/verify"
              className="mt-6 block w-full rounded-xl border border-line bg-paper py-3 text-center text-[13px] font-bold text-ink"
            >
              쿠폰·포인트 확인 화면으로
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: string
  tone?: 'plain' | 'good' | 'bill'
}) {
  const color =
    tone === 'good' ? 'text-teal-dk' : tone === 'bill' ? 'text-rec' : 'text-ink'
  return (
    <div className="rounded-xl border border-line bg-paper px-2 py-3 text-center">
      <p className="font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">{label}</p>
      <p className={`mt-1 font-display text-[15px] ${color}`}>{value}</p>
    </div>
  )
}
