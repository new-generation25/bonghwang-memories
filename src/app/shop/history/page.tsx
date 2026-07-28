'use client'

/**
 * 가게 사용 내역.
 *
 * 사장님이 정산을 믿으려면 스스로 셀 수 있어야 한다. 운영자가 알려주는
 * 숫자만 있으면 "그날 몇 장이었더라"를 확인할 방법이 없다.
 *
 * 큰 숫자 셋만 위에 둔다 — 오늘 · 이번 달 · 이번 달 정산 예정액.
 * 그 아래 목록은 확인용이라 작게 둔다.
 *
 * 남의 가게 내역은 보이지 않는다. 규칙이 staffUids로 막고, 화면도
 * 계정으로 가게를 찾아온다(주소에 가게를 박지 않는다).
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { fetchMyShops, fetchShopUses, type Shop, type ShopUse } from '@/lib/shops'

export default function ShopHistoryPage() {
  const { profile, loading: authLoading } = useAuth()
  const [shop, setShop] = useState<Shop | null>(null)
  const [uses, setUses] = useState<ShopUse[]>([])
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
        if (mine) setUses(await fetchShopUses(mine.shopId))
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
    const sameDay = (d: Date) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    const sameMonth = (d: Date) =>
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()

    const dated = uses.filter((u) => u.usedAt)
    const today = dated.filter((u) => sameDay(u.usedAt as Date)).length
    const month = dated.filter((u) => sameMonth(u.usedAt as Date)).length
    return { today, month, won: month * (shop?.unitWon ?? 0) }
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

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat label="오늘" value={`${sum.today}장`} />
              <Stat label="이번 달" value={`${sum.month}장`} />
              <Stat label="정산 예정" value={`${sum.won.toLocaleString()}원`} />
            </div>

            <p className="mt-2 text-center text-[10.5px] leading-snug text-ink-60">
              쿠폰 한 장 {shop.unitWon.toLocaleString()}원 기준입니다.
            </p>

            {err && (
              <p className="mt-4 break-all rounded-xl border border-rec bg-rec/10 px-3 py-2 text-[11px] leading-relaxed text-rec">
                {err}
              </p>
            )}

            <h2 className="mt-7 font-mono-retro text-[11px] tracking-[0.2em] text-ink-60">
              최근 사용
            </h2>
            {uses.length === 0 ? (
              <p className="mt-2 text-[12px] text-ink-60">아직 사용된 쿠폰이 없어요.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
                {uses.map((u) => (
                  <li
                    key={u.code}
                    className="flex items-center gap-3 px-3 py-2.5 text-[12px]"
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
                    <span className="font-mono-retro text-[11px] text-ink-60">
                      …{u.code.slice(-4)}
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
              쿠폰 확인 화면으로
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-2 py-3 text-center">
      <p className="font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">{label}</p>
      <p className="mt-1 font-display text-[17px] text-ink">{value}</p>
    </div>
  )
}
