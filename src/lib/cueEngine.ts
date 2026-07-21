/**
 * 큐 엔진 — 봉황1988의 오디오·자막 시퀀서 (모듈 싱글턴).
 *
 * narration.ts의 계약을 계승한다: 오디오 파일이 없어도 앱은 굴러가야 한다.
 * 파일이 없으면 durationSec 기반 합성 클록이 자막 싱크와 스킵 게이트를
 * 동일하게 구동한다. 즉 "자막 우선, 오디오는 보너스".
 *
 * 규칙(명세서):
 *  - D9: 스킵은 재생 15초 후 허용. 다시듣기 무제한. 시간 기반 자동재생 금지
 *    (auto_chain은 "선행 큐 종료"가 기점이므로 허용 — 같은 장소 안에서만).
 *  - D3: 자동 발신 금지 — 전화 연결은 반드시 사용자 탭.
 *  - UI 지시자는 큐 종료 시점에 실행된다.
 */

import {
  ActionId,
  CUES,
  Cue,
  CueId,
  StationId,
  TapId,
  UiDirective,
  findCueByAction,
  findCueByQr,
  findCueByTap,
} from './cues'
import {
  addCoupon,
  awardFragment,
  completeTrack,
  getTourState,
  mutateTour,
  setCurrentTrack,
} from './tourState'
import { STATIONS } from './tracks'
import { POINTS, awardPoints } from './score'

/** D9 — 스킵 허용 시점(초) */
export const SKIP_AFTER_SEC = 15

const BASE_PATH = '/audio'
const EXTENSIONS = ['m4a', 'mp3'] as const

// -----------------------------------------------------------------------------
// 재생 상태
// -----------------------------------------------------------------------------

export interface CuePlaybackState {
  cueId: CueId | null
  channel: 'tape' | 'call' | null
  playing: boolean
  /** 경과 시간(초) — 오디오 또는 합성 클록 */
  elapsed: number
  duration: number
  subtitleIndex: number
  /** D9: 15초 경과 후 true */
  skippable: boolean
  /** 오디오 파일이 있어 실제 소리가 나는 경우 */
  audioAvailable: boolean
  /** 큐가 끝났고 다음 트리거를 기다리는 상태 */
  ended: boolean
  /** auto_chain 대기 중인 다음 큐 */
  pendingAutoChain: CueId | null
}

const INITIAL_STATE: CuePlaybackState = {
  cueId: null,
  channel: null,
  playing: false,
  elapsed: 0,
  duration: 0,
  subtitleIndex: 0,
  skippable: false,
  audioAvailable: false,
  ended: false,
  pendingAutoChain: null,
}

let state: CuePlaybackState = { ...INITIAL_STATE }

type StateListener = (state: CuePlaybackState) => void
const stateListeners = new Set<StateListener>()

/** 화면이 반응해야 하는 일회성 이벤트(연출·미션 노출 등) */
export type CueEvent = { directive: UiDirective; cueId: CueId }
type EventListener = (event: CueEvent) => void
const eventListeners = new Set<EventListener>()

function emit(patch: Partial<CuePlaybackState>) {
  state = { ...state, ...patch }
  stateListeners.forEach((l) => l(state))
}

function emitEvent(directive: UiDirective, cueId: CueId) {
  eventListeners.forEach((l) => l({ directive, cueId }))
}

export function subscribeCue(listener: StateListener): () => void {
  stateListeners.add(listener)
  listener(state)
  return () => stateListeners.delete(listener)
}

export function subscribeCueEvents(listener: EventListener): () => void {
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

export function getCueState(): CuePlaybackState {
  return state
}

// -----------------------------------------------------------------------------
// 내부 재생 리소스
// -----------------------------------------------------------------------------

let audio: HTMLAudioElement | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
let chainTimer: ReturnType<typeof setTimeout> | null = null
/**
 * 합성 클록은 벽시계 기준으로 계산한다 — setInterval 횟수 누적 방식은
 * 브라우저 타이머 스로틀링(백그라운드 탭 등)에서 실제보다 느려진다.
 * elapsed = clockAccum + (now - clockStartedAt) * timeScale
 */
let clockStartedAt = 0
let clockAccum = 0
let unlocked = false

/** E2E 테스트 배속 (`?e2e=1` → 10배속). 실사용에는 영향 없음 */
let timeScale = 1
export function setTimeScale(scale: number) {
  timeScale = Math.max(0.1, scale)
}
if (typeof window !== 'undefined') {
  try {
    if (new URLSearchParams(window.location.search).get('e2e') === '1') {
      timeScale = 10
    }
    // E2E·QA에서 리로드 없이 배속을 바꿀 수 있는 훅
    ;(window as unknown as Record<string, unknown>).__bh88SetTimeScale =
      setTimeScale
  } catch {
    /* noop */
  }
}

/** 존재하지 않는 파일 재요청 방지 (narration.ts 패턴) */
const missing = new Set<string>()

async function probe(url: string): Promise<boolean> {
  if (missing.has(url)) return false
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok) return true
  } catch {
    /* fallthrough */
  }
  missing.add(url)
  return false
}

