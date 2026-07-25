'use client'

/**
 * 말 놓기 — 소영이 묻고 참여자가 답한다.
 *
 * "저기… 말 편하게 해도 될까요?"까지 듣고 나면 재생이 멈추고 이 창이
 * 올라온다. 대답 없이 흘려보내면 소영이 혼자 묻고 혼자 말을 놓는 꼴이라,
 * 두 사람이 가까워지는 그 대목이 통째로 지나가 버린다.
 *
 * 물음이 끝나고 한 박자(ASK_DELAY_MS) 두고 뜬다. 말이 끝나자마자 창이
 * 덮으면 재촉하는 것처럼 보인다 — 실제로 사람에게 그런 질문을 받으면
 * 잠깐 생각한다.
 *
 * 지금은 어느 쪽을 골라도 이야기가 같게 이어진다. 녹음이 반말 한 벌뿐이라
 * 거절해도 다음 대사가 반말로 나온다. 답은 tourState.speechConsent에
 * 남겨둔다 — 존댓말 벌이 생기면 여기가 갈림길이 된다.
 */

interface SpeechAskProps {
  onAnswer: (consent: 'yes' | 'no') => void
}

export default function SpeechAsk({ onAnswer }: SpeechAskProps) {
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-shell/60 px-4 pb-4">
      <div
        className="w-full max-w-[380px] rounded-2xl border border-teal/40 bg-paper p-5 shadow-2xl"
        style={{
          animation: 'guide-pull-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
          paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
        }}
      >
        <p className="font-mono-retro text-[10px] tracking-widest text-teal">
          소영의 물음
        </p>
        <h3 className="mt-1.5 text-[15px] font-bold leading-relaxed text-ink">
          말 편하게 해도 될까요?
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
          왠지 오래 알던 사이 같아서요.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onAnswer('no')}
            className="flex-1 rounded-xl border border-line bg-cream py-3 text-[13px] text-ink"
          >
            아니요
            <span className="mt-0.5 block text-[10.5px] text-ink-60">
              말을 놓지 않는다
            </span>
          </button>
          <button
            type="button"
            onClick={() => onAnswer('yes')}
            className="flex-1 rounded-xl bg-teal py-3 font-display text-[14px] text-cream"
          >
            그래요
            <span className="mt-0.5 block font-sans text-[10.5px] font-normal text-cream/80">
              말을 놓는다
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
