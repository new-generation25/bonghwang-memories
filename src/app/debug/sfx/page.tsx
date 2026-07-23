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
  { id: 'latch', name: 'B · 딸깍 (기본)', desc: '앞 딸 + 뒤 깍, 간격 38ms' },
  { id: 'metal', name: 'C · 찰칵 (금속)', desc: '쇠 걸쇠 — 밝고 단단한 두 음' },
  { id: 'twostage', name: 'D · 딸깍 (간격 넓게)', desc: '두 음 사이 60ms — 또렷하게 갈림' },
  { id: 'deep', name: 'E · 딸깍 (묵직)', desc: '두 음 + 낮은 몸통 — 큰 기구 느낌' },
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

/**
 * 접점음 한 번 — '딸' 또는 '깍'에 해당하는 아주 짧은 소리.
 *
 * 실제 기계식 키의 클릭은 길이가 10ms 안팎이다. 이보다 길면 '치익'이 되고,
 * 사인파로 만들면 '툭'하는 북소리가 된다. 그래서 노이즈를 대역통과로 좁게
 * 깎아 아주 빠르게 죽인다.
 */
function tick(
  ac: AudioContext,
  at: number,
  opts: { ms: number; freq: number; q: number; gain: number; type?: BiquadFilterType }
) {
  const len = Math.max(2, Math.floor(ac.sampleRate * (opts.ms / 1000)))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    // 지수 감쇠 — 앞부분만 남기고 뚝 끊어야 '딱' 소리가 된다
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
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
  src.stop(at + opts.ms / 1000 + 0.01)
}

/**
 * 짧은 공명 — 접점 뒤에 남는 여운.
 * 금속이면 높게(1~2kHz), 케이스 울림이면 낮게(150~350Hz) 준다.
 * 감쇠를 짧게 유지해야 '딸깍'의 윤곽이 흐려지지 않는다.
 */
function ping(
  ac: AudioContext,
  at: number,
  opts: { freq: number; gain: number; decay: number; type?: OscillatorType }
) {
  const osc = ac.createOscillator()
  osc.type = opts.type ?? 'triangle'
  osc.frequency.value = opts.freq

  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(opts.gain, at + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.decay)

  osc.connect(g).connect(ac.destination)
  osc.start(at)
  osc.stop(at + opts.decay + 0.02)
}

/**
 * 두 음 클릭 — 앞은 크게, 뒤는 작게, 사이는 짧게.
 * 키를 누를 때 걸쇠가 걸리고(딸), 곧바로 되튀는(깍) 실제 동작이다.
 */
function twoTone(
  ac: AudioContext,
  at: number,
  o: {
    gapMs: number
    freq: number
    q?: number
    gain?: number
    /** 뒤 음의 크기 비율 — 항상 앞보다 작다 */
    tailRatio?: number
    type?: BiquadFilterType
    resonance?: { freq: number; gain: number; decay: number; type?: OscillatorType }
  }
) {
  const q = o.q ?? 1.1
  const gain = o.gain ?? 0.3
  const tail = o.tailRatio ?? 0.42
  const gap = o.gapMs / 1000

  // 앞 — '딸'
  tick(ac, at, { ms: 11, freq: o.freq, q, gain, type: o.type })
  // 뒤 — '깍'. 더 짧고 작고 살짝 낮게
  tick(ac, at + gap, {
    ms: 7,
    freq: o.freq * 0.78,
    q,
    gain: gain * tail,
    type: o.type,
  })

  if (o.resonance) {
    ping(ac, at + 0.001, o.resonance)
  }
}

function playVariant(ac: AudioContext, id: VariantId) {
  const t = ac.currentTime + 0.01

  switch (id) {
    case 'current':
      // 비교 기준 — 기존의 '툭'(노이즈 + 사인 저역)
      tick(ac, t, { ms: 35, freq: 2600, q: 0.8, gain: 0.16 })
      ping(ac, t + 0.004, { freq: 148, gain: 0.1, decay: 0.09, type: 'sine' })
      break

    case 'latch':
      // 딸깍 기본 — 나무·플라스틱 접점의 단단한 두 음
      twoTone(ac, t, {
        gapMs: 38,
        freq: 2400,
        gain: 0.32,
        resonance: { freq: 320, gain: 0.05, decay: 0.05 },
      })
      break

    case 'metal':
      // 찰칵 — 쇠 걸쇠. 대역을 높이고 금속 링잉을 얹는다
      twoTone(ac, t, {
        gapMs: 32,
        freq: 3400,
        q: 1.5,
        gain: 0.3,
        tailRatio: 0.5,
        resonance: { freq: 1850, gain: 0.045, decay: 0.06, type: 'square' },
      })
      break

    case 'twostage':
      // 간격을 넓혀 두 음이 또렷하게 갈리는 느낌
      twoTone(ac, t, {
        gapMs: 60,
        freq: 2300,
        gain: 0.32,
        tailRatio: 0.38,
        resonance: { freq: 300, gain: 0.05, decay: 0.05 },
      })
      break

    case 'deep':
      // 묵직한 딸깍 — 대역을 낮추고 케이스 울림을 조금 더
      twoTone(ac, t, {
        gapMs: 42,
        freq: 1600,
        q: 0.9,
        gain: 0.34,
        tailRatio: 0.45,
        resonance: { freq: 180, gain: 0.085, decay: 0.075 },
      })
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
            B~E는 모두 <b className="text-ink">두 음</b>입니다 — 걸쇠가 걸리는
            &lsquo;딸&rsquo;(크게)과 되튀는 &lsquo;깍&rsquo;(작게). 뒤 음은 앞의
            40~50% 크기이고, 사이는 32~60ms로 짧습니다.
            <br />
            A(현재)만 사인파 &lsquo;툭&rsquo;이라 북소리처럼 들립니다 — 차이를
            비교해 보세요.
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
