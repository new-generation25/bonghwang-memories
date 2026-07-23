'use client'

/**
 * 카세트 버튼 효과음.
 *
 * 음원 파일을 넣지 않고 Web Audio로 합성한다. 이 앱은 90분 내내 걸으면서
 * 쓰는 물건이라 오디오를 전부 미리 받아두는데(D8), 거기에 효과음 파일까지
 * 얹으면 그만큼 첫 로딩이 길어진다. 합성음은 용량이 0이고 오프라인에서도
 * 똑같이 난다.
 *
 * 소리는 기계식 데크 키의 '철컥'이다. 짧은 노이즈 버스트(플라스틱이 부딪는
 * 소리)와 낮은 사인파 툭(기구가 걸리는 소리)을 겹친다.
 *
 * 재생은 반드시 클릭 안에서 일어나므로 자동재생 정책에 걸리지 않는다.
 */

export type SfxKind = 'play' | 'pause' | 'stop' | 'rew' | 'ff' | 'rec'

/** 키마다 살짝 다른 음색 — 같은 소리가 반복되면 금세 지겨워진다 */
const TONE: Record<SfxKind, { thump: number; bright: number }> = {
  play: { thump: 148, bright: 2600 },
  pause: { thump: 126, bright: 2100 },
  stop: { thump: 116, bright: 1900 },
  rew: { thump: 172, bright: 3100 },
  ff: { thump: 182, bright: 3300 },
  rec: { thump: 132, bright: 2200 },
}

let ctx: AudioContext | null = null
let muted = false

const MUTE_KEY = 'bh_sfx_muted_v1'

export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return false
  if (muted) return true
  return window.localStorage.getItem(MUTE_KEY) === '1'
}

export function setSfxMuted(next: boolean): void {
  muted = next
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  }
}

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    // 화면을 오래 두면 정지 상태로 내려간다 — 클릭 안이라 바로 깨울 수 있다
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 짧은 노이즈 — 플라스틱 키가 부딪는 성분 */
function clack(ac: AudioContext, at: number, bright: number, gain: number) {
  const len = Math.floor(ac.sampleRate * 0.035)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    // 뒤로 갈수록 빠르게 죽인다 — 길게 끌면 '치익' 하는 잡음이 된다
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  const src = ac.createBufferSource()
  src.buffer = buf

  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = bright
  bp.Q.value = 0.8

  const g = ac.createGain()
  g.gain.value = gain

  src.connect(bp).connect(g).connect(ac.destination)
  src.start(at)
  src.stop(at + 0.05)
}

/** 낮은 툭 — 기구가 걸리는 성분 */
function thump(ac: AudioContext, at: number, freq: number, gain: number) {
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, at)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + 0.06)

  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)

  osc.connect(g).connect(ac.destination)
  osc.start(at)
  osc.stop(at + 0.1)
}

/**
 * 데크 키를 눌렀을 때의 소리.
 * 실패해도 조용히 넘어간다 — 효과음 때문에 조작이 막히면 안 된다.
 */
export function playDeckKey(kind: SfxKind = 'play'): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    const tone = TONE[kind] ?? TONE.play
    clack(ac, now, tone.bright, 0.16)
    thump(ac, now + 0.004, tone.thump, 0.1)
    // REC은 걸쇠가 두 번 걸린다 — 다른 키와 구분되도록 한 번 더
    if (kind === 'rec') clack(ac, now + 0.045, tone.bright * 0.8, 0.09)
  } catch {
    /* 소리는 부가 기능이다 */
  }
}
