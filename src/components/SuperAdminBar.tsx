'use client'

/**
 * 슈퍼관리자 조작 패널.
 *
 * 모드가 켜져 있음을 알리는 일은 앱바가 맡는다 — 켜지면 티얼이 레드로
 * 바뀐다(globals.css의 .super-admin). 건너뛰며 만든 판을 실제 참여자의
 * 판으로 착각하는 것이 이 종류의 기능에서 제일 잦은 사고인데, 모든 화면에
 * 있고 면적이 넓은 앱바가 그 일에 맞다. 예전엔 맨 위에 글씨 띠를 하나 더
 * 얹었지만 같은 말을 두 번 하는 것이라 걷어냈다.
 *
 * 이 컴포넌트는 이제 조작만 맡는다. 내 설정에서 연다.
 *
 * 상태는 직접 쓰지 않고 tourState의 헬퍼를 거친다 — 조각·빙고·현재 트랙이
 * 서로 물려 있어서 raw로 써 넣으면 조각 없이 B면이 열리는 조합이 나온다.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dispatchQr } from '@/lib/cueEngine'
import {
  SUPER_PANEL_EVENT,
  setSuperAdmin,
  useSuperAdmin,
} from '@/lib/superAdmin'
import { STATIONS } from '@/lib/tracks'
import {
  addCoupon,
  awardFragment,
  completeTrack,
  getTourState,
  mutateTour,
  restartTour,
  setCurrentTrack,
} from '@/lib/tourState'
import { couponForTrack } from '@/lib/coupons'
import { award } from '@/lib/points'
import type { FragmentId } from '@/lib/cues'

/** 거점 다섯 — 넘버링은 카세트 라벨과 같은 A면 표기를 쓴다 */
const TRACKS = [1, 2, 3, 4, 5] as const

