'use client'

/**
 * J-카드 — 케이스 속지에 아버지가 눌러 적은 다섯 소원 (F-1).
 *
 * '기억의 조각'을 대체하는 수집 구조이자, 이제 진행도 화면 그 자체다 —
 * /me의 투어 진행도 카드가 하던 일(어디까지 왔나·가게 이름·빙고 요약)을
 * 이 카드가 흡수했다. 같은 다섯 소원을 두 카드가 반복하면 화면이 두 번
 * 말하게 된다.
 *
 * 줄은 따로 저장하지 않고 트랙 완료(tracksCompleted)에서 파생한다 —
 * 조각은 늘 트랙 완료와 같은 큐에서 지급돼 두 상태가 어긋날 길이 없었고,
 * 그렇다면 상태는 하나면 된다.
 *
 * 다섯째 줄은 영원히 채워지지 않는다. 잠금 아이콘이 아니라 '아버지의 몫'
 * 이라는 상태 문구다 — 미완이 실패가 아니라 이야기의 결말이기 때문이다
 * (B5_F "마지막 하나는 남겨둘게요"). 결말을 미리 새기는 문구는 두지
 * 않는다 — 피날레가 말할 것을 카드가 먼저 말하면 스포일러다.
 *
 * SIDE B 칸은 편지를 들어야 생긴다. album_build 지시자(B5_F 종료)를
 * 구독해 그 순간 '탁' 소리와 함께 채우고, 화면을 다시 열었을 때는
 * phase(act2부터)로 판정한다 — 지시자는 흘러가고 상태는 남는다.
 */

import { useEffect, useRef, useState } from 'react'
import { subscribeCueEvents } from '@/lib/cueEngine'
import { playCassetteFlip, playStamp } from '@/lib/sfx'
import { useTourState } from '@/hooks/useTourState'
import { formatElapsed } from '@/lib/tourState'
import { JCARD_FILLABLE_TRACKS, TRACK_STATIONS } from '@/lib/tracks'
import { countAct2Done } from '@/lib/bingoCells'

/** 다섯째 줄 상태 문구 — 잠금이 아니라 남겨둔 자리라는 뜻 */
const FIFTH_WISH_RESERVED = '아버지의 몫'

export default function JCard() {
  const tour = useTourState()

  const done = new Set(
    tour.tracksCompleted.filter((t) => JCARD_FILLABLE_TRACKS.includes(t))
  )
  /** B면 편지를 들었는가 — B5_F가 phase:act2를 세우므로 그 뒤가 전부 해당 */
  const letterHeard = tour.phase === 'act2' || tour.phase === 'done'

  /*
    줄이 '지금' 채워졌을 때만 소리와 움직임을 낸다. 마운트 때 이미 차 있던
    줄까지 움직이면 화면을 열 때마다 다섯 소원이 다시 그어진다.
  */
  const seenRef = useRef<Set<number> | null>(null)
  const [justFilled, setJustFilled] = useState<number | null>(null)
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(done)
      return
    }
    for (const t of Array.from(done)) {
      if (!seenRef.current.has(t)) {
        seenRef.current.add(t)
        setJustFilled(t)
        playStamp()
      }
    }
    // done은 렌더마다 새 Set이라 길이로 따라간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.size])

  // SIDE B — 편지가 끝나는 순간(album_build)의 '탁'
  const [sideBJust, setSideBJust] = useState(false)
  useEffect(() => {
    return subscribeCueEvents(({ directive }) => {
      if (directive === 'album_build') {
        setSideBJust(true)
        playCassetteFlip()
      }
    })
  }, [])

  return (
    <div className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
      {/* 케이스 속지 머리 — 카세트 라벨과 같은 결 */}
      <div className="flex items-baseline justify-between">
        <p className="font-mono-retro text-[10px] tracking-widest text-rec">
          SIDE A · 다섯 가지 소원
        </p>
        <p className="font-mono-retro text-[10px] text-ink-60">
          {done.size} / 4 + 1
        </p>
      </div>
      <p className="mt-1 font-pen text-[17px] text-ink-60">
        소영에게 — 1988. 9. 17.
      </p>

      <ol className="mt-3">
        {TRACK_STATIONS.map((station) => {
          const fillable = JCARD_FILLABLE_TRACKS.includes(station.track)
          const filled = fillable && done.has(station.track)
          const animate = justFilled === station.track

          return (
            <li key={station.id} className="py-2.5 first:pt-1">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono-retro text-[11px] text-ink-60">
                  A{station.track}
                </span>
                <span className="min-w-0 flex-1">
                  {/* 손글씨는 획이 가늘어 작으면 안 읽힌다 — 본문보다 큼직하게 */}
                  <span
                    className={`block font-pen text-[24px] leading-normal ${
                      filled ? 'text-ink' : 'text-ink-60'
                    }`}
                  >
                    {station.wish}
                  </span>
                  {/* 만년필 밑줄 — 이룬 소원에만 긋는다 */}
                  {filled && (
                    <span
                      className="block h-[2px] rounded-full bg-teal-dk/70"
                      style={
                        animate
                          ? { animation: 'fadeIn 0.8s ease-in-out' }
                          : undefined
                      }
                    />
                  )}
                </span>
                <span
                  className="shrink-0 text-[14px]"
                  style={
                    animate ? { animation: 'fadeIn 0.8s ease-in-out' } : undefined
                  }
                >
                  {fillable ? (
                    filled ? (
                      '🖋'
                    ) : (
                      ''
                    )
                  ) : (
                    /* 다섯째 줄 — 잠금 아이콘이 아니라 상태 문구(F-1) */
                    <span className="font-mono-retro text-[10px] tracking-wider text-ink-60">
                      {FIFTH_WISH_RESERVED}
                    </span>
                  )}
                </span>
              </div>
              {/* 어느 가게의 소원인지 — 속지의 각주처럼 작게 */}
              <p className="mt-0.5 pl-[26px] font-mono-retro text-[10px] text-ink-60">
                {station.name}
              </p>
            </li>
          )
        })}
      </ol>

      {/* SIDE B — 편지를 들은 뒤에만 생기는 칸 */}
      {letterHeard && (
        <div
          className="mt-2 border-t border-dashed border-line pt-3"
          style={sideBJust ? { animation: 'fadeIn 1s ease-in-out' } : undefined}
        >
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono-retro text-[10px] tracking-widest text-rec">
              SIDE B
            </span>
            <span className="font-pen text-[24px] text-ink">아버지의 편지</span>
            <span className="ml-auto text-[14px]" aria-hidden>
              📼
            </span>
          </div>
        </div>
      )}

      {/* 진행 요약 — 진행도 카드를 흡수한 자리. 걷기 시작해야 뜬다 */}
      {tour.startTime && (
        <p className="mt-3 border-t border-line pt-2 font-mono-retro text-[11px] text-ink-60">
          {formatElapsed(tour.startTime)} 걷는 중
          {tour.bingo.unlocked &&
            ` · 골목 빙고 ${countAct2Done(tour.bingo.cellsDone)}칸 · ${tour.bingo.lines}줄`}
        </p>
      )}
    </div>
  )
}
