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
import { playBingoLine } from '@/lib/sfx'
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
  /** 2막 여는 대사가 끝난 직후 한 번 띄우는 안내 */
  const [welcome, setWelcome] = useState(false)

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
      /*
        여러 줄이 한꺼번에 완성돼도 한 번만 낸다 — 같은 소리를 겹쳐 내면
        줄 수가 아니라 잡음으로 들린다. 몇 줄인지는 화면 숫자가 말한다.
      */
      playBingoLine()
    }
  }, [lines, tour.bingo.lines])

  /*
    2막 여는 대사(B6_0)가 끝나면 안내를 한 번 띄운다.

    소영이 "골목마다 내 어릴 적 얘기가 숨어 있어"까지 말하고 카드가 사라지면
    빙고판만 남는데, 그 순간 무엇을 해야 하는지 아무도 말해주지 않는다.
    칸을 눌러 기록하는 놀이라는 것을 그때 한 번만 알려준다.

    셀 한마디(B6_X_*)에는 띄우지 않는다 — 그건 이미 하고 있는 일에 대한
    반응이라 같은 안내를 반복하면 잔소리가 된다.
  */
  useEffect(() => {
    if (cueState.cueId === 'B6_0' && cueState.ended) setWelcome(true)
  }, [cueState.cueId, cueState.ended])

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
        머리는 다른 탭과 같은 앱바 하나 — 뱃지 · 제목 · 진행 칩.
        한때 아래 트랙바를 앱바 안으로 합쳐 높이를 아꼈지만, 다섯 탭이
        같은 머리를 쓰는 규칙이 이 화면에서만 깨졌다. 높이는 빙고 칸을
        정사각으로 줄여 되찾는다.
      */}
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">2막 · 소영이 자란 동네</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">골목 빙고</h1>
            {/* 발견 수는 앱바로 — 다른 탭의 'N / 5'와 같은 자리다 */}
            <span className="shrink-0 rounded-full bg-cream/20 px-3 py-1 font-mono-retro text-[11px] font-bold">
              {act2Done} / 20
            </span>
          </div>
        </div>
      </header>

      {/* 트랙바 — 수집 진행률. 릴 두 개가 도는 자리다 */}
      <div className="trackbar px-4 py-3">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between font-mono-retro text-[10px] text-sunset">
            <span>빙고 {lines}줄</span>
            {/* 누적 포인트 — 여기서 다른 보너스 미션으로 이어지게 하는 고리다 */}
            <span className="font-display text-[13px] text-cream">
              {myPoints.toLocaleString()}P
            </span>
          </div>
          {/*
            채운 칸만큼 왼쪽에서 풀려 오른쪽에 감긴다. 둘 다 돈다 —
            한쪽만 돌면 테이프가 어디로 가는지가 보이지 않는다.
          */}
          <div className="tape-prog mt-2">
            <div
              className="reel spin"
              style={{ '--fill': 1 - act2Done / 20 } as React.CSSProperties}
            >
              <span className="hub" />
            </div>
            <div className="bar">
              <i style={{ width: `${(act2Done / 20) * 100}%` }} />
            </div>
            <div
              className="reel spin"
              style={{ '--fill': act2Done / 20 } as React.CSSProperties}
            >
              <span className="hub" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-5">
        {/*
          소영의 한마디 — 말하는 동안에만 띄운다.

          예전에는 큐가 끝난 뒤에도 통화 카드가 남아서, 빙고판 위에 다 끝난
          대사와 눌리지 않는 데크가 계속 얹혀 있었다. 한 화면에 '듣는 것'과
          '고르는 것'이 겹치니 지금 무엇을 하는 화면인지가 흐려진다.

          끝나면 카드를 내리고, 대신 할 일을 한 줄로 알린다(아래 안내).
          큐 ID는 B6_X_* — 'C6'은 v1 시절 접두사라 영영 거짓이었다.
        */}
        {cueState.cueId?.startsWith('B6') && !cueState.ended && (
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
      {/*
        2막 시작 안내 — 대사가 끝나고 빙고판만 남은 그 순간에 한 번.
        칸을 채우는 확인 대화상자와 같은 생김새를 쓴다. 이 화면에서 무언가
        물어보는 창은 하나의 모양이어야 한다.
      */}
      {welcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-shell/80 px-6">
          <div className="w-full max-w-[320px] rounded-2xl bg-paper p-6 text-center">
            <div className="text-4xl">🗺️</div>
            <h3 className="mt-2 font-display text-[17px] text-ink">
              골목의 숨겨진 이야기를
              <br />더 발견해 보세요
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
              마음에 드는 곳을 만나면 그 칸을 눌러 기록으로 남기세요.
              <br />
              가로·세로·대각선 5칸을 이으면 빙고입니다.
            </p>
            <button
              onClick={() => setWelcome(false)}
              className="mt-4 w-full rounded-xl bg-teal py-3 font-display text-[14px] text-cream"
            >
              둘러보기 ▶
            </button>
          </div>
        </div>
      )}

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
