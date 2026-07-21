'use client'

/**
 * S30 — 2막 골목 빙고 (5×5).
 *
 * 다섯 소원 완료(phase=act2) 전에는 잠긴다 — 강제 해제 없음.
 * 대각선 5칸은 1막 소원(자동 완료), 나머지 20칸은 자유 탐험 셀.
 * 줄 판정은 실제 12줄(행·열·대각) 기준이며, 새 줄마다 쿠폰을 준다.
 * 소영의 큐가 연결된 셀(분식점·벽화골목·봉황대)은 완료 시 한마디가 재생된다.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import CuePlayer from '@/components/cue/CuePlayer'
import Navigation from '@/components/Navigation'
import { useCue } from '@/hooks/useCue'
import { useTourState } from '@/hooks/useTourState'
import { BoardCell, buildBoard, countLines } from '@/lib/bingoCells'
import { BINGO_LOCKED_MESSAGE } from '@/lib/cues'
import { dispatchAction, dispatchTap, unlockAudio } from '@/lib/cueEngine'
import { markBingoCell, mutateTour, addCoupon } from '@/lib/tourState'
import { POINTS, awardPoints } from '@/lib/score'

export default function BingoPage() {
  const tour = useTourState()
  const cueState = useCue()
  const router = useRouter()
  const [pendingCell, setPendingCell] = useState<BoardCell | null>(null)

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

  // 줄 수가 늘면 저장 + 새 줄마다 쿠폰·점수 (스펙: 줄 완성=쿠폰)
  useEffect(() => {
    if (lines > tour.bingo.lines) {
      for (let i = tour.bingo.lines + 1; i <= lines; i++) {
        addCoupon(`bingo-line-${i}`)
        awardPoints(`bingo-line-${i}`, POINTS.bingoLine)
      }
      mutateTour((prev) => ({ bingo: { ...prev.bingo, lines } }))
    }
  }, [lines, tour.bingo.lines])

  // ---------- 잠금 화면 ----------
  if (!tour.bingo.unlocked) {
    return (
      <div className="min-h-screen bg-cream-base pb-32">
        <header className="appbar px-4 pb-3 pt-3">
          <div className="mx-auto max-w-md">
            <span className="appbar-badge">SIDE B · 골목 빙고</span>
            <h1 className="appbar-title mt-1 text-[19px]">🔒 잠겨 있어요</h1>
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
    awardPoints(pendingCell.id, POINTS.bingoCell)
    if (pendingCell.cueAction) {
      dispatchAction(pendingCell.cueAction)
    }
    setPendingCell(null)
  }

  const handleFinish = () => {
    unlockAudio()
    dispatchTap('FINISH')
    router.push('/finale')
  }

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">2막 · 소영이 자란 동네</span>
          <h1 className="appbar-title mt-1 text-[19px]">골목 빙고</h1>
        </div>
      </header>

      {/* 트랙바 — 수집 진행률 */}
      <div className="trackbar px-4 py-3">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between font-mono-retro text-[10px] text-sunset">
            <span>
              발견 {act2Done} / 20 · 빙고 {lines}줄
            </span>
            <span className="rec-dot">REC</span>
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
      </div>

      <div className="mx-auto max-w-md px-4 py-5">
        {/* 소영의 한마디 (C6_x) 재생 중이면 표시 */}
        {cueState.cueId?.startsWith('C6') && (
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
            가로·세로·대각선 5칸을 이으면 빙고 — 줄마다 상점 쿠폰을 드려요.
          </p>
          {tour.coupons.length > 0 && (
            <p className="mt-2 font-mono-retro text-[11px] text-teal">
              🎟 보유 쿠폰 {tour.coupons.length}장
            </p>
          )}
        </div>

        {/* 투어 마치기 */}
        <button onClick={handleFinish} className="btn-teal w-full text-[15px]">
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

      <Navigation />
    </div>
  )
}
