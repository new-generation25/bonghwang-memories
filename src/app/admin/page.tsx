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
import {
  AdminPointEntry,
  AdminPost,
  AdminSurveyResponse,
  AdminUser,
  TICKET_PRICE,
  adminUids,
  averageDurationMin,
  cellPopularity,
  excludeAdmins,
  fetchAllPoints,
  fetchPosts,
  fetchSurveyResponses,
  fetchUsers,
  funnel,
  hourlyStarts,
  isAdminUser,
  periodStats,
  surveySummary,
} from '@/lib/admin'

const won = (n: number) => `${n.toLocaleString()}원`

export default function AdminPage() {
  const { profile, loading } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [points, setPoints] = useState<AdminPointEntry[]>([])
  const [responses, setResponses] = useState<AdminSurveyResponse[]>([])
  const [posts, setPosts] = useState<AdminPost[]>([])
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
      const [u, p, r, po] = await Promise.all([
        fetchUsers(),
        fetchAllPoints(),
        fetchSurveyResponses(),
        fetchPosts(),
      ])
      setUsers(u)
      setPoints(p)
      setResponses(r)
      setPosts(po)
      setState('ready')
    } catch (err) {
      // 규칙을 아직 게시하지 않았으면 users 읽기가 권한 거부로 떨어진다.
      // 잡지 않으면 화면이 "불러오는 중…"에서 영영 멈춰 원인을 알 수 없다.
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }, [])

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