export default function SuperAdminBar() {
  const on = useSuperAdmin()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  /*
   * 앱바 색을 바꾼다.
   *
   * 띠는 화면 맨 위 한 줄이라 스크롤 중에는 눈에 잘 안 들어온다. 앱바는
   * 모든 화면에 있고 면적이 넓어서, 색이 다르면 어느 화면에 있든 "지금
   * 보통 상태가 아니다"가 먼저 읽힌다. 티얼(구조색) → 레드.
   *
   * 클래스를 <html>에 걸어 CSS가 .appbar를 한 번에 덮게 한다. 앱바를 쓰는
   * 화면이 여럿이라 컴포넌트마다 색을 넘기면 하나를 빠뜨린다.
   */
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('super-admin', on)
    return () => root.classList.remove('super-admin')
  }, [on])

  // 내 설정에서 여는 신호를 받는다
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(SUPER_PANEL_EVENT, show)
    return () => window.removeEventListener(SUPER_PANEL_EVENT, show)
  }, [])

  if (!on) return null

  /** 그 거점으로 이동 — QR을 찍은 것과 같은 경로를 탄다 */
  const jump = (track: number) => {
    const station = Object.values(STATIONS).find((s) => s.track === track)
    if (!station) return
    setCurrentTrack(track as 1 | 2 | 3 | 4 | 5)
    dispatchQr(station.id)
    setOpen(false)
    router.push(`/track/${track}`)
  }

  /**
   * 그 거점까지 걸어온 것으로 친다.
   *
   * 실제 완주가 주는 것을 빠짐없이 넣는다 — 완료 표시 · 조각 · 쿠폰 ·
   * 포인트. 처음에는 완료 표시와 조각만 넣었는데, 그러면 쿠폰함이 비고
   * 포인트가 0이라 인증서와 랭킹이 실제와 다른 숫자를 보여줬다. 절반만
   * 찬 상태로 시험하면 "인증서에 쿠폰이 왜 없지" 같은 헛다리를 짚는다.
   *
   * 주는 것들은 cueEngine의 runDirective가 큐 종료 때 하는 일과 같다
   * (fragment_award · coupon · track_check). 값을 여기 다시 적지 않고
   * 같은 출처(couponForTrack)를 쓴다 — 쿠폰이 바뀌면 함께 바뀐다.
   *
   * 조각은 트랙 1~4에서만 나온다(FragmentId가 넷). 트랙 5는 B면 편지로
   * 이어지는 자리라 조각을 주지 않는다 — 없는 조각을 만들어 넣으면
   * 피날레에서 개수가 맞지 않는다.
   */
  const completeUpTo = (track: number) => {
    for (let t = 1; t <= track; t++) {
      // 점수는 최초 완료에만 — 두 번 눌러도 중복 적립되지 않는다
      if (!getTourState().tracksCompleted.includes(t)) {
        void award(`main-${t}`, 'mainMission')
      }
      completeTrack(t)
      if (t <= 4) awardFragment(`frag_${t}` as FragmentId)
      const coupon = couponForTrack(t)
      if (coupon) addCoupon(coupon)
    }
    setCurrentTrack(track as 1 | 2 | 3 | 4 | 5)
    setOpen(false)
  }

  const openBingo = () => {
    mutateTour((prev) => ({
      phase: 'act2',
      bingo: { ...prev.bingo, unlocked: true },
    }))
    setOpen(false)
    router.push('/treasure')
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[69] flex items-start justify-center bg-shell/60 px-4 pt-10"
      onClick={() => setOpen(false)}
    >
          <div
            className="w-full max-w-[420px] rounded-2xl bg-paper px-4 pb-4 pt-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-display text-[15px] text-rec">
                🔓 순서 무시 조작
              </p>
              <button
                onClick={() => setOpen(false)}
                className="text-[12px] text-ink-60"
              >
                닫기
              </button>
            </div>

            <Row label="거점으로 이동" hint="QR 없이 그 거점의 도착 큐를 시작합니다">
              {TRACKS.map((t) => (
                <Key key={t} onClick={() => jump(t)}>
                  A{t}
                </Key>
              ))}
            </Row>

            <Row
              label="여기까지 완료 처리"
              hint="조각 · 쿠폰 · 포인트까지 실제 완주와 같게 채웁니다"
            >
              {TRACKS.map((t) => (
                <Key key={t} onClick={() => completeUpTo(t)}>
                  ~A{t}
                </Key>
              ))}
            </Row>

            {/*
              인트로로 돌아가는 길.

              인트로는 테이프를 듣고 전화를 거는 첫 10분인데, 한 번 지나면
              다시 볼 방법이 '처음부터 다시'뿐이었다. 그건 진행을 통째로
              지우므로 인트로 한 곳만 고칠 때는 쓸 수 없다.

              진행은 건드리지 않고 화면만 연다 — 인트로를 끝까지 보면
              phase가 다시 act1로 정리된다.
            */}
            <button
              onClick={() => {
                setOpen(false)
                router.push('/intro')
              }}
              className="mt-3 w-full rounded-lg border border-line bg-cream py-2 text-[12px] font-bold text-ink"
            >
              ▶ 인트로 다시 보기 — 테이프 · 전화
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={openBingo}
                className="rounded-lg border border-line bg-cream py-2 text-[12px] font-bold text-ink"
              >
                🎟️ 빙고 열기
              </button>
              <button
                onClick={() => {
                  restartTour()
                  setOpen(false)
                  router.push('/')
                }}
                className="rounded-lg border border-line bg-cream py-2 text-[12px] font-bold text-ink"
              >
                ↺ 처음부터 다시
              </button>
            </div>

            {/*
              끄는 것으로 되감기지 않는다. 트랙 5까지 건너뛴 뒤 끄면 트랙 5에
              서 있다 — 참여자 흐름을 처음부터 밟으려면 '처음부터 다시'까지.
            */}
            <button
              onClick={() => {
                setSuperAdmin(false)
                setOpen(false)
              }}
              className="mt-2 w-full rounded-lg bg-cream-dp py-2 text-[12px] font-bold text-ink"
            >
              모드 끄기 — 여기서부터 참여자와 같이 진행
            </button>
            <p className="mt-1.5 text-center text-[10.5px] leading-snug text-ink-60">
              꺼도 지금까지 건너뛴 것은 그대로입니다.
              <br />
              관리자 계정의 기록은 콘트롤 패널 집계에서 빠집니다.
            </p>
      </div>
    </div>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[12px] font-bold text-ink">{label}</p>
      <p className="text-[10.5px] text-ink-60">{hint}</p>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5">{children}</div>
    </div>
  )
}

function Key({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-line bg-cream py-2 font-mono-retro text-[12px] font-bold text-ink"
    >
      {children}
    </button>
  )
}
