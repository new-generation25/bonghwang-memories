'use client'

/**
 * 가게 주인의 이야기를 청하는 카드.
 *
 * 소영의 대답(B1_OK)이 끝난 뒤에 뜬다. 세는 일과 듣는 일은 다른 차례라
 * 카드를 나눴다 — 한 카드에 겹쳐 두면 정답을 맞힌 순간 화면이
 * '맞았다'와 '이제 저기로 가라'를 동시에 말한다.
 *
 * 자동으로 재생하지 않는다. 가게 문을 열고 사장님 앞에 선 뒤에 눌러야
 * 이야기가 그 자리에서 흐른다 — 걸어가는 동안 흘려보내면 안 된다.
 */

import { dispatchTap, unlockAudio } from '@/lib/cueEngine'

interface ListenStepProps {
  label: string
  prompt: string
  /** 버튼 글자 — 누구의 이야기인지 */
  button: string
}

export default function ListenStep({ label, prompt, button }: ListenStepProps) {
  return (
    <div
      className="mt-4 rounded-2xl border border-sunset-yellow bg-paper p-5 shadow-sm"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <p className="font-mono-retro text-[10px] tracking-widest text-rec">
        {label}
      </p>
      <h3 className="mt-1 text-[15px] font-bold leading-snug text-ink">
        {prompt}
      </h3>

      <button
        onClick={() => {
          // 사용자 조작 안에서 오디오를 깨워야 iOS가 재생을 막지 않는다
          unlockAudio()
          dispatchTap('LISTEN')
        }}
        className="btn-teal mt-4 w-full text-[14px]"
      >
        {button}
      </button>
    </div>
  )
}
