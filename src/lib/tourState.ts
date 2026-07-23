/**
 * 투어 전역 상태 (명세서 §2.2) — 모듈 싱글턴 + 구독 패턴.
 *
 * narration.ts와 같은 방식이다: React context가 아니라 모듈 상태이므로
 * 라우트가 바뀌어도 유지되고, 어느 컴포넌트든 구독만 하면 된다.
 * 모든 변경은 localStorage 키 `bh_tour_v2` 한 곳에 즉시 저장된다.
 *
 * 구(舊) 키(completedMissions·totalScore)는 최초 1회 마이그레이션으로만
 * 읽고, 새 코드는 절대 쓰지 않는다.
 */

import type { CueId, FragmentId } from './cues'

export type TourPhase = 'landing' | 'intro' | 'act1' | 'act2' | 'done'

export interface BsideEntry {
  type: 'voice' | 'text' | 'heart_only'
  /** voice: IndexedDB blob 키 */
  idbKey?: string
  /** text: 입력한 내용 */
  text?: string
  /** 서버 업로드는 명시 동의 시에만 true (D12) */
  uploaded: boolean
}

export interface TourPhoto {
  track: number
  idbKey: string
  takenAt: number
}

export interface TourState {
  phase: TourPhase
  currentTrack: 0 | 1 | 2 | 3 | 4 | 5
  fragments: FragmentId[]
  tracksCompleted: number[]
  /** D7: Track 1 종료(C1_5) 후 casual 고정 */
  speechMode: 'formal' | 'casual'
  bsideEntry: BsideEntry | null
  photos: TourPhoto[]
  bingo: { unlocked: boolean; cellsDone: string[]; lines: number }
  coupons: string[]
  audioCacheReady: boolean
  arFallbackUsed: boolean
  startTime: number | null
  /** §10 재개: 마지막으로 완료한 큐 */
  lastCueCompleted: CueId | null
  /** S00 모의 결제 여부 */
  paid: boolean
  /** C7_1 에필로그 라이브 육성 feature flag (D5) */
  epilogueLiveVoice: boolean
}

const STORAGE_KEY = 'bh_tour_v2'

export const INITIAL_TOUR_STATE: TourState = {
  phase: 'landing',
  currentTrack: 0,
  fragments: [],
  tracksCompleted: [],
  speechMode: 'formal',
  bsideEntry: null,
  photos: [],
  bingo: { unlocked: false, cellsDone: [], lines: 0 },
  coupons: [],
  audioCacheReady: false,
  arFallbackUsed: false,
  startTime: null,
  lastCueCompleted: null,
  paid: false,
  epilogueLiveVoice: false,
}

type Listener = (state: TourState) => void
const listeners = new Set<Listener>()

let state: TourState | null = null

function load(): TourState {
  if (typeof window === 'undefined') return { ...INITIAL_TOUR_STATE }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TourState>
      return { ...INITIAL_TOUR_STATE, ...parsed }
    }
  } catch {
    // 손상된 저장값은 무시하고 초기화
  }
  // 저장값이 없으면 처음부터 시작한다.
  // 구 키(completedMissions)를 읽어 진행 상태를 복원하지 않는다 —
  // 그 키는 score.ts가 점수 적립용으로 지금도 쓰고 있어서(main-1 등),
  // 이관 로직을 두면 결제하지 않은 사람이 paid=true로 복원돼 결제·인트로를
  // 통째로 건너뛴다. 구 앱은 컨셉 자체가 달라 이어받을 진행도도 없다.
  return { ...INITIAL_TOUR_STATE }
}

function persist() {
  if (typeof window === 'undefined' || !state) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 저장 실패(용량 등)로 앱 흐름을 막지 않는다
  }
}

export function getTourState(): TourState {
  if (!state) state = load()
  return state
}

export function subscribeTour(listener: Listener): () => void {
  listeners.add(listener)
  listener(getTourState())
  return () => listeners.delete(listener)
}

export function mutateTour(
  patch: Partial<TourState> | ((prev: TourState) => Partial<TourState>)
): TourState {
  const prev = getTourState()
  const resolved = typeof patch === 'function' ? patch(prev) : patch
  state = { ...prev, ...resolved }
  persist()
  listeners.forEach((l) => l(state as TourState))
  return state
}

/** 처음부터 다시 (디버그·재플레이) */
export function resetTour(): TourState {
  state = { ...INITIAL_TOUR_STATE }
  persist()
  listeners.forEach((l) => l(state as TourState))
  return state
}

/**
 * 이야기만 처음으로 되돌린다 — 산 것은 그대로 둔다.
 *
 * resetTour는 paid까지 false로 되돌린다. 로그아웃이나 기기 인계처럼 기록을
 * 통째로 비울 때는 그게 맞지만, 사용자가 '처음부터 시작하기'를 누른 것은
 * 환불이 아니라 다시 걷겠다는 뜻이다. 여기서 결제까지 지우면 15,000원 내고
 * 산 사람이 자기 상품에 못 들어간다.
 */
export function restartTour(): TourState {
  const wasPaid = (state as TourState).paid
  state = { ...INITIAL_TOUR_STATE, paid: wasPaid, phase: wasPaid ? 'intro' : 'landing' }
  persist()
  listeners.forEach((l) => l(state as TourState))
  return state
}

// ---------------------------------------------------------------------------
// 자주 쓰는 파생·조작 헬퍼
// ---------------------------------------------------------------------------

export function awardFragment(fragment: FragmentId) {
  mutateTour((prev) =>
    prev.fragments.includes(fragment)
      ? {}
      : { fragments: [...prev.fragments, fragment] }
  )
}

export function addCoupon(coupon: string) {
  mutateTour((prev) =>
    prev.coupons.includes(coupon) ? {} : { coupons: [...prev.coupons, coupon] }
  )
}

/**
 * 트랙 완료 기록. currentTrack은 건드리지 않는다 —
 * 이동 큐(user_tap:NEXT)가 현재 트랙으로 매칭되어야 하므로,
 * currentTrack 갱신은 다음 거점 QR 도착(dispatchQr) 시점에 일어난다.
 */
export function completeTrack(track: number) {
  mutateTour((prev) => {
    const tracksCompleted = prev.tracksCompleted.includes(track)
      ? prev.tracksCompleted
      : [...prev.tracksCompleted, track].sort()
    return { tracksCompleted }
  })
}

export function setCurrentTrack(track: TourState['currentTrack']) {
  mutateTour({ currentTrack: track })
}

export function markBingoCell(cellId: string) {
  mutateTour((prev) => {
    if (prev.bingo.cellsDone.includes(cellId)) return {}
    return {
      bingo: {
        ...prev.bingo,
        cellsDone: [...prev.bingo.cellsDone, cellId],
      },
    }
  })
}

/** 소요 시간 표시용 "1시간 23분" */
export function formatElapsed(startTime: number | null, now = Date.now()): string {
  if (!startTime) return '—'
  const totalMin = Math.max(0, Math.floor((now - startTime) / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}
