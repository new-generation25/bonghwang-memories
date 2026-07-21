/**
 * 내레이션 오디오 재생 계층.
 *
 * 음성 파일은 public/audio/ 에 미리 넣어둔 사전 녹음본을 쓴다.
 * 파일이 아직 없어도 앱은 정상 동작해야 하므로, 없으면 조용히 건너뛴다.
 *
 * iOS Safari는 사용자 조작 없이 소리를 재생하지 못한다. 그래서 첫 재생은
 * 반드시 탭/클릭 핸들러 안에서 일어나야 하고, 이후 재생을 위해 같은
 * Audio 객체를 재사용한다(unlock 참고).
 */

export type NarrationId =
  | 'prologue' // 아빠 — 프롤로그 편지
  | `mission-${string}-intro` // 소영 — 미션 안내
  | `mission-${string}-outro` // 소영 — 미션 완료
  | 'complete' // 소영 — 완주 축하

const BASE_PATH = '/audio'

/** 확장자는 브라우저 호환을 위해 m4a(AAC) 우선, 없으면 mp3 */
const EXTENSIONS = ['m4a', 'mp3'] as const

/** 존재하지 않는 파일을 매번 다시 요청하지 않도록 결과를 기억한다 */
const missing = new Set<string>()

let current: HTMLAudioElement | null = null
let unlocked = false

/** 재생 상태가 바뀔 때 UI에 알리기 위한 구독자 목록 */
type Listener = (state: NarrationState) => void
const listeners = new Set<Listener>()

export interface NarrationState {
  id: NarrationId | null
  playing: boolean
  /** 오디오 파일이 없어 재생을 건너뛴 경우 */
  unavailable: boolean
  duration: number
  currentTime: number
}

let state: NarrationState = {
  id: null,
  playing: false,
  unavailable: false,
  duration: 0,
  currentTime: 0,
}

function emit(patch: Partial<NarrationState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener(state))
}

export function subscribeNarration(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

export function getNarrationState(): NarrationState {
  return state
}

/**
 * iOS 오디오 잠금 해제.
 * 사용자의 첫 조작(탭) 시점에 무음을 한 번 재생해 이후 프로그램 재생을 허용시킨다.
 * 반드시 클릭/터치 핸들러 안에서 호출해야 한다.
 */
export function unlockAudio() {
  if (unlocked || typeof window === 'undefined') return
  try {
    const silent = new Audio()
    silent.muted = true
    // 아주 짧은 무음 WAV — 외부 파일 없이 잠금만 푼다
    silent.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    void silent.play().catch(() => {})
    unlocked = true
  } catch {
    // 잠금 해제 실패는 치명적이지 않다 — 버튼을 누르면 어차피 재생된다
  }
}

/**
 * 음성 파일이 준비되어 있는지 확인한다.
 * UI가 마운트 시점에 호출해, 없는 기능을 노출하지 않도록 쓴다.
 */
export async function isNarrationAvailable(id: NarrationId): Promise<boolean> {
  return (await resolveSource(id)) !== null
}

/** 파일 존재 여부를 확인하며 재생 가능한 URL을 찾는다 */
async function resolveSource(id: NarrationId): Promise<string | null> {
  for (const ext of EXTENSIONS) {
    const url = `${BASE_PATH}/${id}.${ext}`
    if (missing.has(url)) continue
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) return url
      missing.add(url)
    } catch {
      missing.add(url)
    }
  }
  return null
}

export function stopNarration() {
  if (current) {
    current.pause()
    current.currentTime = 0
    current = null
  }
  emit({ id: null, playing: false, currentTime: 0 })
}

export function pauseNarration() {
  if (current && !current.paused) {
    current.pause()
    emit({ playing: false })
  }
}

export function resumeNarration() {
  if (current && current.paused) {
    void current.play().catch(() => {})
    emit({ playing: true })
  }
}

/**
 * 내레이션 재생. 파일이 없으면 unavailable 상태로만 알리고 조용히 끝낸다.
 * 앱 흐름을 막지 않는 것이 이 함수의 계약이다.
 */
export async function playNarration(id: NarrationId): Promise<void> {
  stopNarration()

  const src = await resolveSource(id)
  if (!src) {
    emit({ id, playing: false, unavailable: true, duration: 0, currentTime: 0 })
    return
  }

  const audio = new Audio(src)
  current = audio

  audio.addEventListener('loadedmetadata', () => {
    if (current === audio) emit({ duration: audio.duration || 0 })
  })
  audio.addEventListener('timeupdate', () => {
    if (current === audio) emit({ currentTime: audio.currentTime })
  })
  audio.addEventListener('ended', () => {
    if (current === audio) {
      current = null
      emit({ playing: false, currentTime: 0 })
    }
  })
  audio.addEventListener('error', () => {
    if (current === audio) {
      current = null
      emit({ playing: false, unavailable: true })
    }
  })

  emit({ id, unavailable: false, currentTime: 0 })

  try {
    await audio.play()
    emit({ playing: true })
  } catch {
    // 자동재생 차단 등 — 사용자가 버튼을 다시 누르면 재생된다
    emit({ playing: false })
  }
}

/** 페이지를 벗어날 때 소리가 따라다니지 않도록 정리 */
export function disposeNarration() {
  stopNarration()
  listeners.clear()
}
