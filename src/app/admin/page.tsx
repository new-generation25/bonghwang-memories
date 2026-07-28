'use client'

/**
 * 관리자 콘트롤 패널.
 *
 * 접근은 구글 로그인 이메일로 판정한다(admin.ts / firestore.rules 동일 기준).
 * 화면 차단은 편의일 뿐이고 실제 방어는 규칙이다 — 여기를 우회해도
 * Firestore가 남의 데이터를 내주지 않는다.
 *
 * 집계는 클라이언트에서 한다. users를 한 번 읽어 메모리에서 계산하므로
 * 수백~수천 명까지는 충분하다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { BINGO_CELLS } from '@/lib/bingoCells'
import { REASON_LABEL, PointReason } from '@/lib/points'
import { DEFAULT_SURVEY } from '@/lib/survey'
import { COUPONS, couponSpec } from '@/lib/coupons'
import { addShop, fetchAllShops, setShopActive, type Shop } from '@/lib/shops'
import {
  AdminCouponUse,
  AdminEvent,
  AdminPointEntry,
  AdminPost,
  AdminSurveyResponse,
  AdminUser,
  TICKET_PRICE,
  adminUids,
  averageDurationMin,
  cellPopularity,
  eventBreakdown,
  excludeAdmins,
  fetchAllPoints,
  fetchCouponUses,
  fetchEvents,
  fetchPosts,
  fetchSurveyResponses,
  fetchUsers,
  funnel,
  hourlyStarts,
  isAdminUser,
  periodStats,
  shopSettlement,
  surveySummary,
} from '@/lib/admin'

const won = (n: number) => `${n.toLocaleString()}원`

export default function AdminPage() {
  const { profile, loading } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [points, setPoints] = useState<AdminPointEntry[]>([])
  const [responses, setResponses] = useState<AdminSurveyResponse[]>([])
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [couponUses, setCouponUses] = useState<AdminCouponUse[]>([])
  const [events, setEvents] = useState<AdminEvent[]>([])
  /*
    가게 문서 심기. postToken이 들어 있어 코드에 박아둘 수 없고(번들은 누구나
    읽는다), 콘솔 붙여넣기는 크롬이 막는다. 그래서 여기서 받는다.
  */
  const [shops, setShops] = useState<Shop[]>([])
  /** 가게 추가 폼 — 쿠폰을 고르면 카탈로그 값이 미리 채워진다 */
  const [acc, setAcc] = useState({
    shopId: '',
    loginId: '',
    password: '',
    name: '',
    benefit: '',
    unitWon: 0,
  })
  const [accMsg, setAccMsg] = useState('')
  const [accBusy, setAccBusy] = useState(false)
  /*
    등록 칸은 접어둔다. 평소에 보는 것은 목록이고, 가게를 새로 넣는 일은
    개업 때 한 번이다 — 늘 펼쳐두면 정작 봐야 할 표가 아래로 밀린다.
  */
  const [panel, setPanel] = useState<'none' | 'shop' | 'account'>('none')

  const loadShops = useCallback(async () => {
    try {
      setShops(await fetchAllShops())
    } catch {
      setShops([])
    }
  }, [])
  const [state, setState] = useState<
    'idle' | 'loading' | 'ready' | 'denied' | 'error'
  >('idle')
  const [errorMsg, setErrorMsg] = useState('')
  // 관리자 기록도 참여자와 똑같이 남는다. 지우지 않고 여기서만 뺀다.
  // 기본이 '제외'인 이유는 실수의 방향이다 — 포함이 기본이면 누를 때까지
  // 틀린 숫자가 보이고, 그대로 사업자에게 보여주게 된다.
  const [includeAdmin, setIncludeAdmin] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const [u, p, r, po, cu, ev] = await Promise.all([
        fetchUsers(),
        fetchAllPoints(),
        fetchSurveyResponses(),
        fetchPosts(),
        fetchCouponUses(),
        fetchEvents(),
      ])
      setUsers(u)
      setPoints(p)
      setResponses(r)
      setPosts(po)
      setCouponUses(cu)
      setEvents(ev)
      void loadShops()
      setState('ready')
    } catch (err) {
      // 규칙을 아직 게시하지 않았으면 users 읽기가 권한 거부로 떨어진다.
      // 잡지 않으면 화면이 "불러오는 중…"에서 영영 멈춰 원인을 알 수 없다.
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }, [loadShops])

  useEffect(() => {
    if (loading) return
    if (!isAdminUser()) {
      setState('denied')
      return
    }
    void load()
  }, [loading, profile, load])

  /** 관리자 계정 수 — 뺄 것이 없으면 띠를 띄우지 않는다 */
  const adminCount = useMemo(() => adminUids(users).size, [users])

  /**
   * 집계에 넣을 자료. 관리자 기록을 뺀 뒤 넘긴다.
   *
   * 여기 한 곳에서만 거른다. 아래 집계 함수들은 무엇이 걸러졌는지 모른 채
   * 받은 배열만 계산한다 — 새 지표를 추가해도 거르는 것을 잊을 자리가 없다.
   */
  const view = useMemo(() => {
    const all = { users, points, responses, posts }
    return includeAdmin ? all : excludeAdmins(all)
  }, [users, points, responses, posts, includeAdmin])

  /*
    계측 이벤트는 view(excludeAdmins)를 안 탄다 — 그 함수는 users·points류만
    알아서, 여기서 같은 기준(adminUids)으로 거른다.
  */
  const eventRows = useMemo(() => {
    const admins = adminUids(users)
    const src = includeAdmin ? events : events.filter((e) => !admins.has(e.uid))
    return eventBreakdown(src)
  }, [events, users, includeAdmin])

  const stats = useMemo(() => periodStats(view.users), [view])
  const steps = useMemo(() => funnel(view.users), [view])
  const popular = useMemo(() => cellPopularity(view.points), [view])
  const hours = useMemo(() => hourlyStarts(view.users), [view])
  const avgMin = useMemo(() => averageDurationMin(view.users), [view])
  const survey = useMemo(() => surveySummary(view.responses), [view])
  const ranking = useMemo(
    () =>
      [...view.users]
        .filter((u) => u.totalPoints > 0)
        .sort((a, b) => b.totalPoints - a.totalPoints),
    [view]
  )
  /*
    가게 정산은 관리자 기록을 거르지 않는다. 슈퍼관리자 코드(BH1T)는
    애초에 사용 기록이 남지 않고, 남은 것은 실제로 가게에서 찍힌 것뿐이라
    빼면 오히려 돌려드릴 금액이 줄어든다.
  */
  const settlement = useMemo(() => shopSettlement(couponUses), [couponUses])
  const settlementTotal = useMemo(
    () => settlement.reduce((n, r) => n + r.won, 0),
    [settlement]
  )

  const pointsByReason = useMemo(() => {
    const out: Record<string, { count: number; sum: number }> = {}
    for (const p of view.points) {
      out[p.reason] = out[p.reason] ?? { count: 0, sum: 0 }
      out[p.reason].count++
      out[p.reason].sum += p.points
    }
    return out
  }, [view])

  if (loading || state === 'idle' || state === 'loading') {
    return <Shell><p className="text-[13px] text-ink-60">불러오는 중…</p></Shell>
  }

  if (state === 'error') {
    return (
      <Shell>
        <div className="card-paper p-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="mt-2 font-display text-[17px] text-ink">
            데이터를 읽지 못했습니다
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
            firestore.rules가 아직 게시되지 않았을 수 있습니다. 콘솔에서
            규칙을 게시한 뒤 다시 시도해주세요.
          </p>
          <p className="mt-2 break-all font-mono-retro text-[10px] text-ink-60">
            {errorMsg}
          </p>
          <button onClick={load} className="btn-teal mt-4 px-5 text-[14px]">
            다시 시도
          </button>
        </div>
      </Shell>
    )
  }

  if (state === 'denied') {
    return (
      <Shell>
        <div className="card-paper p-6 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="mt-2 font-display text-[17px] text-ink">관리자 전용</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
            {profile
              ? '이 계정에는 권한이 없습니다. 관리자 구글 계정으로 로그인해주세요.'
              : '구글 계정으로 로그인해주세요.'}
          </p>
          <Link href="/" className="btn-teal mt-4 inline-block px-5 text-[14px]">
            홈으로
          </Link>
        </div>
      </Shell>
    )
  }

  const paidCount = view.users.filter((u) => u.paid).length
  const totalRevenue = paidCount * TICKET_PRICE

  return (
    <Shell onRefresh={load}>
      {/* ───── 관리자 데이터 제외 ───── */}
      {adminCount > 0 && (
        <button
          onClick={() => setIncludeAdmin((v) => !v)}
          className={`mb-4 flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left ${
            includeAdmin
              ? 'border-rec/40 bg-rec/5'
              : 'border-line bg-paper'
          }`}
        >
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-ink">
              {includeAdmin
                ? '관리자 데이터 포함됨'
                : `관리자 데이터 제외됨 · ${adminCount}명`}
            </span>
            <span className="block text-[11px] text-ink-60">
              {includeAdmin
                ? '시험 삼아 만든 기록이 숫자에 섞여 있습니다'
                : '기록은 남아 있습니다 — 눌러서 볼 수 있습니다'}
            </span>
          </span>
          <span
            className={`ml-3 shrink-0 rounded-lg px-2.5 py-1 font-mono-retro text-[10.5px] tracking-wider ${
              includeAdmin ? 'bg-rec text-cream' : 'bg-cream-dp text-ink-60'
            }`}
          >
            {includeAdmin ? '제외하기' : '포함해서 보기'}
          </span>
        </button>
      )}

      {/* ───── 기간별 참여·매출 ───── */}
      <Section title="참여 · 매출" hint="결제 완료 기준">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-paper p-3">
              <p className="font-mono-retro text-[10px] tracking-wider text-teal">{s.label}</p>
              <p className="mt-1 font-display text-[20px] text-ink">{s.participants}팀</p>
              <p className="text-[11px] text-ink-60">{won(s.revenue)}</p>
              <p className="mt-1 text-[11px] text-ink-60">
                완주 {s.finished}팀 · {s.finishRate}%
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Metric label="누적 참여" value={`${paidCount}팀`} />
          <Metric label="누적 매출" value={won(totalRevenue)} />
          <Metric label="평균 소요" value={avgMin ? `${avgMin}분` : '—'} />
        </div>
      </Section>

      {/* ───── 이탈 지점 ───── */}
      <Section title="진행 퍼널" hint="어디서 멈추는지 — 안내를 보강할 지점">
        {steps.map((s, i) => {
          const base = steps[0].count || 1
          const pct = Math.round((s.count / base) * 100)
          const drop = i > 0 ? steps[i - 1].count - s.count : 0
          return (
            <div key={s.label} className="mt-1.5 first:mt-0">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-ink">{s.label}</span>
                <span className="font-mono-retro text-ink-60">
                  {s.count}팀 · {pct}%
                  {drop > 0 && <span className="ml-1.5 text-rec">−{drop}</span>}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-cream-dp">
                <div className="h-2 rounded-full bg-teal" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </Section>

      {/* ───── 계측 이벤트 (F-7) ───── */}
      <Section
        title="계측 이벤트"
        hint="투어 순서대로 — 인원이 뚝 떨어지는 단계가 막힘 지점"
      >
        {eventRows.length === 0 ? (
          <Empty>아직 수집된 이벤트가 없습니다.</Empty>
        ) : (
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-ink-60">
                <th className="py-1 font-normal">이벤트</th>
                <th className="py-1 text-right font-normal">횟수</th>
                <th className="py-1 text-right font-normal">인원</th>
                <th className="py-1 text-right font-normal">마지막</th>
              </tr>
            </thead>
            <tbody>
              {eventRows.map((r) => (
                <tr key={r.name} className="border-t border-line/60">
                  <td className="py-1 font-mono-retro text-ink">{r.name}</td>
                  <td className="py-1 text-right font-mono-retro text-ink">
                    {r.count}
                  </td>
                  <td className="py-1 text-right font-mono-retro text-ink">
                    {r.users}
                  </td>
                  <td className="py-1 text-right text-ink-60">
                    {r.lastAt
                      ? new Date(r.lastAt).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ───── 랭킹 ───── */}
      <Section title="기록자 랭킹" hint={`포인트 보유 ${ranking.length}명`}>
        {ranking.length === 0 ? (
          <Empty>아직 적립된 포인트가 없습니다.</Empty>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] text-ink-60">
                <th className="pb-1">#</th>
                <th className="pb-1">기록자</th>
                <th className="pb-1 text-right">포인트</th>
                <th className="pb-1 text-right">미션</th>
                <th className="pb-1 text-right">단계</th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 30).map((u, i) => (
                <tr key={u.uid} className="border-t border-line/60">
                  <td className="py-1.5 font-mono-retro text-ink-60">{i + 1}</td>
                  <td className="py-1.5 text-ink">{u.nickname}</td>
                  <td className="py-1.5 text-right font-bold text-teal-dk">
                    {u.totalPoints.toLocaleString()}P
                  </td>
                  <td className="py-1.5 text-right text-ink-60">{u.missionCount}</td>
                  <td className="py-1.5 text-right text-ink-60">{u.phase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ───── 포인트 지급 내역 ───── */}
      <Section title="포인트 지급 현황" hint="적립 사유별">
        {Object.keys(pointsByReason).length === 0 ? (
          <Empty>적립 내역이 없습니다.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(pointsByReason).map(([reason, v]) => (
              <div key={reason} className="rounded-lg border border-line bg-paper p-2.5">
                <p className="text-[11.5px] font-bold text-ink">
                  {REASON_LABEL[reason as PointReason] ?? reason}
                </p>
                <p className="font-mono-retro text-[11px] text-ink-60">
                  {v.count}건 · {v.sum.toLocaleString()}P
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ───── 가게 관리 ───── */}
      <Section title="골목 가게 관리" hint={`등록 ${shops.length}곳`}>
        {shops.length === 0 ? (
          <Empty>아직 등록된 가게가 없습니다. 아래 [＋ 가게 등록]부터 하세요.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12px]">
              <thead>
                <tr className="border-b border-line text-left font-mono-retro text-[10px] tracking-[0.1em] text-ink-60">
                  <th className="py-1.5">가게</th>
                  <th className="py-1.5">쿠폰</th>
                  <th className="py-1.5 text-right">단가</th>
                  <th className="py-1.5">스티커 토큰</th>
                  <th className="py-1.5 text-right">직원</th>
                  <th className="py-1.5 text-right">상태</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s.shopId} className="border-b border-line/60">
                    <td className="py-1.5 text-ink">{s.name}</td>
                    <td className="py-1.5 font-mono-retro text-[11px] text-ink-60">
                      {s.couponId}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-ink">
                      {(s.unitWon ?? 0).toLocaleString()}
                    </td>
                    {/*
                      토큰을 관리자에게 보여주는 이유 — 스티커가 훼손됐을 때
                      같은 값으로 다시 뽑아야 한다. 바꾸면 이미 붙은 것이 죽는다.
                    */}
                    <td className="py-1.5 font-mono-retro text-[11px] tracking-[0.08em] text-ink">
                      {s.postToken ?? '—'}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-ink-60">
                      {s.staffUids?.length ?? 0}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={async () => {
                          await setShopActive(s.shopId, !s.active)
                          void loadShops()
                        }}
                        className={`rounded px-2 py-0.5 font-mono-retro text-[10px] ${
                          s.active
                            ? 'bg-teal/15 text-teal-dk'
                            : 'bg-rec/15 text-rec'
                        }`}
                      >
                        {s.active ? '영업' : '중지'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 추가는 접어둔다 — 평소에 보는 것은 위의 목록이다 */}
        <div className="mt-4">
          <button
            onClick={() => setPanel(panel === 'shop' ? 'none' : 'shop')}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-[12px] font-bold text-ink"
          >
            {panel === 'shop' ? '✕ 닫기' : '＋ 가게 추가'}
          </button>
        </div>

        {/*
          가게와 계정을 한 폼으로 받는다. 나눠 놓으면 "가게는 있는데 계정이
          없다"는 어정쩡한 상태를 관리자가 이해해야 한다. 이미 등록된 가게를
          고르면 계정만 붙는다 — 토큰은 절대 갈리지 않는다(스티커가 죽는다).
        */}
        <div
          hidden={panel !== 'shop'}
          className="mt-3 rounded-xl border border-line bg-paper p-3"
        >
          <p className="font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">
            가게 추가
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {/*
              쿠폰은 이야기 큐가 지급하는 값이라 카탈로그(coupons.ts)에 산다.
              여기서 새 쿠폰을 만들 수는 없고, 어느 쿠폰의 가게인지 고른다.
            */}
            <select
              value={acc.shopId}
              onChange={(e) => {
                const id = e.target.value
                const spec = couponSpec(id)
                setAcc({
                  shopId: id,
                  loginId: id ? `shop${id}` : '',
                  password: '',
                  name: spec?.shop ?? '',
                  benefit: spec?.benefit ?? '',
                  unitWon: spec?.unitWon ?? 0,
                })
              }}
              className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[12px] text-ink"
            >
              <option value="">쿠폰 고르기</option>
              {Object.values(COUPONS).map((c) => {
                const done = shops.some((s) => s.shopId === c.shopId)
                return (
                  <option key={c.id} value={c.id}>
                    {c.shop} ({c.id}){done ? ' — 등록됨, 계정만 추가' : ''}
                  </option>
                )
              })}
            </select>
            <input
              value={acc.name}
              onChange={(e) => setAcc({ ...acc, name: e.target.value })}
              placeholder="가게 이름"
              className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[12px] text-ink"
            />
            <input
              value={acc.benefit}
              onChange={(e) => setAcc({ ...acc, benefit: e.target.value })}
              placeholder="혜택 문구"
              className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[12px] text-ink"
            />
            <input
              type="number"
              value={acc.unitWon || ''}
              onChange={(e) => setAcc({ ...acc, unitWon: Number(e.target.value) })}
              placeholder="정산 단가(원)"
              className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[12px] text-ink"
            />
            <input
              value={acc.loginId}
              onChange={(e) => setAcc({ ...acc, loginId: e.target.value })}
              placeholder="사장님 아이디"
              autoCapitalize="none"
              className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[12px] text-ink"
            />
            <input
              value={acc.password}
              onChange={(e) => setAcc({ ...acc, password: e.target.value })}
              placeholder="비밀번호 (6자 이상)"
              className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[12px] text-ink"
            />
          </div>
          <button
            disabled={
              accBusy || !acc.shopId || !acc.name || !acc.loginId || acc.password.length < 6
            }
            onClick={async () => {
              setAccBusy(true)
              setAccMsg('')
              try {
                const r = await addShop({
                  couponId: acc.shopId,
                  name: acc.name,
                  benefit: acc.benefit,
                  unitWon: acc.unitWon,
                  loginId: acc.loginId,
                  password: acc.password,
                })
                setAccMsg(
                  `${acc.name} 등록 완료 — 스티커 토큰 ${r.postToken}. ` +
                    `사장님은 /shop/verify에서 ${acc.loginId}로 로그인합니다.`
                )
                setAcc({ shopId: '', loginId: '', password: '', name: '', benefit: '', unitWon: 0 })
                void loadShops()
              } catch (e) {
                setAccMsg(e instanceof Error ? e.message : '추가하지 못했습니다.')
              } finally {
                setAccBusy(false)
              }
            }}
            className="btn-teal mt-2 text-[12px] disabled:opacity-40"
          >
            {accBusy ? '추가하는 중…' : '가게 + 계정 만들기'}
          </button>
          {accMsg && <p className="mt-2 text-[11.5px] text-ink">{accMsg}</p>}
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-60">
            비밀번호는 여기 저장되지 않습니다 — Firebase 인증이 해시로만 보관하고,
            이 화면에서도 다시 볼 수 없으니 <b>종이에 적어 사장님께</b> 전하세요.
            계정을 만들어도 이 화면의 로그인은 그대로입니다.
          </p>
        </div>
      </Section>

      {/* ───── 골목 가게 정산 ───── */}
      <Section
        title="골목 가게 정산"
        hint={`실제 사용 ${couponUses.length}장 · 합계 ${settlementTotal.toLocaleString()}원`}
      >
        {couponUses.length === 0 ? (
          <Empty>아직 사용된 쿠폰이 없습니다.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left font-mono-retro text-[10px] tracking-[0.1em] text-ink-60">
                    <th className="py-1.5">가게</th>
                    <th className="py-1.5 text-right">장수</th>
                    <th className="py-1.5 text-right">직접</th>
                    <th className="py-1.5 text-right">대리</th>
                    <th className="py-1.5 text-right">정산액</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.map((r) => (
                    <tr key={r.shopId} className="border-b border-line/60">
                      <td className="py-1.5 text-ink">{r.name}</td>
                      <td className="py-1.5 text-right text-ink">{r.total}</td>
                      <td className="py-1.5 text-right text-teal-dk">{r.guest}</td>
                      {/*
                        대리가 유난히 많은 가게는 들여다볼 신호다. 손님이 오지
                        않아도 사장님 기기만으로 기록을 만들 수 있는 경로라서다.
                      */}
                      <td
                        className={`py-1.5 text-right ${
                          r.total > 0 && r.staff / r.total > 0.7
                            ? 'font-bold text-rec'
                            : 'text-ink-60'
                        }`}
                      >
                        {r.staff}
                      </td>
                      <td className="py-1.5 text-right font-bold text-ink">
                        {r.won.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-60">
              참여자 수로 추정하지 않고 <b className="text-ink">실제 찍힌 장수</b>로
              셉니다. &lsquo;직접&rsquo;은 손님이 가게 스티커를 앱으로 찍은 것,
              &lsquo;대리&rsquo;는 사장님이 대신 처리한 것입니다. 개편 전의 옛
              기록은 어느 가게 몫인지 알 수 없어 빠집니다.
            </p>
          </>
        )}
      </Section>

      {/* ───── 인기 장소 ───── */}
      <Section title="많이 찾은 골목 · 가게" hint="빙고 칸 방문 수 — 가게 리포트 근거">
        {popular.length === 0 ? (
          <Empty>아직 방문 기록이 없습니다.</Empty>
        ) : (
          <>
            {popular.slice(0, 12).map((c) => {
              const cell = BINGO_CELLS.find((x) => x.id === c.id)
              const max = popular[0].count || 1
              return (
                <div key={c.id} className="mt-1.5 first:mt-0">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-ink">
                      {cell?.emoji} {cell?.title ?? c.id}
                    </span>
                    <span className="font-mono-retro text-ink-60">{c.count}회</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-cream-dp">
                    <div
                      className="h-2 rounded-full bg-sunset"
                      style={{ width: `${(c.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
            <button
              onClick={() => exportShopReport(popular, view.users)}
              className="mt-3 w-full rounded-lg border border-teal/50 bg-teal/5 py-2 text-[12px] font-bold text-teal-dk"
            >
              📄 가게 제공용 리포트 내려받기 (CSV)
            </button>
          </>
        )}
      </Section>

      {/* ───── 시간대 ───── */}
      <Section title="시간대별 시작" hint="현장 인력 배치 참고">
        <div className="flex items-end gap-0.5" style={{ height: 80 }}>
          {hours.map((n, h) => {
            const max = Math.max(...hours) || 1
            return (
              <div key={h} className="flex flex-1 flex-col items-center justify-end">
                <div
                  className="w-full rounded-t bg-teal"
                  style={{ height: `${(n / max) * 64}px`, minHeight: n > 0 ? 3 : 0 }}
                  title={`${h}시 · ${n}팀`}
                />
                {h % 6 === 0 && (
                  <span className="mt-0.5 font-mono-retro text-[8px] text-ink-60">{h}</span>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ───── 설문 ───── */}
      <Section title="완주 설문" hint={`응답 ${view.responses.length}건`}>
        {view.responses.length === 0 ? (
          <Empty>아직 응답이 없습니다.</Empty>
        ) : (
          <>
            {DEFAULT_SURVEY.questions.map((q) => {
              const dist = survey[q.id]
              if (!dist) return null
              const total = Object.values(dist).reduce((a, b) => a + b, 0)
              return (
                <div key={q.id} className="mt-3 first:mt-0">
                  <p className="text-[12px] font-bold text-ink">{q.label}</p>
                  {q.type === 'text' ? (
                    <ul className="mt-1 space-y-1">
                      {Object.keys(dist).slice(0, 8).map((t) => (
                        <li
                          key={t}
                          className="rounded bg-cream px-2 py-1 text-[11.5px] text-ink-60"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    Object.entries(dist)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <div key={k} className="mt-1 flex items-center gap-2">
                          <span className="w-28 shrink-0 truncate text-[11.5px] text-ink">{k}</span>
                          <div className="h-2 flex-1 rounded-full bg-cream-dp">
                            <div
                              className="h-2 rounded-full bg-teal"
                              style={{ width: `${(v / total) * 100}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right font-mono-retro text-[10.5px] text-ink-60">
                            {v}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )
            })}
            <button
              onClick={() => exportSurveyCsv(view.responses)}
              className="mt-3 w-full rounded-lg border border-line bg-paper py-2 text-[12px] font-bold text-ink"
            >
              📄 설문 원자료 내려받기 (CSV)
            </button>
          </>
        )}
      </Section>

      {/* ───── 게시글 ───── */}
      <Section title="커뮤니티 글" hint={`${view.posts.length}건`}>
        {view.posts.length === 0 ? (
          <Empty>아직 글이 없습니다.</Empty>
        ) : (
          view.posts.slice(0, 20).map((p) => (
            <div key={p.id} className="mt-2 rounded-lg border border-line bg-paper p-2.5 first:mt-0">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-teal-dk">{p.authorNickname}</span>
                <span className="font-mono-retro text-[10px] text-ink-60">
                  ♡{p.likes} 💬{p.commentCount}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] text-ink">{p.comment}</p>
            </div>
          ))
        )}
      </Section>
    </Shell>
  )
}

// ---------------------------------------------------------------------------

function Shell({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => void }) {
  return (
    <div className="min-h-screen bg-cream-base pb-16">
      <header className="appbar px-4 pb-3 pt-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {/*
              나가는 길. 이 화면에는 하단 탭바가 없어서, 들어오면 브라우저
              뒤로가기 말고는 앱으로 돌아갈 방법이 없었다. 홈 화면에서 띄운
              PWA에는 그 뒤로가기 버튼조차 없다.
            */}
            <Link
              href="/community"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream/20 text-[15px] text-cream"
              aria-label="앱으로 돌아가기"
            >
              ←
            </Link>
            <div className="min-w-0">
              <span className="appbar-badge">ADMIN</span>
              <h1 className="appbar-title mt-1 text-[19px]">콘트롤 패널</h1>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="shrink-0 rounded-lg bg-cream/20 px-3 py-1.5 text-[12px] font-bold text-cream"
            >
              새로고침
            </button>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-4">{children}</div>
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="card-paper mb-4 p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="font-display text-[15px] text-ink">{title}</h2>
        {hint && <p className="text-[11px] text-ink-60">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-[10.5px] text-ink-60">{label}</p>
      <p className="mt-0.5 font-display text-[15px] text-ink">{value}</p>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-[12px] text-ink-60">{children}</p>
}

// ---------------------------------------------------------------------------
// 내보내기
// ---------------------------------------------------------------------------

function download(name: string, csv: string) {
  // BOM을 붙여야 엑셀에서 한글이 깨지지 않는다
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

function exportShopReport(
  popular: { id: string; count: number }[],
  users: AdminUser[]
) {
  const total = users.filter((u) => u.paid).length
  const rows = [
    ['장소', '방문 팀 수', '전체 참여 팀', '방문률(%)'],
    ...popular.map((c) => {
      const meta = BINGO_CELLS.find((x) => x.id === c.id)
      return [
        meta?.title ?? c.id,
        c.count,
        total,
        total ? Math.round((c.count / total) * 100) : 0,
      ]
    }),
  ]
  download(
    `봉황메모리즈_가게리포트_${new Date().toISOString().slice(0, 10)}.csv`,
    rows.map((r) => r.map(cell).join(',')).join('\n')
  )
}

function exportSurveyCsv(responses: AdminSurveyResponse[]) {
  const qids = DEFAULT_SURVEY.questions.map((q) => q.id)
  const rows = [
    ['응답일시', ...DEFAULT_SURVEY.questions.map((q) => q.label)],
    ...responses.map((r) => [
      r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : '',
      ...qids.map((id) => r.answers[id] ?? ''),
    ]),
  ]
  download(
    `봉황메모리즈_설문_${new Date().toISOString().slice(0, 10)}.csv`,
    rows.map((r) => r.map(cell).join(',')).join('\n')
  )
}
