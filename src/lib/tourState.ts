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

import { COUPONS } from './coupons'
import type { CueId } from './cues'

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
  /*
    '기억의 조각'은 없어졌다 — 조각은 트랙 완료와 같은 큐에서 지급돼
    tracksCompleted ∩ [1..4]와 늘 같았다. J-카드(F-1)가 트랙 완료에서
    직접 파생하므로 상태를 따로 두지 않는다.
  */
  tracksCompleted: number[]
  /** D7: Track 1 종료(C1_5) 후 casual 고정 */
  speechMode: 'formal' | 'casual'
  /**
   * 소영이 말을 놓아도 되냐고 물었을 때의 대답.
   *
   * 지금은 어느 쪽을 골라도 이야기가 같게 흐른다 — 녹음이 반말 한 벌뿐이라
   * 거절해도 다음 대사가 반말로 나온다. 그래도 답을 남겨두는 건 나중에
   * 존댓말 벌을 넣을 때 이 값이 갈림길이 되기 때문이다.
   */
  speechConsent: 'yes' | 'no' | null
  bsideEntry: BsideEntry | null
  photos: TourPhoto[]
  bingo: { unlocked: boolean; cellsDone: string[]; lines: number }
  coupons: string[]
  /**
   * 골목 뽑기에서 연 칸 번호(0~49). 상품은 칸에서 파생한다(gacha.ts) —
   * 판 배치가 고정이라 칸 번호만 있으면 무엇이 나왔는지 되짚을 수 있다.
   * 빙고 두 번째 줄부터 한 줄에 한 번씩 뽑는다.
   */
  gachaDrawn: number[]
  /** F-3: 쓴 힌트 — 'M1:h1' 꼴 refId. 회차 총 3회 상한은 화면이 잰다 */
  hintsUsed: string[]
  /** F-2: 발견한 히든트랙 id. 해금 전에는 수집첩에 잠긴 채 쌓인다 */
  hiddenFound: string[]
  /** F-2: 1막 완주 후 소영의 수신 전화로 일괄 해금됐는가 */
  hiddenUnlocked: boolean
  /** F-7: 유입 경로 — 랜딩 ?via= 태그. 첫 값이 남는다(자연 유입은 null) */
  entryVia: string | null
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
  tracksCompleted: [],
  speechMode: 'formal',
  speechConsent: null,
  bsideEntry: null,
  photos: [],
  bingo: { unlocked: false, cellsDone: [], lines: 0 },
  coupons: [],
  gachaDrawn: [],
  hintsUsed: [],
  hiddenFound: [],
  hiddenUnlocked: false,
  entryVia: null,
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
      const merged = { ...INITIAL_TOUR_STATE, ...parsed }
      /*
        카탈로그에 없는 쿠폰 id를 걸러낸다.

        빙고 줄마다 `bingo-line-N`을 쿠폰이라고 넣던 시절이 있었다. 화면은
        couponSpec()이 null이면 그리지 않아 눈에 띄지 않았지만, 그 값들이
        기기에 그대로 남아 관리자 통계의 '쿠폰 수'를 줄 수만큼 부풀렸다.

        걸러낸 값을 **그 자리에서 되쓴다.** 예전에는 메모리에서만 털고
        다음 저장을 기다렸는데, 그 '다음 저장'이 첫 줄 쿠폰 지급 효과였다 —
        보상 구조가 바뀌어 그 효과가 사라지자 저장소에 잔재가 그대로 남았다.
        고치는 곳과 남는 곳이 다르면 언젠가 다시 어긋난다.
      */
      const clean = merged.coupons.filter((id) => Boolean(COUPONS[id]))
      if (clean.length !== merged.coupons.length) {
        merged.coupons = clean
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        } catch {
          // 되쓰기에 실패해도 이번 화면은 깨끗한 값으로 돈다
        }
      }
      return merged
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


export function addCoupon(coupon: string) {
  mutateTour((prev) =>
    prev.coupons.includes(coupon) ? {} : { coupons: [...prev.coupons, coupon] }
  )
}

/** 뽑기에서 연 칸을 기록한다 — 같은 칸은 두 번 열리지 않는다 */
export function markGachaDrawn(slot: number) {
  mutateTour((prev) =>
    prev.gachaDrawn.includes(slot)
      ? {}
      : { gachaDrawn: [...prev.gachaDrawn, slot] }
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
