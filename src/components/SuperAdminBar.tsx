'use client'

/**
 * 슈퍼관리자 띠 — 모드가 켜져 있는 동안 모든 화면 위에 남는다.
 *
 * 띠를 상시로 두는 이유는 하나다. 건너뛰며 만든 판을 실제 참여자의 판으로
 * 착각하는 것이 이 종류의 기능에서 제일 잦은 사고다. "왜 여기서 소리가
 * 안 나지"를 30분 붙들었는데 알고 보니 앞 단계를 건너뛰어 상태가 없던
 * 것이면, 그 30분은 띠 하나로 막을 수 있었던 시간이다.
 *
 * 눌러서 펼치면 진행을 건너뛰는 조작이 나온다. 상태는 직접 쓰지 않고
 * tourState의 헬퍼를 거친다 — 조각·빙고·현재 트랙이 서로 물려 있어서
 * raw로 써 넣으면 조각 없이 B면이 열리는 조합이 나온다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dispatchQr } from '@/lib/cueEngine'
import { setSuperAdmin, useSuperAdmin } from '@/lib/superAdmin'
import { STATIONS } from '@/lib/tracks'
import {
  awardFragment,
  completeTrack,
  mutateTour,
  restartTour,
  setCurrentTrack,
} from '@/lib/tourState'
import type { FragmentId } from '@/lib/cues'

/** 거점 다섯 — 넘버링은 카세트 라벨과 같은 A면 표기를 쓴다 */
const TRACKS = [1, 2, 3, 4, 5] as const

export default function SuperAdminBar() {
  const on = useSuperAdmin()
  const router = useRouter()
  const [open, setOpen] = useState(false)

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
   * 조각은 트랙 1~4에서만 나온다(FragmentId가 넷). 트랙 5는 B면 편지로
   * 이어지는 자리라 조각을 주지 않는다 — 없는 조각을 만들어 넣으면
   * 피날레에서 개수가 맞지 않는다.
   */
  const completeUpTo = (track: number) => {
    for (let t = 1; t <= track; t++) {
      completeTrack(t)
      if (t <= 4) awardFragment(`frag_${t}` as FragmentId)
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

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-rec px-3 py-1 text-cream"
        style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))' }}
      >
        <span className="font-mono-retro text-[10px] font-bold tracking-[0.2em]">
          슈퍼관리자 · 순서 무시 중
        </span>
        <span className="text-[10px] opacity-80">{open ? '닫기' : '조작 ▾'}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[69] bg-shell/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto mt-9 w-full max-w-[420px] rounded-b-2xl bg-paper px-4 pb-4 pt-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Row label="거점으로 이동" hint="QR 없이 그 거점의 도착 큐를 시작합니다">
              {TRACKS.map((t) => (
                <Key key={t} onClick={() => jump(t)}>
                  A{t}
                </Key>
              ))}
            </Row>

            <Row label="여기까지 완료 처리" hint="조각과 완료 표시를 함께 넣습니다">
              {TRACKS.map((t) => (
                <Key key={t} onClick={() => completeUpTo(t)}>
                  ~A{t}
                </Key>
              ))}
            </Row>

            <div className="mt-3 grid grid-cols-2 gap-2">
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
      )}
    </>
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
