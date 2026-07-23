'use client'

/**
 * 카세트 키 효과음 비교 — 개발용.
 *
 * 기존 소리가 가볍다는 지적이 있어 무게를 다르게 준 변형을 나란히 듣고
 * 고르기 위한 화면이다. 고른 뒤에는 그 합성 설정을 lib/sfx.ts로 옮긴다.
 *
 * 소리를 무겁게 만드는 요소는 셋이다:
 *  · 저역(thump) 주파수를 낮추고 감쇠를 늘린다 — 큰 기구가 움직이는 느낌
 *  · 몸통 공명(body)을 얹는다 — 플라스틱 케이스가 함께 울리는 소리
 *  · 노이즈를 어둡게(저역 통과) 깎는다 — 밝으면 '딸깍'이 얇아진다
 */

import { useRef, useState } from 'react'

type VariantId = 'current' | 'latch' | 'metal' | 'twostage' | 'deep'

interface Variant {
  id: VariantId
  name: string
  desc: string
}

const VARIANTS: Variant[] = [
  { id: 'current', name: 'A · 현재', desc: '지금 앱에 들어간 소리 (비교 기준)' },
  { id: 'latch', name: 'B · 묵직한 걸쇠', desc: '저역을 낮추고 몸통 공명을 얹음' },
  { id: 'metal', name: 'C · 금속 래치', desc: '쇠 걸쇠가 걸리는 짧은 링잉 추가' },
  { id: 'twostage', name: 'D · 두 단 걸림', desc: '눌림 → 걸림, 두 번 나눠 걸리는 기계식' },
  { id: 'deep', name: 'E · 깊은 저역', desc: '서브베이스까지 내려 가장 무겁게' },
]

function makeContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor()
  } catch {
    return null
  }
}

/** 노이즈 버스트 — 부딪는 성분. lowpass로 깎으면 두툼해진다 */
function clack(
  ac: AudioContext,
  at: number,
  opts: { ms: number; freq: number; q: number; gain: number; type?: BiquadFilterType }
) {
  const len = Math.floor(ac.sampleRate * (opts.ms / 1000))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  const src = ac.createBufferSource()
  src.buffer = buf

  const filter = ac.createBiquadFilter()
  filter.type = opts.type ?? 'bandpass'
  filter.frequency.value = opts.freq
  filter.Q.value = opts.q

  const g = ac.createGain()
  g.gain.value = opts.gain

  src.connect(filter).connect(g).connect(ac.destination)
  src.start(at)
  src.stop(at + opts.ms / 1000 + 0.02)
}

/** 저역 툭 — 기구가 걸리는 성분 */
function thump(
  ac: AudioContext,
  at: number,
  opts: { freq: number; drop: number; gain: number; decay: number }
) {
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(opts.freq, at)
  osc.frequency.exponentialRampToValueAtTime(opts.freq * opts.drop, at + opts.decay * 0.7)

  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(opts.gain, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.decay)

  osc.connect(g).connect(ac.destination)
  osc.start(at)
  osc.stop(at + opts.decay + 0.02)
}

/** 몸통 공명 — 케이스가 함께 울리는 성분. 무게감의 핵심 */
function body(
  ac: AudioContext,
  at: number,
  opts: { freq: number; gain: number; decay: number; type?: OscillatorType }
) {
  const osc = ac.createOscillator()
  osc.type = opts.type ?? 'triangle'
  osc.frequency.value = opts.freq

  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(opts.gain, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.decay)

  osc.connect(g).connect(ac.destination)
  osc.start(at)
  osc.stop(at + opts.decay + 0.02)
}

