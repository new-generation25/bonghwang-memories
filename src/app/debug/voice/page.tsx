'use client'

/**
 * 아버지 목소리 후보 듣기 — 개발용.
 *
 * 보이스 7종을 젊은/늙은 두 대사로 구워 나란히 듣고 고른다.
 * 같은 배우가 두 나이를 다 소화해야 하므로, 한 줄에 두 나이를 붙여
 * 바로 이어 들을 수 있게 했다 — 젊은 쪽만 좋은 목소리를 고르면
 * B면(B5_LETTER)에서 다른 사람이 되어버린다.
 *
 * 음원은 public/audio/_raw/father/ 에 있고 gitignore 대상이다.
 * 채택한 보이스 ID만 녹음 발주 문서에 남긴다.
 */

import { useRef, useState } from 'react'

interface Candidate {
  no: number
  voiceId: string
}

const CANDIDATES: Candidate[] = [
  { no: 1, voiceId: 'tc_68257f68bc6e3c161ab5078d' },
  { no: 2, voiceId: 'tc_660e46188b5f4761eb8e36d6' },
  { no: 3, voiceId: 'tc_6583e016e1060e8bebe9a695' },
  { no: 4, voiceId: 'tc_657139d23be20e08b0e92bae' },
  { no: 5, voiceId: 'tc_6539f9a955c3de938ae20ed9' },
  { no: 6, voiceId: 'tc_645b3ef82c2f52f412ede389' },
  { no: 7, voiceId: 'tc_62ce545fb130717df10ea37a' },
]

const LINE = {
  young:
    '…잘 돌아가나, 이거. 어험. 소영아. 아빠다. 곧 나온다더라. 이름은 정해놨다. 강소영. 아빠가 지었다. 이런 거 왜 하나 싶다마는. 아빠가 원래 말주변이 없다.',
  old: '소영아. 이 테이프 뒷면… 네가 찾았구나. 다섯 가지 소원, 다 이뤘니? 아빠는 요즘 자꾸 잊어버린다. 그래서 잊어버리기 전에, 여기다 해둔다. 미안하다. 사랑한다는 말, 너무 늦게 한다.',
}

type Age = 'young' | 'old'

function src(c: Candidate, age: Age): string {
  const n = String(c.no).padStart(2, '0')
  return `/audio/_raw/father/v${n}_${age}_${c.voiceId}.mp3`
}

export default function VoiceLabPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  const play = (c: Candidate, age: Age) => {
    const key = `${c.no}-${age}`
    // 하나만 울리게 — 겹쳐 나면 비교가 안 된다
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playing === key) {
      setPlaying(null)
      return
    }
    const el = new Audio(src(c, age))
    audioRef.current = el
    el.onended = () => setPlaying(null)
    el.onerror = () => setPlaying(null)
    void el.play()
    setPlaying(key)
  }

  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[460px]">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          VOICE LAB · 개발용
        </p>
        <h1 className="mt-1 font-display text-[22px] text-ink">
          아버지 목소리 고르기
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          후보 7명을 <b className="text-ink">젊은 아버지</b>(1988년 녹음)와{' '}
          <b className="text-ink">늙은 아버지</b>(B면 편지) 두 대사로 구웠습니다.
          한 사람이 두 나이를 다 소화해야 하니 <b className="text-ink">가로로
          이어서</b> 들어보세요.
        </p>

        <div className="card-paper mt-4 space-y-2 p-4">
          <p className="text-[11.5px] leading-relaxed text-ink-60">
            <b className="text-ink">젊은</b> — {LINE.young}
          </p>
          <p className="border-t border-line pt-2 text-[11.5px] leading-relaxed text-ink-60">
            <b className="text-ink">늙은</b> — {LINE.old}
          </p>
        </div>

        <div className="mt-5 space-y-2.5">
          {CANDIDATES.map((c) => (
            <div
              key={c.voiceId}
              className="rounded-xl border border-line bg-paper px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-ink">
                  {c.no}번
                </span>
                <span className="truncate font-mono-retro text-[9.5px] text-ink-60">
                  {c.voiceId}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                {(['young', 'old'] as Age[]).map((age) => {
                  const on = playing === `${c.no}-${age}`
                  return (
                    <button
                      key={age}
                      onClick={() => play(c, age)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-[12.5px] font-bold transition-colors ${
                        on
                          ? 'border-teal bg-teal text-cream'
                          : 'border-line bg-cream-base text-teal-dk'
                      }`}
                    >
                      {on ? '■ ' : '▶ '}
                      {age === 'young' ? '젊은 아버지' : '늙은 아버지'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="card-paper mt-6 p-4">
          <p className="text-[12px] leading-relaxed text-ink-60">
            고르실 때 기준 — 젊은 쪽은{' '}
            <b className="text-ink">쑥스러워하는 무뚝뚝함</b>(&lsquo;이런 거 왜
            하나 싶다마는&rsquo;), 늙은 쪽은{' '}
            <b className="text-ink">느리고 미안해하는 결</b>(&lsquo;너무 늦게
            한다&rsquo;)이 살아야 합니다. 번호를 알려주시면 그 보이스로
            전체 대사를 굽겠습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
