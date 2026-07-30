'use client'

/**
 * 적립 알림.
 *
 * 미션을 끝냈을 때 포인트가 붙었다는 걸 그 자리에서 알려준다. 커뮤니티 화면에
 * 들어가야만 점수를 볼 수 있으면 걷는 중에는 아무 보상도 못 느낀다.
 *
 * 여러 건이 연달아 들어올 수 있어(빙고 칸 + 줄 완성) 쌓아서 보여준다.
 */

import { useEffect, useState } from 'react'
import { WISH_EVENT } from '@/lib/cueEngine'
import { PointEntry, POINTS_EVENT, REASON_LABEL } from '@/lib/points'
import { playPoint } from '@/lib/sfx'

interface Toast extends PointEntry {
  key: string
}

/**
 * 소원을 이룬 순간의 알림 — 첫 번째와 마지막에만 뜬다.
 *
 * 다섯 번 다 띄우면 의식이 절차가 된다. 가운데 셋은 소영이 대사로 이미
 * 말해주므로 화면이 또 말할 필요가 없다.
 */
interface WishToast {
  key: string
  track: number
}

const WISH_LABEL: Record<number, string> = {
  1: '첫 번째 소원을 이뤘어요',
  5: '다섯 가지 소원, 모두 이뤘어요',
}

/*
  머무는 시간 — 예전의 두 배.

  걷는 중에 뜨는 알림이다. 화면을 손에 들고 보고 있는 사람이 아니라,
  방금 사진을 찍고 고개를 든 사람이 읽어야 한다. 3초는 그 사이에
  사라졌다 — 점수가 붙은 것을 못 보고 지나가면 보상이 없는 셈이 된다.
*/
const LIFETIME_MS = 6400

/** 소원 알림은 조금 더 머문다 — 읽고 넘어갈 값이 있는 문장이다 */
const WISH_LIFETIME_MS = 8400

/**
 * 사라지는 연출을 언제 시작할지 — 머무는 시간에서 그 길이만큼 앞당긴다.
 *
 * CSS(.point-toast)에 값을 박아두지 않는 이유가 있다. 예전에는 2.9s로
 * 고정돼 있어서 여기 시간을 늘리면 알림이 먼저 사라지고 몇 초간 보이지
 * 않는 채로 남았다 — 두 곳의 값이 어긋나면 눈에 띄지 않게 깨진다.
 */
const FADE_MS = 300
const fadeAt = (lifetime: number) =>
  ({ '--toast-out-delay': `${lifetime - FADE_MS}ms` }) as React.CSSProperties

/** 업데이트 안내는 짧게 — 읽으라고 붙잡는 문구가 아니다 */
const UPDATED_LIFETIME_MS = 1000

export default function PointToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [wishes, setWishes] = useState<WishToast[]>([])

  /*
    업데이트 직후 한 줄.

    새 버전으로 갈아타면 페이지가 새로고침되는데, 그것이 화면이 한 번
    깜빡이는 일로 보인다. 까닭 없이 깜빡이면 앱이 흔들린 줄 아니까
    무슨 일이었는지 알려준다. 묻지 않고 적용하는 대신 알리기만 한다.
  */
  const [updated, setUpdated] = useState(false)
  useEffect(() => {
    try {
      if (sessionStorage.getItem('bh_updated') !== '1') return
      sessionStorage.removeItem('bh_updated')
    } catch {
      return
    }
    setUpdated(true)
    // 짧게. 읽으라고 붙잡는 문구가 아니라 깜빡임의 까닭을 대는 한 줄이다
    const t = window.setTimeout(() => setUpdated(false), UPDATED_LIFETIME_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const onWish = (e: Event) => {
      const d = (e as CustomEvent<{ track: number }>).detail
      if (!d || !WISH_LABEL[d.track]) return
      const key = `wish-${d.track}-${Date.now()}`
      setWishes((prev) => [...prev, { key, track: d.track }])
      window.setTimeout(
        () => setWishes((prev) => prev.filter((w) => w.key !== key)),
        WISH_LIFETIME_MS
      )
    }
    window.addEventListener(WISH_EVENT, onWish)
    return () => window.removeEventListener(WISH_EVENT, onWish)
  }, [])

  useEffect(() => {
    const onAward = (e: Event) => {
      const entry = (e as CustomEvent<PointEntry>).detail
      if (!entry) return
      const key = `${entry.refId}-${entry.createdAt}`
      /*
        빙고 줄은 여기서 내지 않는다. 빙고 화면이 같은 순간에 더 큰 소리를
        내므로 둘이 겹치면 어느 쪽도 제대로 안 들린다.
      */
      if (entry.reason !== 'treasureLine') playPoint()
      setToasts((prev) => [...prev, { ...entry, key }])
      window.setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.key !== key)),
        LIFETIME_MS
      )
    }
    window.addEventListener(POINTS_EVENT, onAward)
    return () => window.removeEventListener(POINTS_EVENT, onAward)
  }, [])

  if (toasts.length === 0 && wishes.length === 0 && !updated) return null

  return (
    <>
      {/*
        업데이트 안내는 위에 그대로 둔다.

        적립과 성격이 다르다 — 화면이 왜 깜빡였는지 대는 한 줄이고 1초만
        머문다. 이것까지 가운데로 옮기면 이야기를 가리고 지나간다.
      */}
      {updated && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          role="status"
          aria-live="polite"
        >
          <div
            className="point-toast flex items-center gap-2.5 rounded-full bg-teal-dk px-4 py-2 shadow-lg"
            style={fadeAt(UPDATED_LIFETIME_MS)}
          >
            <span className="text-[13px] leading-none" aria-hidden>
              ✓
            </span>
            <span className="text-[12px] font-bold text-cream">
              최신 버전으로 업데이트했어요
            </span>
          </div>
        </div>
      )}

      {/*
        적립·소원 알림은 화면 가운데.

        맨 위에 뜰 때는 앱바와 겹쳐 눈에 들어오지 않았다. 걷는 중에 보는
        화면에서 시선이 머무는 곳은 가운데이고, 방금 사진을 찍고 고개를
        든 사람이 거기를 본다.

        pointer-events-none이 반드시 있어야 한다 — 가운데를 덮으므로
        이것이 없으면 알림이 떠 있는 동안 아래 버튼이 눌리지 않는다.
      */}
      {(toasts.length > 0 || wishes.length > 0) && (
        <div
          className="pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-center gap-2 px-4"
          role="status"
          aria-live="polite"
        >
          {wishes.map((w) => (
            <div
              key={w.key}
              className="point-toast flex items-center gap-2.5 rounded-full bg-sunset-yellow px-5 py-2.5 shadow-lg"
              style={fadeAt(WISH_LIFETIME_MS)}
            >
              <span className="text-[15px] leading-none" aria-hidden>
                ✦
              </span>
              <span className="text-[13px] font-bold text-shell">
                {WISH_LABEL[w.track]}
              </span>
            </div>
          ))}
          {toasts.map((t) => (
            <div
              key={t.key}
              className="point-toast flex items-center gap-2.5 rounded-full bg-teal-dk px-4 py-2 shadow-lg"
              style={fadeAt(LIFETIME_MS)}
            >
              <span className="font-display text-[17px] leading-none text-sunset-yellow">
                +{t.points}P
              </span>
              <span className="text-[12px] font-bold text-cream">
                {REASON_LABEL[t.reason]}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
