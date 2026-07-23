'use client'

/**
 * 슈퍼관리자 모드 — 진행 순서를 무시하고 앱을 시험한다.
 *
 * 90분짜리 이야기를 순서대로만 걸을 수 있으면 뒤쪽 화면은 고칠 때마다
 * 처음부터 다시 걸어야 한다. 거점 QR은 현장에 붙어 있어 책상에서는
 * 아예 통과할 수 없다.
 *
 * 켜는 것과 데이터 표시는 별개다. 이 모드를 껐다고 관리자 계정의 기록이
 * 참여자 기록이 되지는 않는다 — 표시는 계정 단위이고(admin.ts), 여기서
 * 정하는 것은 '지금부터 어떻게 진행할지'뿐이다.
 *
 * 되감지 않는다. 트랙 5까지 건너뛴 뒤 끄면 트랙 5에 서 있다. 참여자
 * 흐름을 처음부터 밟아보려면 끄고 나서 '처음부터 다시'를 눌러야 한다.
 *
 * 기존 검수 완화 장치(tracks.ts의 REHEARSAL)와 역할이 다르다. 그쪽은
 * 빌드 종류로 갈려서 프로덕션에서는 스스로 잠긴다. 이 모드는 런타임
 * 스위치라 프로덕션에서도 켤 수 있고, 대신 관리자 계정에만 열린다.
 */

import { useEffect, useState } from 'react'
import { isAdminUser } from './admin'
import { BINGO_ALWAYS_OPEN } from './tracks'

const STORAGE_KEY = 'bh_super_admin'

type Listener = (on: boolean) => void
const listeners = new Set<Listener>()

let enabled: boolean | null = null

function load(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 모드가 켜져 있는지 — 계정 확인까지 포함한다.
 *
 * 저장값만 보면 관리자가 로그아웃한 뒤에도 켜진 채로 남는다. 같은 기기를
 * 다음 사람이 쓰면 걷지 않고 전 거점이 열린다.
 */
export function isSuperAdmin(): boolean {
  if (enabled === null) enabled = load()
  return enabled && isAdminUser()
}

/** 저장된 스위치 값 — 계정과 무관하게 토글 UI가 보여줄 상태 */
export function superAdminSwitch(): boolean {
  if (enabled === null) enabled = load()
  return enabled
}

export function setSuperAdmin(on: boolean) {
  enabled = on
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // 저장 실패로 토글을 막지 않는다 — 이번 세션에는 반영된다
  }
  listeners.forEach((l) => l(on))
}

export function subscribeSuperAdmin(listener: Listener): () => void {
  listeners.add(listener)
  listener(superAdminSwitch())
  return () => listeners.delete(listener)
}

/**
 * 화면용 — 모드가 바뀌면 다시 그린다.
 *
 * 서버 렌더에서는 항상 false로 시작한다. localStorage를 첫 그림에 읽으면
 * 서버와 결과가 달라 하이드레이션이 어긋난다.
 */
export function useSuperAdmin(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => subscribeSuperAdmin(() => setOn(isSuperAdmin())), [])
  return on
}

// ---------------------------------------------------------------------------
// 관문 — 이 모드가 여는 것들
// ---------------------------------------------------------------------------

/**
 * 거점 순서를 건너뛸 수 있는지.
 * true면 QR 없이, 그리고 차례가 아닌 거점도 들어갈 수 있다.
 */
export function canSkipOrder(): boolean {
  return isSuperAdmin()
}

/**
 * 빙고판을 열 수 있는지.
 * 정상 동작은 다섯 소원 완료 후 해제다. 리허설 빌드이거나 이 모드가
 * 켜져 있으면 먼저 연다.
 */
export function bingoOpen(): boolean {
  return BINGO_ALWAYS_OPEN || isSuperAdmin()
}

/**
 * 15초를 기다리지 않고 큐를 건너뛸 수 있는지(D9).
 * 뒤쪽 큐를 고칠 때 앞의 대사를 매번 15초씩 기다릴 수 없다.
 */
export function canSkipCueNow(): boolean {
  return isSuperAdmin()
}
