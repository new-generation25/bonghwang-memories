'use client'

/**
 * 데크 키음을 앱 전체에 건다.
 *
 * 원래는 카세트 컨트롤 바(DeckControls)만 소리를 냈다. 그래서 이야기를
 * 듣는 동안에는 딸깍 소리가 나다가, 미션 화면(능소화 포토존의 촬영 버튼
 * 같은)으로 넘어가면 갑자기 조용해졌다. 같은 앱 안에서 어떤 버튼은
 * 기계고 어떤 버튼은 아닌 것처럼 느껴진다.
 *
 * 버튼마다 호출을 심지 않고 문서 한 곳에서 위임으로 받는다. 화면이
 * 스무 개가 넘고 앞으로도 늘 텐데, 새 버튼을 만들 때마다 소리를 넣는
 * 걸 기억해야 한다면 반드시 빠뜨린다.
 *
 * 대상은 '모든 버튼'이다.
 *
 * 처음에는 .btn-teal 같은 클래스 목록으로 골랐는데, 미션의 '📷 사진 찍기'는
 * bg-shell이라 목록에서 빠졌다 — 능소화 포토존이 조용했던 게 그것이다.
 * 화면마다 버튼 모양이 조금씩 다르고 앞으로도 늘 텐데, 목록을 관리하는
 * 방식은 반드시 또 빠뜨린다. 넓게 잡고 필요한 곳만 끈다.
 *
 * 끄는 곳:
 *  · [data-sfx="off"]  이 요소나 그 안쪽 전부
 *  · disabled 버튼      눌리지 않았는데 소리가 나면 눌린 줄 안다
 *  · .deck-key         DeckControls가 키마다 다른 음색으로 이미 낸다
 */

import { useEffect } from 'react'
import { playDeckKey, preloadDeckKey } from '@/lib/sfx'

const CLICKABLE = 'button,[role="button"]'

export default function DeckSfx() {
  useEffect(() => {
    preloadDeckKey()

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target?.closest) return

      // 꺼둔 영역이면 그만 — 버튼 하나든 화면 전체든
      if (target.closest('[data-sfx="off"]')) return

      /*
        데크 키는 DeckControls가 키 종류에 맞는 음색으로 이미 낸다.
        여기서 또 내면 두 번 겹쳐 '딸깍딸깍'이 된다.
      */
      if (target.closest('.deck-key')) return

      const el = target.closest(CLICKABLE)
      if (!el) return
      // 비활성 버튼은 소리를 내지 않는다 — 눌린 줄 알게 된다
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
        return
      }

      playDeckKey('play')
    }

    // 캡처 단계에서 받는다 — 버튼의 onClick이 화면을 갈아치우면
    // 버블링이 끊겨 소리를 놓치는 경우가 있다
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
