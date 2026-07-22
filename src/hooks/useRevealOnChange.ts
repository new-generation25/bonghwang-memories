'use client'

/**
 * 값이 바뀌면 해당 요소를 화면 안으로 끌어온다.
 *
 * 거점 화면은 자막·미션 카드가 쌓여 800px을 넘기 때문에, 새로 열린 확정 버튼이
 * 스크롤 아래에 묻힌다. 사진을 찍거나 정답을 맞힌 직후 아무 일도 안 일어난 것처럼
 * 보이는 게 그 이유다. 버튼이 나타나는 순간에만 스크롤을 옮겨 붙인다 —
 * 상시 고정 바와 달리 자막을 가리지 않는다.
 */

import { useEffect, useRef } from 'react'

export function useRevealOnChange<T extends HTMLElement = HTMLDivElement>(
  /** 이 값이 바뀔 때 스크롤한다 */
  trigger: unknown,
  /** false면 스크롤하지 않는다 (아직 나타나지 않은 단계) */
  active = true
) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    // 레이아웃이 확정된 다음 프레임에 옮긴다
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'end', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [trigger, active])

  return ref
}
