'use client'

/**
 * 투어 진행도 계정 동기화.
 *
 * tourState는 localStorage가 원본이다(오프라인 투어라 네트워크에 기대면 안 된다).
 * 이 모듈은 그 위에 얹는 백업·복원 계층이다:
 *
 *  · 로그인하면 서버 기록을 내려받아 로컬과 병합한다 (pullTour)
 *  · 이후 진행이 바뀔 때마다 서버에 밀어 올린다 (startTourSync, 디바운스)
 *
 * 병합 규칙은 "덜 잃는 쪽"이다. 기기를 바꿔 로그인했을 때 서버 기록으로
 * 이어 걸을 수 있어야 하고, 반대로 로그인 전에 걸어둔 진행이 로그인 때문에
 * 사라져서도 안 된다. 그래서 진행도가 더 나아간 쪽을 택하고,
 * 배열(완료 트랙·조각·쿠폰·빙고 칸)은 합집합으로 둔다.
 *
 * 사진 원본은 올리지 않는다 — IndexedDB에만 두고, 서버에는 어느 트랙에서
 * 몇 장 찍었는지만 남긴다(용량·비용 문제. Storage 업로드는 별도 동의 항목).
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseReady } from './firebase'
import {
  TourState,
  getTourState,
  mutateTour,
  subscribeTour,
} from './tourState'

/** 서버에 올리는 필드 — 사진 blob 키처럼 기기에 묶인 값은 뺀다 */
type SyncedTour = Omit<TourState, 'photos' | 'bsideEntry'> & {
  /** 사진은 개수·트랙만 (원본은 IndexedDB) */
  photoSummary: { track: number; count: number }[]
  /** 메모는 종류만 (음성 blob은 기기에) */
  memoType: 'voice' | 'text' | 'heart_only' | null
}

const PHASE_RANK: Record<TourState['phase'], number> = {
  landing: 0,
  intro: 1,
  act1: 2,
  act2: 3,
  done: 4,
}

function tourDoc(uid: string) {
  return doc(db!, 'users', uid, 'progress', 'tour')
}

