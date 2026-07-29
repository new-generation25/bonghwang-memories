'use client'

/**
 * 추억의 뽑기왕 — 50칸 판에서 한 칸을 고른다.
 *
 * 옛날 문방구 앞에 걸려 있던 종이 뽑기판을 그대로 가져왔다. 주황 방사형
 * 배경, 폭발 말풍선 제목, 등수 원판, 파란 격자 — 그 판을 본 적 있는
 * 사람에게는 설명이 필요 없고, 없는 사람에게도 '뽑는 판'으로 읽힌다.
 * 1988년을 걷는 앱이라 이 그림이 이야기와 같은 자리에 선다.
 *
 * **참여자가 직접 고른다.** 버튼을 누르면 기계가 뽑아주던 것을 바꿨다 —
 * 판 앞에서 손가락을 옮기다 하나를 짚던 그 순간이 이 놀이의 전부인데,
 * 그것을 앱이 대신하면 남는 것은 결과 통보뿐이다.
 *
 * 판은 사람마다 섞여 있다(gacha.boardFor — 계정 시드). 어느 칸을 고르든
 * 확률은 같고, 누가 "17번이 카세트더라"라고 알려도 소용이 없다.
 *
 * 화면을 꽉 채운다. 예전에는 420px 시트에 10열을 욱여넣어 칸 하나가
 * 40px이었다 — 판이 아니라 점 무더기로 보였다. 5열 10행이면 세로 화면에서
 * 칸이 손가락만 해진다.
 *
 * 이미 연 칸은 회색으로 남는다. 지워버리면 판이 매번 줄어들어, 뽑을수록
 * 남은 것이 적어진다는 실감이 사라진다.
 */

import { useEffect, useRef, useState } from 'react'
import {
  GACHA_PRIZES,
  GACHA_SLOTS,
  boardFor,
  openSlot,
  prizeById,
  type GachaPrize,
} from '@/lib/gacha'
import { playStamp, playBingoLine, playDeckKey } from '@/lib/sfx'

interface Props {
  /** 판 배치를 정하는 시드 — 계정마다 다르다 */
  seed: string
  /** 이미 연 칸들 */
  drawn: number[]
  /** 한 칸을 열었다 — 저장과 상품 지급은 부모가 한다 */
  onDrawn: (slot: number, prize: GachaPrize) => void
  onClose: () => void
}

type Phase =
  | { kind: 'ready' }
  /** 고른 칸을 여는 중 — 뜸을 들여야 여는 맛이 난다 */
  | { kind: 'opening'; slot: number }
  | { kind: 'done'; slot: number; prize: GachaPrize }

/** 여는 연출 길이. 더 끌면 기다림이 된다 — 이 앱은 기다리게 하지 않는다 */
const OPEN_MS = 900