/** audioFile → alias 순서로 재생 가능한 URL 탐색 */
async function resolveSource(cue: Cue): Promise<string | null> {
  const names = [cue.audioFile, ...(cue.audioAliases ?? [])]
  for (const name of names) {
    for (const ext of EXTENSIONS) {
      const url = `${BASE_PATH}/${name}.${ext}`
      if (await probe(url)) return url
    }
  }
  return null
}

/**
 * iOS 오디오 잠금 해제 — 첫 사용자 탭에서 호출.
 * (narration.ts에서 이관. 모든 user_tap 진입점에서 불러도 무해)
 */
export function unlockAudio() {
  if (unlocked || typeof window === 'undefined') return
  try {
    const silent = new Audio()
    silent.muted = true
    silent.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    void silent.play().catch(() => {})
    unlocked = true
  } catch {
    /* 치명적이지 않음 */
  }
}

// -----------------------------------------------------------------------------
// 자막 싱크 — 문장 길이 비례로 현재 줄 계산
// -----------------------------------------------------------------------------

function subtitleIndexAt(cue: Cue, elapsed: number, duration: number): number {
  const weights = cue.subtitleLines.map((l) => Math.max(1, l.text.length))
  const total = weights.reduce((a, b) => a + b, 0)
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (progress < acc / total) return i
  }
  return weights.length - 1
}

// -----------------------------------------------------------------------------
// 재생 제어
// -----------------------------------------------------------------------------

