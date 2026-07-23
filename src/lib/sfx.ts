'use client'

/**
 * 카세트 버튼 효과음.
 *
 * 실제 카세트 데크를 직접 녹음해 잘라낸 조각(public/audio/sfx/deck-key.wav)을
 * 쓴다. 합성으로도 '딸깍'의 두 음은 흉내낼 수 있지만, 진짜 기구가 걸리는
 * 소리에는 배음과 케이스 울림이 불규칙하게 섞여 있어 합성음은 끝내 가볍게
 * 들린다. 이 앱에서 데크 키는 화면의 주인공이라 그 차이가 그대로 드러난다.
 *
 * 파일은 모노 24kHz 0.2초로 10KB다. 오디오를 전부 미리 받아두는 정책(D8)에
 * 얹어도 부담이 없는 크기다.
 *
 * 파일을 못 받거나 디코딩이 안 되면 예전 합성음으로 떨어진다 — 오프라인
 * 첫 실행이나 옛 브라우저에서도 조작 피드백은 남아 있어야 한다.
 *
 * 재생은 반드시 클릭 안에서 일어나므로 자동재생 정책에 걸리지 않는다.
 */

export type SfxKind = 'play' | 'pause' | 'stop' | 'rew' | 'ff' | 'rec'

const SAMPLE_URL = '/audio/sfx/deck-key.wav'

/**
 * 키마다 살짝 다른 음색 — 같은 소리가 반복되면 금세 지겨워진다.
 *
 * rate: 녹음 조각의 재생 속도. 1보다 크면 짧고 높아져 가벼운 키가 되고,
 *       작으면 길고 낮아져 묵직해진다. ±8% 안이라 다른 소리로 들리지 않는다.
 * gain: 키의 무게. STOP처럼 크게 눌리는 키를 조금 더 크게 준다.
 * thump/bright: 폴백 합성음의 저역·고역 (파일을 못 쓸 때만 쓰인다)
 */
const TONE: Record<SfxKind, { rate: number; gain: number; thump: number; bright: number }> = {
  play: { rate: 1.0, gain: 0.85, thump: 148, bright: 2600 },
  pause: { rate: 1.04, gain: 0.7, thump: 126, bright: 2100 },
  stop: { rate: 0.94, gain: 1.0, thump: 116, bright: 1900 },
  rew: { rate: 1.07, gain: 0.72, thump: 172, bright: 3100 },
  ff: { rate: 1.08, gain: 0.72, thump: 182, bright: 3300 },
  rec: { rate: 0.97, gain: 0.88, thump: 132, bright: 2200 },
}

let ctx: AudioContext | null = null
let muted = false

/** 디코딩한 녹음 조각. null이면 아직 못 받았거나 실패한 것 */
let sample: AudioBuffer | null = null
/** 같은 로딩을 여러 번 걸지 않도록 붙잡아 둔다 */
let sampleLoad: Promise<AudioBuffer | null> | null = null

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
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null

    /*
      닫힌 컨텍스트는 되살릴 수 없다 — 새로 만든다.
      디코딩해 둔 조각도 그 컨텍스트에 묶여 있으므로 함께 버린다.
    */
    if (ctx && ctx.state === 'closed') {
      ctx = null
      sample = null
      sampleLoad = null
    }
    if (!ctx) ctx = new Ctor()

    /*
      멈춘 컨텍스트를 깨운다.

      'suspended'는 화면을 오래 뒀을 때고, 'interrupted'는 iOS가 카메라·통화
      같은 다른 오디오 세션에 자리를 내줬을 때다(표준에 없는 상태라 문자열로
      비교한다). 능소화 포토존처럼 카메라를 쓰고 돌아오면 여기에 걸려서,
      suspended만 되살리던 코드는 그 뒤로 소리를 내지 못했다.
    */
    if (ctx.state !== 'running') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

