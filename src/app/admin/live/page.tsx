'use client'

/**
 * /admin/live — 지금 걷고 있는 팀들.
 *
 * `/admin`은 **끝난 뒤 세어 보는 화면**이다. 합계와 퍼널은 어제 무슨 일이
 * 있었는지 말해주지만, 골목에 서서 폰을 들고 있는 사람에게 필요한 것은
 * "3번 가족이 능소화 고택에서 20분째 안 움직인다" 한 줄이다.
 *
 * 자료는 이미 다 읽어오고 있었다(admin.ts의 phase·tracksCompleted·
 * lastActiveAt). 없던 것은 화면뿐이라 여기서는 새로 수집하지 않는다.
 *
 * 스스로 다시 읽는다. 현장에서 새로고침을 누르고 있을 수는 없다 —
 * onSnapshot을 쓰지 않는 것은 읽기 횟수 때문이다. 20초면 걷는 속도에
 * 충분히 붙는다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { AdminUser, fetchUsers, isSuperAdminUser } from '@/lib/admin'
import { TRACK_STATIONS } from '@/lib/tracks'

/** 자동 갱신 주기 */
const REFRESH_MS = 20_000

/**
 * 이만큼 조용하면 '멈춘 것'으로 본다.
 *
 * 거점 사이를 걷는 데 5분쯤 걸리고 그동안에는 아무 기록도 남지 않는다.
 * 8분을 넘기면 걷는 것치고는 길다 — 길을 잃었거나, 가게가 닫혔거나,
 * 앱이 멈춘 것이다. 셋 다 사람이 가봐야 하는 상황이라 같이 묶는다.
 */
const STALL_MIN = 8

/** 이만큼 지나면 오늘 걷는 팀이 아니다 */
const AWAY_MIN = 90

type Row = {
  user: AdminUser
  /** 마지막 활동 이후 분 */
  idleMin: number
  place: string
  stalled: boolean
}

const minutesSince = (t: number | null): number =>
  t ? Math.max(0, Math.round((Date.now() - t) / 60_000)) : Infinity

/**
 * 지금 어디쯤인가.
 *
 * tracksCompleted는 '이룬 소원의 수'다. 셋을 이뤘으면 넷째 거점으로
 * 가는 중이라고 읽는다 — 도착을 알 방법은 QR뿐이고 그건 다음 큐가
 * 시작돼야 남으므로, 이 화면은 늘 '가는 중'까지만 말한다.
 */
function placeOf(u: AdminUser): string {
  if (u.phase === 'landing') return '아직 시작 전'
  if (u.phase === 'intro') return '인트로 · 테이프'
  if (u.phase === 'done') return '완주'
  if (u.phase === 'act2') return '2막 · 골목 빙고'
  const next = TRACK_STATIONS[u.tracksCompleted]
  if (!next) return '다섯 소원 완료'
  return `${u.tracksCompleted}/5 · ${next.name}`
}

