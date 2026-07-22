/**
 * 봉황1988 EP.1 — 거점(Station)과 트랙 미션 정의.
 *
 * 1막(act1)의 다섯 거점 + 인트로. 좌표는 구 missions.ts에서 이관했다.
 * QR 페이로드와 4자리 수동 코드는 실물 QR 제작 전의 잠정값이다 —
 * 실물이 이미 인쇄되어 있다면 여기 값을 실물에 맞출 것.
 */

import type { ActionId, CueId, FragmentId, StationId } from './cues'

export interface Station {
  id: StationId
  track: 0 | 1 | 2 | 3 | 4 | 5
  name: string
  /** 아버지의 소원 (테이프 원문 표현) */
  wish: string
  location: { lat: number; lng: number } | null
  /** 실물 QR에 담기는 문자열 — 스캔 검증 대상 */
  qrPayload: string
  /** QR 훼손·카메라 거부 시 수동 입력 폴백 (§10) */
  manualCode: string
  /** 스캔 성공 시 재생되는 도착 큐 */
  arrivalCue: CueId | null
}

export type TrackMissionType =
  | 'count_input'
  | 'photo'
  | 'ar_photo'
  | 'record'
  | 'poster_photo'
  | 'unlock'

export interface TrackMission {
  id: 'M1' | 'M1b' | 'M2' | 'M3' | 'M4' | 'M5a' | 'M5b'
  track: 1 | 2 | 3 | 4 | 5
  type: TrackMissionType
  title: string
  /** count_input: 정답 / unlock: 필요한 조각 수 */
  validation?: { answer?: number; threshold?: number }
  reward?: { fragment?: FragmentId; coupon?: string }
  /** 완료 시 큐 엔진에 발화하는 액션 */
  onCompleteAction: ActionId
}

// ---------------------------------------------------------------------------
// 거점
// ---------------------------------------------------------------------------

export const STATIONS: Record<StationId, Station> = {
  intro: {
    id: 'intro',
    track: 0,
    name: '골목 입구 우체통',
    wish: '테이프의 발견',
    location: null,
    qrPayload: 'BH88:INTRO',
    manualCode: '1988',
    arrivalCue: null, // 인트로 테이프는 QR 후 [▶ PLAY] user_tap으로 시작 (D4·D9)
  },
  t1: {
    id: 't1',
    track: 1,
    name: '봉황1935',
    wish: '엄마랑 어떻게 만났는지 들려주기',
    location: { lat: 35.228483, lng: 128.876678 },
    qrPayload: 'BH88:T1',
    manualCode: '1935',
    arrivalCue: 'B1_A',
  },
  t2: {
    id: 't2',
    track: 2,
    name: '미야상회',
    wish: '목욕탕 가서 등 밀어주기',
    location: { lat: 35.229116, lng: 128.878596 },
    qrPayload: 'BH88:T2',
    manualCode: '0917',
    arrivalCue: 'B2_A',
  },
  t3: {
    id: 't3',
    track: 3,
    name: '능소화 고택',
    wish: '예쁜 사진 찍어주기',
    location: { lat: 35.229192, lng: 128.87929 },
    qrPayload: 'BH88:T3',
    manualCode: '7788',
    arrivalCue: 'B3_A',
  },
  t4: {
    id: 't4',
    track: 4,
    name: '카페 탱자',
    wish: '좋아하는 음악 같이 듣기',
    location: { lat: 35.229361, lng: 128.879839 },
    qrPayload: 'BH88:T4',
    manualCode: '8890',
    arrivalCue: 'B4_A',
  },
  t5: {
    id: 't5',
    track: 5,
    name: '방하림',
    wish: '가족오락관 같이 나가기',
    location: { lat: 35.229729, lng: 128.880246 },
    qrPayload: 'BH88:T5',
    manualCode: '0625',
    arrivalCue: 'B5_A',
  },
}

export const TRACK_STATIONS: Station[] = [
  STATIONS.t1,
  STATIONS.t2,
  STATIONS.t3,
  STATIONS.t4,
  STATIONS.t5,
]

export function stationByTrack(track: number): Station | null {
  return TRACK_STATIONS.find((s) => s.track === track) ?? null
}

/** QR 페이로드 → 거점. 검증 실패 시 null */
export function stationByQrPayload(payload: string): Station | null {
  const normalized = payload.trim().toUpperCase()
  return (
    Object.values(STATIONS).find((s) => s.qrPayload === normalized) ?? null
  )
}

/** 4자리 수동 코드 → 거점 */
export function stationByManualCode(code: string): Station | null {
  const normalized = code.trim()
  return (
    Object.values(STATIONS).find((s) => s.manualCode === normalized) ?? null
  )
}

// ---------------------------------------------------------------------------
// 트랙 미션 (§8)
// ---------------------------------------------------------------------------

/** 최종 잠금 해제에 필요한 기억의 조각 수 (D10 — 1미션 실패 허용) */
export const UNLOCK_THRESHOLD = 3

export const ALL_FRAGMENTS: FragmentId[] = [
  'frag_1',
  'frag_2',
  'frag_3',
  'frag_4',
]

export const TRACK_MISSIONS: Record<TrackMission['id'], TrackMission> = {
  M1: {
    id: 'M1',
    track: 1,
    type: 'count_input',
    title: '풍선초 열매 세기',
    validation: { answer: 7 },
    // 개수 정답 → [사장님의 이야기 듣기] 활성 (아직 조각 없음)
    onCompleteAction: 'M1_count_ok',
  },
  M1b: {
    id: 'M1b',
    track: 1,
    type: 'photo',
    title: '풍선초 앞 인증샷',
    reward: { fragment: 'frag_1', coupon: 'cp1' },
    onCompleteAction: 'M1_photo_done',
  },
  M2: {
    id: 'M2',
    track: 2,
    type: 'photo',
    title: '바나나우유 인증샷',
    reward: { fragment: 'frag_2', coupon: 'cp2' },
    onCompleteAction: 'M2_photo_done',
  },
  M3: {
    id: 'M3',
    track: 3,
    type: 'ar_photo',
    title: '능소화 다시 피우기',
    reward: { fragment: 'frag_3', coupon: 'cp3' },
    onCompleteAction: 'M3_photo_done',
  },
  M4: {
    id: 'M4',
    track: 4,
    type: 'record',
    title: 'B면에 답장 남기기',
    reward: { fragment: 'frag_4', coupon: 'cp4' },
    onCompleteAction: 'M4_done',
  },
  M5a: {
    id: 'M5a',
    track: 5,
    type: 'poster_photo',
    title: '포스터 촬영',
    onCompleteAction: 'M5a_done',
  },
  M5b: {
    id: 'M5b',
    track: 5,
    type: 'unlock',
    title: 'B면의 마지막 트랙',
    validation: { threshold: UNLOCK_THRESHOLD },
    onCompleteAction: 'unlock_done',
  },
}

export function missionsForTrack(track: number): TrackMission[] {
  return Object.values(TRACK_MISSIONS).filter((m) => m.track === track)
}