function toSynced(s: TourState): SyncedTour {
  // tsconfig target이 낮아 Map/Set 순회 스프레드를 쓰지 않는다
  const counts: Record<number, number> = {}
  for (const p of s.photos) counts[p.track] = (counts[p.track] ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { photos, bsideEntry, ...rest } = s
  return {
    ...rest,
    photoSummary: Object.keys(counts).map((k) => ({
      track: Number(k),
      count: counts[Number(k)],
    })),
    memoType: bsideEntry?.type ?? null,
  }
}

function union<T>(a: T[], b: T[]): T[] {
  const out = a.slice()
  for (const v of b) if (out.indexOf(v) === -1) out.push(v)
  return out
}

/**
 * 로컬 + 서버 병합. 진행이 더 나아간 쪽을 택하고 목록은 합친다.
 * 로그인으로 진행도가 뒤로 가는 일은 없어야 한다.
 */
export function mergeTour(local: TourState, remote: Partial<SyncedTour>): Partial<TourState> {
  const tracks = union(local.tracksCompleted, remote.tracksCompleted ?? [])
  const localRank = PHASE_RANK[local.phase]
  const remoteRank = remote.phase ? PHASE_RANK[remote.phase] : -1

  return {
    paid: local.paid || Boolean(remote.paid),
    phase: remoteRank > localRank ? remote.phase! : local.phase,
    // 시작 시각은 더 이른 쪽 — 완주 시간 계산의 기준이다
    startTime:
      local.startTime && remote.startTime
        ? Math.min(local.startTime, remote.startTime)
        : (local.startTime ?? remote.startTime ?? null),
    tracksCompleted: tracks.sort((a, b) => a - b),
    currentTrack: Math.max(
      local.currentTrack,
      remote.currentTrack ?? 0
    ) as TourState['currentTrack'],
    fragments: union(local.fragments, remote.fragments ?? []),
    coupons: union(local.coupons, remote.coupons ?? []),
    // 반말 전환은 한 번 넘어가면 되돌리지 않는다(D7)
    speechMode:
      local.speechMode === 'casual' || remote.speechMode === 'casual'
        ? 'casual'
        : 'formal',
    bingo: {
      unlocked: local.bingo.unlocked || Boolean(remote.bingo?.unlocked),
      cellsDone: union(local.bingo.cellsDone, remote.bingo?.cellsDone ?? []),
      lines: Math.max(local.bingo.lines, remote.bingo?.lines ?? 0),
    },
    epilogueLiveVoice: local.epilogueLiveVoice || Boolean(remote.epilogueLiveVoice),
    arFallbackUsed: local.arFallbackUsed || Boolean(remote.arFallbackUsed),
    lastCueCompleted: local.lastCueCompleted ?? remote.lastCueCompleted ?? null,
  }
}

/** 서버 기록을 받아 로컬에 병합한다. 로그인 직후 한 번 부른다. */
export async function pullTour(uid: string): Promise<boolean> {
  if (!isFirebaseReady() || !db) return false
  try {
    const snap = await getDoc(tourDoc(uid))
    if (!snap.exists()) return false
    mutateTour((prev) => mergeTour(prev, snap.data() as Partial<SyncedTour>))
    return true
  } catch {
    // 복원 실패로 투어를 막지 않는다 — 로컬 기록으로 계속 걷는다
    return false
  }
}

/** 현재 진행도를 서버에 저장한다 */
/**
 * 서버에 진행도를 올린다. 성공 여부를 돌려준다 —
 * 로그아웃 때 로컬을 지워도 되는지 판단해야 하기 때문이다.
 * 저장되지 않았는데 지우면 걸어온 90분이 사라진다.
 */
export async function pushTour(uid: string): Promise<boolean> {
  if (!isFirebaseReady() || !db) return false
  try {
    await setDoc(
      tourDoc(uid),
      { ...toSynced(getTourState()), uid, updatedAt: serverTimestamp() },
      { merge: true }
    )
    return true
  } catch {
    // 원본은 localStorage에 있으므로 흐름은 막지 않는다
    return false
  }
}

/**
 * 진행이 바뀔 때마다 서버에 밀어 올린다.
 * 한 동작에 여러 번 mutate되는 경우가 많아 디바운스로 묶는다.
 * 반환한 함수를 부르면 구독을 끊는다.
 */
export function startTourSync(uid: string, delayMs = 1500): () => void {
  if (!isFirebaseReady() || !db) return () => {}

  let timer: ReturnType<typeof setTimeout> | null = null
  let lastSent = ''
  let stopped = false

  const unsubscribe = subscribeTour(() => {
    if (stopped) return
    // 실제로 바뀐 게 없으면 쓰지 않는다(구독은 저장과 무관하게도 발화한다)
    const snapshot = JSON.stringify(toSynced(getTourState()))
    if (snapshot === lastSent) return

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      lastSent = JSON.stringify(toSynced(getTourState()))
      void pushTour(uid)
      void syncUserStats(uid)
    }, delayMs)
  })

  // 탭을 닫거나 백그라운드로 갈 때 마지막 상태를 흘리지 않는다
  const flush = () => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    void pushTour(uid)
  }
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  // visibilitychange는 document에서 발생한다
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', flush)

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    unsubscribe()
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', flush)
  }
}

/** 로그인 세션의 uid — 편의용 */
export function currentUid(): string | null {
  return auth?.currentUser?.uid ?? null
}

/**
 * 관리자 화면이 쓰는 요약 통계를 users 문서에 올린다.
 *
 * 진행도 문서(users/{uid}/progress/tour)만 있으면 참여자 한 명을 보려고
 * 하위 문서를 전부 열어야 한다. 목록·집계에 필요한 값만 상위 문서에
 * 평평하게 복사해두면 users 컬렉션 한 번 읽기로 대시보드가 그려진다.
 */
export async function syncUserStats(uid: string): Promise<void> {
  if (!isFirebaseReady() || !db) return
  const s = getTourState()
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        missionCount: s.tracksCompleted.length + s.bingo.cellsDone.length,
        tracksCompleted: s.tracksCompleted.length,
        bingoCells: s.bingo.cellsDone.length,
        bingoLines: s.bingo.lines,
        couponCount: s.coupons.length,
        phase: s.phase,
        paid: s.paid,
        startedAt: s.startTime ?? null,
        finishedAt: s.phase === 'done' ? (s.startTime ? Date.now() : null) : null,
        lastActiveAt: serverTimestamp(),
      },
      { merge: true }
    )
  } catch {
    // 통계 저장 실패로 투어를 막지 않는다
  }
}
