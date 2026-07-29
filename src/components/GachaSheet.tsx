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
 * **판은 스크롤 없이 한 화면에 든다.** 칸 높이를 남은 공간에서 나눠 갖게
 * 해서(grid-rows-10 + h-full) 화면이 작든 크든 판 전체가 한눈에 보인다.
 * 뽑기판은 '전체를 훑어보다 하나를 짚는' 놀이라, 스크롤이 생기는 순간
 * 고르는 재미가 목록 넘기기가 된다.
 *
 * **이용권이 남아 있으면 판을 닫지 않는다.** 한 장 쓸 때마다 빙고판으로
 * 돌아갔다가 다시 들어오면, 남은 장수를 세는 일이 참여자 몫이 된다.
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
  /** 아직 쓰지 않은 뽑기 이용권 수 — 판 위에 늘 띄운다 */
  ticketsLeft: number
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

export default function GachaSheet({
  seed,
  drawn,
  ticketsLeft,
  onDrawn,
  onClose,
}: Props) {
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

  /** 결과를 접고 판으로 — 남은 이용권이 있을 때만 부른다 */
  const again = () => {
    setShowPrize(false)
    setPhase({ kind: 'ready' })
  }

  const taken = new Set(drawn)
  const opened = phase.kind === 'ready' ? -1 : phase.slot
  /*
    onDrawn이 부모 상태를 바로 고치므로 방금 연 칸도 drawn에 들어 있다.
    여기서 한 번 더 빼면 한 칸이 겹쳐 빠져 숫자가 하나씩 어긋난다.
  */
  const closedLeft = GACHA_SLOTS - taken.size

  /** 위쪽 등수 원판 — 값진 상품부터 셋. 실제 판의 '1등/2등/3등' 자리다 */
  const topPrizes = [...GACHA_PRIZES]
    .sort((a, b) => a.slots - b.slots)
    .slice(0, 3)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#E8722C]">
      {/*
        간판. 주황 방사형 배경 위에 폭발 말풍선 제목과 등수 원판 —
        문방구 뽑기판의 머리를 그대로 옮긴 자리다. 판이 한 화면에 들어야
        하므로 머리는 최소한만 차지한다.
      */}
      <div
        className="relative shrink-0"
        style={{
          paddingTop: 'calc(0.375rem + env(safe-area-inset-top))',
          background:
            'repeating-conic-gradient(from 0deg at 50% 0%, #F2B33D 0deg 7deg, #E8722C 7deg 14deg)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-[calc(0.375rem+env(safe-area-inset-top))] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-shell/45 text-[15px] text-cream"
        >
          ✕
        </button>

        {/* 제목 — 폭발 말풍선 */}
        <div className="flex items-center justify-center gap-2 px-4 pt-1">
          <span
            className="hidden shrink-0 items-center justify-center rounded-md bg-rec px-2 py-1 font-display text-[10px] leading-none text-cream xs:flex"
            style={{ transform: 'rotate(-10deg)' }}
          >
            뽑자
          </span>
          <h2
            className="rounded-xl border-[3px] border-shell bg-cream px-3.5 py-1 text-center font-display text-[20px] leading-tight text-rec"
            style={{
              textShadow: '2px 2px 0 rgba(38,36,34,0.18)',
              boxShadow: '0 3px 0 rgba(38,36,34,0.35)',
            }}
          >
            추억의 뽑기왕
          </h2>
          <span
            className="hidden shrink-0 items-center justify-center rounded-md bg-rec px-2 py-1 font-display text-[10px] leading-none text-cream xs:flex"
            style={{ transform: 'rotate(10deg)' }}
          >
            봉황
          </span>
        </div>

        {/* 등수 원판 — 가장 귀한 상품 셋 */}
        <div className="flex items-start justify-center gap-2 px-4 pb-1.5 pt-1.5">
          {topPrizes.map((p, i) => (
            <div
              key={p.id}
              className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-full border-[3px] bg-paper text-center"
              style={{
                borderColor: ['#D93A2B', '#2E8A80', '#F2B33D'][i],
                transform: `rotate(${[-5, 0, 5][i]}deg)`,
              }}
            >
              <span className="text-[15px] leading-none">{p.emoji}</span>
              <span className="font-mono-retro text-[7px] text-ink-60">
                {i + 1}등
              </span>
            </div>
          ))}
        </div>
      </div>

      {/*
        남은 이용권을 판 위에 늘 세워둔다 — 한 판 더 할 수 있는지를
        참여자가 세지 않아도 되게.
      */}
      <div className="flex shrink-0 items-center justify-center gap-2 bg-shell/85 px-4 py-1.5 text-center">
        <span className="rounded-full bg-sunset-yellow px-2.5 py-0.5 font-mono-retro text-[11px] font-bold text-ink">
          🎟 이용권 {ticketsLeft}장
        </span>
        <span className="text-[11.5px] text-cream/85">
          {phase.kind === 'opening'
            ? '여는 중…'
            : `닫힌 칸 ${closedLeft}개`}
        </span>
      </div>

      {/*
        판. 실제 뽑기판이 파란 바탕에 칸이 촘촘히 박혀 있어 그 결을 따랐다.

        칸 높이를 비율(aspect)로 잡지 않고 **남은 공간을 열 줄로 나눠 갖게**
        한다. 비율로 잡으면 작은 화면에서 판이 화면 밖으로 밀려 스크롤이
        생기는데, 뽑기판은 전체를 훑어보는 물건이라 그러면 안 된다.
      */}
      <div className="min-h-0 flex-1 overflow-hidden bg-[#2E6FA8] px-2 py-2">
        <div className="mx-auto grid h-full w-full max-w-[400px] grid-cols-5 grid-rows-10 gap-1.5">
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
                aria-label={
                  isTaken
                    ? `${slot + 1}번 칸 — 이미 열었어요`
                    : `${slot + 1}번 칸`
                }
                className={`relative flex flex-col items-center justify-center overflow-hidden rounded-lg border-2 transition ${
                  isOpen
                    ? 'border-sunset-yellow bg-sunset-yellow text-ink shadow-[0_0_24px_rgba(242,179,61,0.55)]'
                    : isOpening
                      ? 'border-cream bg-teal text-cream'
                      : isTaken
                        ? // 이미 연 칸 — 종이가 찢겨 안이 드러난 자리.
                          // 흐릿한 ✕가 아니라 **무엇이 나왔는지**를 남긴다.
                          'border-dashed border-cream/25 bg-shell/45 text-cream'
                        : 'border-cream/20 bg-cream/[0.07] text-cream/50 active:scale-95 active:border-sunset-yellow active:bg-cream/20'
                }`}
                style={isOpen ? { animation: 'gacha-pop 0.5s ease-out' } : undefined}
              >
                {/* 칸 번호는 늘 흐리게 — 판이라는 것을 알려주는 눈금이다 */}
                <span className="absolute left-1 top-0 font-mono-retro text-[8px] opacity-50">
                  {String(slot + 1).padStart(2, '0')}
                </span>
                {isOpen ? (
                  <>
                    <span className="text-[20px] leading-none">{prize?.emoji}</span>
                    <span className="font-mono-retro text-[8px]">당첨</span>
                  </>
                ) : isOpening ? (
                  <span className="text-[18px] leading-none">✱</span>
                ) : isTaken ? (
                  <>
                    <span className="text-[17px] leading-none opacity-45">
                      {prize?.emoji}
                    </span>
                    <span className="font-mono-retro text-[7.5px] text-cream/55">
                      뽑음
                    </span>
                  </>
                ) : (
                  <span className="text-[16px] leading-none opacity-60">?</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <p
        className="shrink-0 bg-[#2E6FA8] px-4 pt-1 text-center text-[11px] text-cream/70"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {phase.kind === 'ready'
          ? '마음에 드는 칸을 직접 골라 누르세요 — 어느 칸이든 확률은 같아요'
          : ' '}
      </p>

      {/*
        결과는 판 위에 덮어 띄운다. 발치에 끼워 넣으면 카드가 뜰 때마다
        판이 눌려 칸 크기가 출렁인다 — 방금 어디를 눌렀는지를 잃는다.
      */}
      {phase.kind === 'done' && showPrize && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-shell/70 px-6">
          <div
            className="w-full max-w-[320px] rounded-2xl border-2 border-sunset-yellow bg-paper px-5 py-5 text-center"
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
            {ticketsLeft > 0 ? (
              <>
                <button onClick={again} className="btn-teal mt-4 w-full text-center">
                  한 판 더 · 이용권 {ticketsLeft}장 남음
                </button>
                <button
                  onClick={onClose}
                  className="mt-2 w-full py-2 text-[12.5px] font-bold text-ink-60"
                >
                  나중에 뽑을게요
                </button>
              </>
            ) : (
              <button onClick={onClose} className="btn-teal mt-4 w-full text-center">
                받기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
