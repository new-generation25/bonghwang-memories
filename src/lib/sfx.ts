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
 * 길게 끄는 저역 노이즈 — 통이 울리는 성분.
 *
 * clack은 0.035초로 고정이라 '탁' 이상은 만들지 못한다. 도장처럼 무게가
 * 남아야 하는 소리는 여운이 있어야 해서 길이를 받는 쪽을 따로 둔다.
 * 밴드패스 대신 로우패스를 쓴다 — 좁은 대역만 남기면 통울림이 아니라
 * 삐 하는 음정으로 들린다.
 */
function lowNoise(
  ac: AudioContext,
  at: number,
  cutoff: number,
  gain: number,
  dur: number
) {
  const len = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
  }
  const src = ac.createBufferSource()
  src.buffer = buf

  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff

  const g = ac.createGain()
  g.gain.value = gain

  src.connect(lp).connect(g).connect(ac.destination)
  src.start(at)
  src.stop(at + dur + 0.02)
}

/**
 * 음정이 있는 짧은 신호음.
 *
 * 노이즈로는 '확인됐다'·'한 줄 됐다' 같은 뜻을 못 만든다 — 사람은 올라가는
 * 음에서 성공을 읽는다. 그래서 여기만 오실레이터를 쓴다.
 *
 * 삼각파를 기본으로 둔다. 사인파는 스피커가 작은 휴대폰에서 거의 안 들리고,
 * 사각파는 같은 크기에서도 귀를 찌른다.
 *
 * 시작과 끝을 램프로 감싼다. 값을 그냥 0으로 떨구면 파형이 잘려 '틱' 하는
 * 잡음이 붙는다.
 */
function tone(
  ac: AudioContext,
  at: number,
  freq: number,
  gain: number,
  dur: number
) {
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq

  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)

  osc.connect(g).connect(ac.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
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
 * 카세트 뒤집기 — 뚜껑을 열고, 테이프를 돌려 끼우고, 닫는다.
 *
 * 이 소리는 한 번의 '탁'이 아니라 사람이 손으로 하는 세 동작이다. 붙여서
 * 내면 그냥 두꺼운 클릭이 되고, B면으로 넘어갔다는 느낌이 남지 않는다.
 * 그래서 가운데에 정적을 둔다 — 손이 움직이는 시간이 있어야 기구가 아니라
 * 사람이 뒤집은 것처럼 들린다.
 *
 *  1) 뚜껑이 젖혀지는 '탁' — 가장 밝고 크다
 *  2) 0.18초 정적 — 테이프를 돌려 쥐는 사이
 *  3) 케이스 홈을 긁으며 들어가는 '드르륵' — 짧은 노이즈 다섯 조각.
 *     간격을 일정하게 두면 기계 소리가 되므로 조금씩 흔든다.
 *  4) 걸쇠가 물리는 '탁' + 통이 울리는 여운
 */
export function playCassetteFlip(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    clack(ac, now, 2900, 0.32) // 뚜껑
    clack(ac, now + 0.03, 1400, 0.12) // 뚜껑이 끝까지 젖혀지며 부딪는 소리

    // 드르륵 — 간격이 조금씩 다른 다섯 조각
    const drag = now + 0.21
    for (let i = 0; i < 5; i++) {
      clack(ac, drag + i * 0.026 + Math.random() * 0.008, 1700 + i * 120, 0.075)
    }

    const seat = drag + 0.16
    clack(ac, seat, 2200, 0.26) // 걸쇠
    lowNoise(ac, seat, 420, 0.2, 0.14) // 케이스가 울리는 여운
  } catch {
    /* 소리는 부가 기능이다 */
  }
}

/**
 * QR 인식 성공 — 스캐너의 '삑'.
 *
 * 마트 계산대에서 배운 소리다. 하나뿐이고, 짧고, 높다. 두 번 내면 확인이
 * 아니라 안내처럼 들려서 그다음을 기다리게 된다.
 *
 * 앞에 아주 작은 노이즈를 붙인다 — 순수한 음만 내면 어디서 시작했는지
 * 모르게 스르륵 들어와서, 찍힌 순간과 소리가 어긋난 것처럼 느껴진다.
 */
