'use client'

/**
 * 말 놓기 — 소영이 묻고 참여자가 답한다.
 *
 * "저기… 말 편하게 해도 될까요?"까지 듣고 나면 재생이 멈추고 이 창이
 * 올라온다. 대답 없이 흘려보내면 소영이 혼자 묻고 혼자 말을 놓는 꼴이라,
 * 두 사람이 가까워지는 그 대목이 통째로 지나가 버린다.
 *
 * 물음(B1_B)이 끝나면 뜬다. 대답에 따라 다음 번들이 갈린다 —
 * 승낙은 B1_YES("…고마워. 이제 말 놓을게"), 거절은 B1_NO(한 박자 물러섰다가
 * 다시 청한다). 어느 쪽이든 말은 놓게 된다(D7 — 전환은 한 번, 되돌리지
 * 않는다). 존댓말 벌을 따로 굽지 않는 한 뒤의 대사가 전부 반말이기 때문이다.
 *
 * 그래서 버튼 부제로 결과를 약속하지 않는다. "말을 놓지 않는다"고 적어두면
 * 곧바로 지키지 못할 말이 된다 — 지금 마음이 어떤지만 고르게 한다.
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
              아직 좀 어색해요
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
