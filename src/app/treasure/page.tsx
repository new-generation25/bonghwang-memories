'use client'

/**
 * S30 — 2막 골목 빙고 (5×5).
 *
 * 다섯 소원 완료(phase=act2) 전에는 잠긴다 — 강제 해제 없음.
 * 대각선 5칸은 1막 소원(자동 완료), 나머지 20칸은 자유 탐험 셀.
 * 줄 판정은 실제 12줄(행·열·대각) 기준이며, 새 줄마다 포인트와 아이템을 준다.
 * 소영의 큐가 연결된 셀(분식점·벽화골목·봉황대)은 완료 시 한마디가 재생된다.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import CuePlayer from '@/components/cue/CuePlayer'
import Navigation from '@/components/Navigation'
import { useCue } from '@/hooks/useCue'
import { useTourState } from '@/hooks/useTourState'
import { BoardCell, buildBoard, countLines } from '@/lib/bingoCells'
import { bingoOpen, useSuperAdmin } from '@/lib/superAdmin'
import { BINGO_LOCKED_MESSAGE } from '@/lib/cues'
import { dispatchAction, dispatchTap, unlockAudio } from '@/lib/cueEngine'
import { markBingoCell, mutateTour, addCoupon } from '@/lib/tourState'
import {
  POINT_TABLE,
  POINTS_EVENT,
  award,
  localPointTotal,
} from '@/lib/points'
import { logEvent } from '@/lib/analytics'

export default function BingoPage() {
  const tour = useTourState()
  // 모드를 켜면 잠금 화면이 그 자리에서 열려야 한다
  useSuperAdmin()
  const cueState = useCue()
  const router = useRouter()
  const [pendingCell, setPendingCell] = useState<BoardCell | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)

  const board = useMemo(() => buildBoard(), [])

  // 완료 포지션: 대각선(트랙 완료) + 2막 셀
  const donePositions = useMemo(() => {
    const set = new Set<number>()
    for (const cell of board) {
      if (cell.kind === 'main' && cell.track && tour.tracksCompleted.includes(cell.track)) {
        set.add(cell.position)
      }
      if (cell.kind === 'act2' && tour.bingo.cellsDone.includes(cell.id)) {
        set.add(cell.position)
      }
    }
    return set
  }, [board, tour.tracksCompleted, tour.bingo.cellsDone])

  const lines = useMemo(() => countLines(donePositions), [donePositions])

  // 빙고판 상단에 누적 포인트를 띄운다. 칸을 채울 때마다 그 자리에서 올라가야
  // 다음 칸으로 이어진다 — 점수를 보려고 다른 화면에 다녀오게 하면 끊긴다.
  const [myPoints, setMyPoints] = useState(0)
  useEffect(() => {
    const sync = () => setMyPoints(localPointTotal())
    sync()
    window.addEventListener(POINTS_EVENT, sync)
    return () => window.removeEventListener(POINTS_EVENT, sync)
  }, [])

  // 줄 수가 늘면 저장 + 새 줄마다 포인트·아이템
  useEffect(() => {
    if (lines > tour.bingo.lines) {
      for (let i = tour.bingo.lines + 1; i <= lines; i++) {
        addCoupon(`bingo-line-${i}`)
        void award(`bingo-line-${i}`, 'treasureLine')
        logEvent('bingo_line', { n: i })
      }
      mutateTour((prev) => ({ bingo: { ...prev.bingo, lines } }))
    }
  }, [lines, tour.bingo.lines])

  // ---------- 잠금 화면 (리허설 빌드·슈퍼관리자는 통과) ----------
  if (!tour.bingo.unlocked && !bingoOpen()) {
    return (
      <div className="min-h-screen bg-cream-base pb-32">
        <header className="appbar px-4 pb-3 pt-3">
          <div className="mx-auto max-w-md">
            <span className="appbar-badge">SIDE B · 골목 빙고</span>
            <div className="mt-1 flex items-end justify-between gap-3">
              <h1 className="appbar-title text-[19px]">🔒 잠겨 있어요</h1>
              {/* 잠긴 화면에서도 머리 높이를 맞춘다. 칩에는 무엇을 채우면
                  열리는지를 넣어 잠금 안내와 진행도를 한 줄로 잇는다. */}
              <span className="shrink-0 rounded-full bg-cream/20 px-3 py-1 font-mono-retro text-[11px] font-bold">
                {tour.tracksCompleted.length} / 5
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-md px-4 py-12 text-center">
          <div className="card-paper p-8 shadow-lg">
            <div className="mb-5 text-6xl">🔐</div>
            <p className="font-pen text-[21px] leading-relaxed text-ink">
              {BINGO_LOCKED_MESSAGE}
            </p>
            <div className="mt-5 rounded-lg bg-cream p-4">
              <p className="font-handwriting text-ink-60">
                소원 진행률: {tour.tracksCompleted.length}/5
              </p>
              <div className="mt-2 h-3 w-full rounded-full bg-cream-dp">
                <div
                  className="h-3 rounded-full bg-sunset transition-all duration-500"
                  style={{ width: `${(tour.tracksCompleted.length / 5) * 100}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => router.push('/play')}
              className="btn-teal mt-6 w-full text-[14px]"
            >
              📼 소원 이어가기
            </button>
          </div>
        </div>

        <Navigation />
      </div>
    )
  }

  // ---------- 빙고 보드 ----------
  const act2Done = tour.bingo.cellsDone.length

  const handleCellTap = (cell: BoardCell) => {
    if (cell.kind === 'main') return
    if (tour.bingo.cellsDone.includes(cell.id)) return
    setPendingCell(cell)
  }

  const confirmCell = () => {
    if (!pendingCell) return
    unlockAudio()
    markBingoCell(pendingCell.id)
    void award(`bingo-cell-${pendingCell.id}`, 'bonusMission')
    if (pendingCell.cueAction) {
      dispatchAction(pendingCell.cueAction)
    }
    setPendingCell(null)
  }

  // 투어 종료는 되돌릴 수 없다(피날레에서 phase='done' 확정).
  // 셀 하나 체크에도 확인을 받으면서 종료만 즉시 실행하던 비대칭을 없앤다.
  const handleFinish = () => {
    unlockAudio()
    dispatchTap('FINISH')
    router.push('/finale')
  }

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      {/*
        머리를 하나로 합쳤다.

        전에는 앱바(제목) 아래에 트랙바(릴·진행바)가 따로 얹혀 색 띠가 둘로
        갈렸다. 보기에 어수선한 것보다 문제는 높이였다 — 둘이 140px을 먹어서
        빙고판과 그 아래 설명이 한 화면에 들어오지 않았다. 릴과 바를 앱바
        안으로 들여 40px 남짓을 돌려준다.

        수치 셋의 자리: 발견 수(N/20)는 제목 옆 — 다른 탭의 'N / 5'와 같은
        자리다. 줄 수는 뱃지 줄 오른쪽, 누적 포인트는 그 아래. 포인트는
        다른 보너스 미션으로 이어지는 고리라 작게라도 남긴다.
      */}
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <span className="appbar-badge">2막 · 소영이 자란 동네</span>
            <span className="shrink-0 font-mono-retro text-[10px] text-sunset">
              빙고 {lines}줄
            </span>
          </div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">골목 빙고</h1>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-display text-[13px] text-cream">
                {myPoints.toLocaleString()}P
              </span>
              <span className="rounded-full bg-cream/20 px-3 py-1 font-mono-retro text-[11px] font-bold">
                {act2Done} / 20
              </span>
            </div>
          </div>
          <div className="tape-prog mt-2">
            <div className="reel spin">
              <span className="hub" />
            </div>
            <div className="bar">
              <i style={{ width: `${(act2Done / 20) * 100}%` }} />
            </div>
            <div className="reel">
              <span className="hub" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-5">
        {/* 소영의 한마디 (C6_x) 재생 중이면 표시 */}
        {/* 큐 ID는 B6_X_* — 'C6'은 v1 시절 접두사라 영영 거짓이었다 */}
        {cueState.cueId?.startsWith('B6') && (
          <div className="mb-4">
            <CuePlayer />
          </div>
        )}

        {/* 보드 */}
        <div className="card-paper mb-5 p-3 shadow-lg">
          <div className="grid grid-cols-5 gap-1.5">
            {board.map((cell) => {
              const done = donePositions.has(cell.position)
              return (
                <button
                  key={cell.position}
                  onClick={() => handleCellTap(cell)}
                  className={`bingo-cell flex flex-col items-center justify-center p-1 ${
                    done ? 'completed' : ''
                  }`}
                >
                  {done ? (
                    <>
                      <span className="text-base font-black">✓</span>
                      <span className="mt-0.5 font-mono-retro text-[7px] opacity-90">
                        {cell.kind === 'main' ? 'SIDE A' : 'REC'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">{cell.emoji}</span>
                      <span className="mt-0.5 text-center text-[8px] font-bold leading-tight">
                        {cell.title}
                      </span>
                    </>
                  )}
                  <span
                    className={`absolute left-0.5 top-0.5 font-mono-retro text-[6px] ${
                      done ? 'text-cream/70' : 'text-ink-60/70'
                    }`}
                  >
                    {String(cell.position + 1).padStart(2, '0')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 안내 */}
        <div className="card-paper mb-5 p-4 shadow-lg">
          <p className="text-[12px] leading-relaxed text-ink-60">
            골목을 걷다가 마음에 드는 곳을 발견하면 칸을 눌러 기록하세요.
            가로·세로·대각선 5칸을 이으면 빙고 — 빙고를 완성할 때마다
            포인트 또는 아이템을 얻을 수 있어요.
          </p>
          <p className="mt-2 font-mono-retro text-[11px] text-teal">
            칸 하나 +{POINT_TABLE.bonusMission}P · 빙고 한 줄 +
            {POINT_TABLE.treasureLine}P
          </p>
        </div>

        {/* 투어 마치기 */}
        <button
          onClick={() => setConfirmFinish(true)}
          className="btn-teal w-full text-[15px]"
        >
          🎬 투어 마치기 — 우리의 테이프 만들기
        </button>
      </div>

      {/* 셀 완료 확인 */}
      {pendingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-shell/80 px-6">
          <div className="w-full max-w-[320px] rounded-2xl bg-paper p-6 text-center">
            <div className="text-4xl">{pendingCell.emoji}</div>
            <h3 className="mt-2 font-display text-[17px] text-ink">
              {pendingCell.title}
            </h3>
            <p className="mt-1 text-[12.5px] text-ink-60">
              이 골목을 발견하셨나요? 기록으로 남길게요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPendingCell(null)}
                className="flex-1 rounded-xl border border-line bg-cream py-3 text-[13px] text-ink"
              >
                아직이요
              </button>
              <button
                onClick={confirmCell}
                className="flex-1 rounded-xl bg-teal py-3 font-display text-[14px] text-cream"
              >
                발견했어요 ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 투어 종료 확인 — 되돌릴 수 없는 전환이라 한 번 묻는다 */}
      {confirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-shell/80 px-6">
          <div className="w-full max-w-[320px] rounded-2xl bg-paper p-6 text-center">
            <div className="text-4xl">🎬</div>
            <h3 className="mt-2 font-display text-[17px] text-ink">
              오늘의 투어를 마칠까요?
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
              지금까지의 기록으로 &lsquo;우리의 테이프&rsquo;를 만듭니다.
              마치고 나면 골목 빙고로 돌아올 수 없어요.
            </p>
            <p className="mt-2 font-mono-retro text-[11px] text-teal">
              발견 {act2Done} / 20 · 빙고 {lines}줄
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmFinish(false)}
                className="flex-1 rounded-xl border border-line bg-cream py-3 text-[13px] text-ink"
              >
                더 걸을래요
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 rounded-xl bg-teal py-3 font-display text-[14px] text-cream"
              >
                마칠게요 ✓
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  )
}
