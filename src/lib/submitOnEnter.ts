/**
 * Enter로 입력 완료 — PC 조작 편의.
 *
 * 모바일에서는 키보드의 완료 버튼이, PC에서는 Enter가 같은 동작을 하도록 맞춘다.
 * 한글 IME 조합 중의 Enter는 한자·후보 확정용이므로 제출로 처리하지 않는다
 * (`isComposing` 검사 — 이게 없으면 "봉황"을 치다 Enter로 확정할 때 폼이 날아간다).
 *
 * 여러 줄 입력(textarea)에는 쓰지 않는다 — 거기서 Enter는 줄바꿈이어야 한다.
 * 여러 줄에서 제출까지 걸고 싶으면 submitOnCtrlEnter를 쓴다.
 */

import type { KeyboardEvent } from 'react'

type AnyInput = HTMLInputElement | HTMLTextAreaElement

/** 한 줄 입력용 — Enter를 누르면 submit()을 부른다. canSubmit이 false면 무시한다. */
export function submitOnEnter(submit: () => void, canSubmit = true) {
  return (e: KeyboardEvent<AnyInput>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (canSubmit) submit()
  }
}

/** 여러 줄 입력용 — Ctrl(⌘)+Enter로 제출. 맨 Enter는 줄바꿈 그대로. */
export function submitOnCtrlEnter(submit: () => void, canSubmit = true) {
  return (e: KeyboardEvent<AnyInput>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    if (canSubmit) submit()
  }
}
