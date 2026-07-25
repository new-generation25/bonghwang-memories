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

const LIFETIME_MS = 3200

/** 소원 알림은 조금 더 머문다 — 읽고 넘어갈 값이 있는 문장이다 */
const WISH_LIFETIME_MS = 4200

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
    const t = window.setTimeout(() => setUpdated(false), WISH_LIFETIME_MS)
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
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      role="status"
      aria-live="polite"
    >
      {updated && (
        <div className="point-toast flex items-center gap-2.5 rounded-full bg-teal-dk px-4 py-2 shadow-lg">
          <span className="text-[13px] leading-none" aria-hidden>
            ✓
          </span>
          <span className="text-[12px] font-bold text-cream">
            최신 버전으로 업데이트했어요
          </span>
        </div>
      )}
      {wishes.map((w) => (
        <div
          key={w.key}
          className="point-toast flex items-center gap-2.5 rounded-full bg-sunset-yellow px-5 py-2.5 shadow-lg"
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
  )
}
