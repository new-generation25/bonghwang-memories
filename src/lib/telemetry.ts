/**
 * 계측 서버 큐 — 로컬 수집(analytics.ts)을 Firestore로 이어 보낸다.
 *
 * 이벤트마다 문서를 만들면 90분 투어에 쓰기가 수백 번이다. 그래서 모았다가
 * 한 문서로 보낸다: `users/{uid}/events/{batchId}` = `{ events[], flushedAt }`.
 * 15초가 지나거나 20건이 모이면 보낸다.
 *
 * 로그인 전에 걷는 사람이 있다(등록 없이 걷다가 나중에 로그인하는 흐름이
 * 정상 경로다). 그동안은 로컬에 대기시키고, 로그인 순간 AuthContext가
 * flushTelemetry로 밀어 올린다 — points.ts의 flushPendingPoints와 같은 결이다.
 *
 * 전송 실패는 조용히 삼킨다. 계측이 투어를 막아선 안 되고, 대기열이
 * 남아 있으면 다음 이벤트가 다시 밀어 올린다.
 */

import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, isFirebaseReady } from './firebase'

export interface TelemetryEvent {
  name: string
  props?: Record<string, string | number | boolean>
  /** epoch ms — 서버 시각이 아니라 발생 시각. 오프라인 대기 후 올라와도 유효하다 */
  at: number
}

const PENDING_KEY = 'bh_telemetry_pending_v1'
/** 로그인 없이 끝까지 걷는 사람의 기기에서 무한히 쌓이지 않게 자른다 */
const MAX_PENDING = 500
/** 이만큼 모이면 시간을 기다리지 않는다 */
const FLUSH_COUNT = 20
/** 골목에서 신호가 끊겼다 붙었다 하므로 너무 잦게 보내지 않는다 */
const FLUSH_DELAY_MS = 15_000
/** 한 문서에 담는 상한 — 규칙(events.size() <= 500)과 문서 1MB 한도의 여유 */
const MAX_BATCH = 200

function readPending(): TelemetryEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const v = JSON.parse(window.localStorage.getItem(PENDING_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function writePending(list: TelemetryEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list))
  } catch {
    /* 저장 실패로 투어를 막지 않는다 */
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false

/**
 * 이벤트를 대기열에 넣는다 — analytics.logEvent가 부른다.
 * 화면 코드는 이 함수를 직접 부르지 않는다(호출부는 logEvent 하나).
 */
export function queueTelemetry(
  name: string,
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return
  const list = readPending()
  list.push({ name, props, at: Date.now() })
  writePending(list.slice(-MAX_PENDING))

  const uid = auth?.currentUser?.uid
  if (!uid) return // 로그인하면 AuthContext가 밀어 올린다

  if (list.length >= FLUSH_COUNT) {
    void flushTelemetry(uid)
    return
  }
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    const u = auth?.currentUser?.uid
    if (u) void flushTelemetry(u)
  }, FLUSH_DELAY_MS)
}

/** 대기열을 서버로 보낸다. 로그인 직후와 배치 조건 충족 시에 불린다. */
export async function flushTelemetry(uid: string): Promise<void> {
  if (flushing || !uid) return
  if (!isFirebaseReady() || !db) return
  const batch = readPending().slice(0, MAX_BATCH)
  if (batch.length === 0) return

  flushing = true
  try {
    await setDoc(doc(collection(db, 'users', uid, 'events')), {
      events: batch,
      flushedAt: serverTimestamp(),
    })
    /*
      보낸 만큼만 앞에서 지운다 — 전송 중에 새로 쌓인 이벤트는 대기열
      뒤쪽에 남아 다음 배치로 나간다.
    */
    writePending(readPending().slice(batch.length))
  } catch {
    /* 대기열이 남아 있으니 다음 이벤트가 다시 시도한다 */
  } finally {
    flushing = false
  }
}

/*
  탭을 닫거나 홈으로 나갈 때 남은 것을 흘리지 않으려는 시도.
  pagehide 중의 비동기 쓰기는 보장이 없지만, 실패해도 대기열은
  localStorage에 남아 다음 방문 때 올라간다.
*/
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const uid = auth?.currentUser?.uid
    if (uid) void flushTelemetry(uid)
  })
}
