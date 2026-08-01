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
import { ALL_CELLS, BINGO_CELLS } from '@/lib/bingoCells'
import { REASON_LABEL, PointReason } from '@/lib/points'
import { DEFAULT_SURVEY } from '@/lib/survey'
import { COUPONS, couponSpec } from '@/lib/coupons'
import {
  addShop,
  fetchAllShops,
  setShopActive,
  setShopCap,
  setShopHours,
  setShopContract,
  repairShops,
  setShopTier,
  stampPending,
  toMerchant,
  type Shop,
} from '@/lib/shops'
import {
  closeMonth,
  fetchClosedMonth,
  fetchSettlementConfig,
  saveSettlementConfig,
  type SettlementDoc,
} from '@/lib/settlement'
import type { SettlementConfig, SettlementMerchant } from '@/lib/coverage'
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
  surveySummary,
  CONTRACT_LABEL,
  DEFAULT_SETTLEMENT,
  TIER_LABEL,
  coverageReport,
  issuedFaceValue,
  monthKey,
  settleMonth,
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

  /*
    정산 설정. 배포 없이 바꿀 수 있어야 하는 값이라 Firestore에 산다
    (config/points는 공개, config/settlement은 관리자만 — 충당률이 새면
    가게끼리 서로의 계약 조건을 알게 된다).
  */
  const [cfg, setCfg] = useState<SettlementConfig>(DEFAULT_SETTLEMENT)
  const [cfgDraft, setCfgDraft] = useState<SettlementConfig>(DEFAULT_SETTLEMENT)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [cfgMsg, setCfgMsg] = useState('')
  /** 어느 달을 정산하는가 — 기본은 이번 달 */
  const [month, setMonth] = useState(monthKey())
  const [closed, setClosed] = useState<SettlementDoc[]>([])
  const [settleMsg, setSettleMsg] = useState('')
  const [settleBusy, setSettleBusy] = useState(false)
  const [shopFixMsg, setShopFixMsg] = useState('')
  const [shopFixBusy, setShopFixBusy] = useState(false)

  const loadShops = useCallback(async () => {
    try {
      setShops(await fetchAllShops())
    } catch {
      setShops([])
    }
  }, [])

  /** 마감 여부는 달을 바꿀 때마다 다시 본다 — 버튼을 잠그는 근거다 */
  const loadClosed = useCallback(async (m: string) => {
    setClosed(await fetchClosedMonth(m))
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
      const [u, p, r, po, cu, ev, conf] = await Promise.all([
        fetchUsers(),
        fetchAllPoints(),
        fetchSurveyResponses(),
        fetchPosts(),
        fetchCouponUses(),
        fetchEvents(),
        fetchSettlementConfig(),
      ])
      setUsers(u)
      setPoints(p)
      setResponses(r)
      setPosts(po)
      setCouponUses(cu)
      setEvents(ev)
      setCfg(conf)
      setCfgDraft(conf)
      void loadShops()
      void loadClosed(month)
      setState('ready')
    } catch (err) {
      // 규칙을 아직 게시하지 않았으면 users 읽기가 권한 거부로 떨어진다.
      // 잡지 않으면 화면이 "불러오는 중…"에서 영영 멈춰 원인을 알 수 없다.
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
    // month는 첫 적재 때의 값만 쓰면 된다 — 달을 바꾸면 아래 effect가 다시 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadShops, loadClosed])

  useEffect(() => {
    if (state === 'ready') void loadClosed(month)
  }, [month, state, loadClosed])

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
  const merchants = useMemo<SettlementMerchant[]>(
    () =>
      shops.map((s) => ({
        ...toMerchant(s, cfg),
        name: s.name,
        feeWon: s.monthlyFeeWon ?? cfg.monthlyFee[s.tier ?? 'free'],
      })),
    [shops, cfg]
  )

  /** 그 달의 QR 스캔 수 — 충당액 옆에 '무엇을 받았는지'를 놓기 위한 값 */
  const scansByShop = useMemo(() => {
    const out: Record<string, number> = {}
    for (const e of events) {
      if (e.name !== 'qr_scan') continue
      const id = String(e.props?.shopId ?? e.props?.station ?? '')
      if (id) out[id] = (out[id] ?? 0) + 1
    }
    return out
  }, [events])

  const settlement = useMemo(
    () =>
      settleMonth({
        merchants,
        redemptions: couponUses,
        scansByShop,
        month,
        alertPercent: cfg.capAlertPercent,
      }),
    [merchants, couponUses, scansByShop, month, cfg.capAlertPercent]
  )

  /** 아직 충당률이 안 찍힌 기록 — 정산에서 0원으로 셈해지므로 눈에 띄어야 한다 */
  const pendingStamp = useMemo(
    () => couponUses.filter((u) => u.coverageRate < 0).length,
    [couponUses]
  )

  const monthTotals = useMemo(
    () =>
      settlement.reduce(
        (a, r) => ({
          count: a.count + r.count,
          amount: a.amount + r.amountWon,
          covered: a.covered + r.coveredWon,
          ops: a.ops + r.opsWon,
          billed: a.billed + r.billedWon,
        }),
        { count: 0, amount: 0, covered: 0, ops: 0, billed: 0 }
      ),
    [settlement]
  )

  /** 이미 마감한 달인가 — 마감 뒤에는 숫자가 움직이면 안 된다 */
  const isClosed = closed.length > 0

  /*
    운영사 부담이 매출의 몇 %인가.

    분모는 코스 결제 매출이다. 가게 충당액은 여기 들어가지 않는다 —
    그것은 매출이 아니라 원가의 차감 항목이다.
  */
  const report = useMemo(() => {
    const paid = view.users.filter((u) => u.paid).length
    return coverageReport({
      redemptions: couponUses,
      issuedWon: issuedFaceValue(view.points, paid, cfg.couponFaceWon),
      // 소멸분은 부채로 잡지 않으므로 참고 지표로만 둔다. 원장을 읽을 때
      // 판정하는 값이라 여기서 다시 세지 않는다
      expiredWon: 0,
      revenueWon: paid * TICKET_PRICE,
      budgetPercent: cfg.budgetPercent,
    })
  }, [couponUses, view, cfg.couponFaceWon, cfg.budgetPercent])

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
                  <th className="py-1.5">등급 · 충당률</th>
                  <th className="py-1.5 text-right">월 상한</th>
                  <th className="py-1.5">스티커 토큰</th>
                  <th className="py-1.5 text-right">직원</th>
                  <th className="py-1.5 text-right">계약</th>
                  <th className="py-1.5 text-right">상태</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => {
                  const m = toMerchant(s, cfg)
                  return (
                    <tr key={s.shopId} className="border-b border-line/60">
                      <td className="py-1.5 text-ink">
                        {s.name}
                        <span className="ml-1 font-mono-retro text-[10px] text-ink-60">
                          {s.couponId}
                        </span>
                      </td>
                      {/*
                        등급을 시간이 저 혼자 바꾸지 않는다. 유예가 끝나면
                        여기서 짚어주고 사람이 누른다 — 그래야 언제 바뀌었는지가
                        기록에 남고(rateSince), 그 뒤 사용분부터 새 충당률이 적용된다.
                      */}
                      <td className="py-1.5">
                        <select
                          value={m.tier}
                          onChange={async (e) => {
                            await setShopTier(
                              s.shopId,
                              e.target.value as typeof m.tier,
                              cfg
                            )
                            void loadShops()
                          }}
                          className="rounded border border-line bg-cream px-1.5 py-0.5 text-[11px] text-ink"
                        >
                          {(['free', 'basic', 'premium'] as const).map((t) => (
                            <option key={t} value={t}>
                              {TIER_LABEL[t]} {cfg.coverage[t]}%
                            </option>
                          ))}
                        </select>
                        <span className="ml-1 font-mono-retro text-[10.5px] text-ink-60">
                          {m.coverageRate}%
                        </span>
                        {/* 회비는 등급을 따라간다 — 무료는 0원이다 */}
                        <span className="ml-1 font-mono-retro text-[10.5px] text-ink-60">
                          · 회비 {won(s.monthlyFeeWon ?? cfg.monthlyFee[m.tier])}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          defaultValue={m.monthlyCapWon}
                          onBlur={async (e) => {
                            const v = Number(e.target.value)
                            if (!Number.isFinite(v) || v === m.monthlyCapWon) return
                            await setShopCap(s.shopId, v)
                            void loadShops()
                          }}
                          className="w-[86px] rounded border border-line bg-cream px-1.5 py-0.5 text-right font-mono-retro text-[11px] text-ink"
                        />
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
                        <select
                          value={m.contract}
                          onChange={async (e) => {
                            await setShopContract(
                              s.shopId,
                              e.target.value as typeof m.contract
                            )
                            void loadShops()
                          }}
                          className="rounded border border-line bg-cream px-1.5 py-0.5 text-[11px] text-ink"
                        >
                          {(['active', 'paused', 'ended'] as const).map((c) => (
                            <option key={c} value={c}>
                              {CONTRACT_LABEL[c]}
                            </option>
                          ))}
                        </select>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/*
          보수 — 시드된 문서에 빠진 칸을 메운다.

          다시 심기와 갈라 둔 이유가 있다. 그쪽은 shops.json을 붙여넣어야
          하는데 그 파일은 외장하드를 따라다녀 자리를 옮기면 없고, 문서를
          세우는 도구라 등급과 가입일을 되돌릴 수 있다. 이 버튼은 이미
          서버에 있는 것을 보고 빈 칸만 채운다.
        */}
        <div className="mt-4">
          <button
            disabled={shopFixBusy}
            onClick={async () => {
              setShopFixBusy(true)
              setShopFixMsg('')
              try {
                const r = await repairShops(cfg)
                setShopFixMsg(
                  (r.fixed.length
                    ? `채웠습니다 — ${r.fixed.join(' / ')}`
                    : '빠진 칸이 없습니다.') +
                    (r.noToken.length
                      ? ` · 스티커 토큰이 없는 가게: ${r.noToken.join(', ')} — 토큰은 만들지 않습니다(이미 붙은 스티커가 죽습니다). scripts/make-shop-qr.mjs로 다시 뽑아 「가게 문서 심기」로 넣으세요.`
                      : '')
                )
                void loadShops()
              } catch (e) {
                setShopFixMsg(e instanceof Error ? e.message : '보수하지 못했습니다.')
              } finally {
                setShopFixBusy(false)
              }
            }}
            className="rounded-xl border border-sunset-yellow bg-sunset-yellow/20 px-3 py-2 text-[12px] font-bold text-ink disabled:opacity-40"
          >
            {shopFixBusy ? '보수하는 중…' : '🔧 빠진 칸 채우기'}
          </button>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-60">
            그룹·뽑기 쿠폰이 받는 칸(<code>accepts</code>·<code>groupCoupons</code>)과
            등급 칸을 메웁니다. <b className="text-ink">있는 값은 건드리지
            않습니다.</b>
          </p>
          {shopFixMsg && (
            <p className="mt-2 break-all text-[11.5px] leading-relaxed text-ink">
              {shopFixMsg}
            </p>
          )}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-60">
          지금은 <b className="text-ink">모든 가게가 무료</b>입니다 — 회비도 부담도
          없습니다. 구독이 시작되면 여기서 등급만 옮기면 되고, 그{' '}
          <b className="text-ink">시점 이후</b> 사용분부터 새 값이 붙습니다. 이미
          기록된 것은 움직이지 않습니다.
        </p>

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

      {/*
        ───── 영업일 · 보너스 미션 ─────

        현장에서 체험이 끊기는 자리가 여기다. 보너스 미션이 걸린 가게가 문을
        닫았는데 화면이 그대로 시키면 참여자는 닫힌 문 앞에서 멈춘다. 미리
        넣어두면 그날 그 칸이 판에서 조용히 빠지고 다른 미션이 들어온다.

        가게 표에 칸을 더 붙이지 않고 따로 세운 이유 — 그 표는 정산을 보는
        자리고 이건 운영을 넣는 자리다. 보는 사람도 고치는 때도 다르다.
      */}
      <Section title="영업일 · 보너스 미션" hint="휴무면 그날 그 칸이 판에서 빠집니다">
        {shops.length === 0 ? (
          <Empty>가게를 먼저 등록하세요.</Empty>
        ) : (
          <div className="space-y-3">
            {shops.map((s) => (
              <ShopHoursRow key={s.shopId} shop={s} onSaved={loadShops} />
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-60">
          비워두면 <b className="text-ink">늘 여는 것으로</b> 봅니다 — 정보가 없다고
          미션을 내리면 아직 시간을 안 넣은 가게가 통째로 사라집니다.
          참여자에게는 가게 사정을 말하지 않습니다. 그 칸이 조용히 다른 미션으로
          바뀌어 있을 뿐입니다.
        </p>
      </Section>

      {/* ───── 골목 가게 정산 ───── */}
      <Section
        title="골목 가게 정산"
        hint={`${month} · 사용 ${monthTotals.count}건 · 청구 ${won(monthTotals.billed)}`}
      >
        {/* 어느 달을 보는가. 마감은 익월 10일이라 지난 달을 보는 일이 잦다 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || monthKey())}
            className="rounded-lg border border-line bg-cream px-2.5 py-1.5 font-mono-retro text-[12px] text-ink"
          />
          {isClosed ? (
            <span className="rounded-lg bg-teal/15 px-2.5 py-1.5 font-mono-retro text-[11px] text-teal-dk">
              마감됨 · {closed.length}곳
            </span>
          ) : (
            <button
              disabled={settleBusy || settlement.length === 0}
              onClick={async () => {
                setSettleBusy(true)
                setSettleMsg('')
                try {
                  const r = await closeMonth(settlement, month)
                  setSettleMsg(
                    `${month} 마감 — ${r.closed}곳 굳혔습니다` +
                      (r.skipped ? ` (이미 마감 ${r.skipped}곳은 그대로)` : '')
                  )
                  await loadClosed(month)
                } catch (e) {
                  setSettleMsg(e instanceof Error ? e.message : '마감하지 못했습니다.')
                } finally {
                  setSettleBusy(false)
                }
              }}
              className="btn-teal px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              {settleBusy ? '마감하는 중…' : '이 달 마감하기'}
            </button>
          )}
          {/*
            주 경로가 남긴 기록에는 충당률이 비어 있다. 가게 화면이 열릴 때도
            찍히지만, 문을 안 여는 가게가 있으므로 여기서도 찍는다.
          */}
          {pendingStamp > 0 && (
            <button
              disabled={settleBusy}
              onClick={async () => {
                setSettleBusy(true)
                setSettleMsg('')
                let ok = 0
                let skip = 0
                for (const s of shops) {
                  const r = await stampPending(s, cfg)
                  ok += r.stamped
                  skip += r.skipped
                }
                setSettleMsg(
                  `${ok}건 반영` +
                    (skip ? ` · ${skip}건은 율이 바뀐 뒤라 손으로 봐야 합니다` : '')
                )
                setCouponUses(await fetchCouponUses())
                setSettleBusy(false)
              }}
              className="rounded-lg border border-sunset-yellow bg-sunset-yellow/20 px-3 py-1.5 text-[12px] font-bold text-ink disabled:opacity-40"
            >
              미반영 {pendingStamp}건 채우기
            </button>
          )}
        </div>
        {settleMsg && <p className="mt-2 text-[11.5px] text-ink">{settleMsg}</p>}

        {settlement.length === 0 ? (
          <Empty>등록된 가게가 없습니다.</Empty>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left font-mono-retro text-[10px] tracking-[0.1em] text-ink-60">
                    <th className="py-1.5">가게</th>
                    <th className="py-1.5 text-right">율</th>
                    <th className="py-1.5 text-right">건수</th>
                    <th className="py-1.5 text-right">대리</th>
                    <th className="py-1.5 text-right">할인</th>
                    <th className="py-1.5 text-right">가게</th>
                    <th className="py-1.5 text-right">운영사</th>
                    <th className="py-1.5 text-right">청구</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.map((r) => (
                    <tr key={r.shopId} className="border-b border-line/60">
                      <td className="py-1.5 text-ink">
                        {r.name}
                        <span className="ml-1 font-mono-retro text-[10px] text-ink-60">
                          {TIER_LABEL[r.tier]}
                        </span>
                        {/* 상한에 닿았으면 그 가게에서는 더 못 쓴다 — 눈에 띄어야 한다 */}
                        {r.cap.state !== 'ok' && (
                          <span
                            className={`ml-1 rounded px-1 py-0.5 font-mono-retro text-[9.5px] ${
                              r.cap.state === 'closed'
                                ? 'bg-rec/15 text-rec'
                                : 'bg-sunset-yellow/30 text-ink'
                            }`}
                          >
                            상한 {r.cap.percent}%
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink-60">
                        {r.currentRate}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink">
                        {r.count}
                        {r.pointCount > 0 && (
                          <span className="ml-0.5 text-[10px] text-teal-dk">
                            (P{r.pointCount})
                          </span>
                        )}
                      </td>
                      {/*
                        대리가 유난히 많은 가게는 들여다볼 신호다. 손님이 오지
                        않아도 사장님 기기만으로 기록을 만들 수 있는 경로라서다.
                      */}
                      <td
                        className={`py-1.5 text-right tabular-nums ${
                          r.count > 0 && r.staff / r.count > 0.7
                            ? 'font-bold text-rec'
                            : 'text-ink-60'
                        }`}
                      >
                        {r.staff}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink-60">
                        {r.amountWon.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink">
                        {r.coveredWon.toLocaleString()}
                        {r.overCapWon > 0 && (
                          <span className="ml-0.5 text-[10px] text-rec">
                            +{r.overCapWon.toLocaleString()}↑
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink-60">
                        {r.opsWon.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums text-ink">
                        {r.billedWon.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-60">
              분담액은 <b className="text-ink">사용 시점에 굳은 값</b>입니다 —
              지금 등급을 다시 곱하지 않으므로, 등급을 바꿔도 지난 정산은
              움직이지 않습니다. 상한에 닿아도{' '}
              <b className="text-ink">사용을 막지 않습니다</b> — 그만큼 쓴 손님은
              그만큼 자주 온 손님입니다. &lsquo;가게&rsquo; 칸의 붉은{' '}
              <b className="text-rec">↑</b>는 상한을 넘긴 몫으로, 청구에서 빼고
              운영사가 부담합니다. 충당액 대비 매출 유입은 사장님 화면에서 함께
              보입니다.
            </p>

            {/* ── 운영사 예산 ── */}
            <div
              className={`mt-4 rounded-xl border px-3 py-3 ${
                report.overBudget ? 'border-rec bg-rec/10' : 'border-line bg-paper'
              }`}
            >
              {/*
                이 칸만 달을 나누지 않고 **누적**으로 본다. 예산 천장은
                한 달의 등락이 아니라 지금까지의 추세로 판단할 값이고,
                달로 자르면 초기의 적은 표본에서 3%가 쉽게 튄다.
              */}
              <p className="font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">
                운영사 부담 · 리워드 예산 (누적)
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="발행 액면" value={won(report.issuedWon)} />
                <Metric label="사용 액면" value={won(report.usedWon)} />
                <Metric label="운영사 부담" value={won(report.opsWon)} />
                <Metric label="사용률" value={`${report.useRate}%`} />
              </div>
              <p
                className={`mt-2 text-[11.5px] leading-snug ${
                  report.overBudget ? 'font-bold text-rec' : 'text-ink-60'
                }`}
              >
                운영사 부담이 매출의 {report.opsShareOfRevenue}%입니다 (천장{' '}
                {cfg.budgetPercent}%).
                {report.overBudget
                  ? ' 배점이나 충당률을 손볼 때입니다.'
                  : ' 아직 여유가 있습니다.'}
              </p>
              {/*
                충당액은 매출이 아니다. 운영사 원가의 차감 항목이라 매출로
                계상하면 재무제표가 부풀려진다 — 비용에 올리는 것은 운영사
                부담액뿐이다.
              */}
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-60">
                가게 충당액({won(monthTotals.covered)})은 <b>매출이 아닙니다.</b>{' '}
                운영사 원가의 차감 항목으로 처리하고, 비용 계정에는 운영사
                부담액만 올립니다.
              </p>
            </div>
          </>
        )}
      </Section>

      {/* ───── 정산 설정 ───── */}
      <Section
        title="정산 설정"
        hint="배포 없이 바뀝니다 — 저장하면 바로 적용"
      >
        <button
          onClick={() => setCfgOpen((v) => !v)}
          className="rounded-xl border border-line bg-paper px-3 py-2 text-[12px] font-bold text-ink"
        >
          {cfgOpen ? '✕ 닫기' : '⚙ 값 보기 · 고치기'}
        </button>

        <div hidden={!cfgOpen} className="mt-3 rounded-xl border border-line bg-paper p-3">
          <p className="font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">
            등급별 충당률 (%)
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(['free', 'basic', 'premium'] as const).map((t) => (
              <NumField
                key={t}
                label={TIER_LABEL[t]}
                value={cfgDraft.coverage[t]}
                onChange={(v) =>
                  setCfgDraft({ ...cfgDraft, coverage: { ...cfgDraft.coverage, [t]: v } })
                }
              />
            ))}
          </div>

          <p className="mt-3 font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">
            등급별 월 회비 (원)
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(['free', 'basic', 'premium'] as const).map((t) => (
              <NumField
                key={t}
                label={TIER_LABEL[t]}
                value={cfgDraft.monthlyFee[t]}
                onChange={(v) =>
                  setCfgDraft({
                    ...cfgDraft,
                    monthlyFee: { ...cfgDraft.monthlyFee, [t]: v },
                  })
                }
              />
            ))}
          </div>

          <p className="mt-3 font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">
            등급별 월 충당 상한 (원)
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(['free', 'basic', 'premium'] as const).map((t) => (
              <NumField
                key={t}
                label={TIER_LABEL[t]}
                value={cfgDraft.monthlyCap[t]}
                onChange={(v) =>
                  setCfgDraft({
                    ...cfgDraft,
                    monthlyCap: { ...cfgDraft.monthlyCap, [t]: v },
                  })
                }
              />
            ))}
          </div>

          <p className="mt-3 font-mono-retro text-[10px] tracking-[0.15em] text-ink-60">
            그 밖
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <NumField
              label="상한 알림(%)"
              value={cfgDraft.capAlertPercent}
              onChange={(v) => setCfgDraft({ ...cfgDraft, capAlertPercent: v })}
            />
            <NumField
              label="예산 천장(%)"
              value={cfgDraft.budgetPercent}
              onChange={(v) => setCfgDraft({ ...cfgDraft, budgetPercent: v })}
            />
            <NumField
              label="쿠폰 액면(원)"
              value={cfgDraft.couponFaceWon}
              onChange={(v) => setCfgDraft({ ...cfgDraft, couponFaceWon: v })}
            />
            <NumField
              label="포인트 문턱(P)"
              value={cfgDraft.minRedeemPoints}
              onChange={(v) => setCfgDraft({ ...cfgDraft, minRedeemPoints: v })}
            />
            <NumField
              label="유효기간(개월)"
              value={cfgDraft.pointExpiryMonths}
              onChange={(v) => setCfgDraft({ ...cfgDraft, pointExpiryMonths: v })}
            />
            <NumField
              label="미션 칸(P)"
              value={cfgDraft.missionPoints}
              onChange={(v) => setCfgDraft({ ...cfgDraft, missionPoints: v })}
            />
            <NumField
              label="빙고 줄(P)"
              value={cfgDraft.linePoints}
              onChange={(v) => setCfgDraft({ ...cfgDraft, linePoints: v })}
            />
            <NumField
              label="완주 보너스(P)"
              value={cfgDraft.completePoints}
              onChange={(v) => setCfgDraft({ ...cfgDraft, completePoints: v })}
            />
          </div>

          <button
            onClick={async () => {
              setCfgMsg('')
              try {
                await saveSettlementConfig(cfgDraft)
                setCfg(cfgDraft)
                setCfgMsg(
                  '저장했습니다. 가게에 걸린 율은 그대로입니다 — ' +
                    '아래 가게 목록에서 등급을 다시 눌러야 따라 움직입니다.'
                )
              } catch (e) {
                setCfgMsg(e instanceof Error ? e.message : '저장하지 못했습니다.')
              }
            }}
            className="btn-teal mt-3 text-[12px]"
          >
            저장
          </button>
          {cfgMsg && <p className="mt-2 text-[11.5px] text-ink">{cfgMsg}</p>}

          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-60">
            여기서 율을 바꿔도 <b className="text-ink">이미 굳은 사용 기록은
            움직이지 않습니다.</b> 그것이 스냅샷을 두는 이유입니다 — 지난 달
            청구서가 오늘의 설정으로 다시 계산되면 안 됩니다.
          </p>
        </div>
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
          <div className="flex shrink-0 items-center gap-2">
            {/*
              대본 고치기는 자리를 가리지 않는 일이라 콘솔에서 바로 연다.
              초안은 서버에 있어 어느 기기에서 열어도 같은 판이다.
            */}
            <Link
              href="/debug/script-edit"
              className="rounded-lg bg-cream/20 px-3 py-1.5 text-[12px] font-bold text-cream"
            >
              ✎ 대본
            </Link>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="rounded-lg bg-cream/20 px-3 py-1.5 text-[12px] font-bold text-cream"
              >
                새로고침
              </button>
            )}
          </div>
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

/**
 * 설정값 한 칸.
 *
 * 빈 칸을 0으로 읽지 않는다 — 지우고 다시 넣는 동안 0이 저장되면
 * 충당률이 0%가 되어 그 뒤 사용분을 운영사가 전액 진다.
 */
function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] text-ink-60">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v >= 0) onChange(v)
        }}
        className="mt-0.5 w-full rounded-lg border border-line bg-cream px-2 py-1.5 text-right font-mono-retro text-[12px] text-ink"
      />
    </label>
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

/** 요일 표기 — 0(일)부터 */
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 한 가게의 영업일·시각·보너스 칸.
 *
 * 저장은 「저장」을 눌러야 간다. 요일 체크 하나에 한 번씩 서버로 보내면
 * 다섯 개를 고치는 동안 다섯 번 쓰고, 중간 상태가 그대로 남는다.
 */
function ShopHoursRow({ shop, onSaved }: { shop: Shop; onSaved: () => void }) {
  const [days, setDays] = useState<number[]>(shop.closedDays ?? [])
  const [openTime, setOpenTime] = useState(shop.openTime ?? '')
  const [closeTime, setCloseTime] = useState(shop.closeTime ?? '')
  const [cells, setCells] = useState<string[]>(shop.bonusCells ?? [])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const dirty =
    JSON.stringify(days) !== JSON.stringify(shop.closedDays ?? []) ||
    openTime !== (shop.openTime ?? '') ||
    closeTime !== (shop.closeTime ?? '') ||
    JSON.stringify(cells) !== JSON.stringify(shop.bonusCells ?? [])

  const save = async () => {
    setBusy(true)
    setNote('')
    try {
      await setShopHours(shop.shopId, {
        closedDays: days,
        openTime,
        closeTime,
        bonusCells: cells,
      })
      setNote('저장됨')
      onSaved()
    } catch (e) {
      setNote(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-cream px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-bold text-ink">{shop.name}</span>
        <span className="grow" />
        {note && <span className="font-mono-retro text-[10.5px] text-teal">{note}</span>}
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="rounded border border-teal px-2 py-0.5 text-[11px] text-teal disabled:opacity-30"
        >
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="mr-1 font-mono-retro text-[10px] text-ink-60">쉬는 날</span>
        {DAY_LABELS.map((label, d) => (
          <button
            key={d}
            onClick={() =>
              setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
            }
            className={`h-6 w-6 rounded text-[11px] ${
              days.includes(d) ? 'bg-rec text-cream' : 'border border-line text-ink-60'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-2 font-mono-retro text-[10px] text-ink-60">영업</span>
        <input
          value={openTime}
          onChange={(e) => setOpenTime(e.target.value)}
          placeholder="11:00"
          className="w-[62px] rounded border border-line bg-paper px-1.5 py-0.5 text-center font-mono-retro text-[11px] text-ink"
        />
        <span className="text-[11px] text-ink-60">~</span>
        <input
          value={closeTime}
          onChange={(e) => setCloseTime(e.target.value)}
          placeholder="21:00"
          className="w-[62px] rounded border border-line bg-paper px-1.5 py-0.5 text-center font-mono-retro text-[11px] text-ink"
        />
      </div>

      <div className="mt-2">
        <span className="font-mono-retro text-[10px] text-ink-60">이 가게의 보너스 칸</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {ALL_CELLS.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                setCells((prev) =>
                  prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                )
              }
              className={`rounded px-1.5 py-0.5 text-[10.5px] ${
                cells.includes(c.id)
                  ? 'bg-teal text-cream'
                  : 'border border-line text-ink-60'
              }`}
            >
              {c.emoji} {c.title}
            </button>
          ))}
        </div>
      </div>
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