function clearResources() {
  if (audio) {
    audio.pause()
    audio.src = ''
    audio = null
  }
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

export function cancelPendingChain() {
  if (chainTimer) {
    clearTimeout(chainTimer)
    chainTimer = null
  }
  if (state.pendingAutoChain) emit({ pendingAutoChain: null })
}

function tick(cue: Cue, elapsed: number, duration: number) {
  emit({
    elapsed,
    duration,
    subtitleIndex: subtitleIndexAt(cue, elapsed, duration),
    skippable: elapsed >= SKIP_AFTER_SEC,
  })
  if (elapsed >= duration) finishCue(cue)
}

export async function playCue(id: CueId): Promise<void> {
  const cue = CUES[id]
  if (!cue) return

  // OPTIONAL 큐(C7_1)는 플래그가 꺼져 있으면 건너뛴다
  if (cue.optionalFlag === 'epilogue_live_voice' && !getTourState().epilogueLiveVoice) {
    return
  }

  cancelPendingChain()
  clearResources()
  clockAccum = 0
  clockStartedAt = 0

  emit({
    cueId: id,
    channel: cue.channel,
    playing: false,
    elapsed: 0,
    duration: cue.durationSec,
    subtitleIndex: 0,
    skippable: false,
    audioAvailable: false,
    ended: false,
    pendingAutoChain: null,
  })

  const src = await resolveSource(cue)

  // playCue가 겹쳐 불렸으면(다른 큐로 전환) 이 큐는 조용히 물러난다
  if (state.cueId !== id) return

  if (src) {
    const el = new Audio(src)
    audio = el
    el.addEventListener('loadedmetadata', () => {
      if (audio === el && el.duration && isFinite(el.duration)) {
        emit({ duration: el.duration })
      }
    })
    el.addEventListener('timeupdate', () => {
      if (audio === el) {
        tick(cue, el.currentTime, el.duration && isFinite(el.duration) ? el.duration : cue.durationSec)
      }
    })
    el.addEventListener('ended', () => {
      if (audio === el) finishCue(cue)
    })
    el.addEventListener('error', () => {
      // 재생 중 오류 → 합성 클록으로 전환하지 않고 그 지점에서 종료 처리
      if (audio === el) finishCue(cue)
    })
    emit({ audioAvailable: true })
    try {
      if (timeScale !== 1) el.playbackRate = timeScale
      await el.play()
      emit({ playing: true })
    } catch {
      // 자동재생 차단 — UI가 "탭해서 계속" 버튼을 보여주도록 playing=false 유지
      emit({ playing: false })
    }
  } else {
    // 합성 클록 — 자막만으로 진행
    clockStartedAt = performance.now()
    emit({ audioAvailable: false, playing: true })
    clockTimer = setInterval(() => {
      if (state.cueId !== id || !state.playing) return
      const elapsed =
        clockAccum + ((performance.now() - clockStartedAt) / 1000) * timeScale
      tick(cue, elapsed, state.duration)
    }, 250)
  }
}

export function pauseCue() {
  if (!state.playing) return
  if (audio) {
    audio.pause()
  } else if (clockStartedAt > 0) {
    // 합성 클록: 지금까지의 경과를 누적하고 멈춘다
    clockAccum += ((performance.now() - clockStartedAt) / 1000) * timeScale
    clockStartedAt = 0
  }
  emit({ playing: false })
}

export function resumeCue() {
  if (state.playing || !state.cueId || state.ended) return
  if (audio) {
    void audio.play().catch(() => {})
  } else {
    clockStartedAt = performance.now()
  }
  emit({ playing: true })
}

/** 다시듣기 — 무제한(D9) */
export function replayCue() {
  if (!state.cueId) return
  void playCue(state.cueId)
}

/** 스킵 — 15초 경과 후에만(D9) */
export function skipCue() {
  if (!state.cueId || !state.skippable || state.ended) return
  const cue = CUES[state.cueId]
  clearResources()
  finishCue(cue)
}

export function stopCue() {
  cancelPendingChain()
  clearResources()
  emit({ ...INITIAL_STATE })
}

// -----------------------------------------------------------------------------
// 종료 파이프라인: 지시자 실행 → 상태 기록 → auto_chain
// -----------------------------------------------------------------------------

function finishCue(cue: Cue) {
  if (state.cueId !== cue.id || state.ended) return
  clearResources()
  emit({
    playing: false,
    ended: true,
    elapsed: state.duration,
    subtitleIndex: cue.subtitleLines.length - 1,
  })

  for (const directive of cue.ui ?? []) {
    runDirective(directive, cue.id)
  }

  mutateTour({ lastCueCompleted: cue.id })

  if (cue.next) {
    const nextCue = CUES[cue.next]
    if (nextCue.trigger.type === 'auto_chain') {
      // OPTIONAL 큐가 꺼져 있으면 체인도 걸지 않는다
      if (
        nextCue.optionalFlag === 'epilogue_live_voice' &&
        !getTourState().epilogueLiveVoice
      ) {
        return
      }
      const delay = (nextCue.autoChainDelayMs ?? 2500) / timeScale
      emit({ pendingAutoChain: nextCue.id })
      chainTimer = setTimeout(() => {
        chainTimer = null
        if (state.pendingAutoChain === nextCue.id) {
          void playCue(nextCue.id)
        }
      }, delay)
    }
  }
}

/** 상태를 바꾸는 지시자는 여기서 처리하고, 연출 지시자는 이벤트로 흘린다 */
function runDirective(directive: UiDirective, cueId: CueId) {
  if (directive.startsWith('fragment_award:')) {
    awardFragment(directive.slice('fragment_award:'.length) as never)
  } else if (directive.startsWith('coupon:')) {
    addCoupon(directive.slice('coupon:'.length))
  } else if (directive.startsWith('track_check:')) {
    const track = parseInt(directive.slice('track_check:'.length), 10)
    // 점수는 최초 완료에만 — 다시듣기(D9)로 지시자가 재실행돼도 중복 적립 금지
    if (!getTourState().tracksCompleted.includes(track)) {
      awardPoints(`main-${track}`, POINTS.mainTrack)
    }
    completeTrack(track)
  } else if (directive === 'speech_mode:casual') {
    mutateTour({ speechMode: 'casual' })
  } else if (directive === 'phase:act2') {
    mutateTour((prev) => ({
      phase: 'act2',
      bingo: { ...prev.bingo, unlocked: true },
    }))
  }
  // 연출·화면 지시자(reel_*, cassette_flip, show_* 등)는 이벤트로만 전달
  emitEvent(directive, cueId)
}

// -----------------------------------------------------------------------------
// 트리거 진입점 (§4)
// -----------------------------------------------------------------------------

/**
 * T1 — QR 스캔(또는 수동 코드) 성공. 사용자 제스처 문맥에서 호출됨.
 * 도착이 곧 현재 트랙의 기준 — user_tap:NEXT 매칭이 여기에 의존한다.
 */
export function dispatchQr(station: StationId): boolean {
  unlockAudio()
  const cue = findCueByQr(station)
  if (!cue) return false
  const st = STATIONS[station]
  if (st && st.track >= 1 && st.track <= 5) {
    setCurrentTrack(st.track as 1 | 2 | 3 | 4 | 5)
  }
  void playCue(cue.id)
  return true
}

/** T3 — 미션 액션 완료 */
export function dispatchAction(action: ActionId): boolean {
  const cue = findCueByAction(action)
  if (!cue) return false
  void playCue(cue.id)
  return true
}

/** T4 — 명시적 버튼 탭. 반드시 클릭 핸들러 안에서 호출할 것 */
export function dispatchTap(tap: TapId): boolean {
  unlockAudio()
  const cue = findCueByTap(tap, getTourState().currentTrack)
  if (!cue) return false
  void playCue(cue.id)
  return true
}

// -----------------------------------------------------------------------------
// §10 — 인터럽트(전화 수신·백그라운드 전환) 처리
// -----------------------------------------------------------------------------

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // e2e 배속 모드에서는 자동 일시정지를 끈다(헤드리스 테스트가 멈추지 않도록)
    if (timeScale !== 1) return
    if (document.visibilityState === 'hidden' && state.playing) {
      pauseCue()
    }
  })
}
