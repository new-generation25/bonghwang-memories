import { Fragment, createElement, type ReactNode } from 'react'

/**
 * 대사 안의 `<br>`을 실제 줄바꿈으로 그린다.
 *
 * 자막은 폭에 따라 아무 데서나 접힌다. 숨을 쉬는 자리와 접히는 자리가
 * 어긋나면 읽는 흐름이 끊겨서, 대본에 사람이 손으로 자리를 잡아뒀다.
 *
 * 태그를 그대로 심지 않고 조각으로 나눠 그린다 — dangerouslySetInnerHTML은
 * 대사에 든 따옴표·꺾쇠까지 태그로 읽어 화면을 망가뜨릴 수 있다.
 *
 * `<br>`은 화면에만 쓰인다. 음성을 구울 때는 generate-audio.mjs가 걷어낸다.
 */
export function renderBreaks(text: string): ReactNode {
  const parts = text.split(/<br\s*\/?>/i)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    createElement(
      Fragment,
      { key: i },
      i > 0 ? createElement('br') : null,
      part
    )
  )
}

/** 줄바꿈 표시를 걷어낸 맨 글자 — 음성 합성·읽어주기에 쓴다 */
export function plainText(text: string): string {
  return text.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()
}
