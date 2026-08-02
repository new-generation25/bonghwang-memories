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
import QrIcon from '@/components/QrIcon'
import { playCassetteFlip, playStamp } from '@/lib/sfx'
import { useTourState } from '@/hooks/useTourState'
import { formatElapsed } from '@/lib/tourState'
import { JCARD_FILLABLE_TRACKS, TRACK_STATIONS, type Station } from '@/lib/tracks'
import { countAct2Done } from '@/lib/bingoCells'

/** 다섯째 줄 상태 문구 — 잠금이 아니라 남겨둔 자리라는 뜻 */
const FIFTH_WISH_RESERVED = '아버지의 몫'

interface Props {
  /**
   * 소원마다 QR 단추를 단다 — 플레이어 화면에서만 넘긴다.
   *
   * 옵션인 이유는 `/me`도 이 카드를 쓰기 때문이다. 거기에는 스캐너를 열
   * 상태가 없고, 있어야 할 이유도 없다 — 마이페이지는 되짚어 보는 곳이지
   * 걷는 곳이 아니다.
   */
  onScan?: (station: Station) => void
}

export default function JCard({ onScan }: Props) {
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
                {/*
                  밑줄은 글자 길이만큼만 긋는다.

                  예전에는 남은 칸 전체에 그어져, 짧은 소원일수록 글자 뒤로
                  빈 줄이 길게 남았다. 만년필로 그은 줄이라면 글자에서 끝난다.
                  inline-block이라 폭이 글자에 맞춰진다.
                */}
                <span className="min-w-0 flex-1">
                  <span className="inline-block max-w-full">
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
                </span>

                {/*
                  이룬 소원의 🖋는 뺐다 — 밑줄이 이미 같은 말을 하고 있어
                  표식이 둘이었고, 그만큼 소원 글이 밀려 두 줄로 깨졌다.

                  다섯째 줄의 '아버지의 몫'은 남긴다. 그건 상태 표식이 아니라
                  이 줄이 왜 영영 안 채워지는지를 말하는 문구다(F-1).
                */}
                {!fillable && (
                  <span className="shrink-0 font-mono-retro text-[10px] tracking-wider text-ink-60">
                    {FIFTH_WISH_RESERVED}
                  </span>
                )}

                {/*
                  소원마다 QR. 세로로 세워 폭을 줄였다 — 가로로 눕히면
                  손글씨가 밀린다.

                  다섯째 줄에도 단다 — J-카드는 안 채워져도(아버지의 몫)
                  방하림은 다녀와야 하는 거점이고 쿠폰도 거기서 나온다.
                  이룬 소원에서도 지우지 않는다. 다녀온 거점은 다시듣기로
                  들어가고(D9), 눈앞의 QR이 가장 가까운 입구다.

                  실물 QR처럼 검정. 티얼은 이 앱의 구조색이라 앱바·탭이
                  이미 쓰고 있어, 여기까지 초록이면 '누르는 곳'이 아니라
                  또 하나의 장식으로 묻힌다.
                */}
                {onScan && (
                  <button
                    onClick={() => onScan(station)}
                    aria-label={`${station.name} 거점 QR 스캔`}
                    className="flex w-7 shrink-0 flex-col items-center gap-px rounded-md bg-shell py-1 text-cream active:scale-95"
                  >
                    <QrIcon size={14} />
                    <span className="font-mono-retro text-[8px] leading-none tracking-wider">
                      QR
                    </span>
                  </button>
                )}
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