function playVariant(ac: AudioContext, id: VariantId) {
  const t = ac.currentTime + 0.01

  switch (id) {
    case 'current':
      clack(ac, t, { ms: 35, freq: 2600, q: 0.8, gain: 0.16 })
      thump(ac, t + 0.004, { freq: 148, drop: 0.55, gain: 0.1, decay: 0.09 })
      break

    case 'latch':
      // 노이즈를 어둡게, 저역을 낮게, 몸통을 얹어 두툼하게
      clack(ac, t, { ms: 48, freq: 1500, q: 0.7, gain: 0.2 })
      thump(ac, t + 0.005, { freq: 92, drop: 0.5, gain: 0.22, decay: 0.16 })
      body(ac, t + 0.006, { freq: 210, gain: 0.1, decay: 0.13 })
      break

    case 'metal':
      // 쇠 걸쇠 — 짧고 높은 링잉을 얹되 저역으로 받쳐 얇아지지 않게
      clack(ac, t, { ms: 40, freq: 1900, q: 0.9, gain: 0.18 })
      thump(ac, t + 0.005, { freq: 104, drop: 0.5, gain: 0.19, decay: 0.14 })
      body(ac, t + 0.004, { freq: 1180, gain: 0.055, decay: 0.1, type: 'square' })
      body(ac, t + 0.004, { freq: 240, gain: 0.08, decay: 0.12 })
      break

    case 'twostage':
      // 누르는 순간(작게) → 걸리는 순간(크게). 기계식 데크의 실제 동작
      clack(ac, t, { ms: 22, freq: 1200, q: 0.6, gain: 0.09, type: 'lowpass' })
      clack(ac, t + 0.055, { ms: 52, freq: 1400, q: 0.7, gain: 0.22 })
      thump(ac, t + 0.058, { freq: 88, drop: 0.48, gain: 0.24, decay: 0.18 })
      body(ac, t + 0.06, { freq: 195, gain: 0.11, decay: 0.15 })
      break

    case 'deep':
      // 서브베이스까지 — 가장 무겁다. 작은 스피커에서는 저역이 덜 들릴 수 있다
      clack(ac, t, { ms: 55, freq: 1100, q: 0.6, gain: 0.2, type: 'lowpass' })
      thump(ac, t + 0.005, { freq: 64, drop: 0.5, gain: 0.3, decay: 0.24 })
      body(ac, t + 0.006, { freq: 170, gain: 0.13, decay: 0.18 })
      body(ac, t + 0.008, { freq: 320, gain: 0.06, decay: 0.1 })
      break
  }
}

export default function SfxLabPage() {
  const ctxRef = useRef<AudioContext | null>(null)
  const [last, setLast] = useState<VariantId | null>(null)

  const play = (id: VariantId) => {
    if (!ctxRef.current) ctxRef.current = makeContext()
    const ac = ctxRef.current
    if (!ac) return
    if (ac.state === 'suspended') void ac.resume()
    try {
      playVariant(ac, id)
      setLast(id)
    } catch {
      /* 소리는 부가 기능이다 */
    }
  }

  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[420px]">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          SFX LAB · 개발용
        </p>
        <h1 className="mt-1 font-display text-[22px] text-ink">
          카세트 키 효과음 비교
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          다섯 가지를 눌러 들어보고 마음에 드는 것을 알려주세요. 고른 소리를
          앱 전체 데크 키에 적용합니다.
          <br />
          <b className="text-ink">이어폰이나 스피커로 들어야</b> 저역 차이가
          제대로 들립니다.
        </p>

        <div className="mt-5 space-y-2.5">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => play(v.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                last === v.id
                  ? 'border-teal bg-teal/10'
                  : 'border-line bg-paper'
              }`}
            >
              <span className="text-[20px]" aria-hidden>
                🔊
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-ink">
                  {v.name}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-60">
                  {v.desc}
                </span>
              </span>
              {last === v.id && (
                <span className="shrink-0 font-mono-retro text-[10px] text-teal">
                  방금 재생
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="card-paper mt-6 p-4">
          <p className="text-[12px] leading-relaxed text-ink-60">
            무게를 만드는 요소는 셋입니다 — <b className="text-ink">저역 주파수</b>를
            낮추고, <b className="text-ink">감쇠</b>를 늘리고,{' '}
            <b className="text-ink">몸통 공명</b>을 얹는 것. A(현재)는 저역이
            148Hz라 얇고, E는 64Hz까지 내려 가장 묵직합니다.
          </p>
        </div>

        <a
          href="/play"
          className="mt-5 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-center text-[13px] font-bold text-teal-dk"
        >
          ← 플레이어로
        </a>
      </div>
    </div>
  )
}
