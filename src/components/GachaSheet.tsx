'use client'

/**
 * 골목 뽑기 — 50칸 판에서 한 칸을 연다.
 *
 * 판을 먼저 통째로 보여준다. 무엇이 들어 있는지 모른 채 버튼만 누르면
 * 그냥 결과 통보이고, 상품 목록만 나열하면 뽑는 재미가 없다. 닫힌 칸이
 * 몇 개 남았는지 눈에 보여야 '뽑는다'가 된다.
 *
 * 결과는 진짜 무작위다(gacha.drawPrize — crypto 난수). 화면이 결과를
 * 정하지 않고 뽑은 뒤에 그 칸으로 스크롤해 열어 보인다.
 *
 * 이미 연 칸은 회색으로 남는다. 지워버리면 판이 매번 줄어들어, 뽑을수록
 * 남은 것이 적어진다는 실감이 사라진다.
 */

import { useEffect, useRef, useState } from 'react'
import {
  GACHA_BOARD,
  GACHA_SLOTS,
  drawPrize,
  prizeById,
  type GachaPrize,
} from '@/lib/gacha'
import { playStamp, playBingoLine } from '@/lib/sfx'

interface Props {
  /** 이미 연 칸들 */
  drawn: number[]
  /** 한 칸을 열었다 — 저장과 상품 지급은 부모가 한다 */
  onDrawn: (slot: number, prize: GachaPrize) => void
  onClose: () => void
}

type Phase = { kind: 'ready' } | { kind: 'rolling' } | { kind: 'done'; slot: number; prize: GachaPrize }

export default function GachaSheet({ drawn, onDrawn, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  /** 굴리는 동안 칸 위를 훑는 표시 — 연출일 뿐 결과와 무관하다 */
  const [cursor, setCursor] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const roll = () => {
    if (phase.kind !== 'ready') return
    const result = drawPrize(drawn)
    if (!result) {
      onClose()
      return
    }

    setPhase({ kind: 'rolling' })
    /*
      결과는 이미 정해졌다. 훑는 연출은 눈으로 따라갈 시간을 주는 것뿐이라
      1.2초에서 멈춘다 — 더 끌면 기다림이 되고, 이 앱은 기다리게 하지 않는다.
    */
    timer.current = setInterval(() => {
      setCursor((c) => (c + 7) % GACHA_SLOTS)
    }, 60)
    setTimeout(() => {
      if (timer.current) clearInterval(timer.current)
      setCursor(result.slot)
      setPhase({ kind: 'done', slot: result.slot, prize: result.prize })
      if (result.prize.tier === 'legend') playBingoLine()
      else playStamp()
      onDrawn(result.slot, result.prize)
    }, 1200)
  }

  const taken = new Set(drawn)
  const opened = phase.kind === 'done' ? phase.slot : -1

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-shell/70 px-4 sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-[420px] overflow-y-auto rounded-t-2xl bg-cream-base px-5 pb-8 pt-5 sm:rounded-2xl"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono-retro text-[11px] tracking-[0.25em] text-rec">
            골목 뽑기
          </p>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-[18px] text-ink-60"
          >
            ✕
          </button>
        </div>

        <p className="text-center text-[12.5px] leading-relaxed text-ink-60">
          빙고 한 줄을 더 채웠어요.
          <br />
          닫힌 칸 <b className="text-ink">{GACHA_SLOTS - taken.size}</b>개 중
          하나가 열립니다.
        </p>

        {/* 50칸 판 — 10열 5행 */}
        <div className="mt-4 grid grid-cols-10 gap-1">
          {GACHA_BOARD.map((prizeId, slot) => {
            const isTaken = taken.has(slot) && slot !== opened
            const isOpen = slot === opened
            const isCursor = phase.kind === 'rolling' && slot === cursor
            const prize = prizeById(prizeId)
            return (
              <div
                key={slot}
                className={`flex aspect-square items-center justify-center rounded text-[13px] ${
                  isOpen
                    ? 'bg-sunset-yellow text-ink'
                    : isTaken
                      ? 'bg-cream-dp text-ink-60/40'
                      : isCursor
                        ? 'bg-teal text-cream'
                        : 'bg-paper text-ink-60'
                }`}
                style={
                  isOpen ? { animation: 'fadeIn 0.5s ease-in-out' } : undefined
                }
              >
                {/* 열린 칸만 무엇이었는지 보인다 */}
                {isOpen ? prize?.emoji : isTaken ? '·' : ''}
              </div>
            )
          })}
        </div>

        {phase.kind === 'done' ? (
          <div className="mt-5 rounded-2xl border-2 border-sunset-yellow bg-paper px-5 py-6 text-center">
            <p className="text-[44px] leading-none" aria-hidden>
              {phase.prize.emoji}
            </p>
            {phase.prize.tier === 'legend' && (
              <p className="mt-2 font-mono-retro text-[10px] tracking-[0.25em] text-rec">
                오늘 단 하나
              </p>
            )}
            <p className="mt-2 font-display text-[19px] text-ink">
              {phase.prize.name}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
              {phase.prize.note}
            </p>
            <button onClick={onClose} className="btn-teal mt-5 w-full text-center">
              받기
            </button>
          </div>
        ) : (
          <button
            onClick={roll}
            disabled={phase.kind === 'rolling'}
            className="btn-teal mt-5 w-full text-center disabled:opacity-60"
          >
            {phase.kind === 'rolling' ? '뽑는 중…' : '🎁 한 칸 열기'}
          </button>
        )}
      </div>
    </div>
  )
}