export default function GachaSheet({ seed, drawn, onDrawn, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  /** 결과 카드는 칸이 열리는 것을 본 뒤에 올라온다 */
  const [showPrize, setShowPrize] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const board = useRef(boardFor(seed)).current

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const pick = (slot: number) => {
    if (phase.kind !== 'ready') return
    const result = openSlot(seed, slot, drawn)
    if (!result) return

    setPhase({ kind: 'opening', slot })
    playDeckKey('play')

    timer.current = setTimeout(() => {
      setPhase({ kind: 'done', slot, prize: result.prize })
      if (result.prize.tier === 'legend') playBingoLine()
      else playStamp()
      onDrawn(slot, result.prize)
      timer.current = setTimeout(() => setShowPrize(true), 480)
    }, OPEN_MS)
  }

  const taken = new Set(drawn)
  const opened = phase.kind === 'ready' ? -1 : phase.slot
  const left = GACHA_SLOTS - taken.size - (phase.kind === 'done' ? 1 : 0)

  /** 위쪽 등수 원판 — 값진 상품부터 셋. 실제 판의 '1등/2등/3등' 자리다 */
  const topPrizes = [...GACHA_PRIZES]
    .sort((a, b) => a.slots - b.slots)
    .slice(0, 3)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#E8722C]">
      {/*
        간판. 주황 방사형 배경 위에 폭발 말풍선 제목과 등수 원판 —
        문방구 뽑기판의 머리를 그대로 옮긴 자리다. 닫기 버튼만 그 위에 뜬다.
      */}
      <div
        className="relative shrink-0"
        style={{
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
          background:
            'repeating-conic-gradient(from 0deg at 50% 0%, #F2B33D 0deg 7deg, #E8722C 7deg 14deg)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-shell/45 text-[16px] text-cream"
        >
          ✕
        </button>

        {/* 제목 — 폭발 말풍선 */}
        <div className="flex items-center justify-center gap-2 px-4 pt-1.5">
          <span
            className="hidden shrink-0 items-center justify-center rounded-md bg-rec px-2 py-1 font-display text-[11px] leading-none text-cream xs:flex"
            style={{ transform: 'rotate(-10deg)' }}
          >
            뽑자
          </span>
          <h2
            className="rounded-xl border-[3px] border-shell bg-cream px-4 py-1.5 text-center font-display text-[24px] leading-tight text-rec"
            style={{
              textShadow: '2px 2px 0 rgba(38,36,34,0.18)',
              boxShadow: '0 3px 0 rgba(38,36,34,0.35)',
            }}
          >
            추억의 뽑기왕
          </h2>
          <span
            className="hidden shrink-0 items-center justify-center rounded-md bg-rec px-2 py-1 font-display text-[11px] leading-none text-cream xs:flex"
            style={{ transform: 'rotate(10deg)' }}
          >
            봉황
          </span>
        </div>

        {/* 등수 원판 — 가장 귀한 상품 셋 */}
        <div className="flex items-start justify-center gap-2 px-4 pb-2 pt-2">
          {topPrizes.map((p, i) => (
            <div
              key={p.id}
              className="flex h-[62px] w-[62px] shrink-0 flex-col items-center justify-center rounded-full border-[3px] bg-paper text-center"
              style={{
                borderColor: ['#D93A2B', '#2E8A80', '#F2B33D'][i],
                transform: `rotate(${[-5, 0, 5][i]}deg)`,
              }}
            >
              <span className="text-[18px] leading-none">{p.emoji}</span>
              <span className="mt-0.5 font-mono-retro text-[8px] text-ink-60">
                {i + 1}등
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="shrink-0 bg-shell/85 px-5 py-2 text-center text-[12px] text-cream/85">
        {phase.kind === 'ready' ? (
          <>
            마음에 드는 칸을 <b className="text-sunset-yellow">직접</b> 골라
            누르세요 · 닫힌 칸 {left}개
          </>
        ) : phase.kind === 'opening' ? (
          <>여는 중…</>
        ) : (
          <>열었습니다 · 닫힌 칸 {left}개</>
        )}
      </p>

      {/*
        판. 실제 뽑기판이 파란 바탕에 칸이 촘촘히 박혀 있어 그 결을 따랐다.
        5열 10행이라 세로 화면에서 칸이 손가락만 해진다.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#2E6FA8] px-3 py-3">
        <div className="mx-auto grid w-full max-w-[440px] grid-cols-5 gap-2">
          {board.map((prizeId, slot) => {
            const isTaken = taken.has(slot) && slot !== opened
            const isOpening = phase.kind === 'opening' && slot === opened
            const isOpen = phase.kind === 'done' && slot === opened
            const prize = prizeById(prizeId)
            const clickable = phase.kind === 'ready' && !isTaken
            return (
              <button
                key={slot}
                type="button"
                disabled={!clickable}
                onClick={() => pick(slot)}
                aria-label={`${slot + 1}번 칸`}
                className={`relative flex aspect-[4/5] flex-col items-center justify-center rounded-lg border-2 transition ${
                  isOpen
                    ? 'border-sunset-yellow bg-sunset-yellow text-ink shadow-[0_0_24px_rgba(242,179,61,0.55)]'
                    : isOpening
                      ? 'border-cream bg-teal text-cream'
                      : isTaken
                        ? 'border-cream/10 bg-cream/5 text-cream/25'
                        : 'border-cream/20 bg-cream/[0.07] text-cream/50 active:scale-95 active:border-sunset-yellow active:bg-cream/20'
                }`}
                style={isOpen ? { animation: 'gacha-pop 0.5s ease-out' } : undefined}
              >
                {/* 칸 번호는 늘 흐리게 — 판이라는 것을 알려주는 눈금이다 */}
                <span className="absolute left-1 top-0.5 font-mono-retro text-[9px] opacity-50">
                  {String(slot + 1).padStart(2, '0')}
                </span>
                {isOpen ? (
                  <>
                    <span className="text-[26px] leading-none">{prize?.emoji}</span>
                    <span className="mt-1 font-mono-retro text-[8.5px]">당첨</span>
                  </>
                ) : isOpening ? (
                  <span className="text-[20px] leading-none">✱</span>
                ) : isTaken ? (
                  <span className="text-[15px] leading-none">✕</span>
                ) : (
                  <span className="text-[17px] leading-none opacity-60">?</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 발치 — 안내 또는 결과 */}
      <div
        className="shrink-0 bg-[#2E6FA8] px-5 pt-2"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        {phase.kind === 'done' && showPrize ? (
          <div
            className="rounded-2xl border-2 border-sunset-yellow bg-paper px-5 py-5 text-center"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            <p className="text-[46px] leading-none" aria-hidden>
              {phase.prize.emoji}
            </p>
            {phase.prize.tier === 'legend' && (
              <p className="mt-1.5 font-mono-retro text-[10px] tracking-[0.25em] text-rec">
                오늘 단 하나
              </p>
            )}
            <p className="mt-1.5 font-display text-[19px] text-ink">
              {phase.prize.name}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-60">
              {phase.prize.note}
            </p>
            <button onClick={onClose} className="btn-teal mt-4 w-full text-center">
              받기
            </button>
          </div>
        ) : (
          <p className="py-3 text-center text-[11.5px] text-cream/70">
            {phase.kind === 'ready'
              ? '판은 사람마다 다르게 섞여 있어요 — 어느 칸이든 확률은 같아요'
              : ' '}
          </p>
        )}
      </div>
    </div>
  )
}