export function playQrOk(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    clack(ac, now, 4200, 0.14) // 시작점을 만드는 아주 짧은 잡음
    tone(ac, now, 2100, 0.3, 0.075)
  } catch {
    /* 소리는 부가 기능이다 */
  }
}

/**
 * 빙고 한 줄 완성.
 *
 * 칸 하나를 채울 때보다 확실히 커야 한다. 같은 크기로 내면 줄이 됐는지
 * 화면을 다시 봐야 알 수 있다.
 *
 * 세 음을 올린다(솔–도–미). 마지막 음만 조금 길게 끌어 끝맺음을 준다 —
 * 셋 다 같은 길이면 아직 더 올라갈 것처럼 들려 끊긴 느낌이 된다.
 */
export function playBingoLine(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    clack(ac, now, 3000, 0.16) // 첫 음의 머리를 세운다
    tone(ac, now, 784, 0.34, 0.1) // 솔
    tone(ac, now + 0.09, 1046, 0.34, 0.1) // 도
    tone(ac, now + 0.18, 1318, 0.36, 0.26) // 미 — 여기서 끝난다
  } catch {
    /* 소리는 부가 기능이다 */
  }
}

/**
 * 포인트 적립 — 작은 '띵'.
 *
 * 걷는 중에 자주 뜨는 알림이라 존재만 알리면 된다. 빙고 줄 소리와 같은
 * 음계를 쓰되 한 음이고 훨씬 작다 — 크게 만들면 몇 번 만에 성가셔진다.
 */
export function playPoint(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    tone(ac, now, 1568, 0.26, 0.16)
  } catch {
    /* 소리는 부가 기능이다 */
  }
}

/**
 * 녹음 시작 신호 — 자동응답기의 '삐-삐'.
 *
 * 두 번 내는 데는 이유가 있다. 한 번이면 눌렸다는 뜻밖에 안 되지만, 두 번은
 * '이제부터 말하세요'가 된다. 육십 초를 혼자 말해야 하는 화면이라 그 신호가
 * 필요하다.
 *
 * 짧고 작게 둔다 — 이 소리는 스피커로 나가는 동안 마이크에 함께 담긴다.
 * 길게 끌면 녹음 앞머리에 신호음이 그대로 남는다.
 */
export function playRecStart(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    tone(ac, now, 880, 0.26, 0.07)
    tone(ac, now + 0.13, 880, 0.26, 0.07)
  } catch {
    /* 소리는 부가 기능이다 */
  }
}

/**
 * 녹음 정지 — 한 번, 낮게.
 *
 * 시작보다 낮은 음이어야 끝났다고 들린다. 같은 음을 한 번만 내면 시작
 * 신호를 덜 낸 것처럼 느껴져 계속 말하게 된다.
 */
export function playRecStop(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    tone(ac, now, 523, 0.26, 0.16)
  } catch {
    /* 소리는 부가 기능이다 */
  }
}

/**
 * 완주 도장 — 종이에 눌러 찍는 '쿵'.
 *
 * 세 겹이다. 고무가 종이에 닿는 짧고 마른 소리, 그 아래 책상이 울리는
 * 저역, 그리고 도장을 떼는 작은 소리. 저역만 내면 북이 되고, 고역만 내면
 * 그냥 딸깍이라 무게가 없다.
 *
 * 여운을 0.26초까지 끈다 — 이 앱에서 가장 긴 효과음이다. 마지막 한 번이라
 * 여기서만 그럴 값이 있다.
 */
export function playStamp(): void {
  if (isSfxMuted()) return
  const ac = audioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    clack(ac, now, 1200, 0.22) // 고무가 종이를 때린다
    lowNoise(ac, now, 180, 0.5, 0.26) // 책상이 울린다
    clack(ac, now + 0.11, 2400, 0.07) // 도장을 뗀다
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