export default function LivePage() {
  const { profile, loading } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [at, setAt] = useState<number | null>(null)
  /** 관리자 계정으로 시험한 기록 — 기본으로 뺀다 */
  const [includeAdmin, setIncludeAdmin] = useState(false)

  const load = useCallback(async () => {
    try {
      setUsers(await fetchUsers())
      setAt(Date.now())
      setState('ok')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (!isSuperAdminUser()) {
      setState('denied')
      return
    }
    void load()
  }, [loading, profile, load])

  /*
    스스로 다시 읽는다. 화면이 꺼져 있는 동안에도 타이머는 도는데,
    읽기 한 번이 users 한 컬렉션이라 그대로 둔다 — 베타 규모에서는
    20초에 한 번이 문제가 되지 않는다.
  */
  useEffect(() => {
    if (state !== 'ok') return
    const t = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(t)
  }, [state, load])

  /*
    지금 걷는 팀만 남긴다.

    결제하고, 아직 안 끝났고, 최근에 움직인 기록이 있는 사람. 오래 조용한
    기록까지 함께 세우면 지난 시험 계정들이 화면을 채워 정작 오늘 걷는
    팀이 묻힌다.
  */
  const rows = useMemo<Row[]>(() => {
    return users
      .filter((u) => (includeAdmin || !u.isAdmin) && u.paid && !u.finishedAt)
      .map((u) => {
        const idleMin = minutesSince(u.lastActiveAt ?? u.startedAt)
        return { user: u, idleMin, place: placeOf(u), stalled: idleMin >= STALL_MIN }
      })
      .filter((r) => r.idleMin <= AWAY_MIN)
      .sort((a, b) => b.idleMin - a.idleMin)
  }, [users, includeAdmin])

  const doneToday = useMemo(() => {
    const dawn = new Date()
    dawn.setHours(0, 0, 0, 0)
    return users.filter(
      (u) => (includeAdmin || !u.isAdmin) && u.finishedAt && u.finishedAt >= dawn.getTime()
    ).length
  }, [users, includeAdmin])

  const stalledCount = rows.filter((r) => r.stalled).length

  if (loading || state === 'idle' || state === 'loading') {
    return <Shell><p className="text-[13px] text-ink-60">불러오는 중…</p></Shell>
  }

  if (state === 'denied') {
    return (
      <Shell>
        <div className="card-paper p-6 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="mt-2 font-display text-[17px] text-ink">관리자 전용</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
            {profile
              ? '이 계정에는 데이터를 볼 권한이 없습니다. 슈퍼관리자 구글 계정으로 로그인해주세요.'
              : '구글 계정으로 로그인해주세요.'}
          </p>
          <Link href="/" className="btn-teal mt-4 inline-block px-5 text-[14px]">
            홈으로
          </Link>
        </div>
      </Shell>
    )
  }

  if (state === 'error') {
    return (
      <Shell>
        <div className="card-paper p-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="mt-2 font-display text-[17px] text-ink">읽지 못했습니다</h2>
          <p className="mt-2 break-all font-mono-retro text-[10px] text-ink-60">{errorMsg}</p>
          <button onClick={load} className="btn-teal mt-4 px-5 text-[14px]">다시 시도</button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onRefresh={load} at={at}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Tile label="걷는 중" value={`${rows.length}팀`} />
        <Tile label="멈춤" value={`${stalledCount}팀`} warn={stalledCount > 0} />
        <Tile label="오늘 완주" value={`${doneToday}팀`} />
      </div>

      {rows.length === 0 ? (
        <div className="card-paper p-6 text-center">
          <p className="text-[13px] text-ink-60">
            지금 걷는 팀이 없습니다.
            <br />
            투어가 시작되면 여기에 뜹니다.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.user.uid}
              className={`rounded-xl border px-3.5 py-3 ${
                r.stalled ? 'border-rec/50 bg-rec/5' : 'border-line bg-paper'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13.5px] font-bold text-ink">
                  {r.user.nickname}
                </span>
                <span
                  className={`shrink-0 font-mono-retro text-[11px] ${
                    r.stalled ? 'font-bold text-rec' : 'text-ink-60'
                  }`}
                >
                  {r.idleMin === 0 ? '방금' : `${r.idleMin}분 전`}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-ink-60">{r.place}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono-retro text-[10px] text-ink-60">
                <Chip>미션 {r.user.missionCount}</Chip>
                <Chip>쿠폰 {r.user.couponCount}</Chip>
                <Chip>{r.user.totalPoints}p</Chip>
                {r.user.startedAt && (
                  <Chip>출발 {minutesSince(r.user.startedAt)}분째</Chip>
                )}
              </div>
              {r.stalled && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-rec">
                  {STALL_MIN}분 넘게 조용합니다 — 길을 잃었거나, 가게가 닫혔거나,
                  앱이 멈춘 자리일 수 있습니다.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setIncludeAdmin((v) => !v)}
        className="mt-4 w-full text-center font-mono-retro text-[10.5px] text-ink-60 underline"
      >
        {includeAdmin ? '관리자 기록 빼고 보기' : '관리자 기록도 함께 보기'}
      </button>

      <Link
        href="/admin"
        className="mt-3 block rounded-xl border border-line bg-paper px-3.5 py-2.5 text-center text-[12.5px] text-ink"
      >
        📊 집계 화면으로
      </Link>
    </Shell>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-cream-dp px-1.5 py-0.5">{children}</span>
}

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        warn ? 'border-rec/50 bg-rec/5' : 'border-line bg-paper'
      }`}
    >
      <p className="text-[10.5px] text-ink-60">{label}</p>
      <p className={`mt-0.5 font-display text-[16px] ${warn ? 'text-rec' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  )
}

function Shell({
  children,
  onRefresh,
  at,
}: {
  children: React.ReactNode
  onRefresh?: () => void
  at?: number | null
}) {
  return (
    <div className="min-h-screen bg-cream-base">
      <header className="appbar sticky top-0 z-20">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/admin"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream/20 text-[15px] text-cream"
              aria-label="집계 화면으로"
            >
              ←
            </Link>
            <div className="min-w-0">
              <span className="appbar-badge">LIVE</span>
              <h1 className="appbar-title mt-1 text-[19px]">지금 걷는 팀</h1>
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
      <div className="mx-auto max-w-2xl px-4 py-4">
        {at && (
          <p className="mb-2 text-center font-mono-retro text-[10px] text-ink-60">
            {new Date(at).toLocaleTimeString('ko-KR')} 기준 · {REFRESH_MS / 1000}초마다 저절로 갱신
          </p>
        )}
        {children}
      </div>
    </div>
  )
}