/** 녹음 조각을 받아 디코딩한다. 실패는 삼킨다 — 폴백이 있다 */
function loadSample(ac: AudioContext): Promise<AudioBuffer | null> {
  if (sample) return Promise.resolve(sample)
  if (sampleLoad) return sampleLoad

  sampleLoad = fetch(SAMPLE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status))
      return res.arrayBuffer()
    })
    .then((ab) => ac.decodeAudioData(ab))
    .then((buf) => {
      sample = buf
      return buf
    })
    .catch(() => null)

  return sampleLoad
}

/**
 * 효과음을 미리 받아둔다.
 *
 * 첫 클릭에 소리가 안 나면 '눌리지 않았나' 싶어 한 번 더 누르게 된다.
 * 오디오 프리로드(D8) 단계에서 같이 불러 그 한 박자를 없앤다.
 */
export function preloadDeckKey(): void {
  const ac = audioContext()
  if (ac) void loadSample(ac)
}

/** 녹음 조각 재생 */
function playSample(ac: AudioContext, buf: AudioBuffer, kind: SfxKind) {
  const tone = TONE[kind] ?? TONE.play
  const src = ac.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = tone.rate

  const g = ac.createGain()
  g.gain.value = tone.gain

  src.connect(g).connect(ac.destination)
  src.start()

  // REC은 걸쇠가 두 번 걸린다 — 다른 키와 구분되도록 한 번 더 작게
  if (kind === 'rec') {
    const echo = ac.createBufferSource()
    echo.buffer = buf
    echo.playbackRate.value = tone.rate * 0.92
    const eg = ac.createGain()
    eg.gain.value = tone.gain * 0.45
    echo.connect(eg).connect(ac.destination)
    echo.start(ac.currentTime + 0.075)
  }
}

/** 짧은 노이즈 — 플라스틱 키가 부딪는 성분 (폴백) */
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

/**
 * 폴백 '딸깍' — 앞은 크게, 뒤는 작게, 사이는 짧게.
 * 사인파 '툭'은 북소리처럼 들려서 쓰지 않는다.
 */
function fallbackClick(ac: AudioContext, kind: SfxKind) {
  const now = ac.currentTime
  const tone = TONE[kind] ?? TONE.play
  clack(ac, now, tone.bright, 0.3)
  clack(ac, now + 0.038, tone.bright * 0.78, 0.13)
  if (kind === 'rec') clack(ac, now + 0.09, tone.bright * 0.7, 0.09)
}

/**
 * 셔터 — 사진을 찍는 순간의 '찰칵'.
 *
 * 녹음 조각을 쓰지 않고 합성한다. 데크 키는 화면의 주인공이라 진짜 기구
 * 소리여야 했지만, 셔터는 한 번 스치고 마는 확인음이라 파일 하나를 더
 * 받아둘 값이 없다.
 *
 * 기계식 셔터는 한 번에 나지 않는다 — 막이 열리며 '착', 반 박자 뒤 닫히며
 * '칵', 그리고 기구가 제자리로 돌아가는 낮은 여운이 붙는다. 이 셋을 겹쳐야
 * '찰칵'으로 들린다. 한 번만 내면 그냥 '탁'이다.
 *
 * 첫 소리를 가장 밝게 두는 것이 중요하다. 사람은 그 순간에 찍혔다고
 * 느끼므로, 뒤가 더 크면 셔터가 늦게 눌린 것처럼 들린다.
 */
export function playShutter(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    clack(ac, now, 5200, 0.34) // 막이 열린다 — 짧고 밝게
    clack(ac, now + 0.055, 3400, 0.2) // 닫힌다 — 조금 낮게
    clack(ac, now + 0.078, 1500, 0.09) // 기구가 돌아가는 여운
  } catch {
    /* 소리는 부가 기능이다 */
  }
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
    if (sample) {
      playSample(ac, sample, kind)
      return
    }
    // 아직 안 받았으면 이번 클릭은 합성음으로 내고, 다음부터 녹음을 쓴다.
    // 여기서 기다리면 소리가 늦게 나 눌린 느낌이 사라진다.
    fallbackClick(ac, kind)
    void loadSample(ac)
  } catch {
    /* 소리는 부가 기능이다 */
  }
}
