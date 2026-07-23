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
import { PointEntry, POINTS_EVENT, REASON_LABEL } from '@/lib/points'
import { playPoint } from '@/lib/sfx'

interface Toast extends PointEntry {
  key: string
}

const LIFETIME_MS = 3200

export default function PointToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

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

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      role="status"
      aria-live="polite"
    >
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
