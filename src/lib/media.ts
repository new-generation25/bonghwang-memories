'use client'

/**
 * 카메라·마이크 접근 공통 처리.
 *
 * 원래는 각 컴포넌트가 getUserMedia를 직접 부르고 실패를 통째로 삼켰다.
 * 그래서 "녹음이 안 된다"는 증상만 남고 원인을 알 방법이 없었다. 여기서
 * 실패 이유를 분류해 돌려준다.
 *
 * 가장 흔한 원인은 코드 문제가 아니라 접속 주소다. 보안 컨텍스트(https 또는
 * localhost)가 아니면 브라우저가 navigator.mediaDevices 자체를 만들지 않는다.
 * 휴대폰에서 http://192.168.x.x 로 접속하면 카메라도 마이크도 통째로 없다.
 */

export type MediaFailure =
  | 'insecure'   // https가 아님 — 기기 접근 자체가 차단
  | 'denied'     // 사용자가 거부
  | 'notfound'   // 장치 없음
  | 'inuse'      // 다른 앱이 점유
  | 'unknown'

export interface MediaResult {
  stream: MediaStream | null
  failure: MediaFailure | null
  /** 화면에 그대로 보여줄 수 있는 설명 */
  message: string
}

const MESSAGES: Record<MediaFailure, string> = {
  insecure:
    'https로 접속해야 카메라·마이크를 쓸 수 있어요. 지금 주소로는 브라우저가 기기 접근을 막습니다.',
  denied:
    '권한이 거부되어 있어요. 주소창 왼쪽 자물쇠 → 사이트 설정에서 허용으로 바꿔주세요.',
  notfound: '사용할 수 있는 장치를 찾지 못했어요.',
  inuse: '다른 앱이 사용 중이에요. 그 앱을 닫고 다시 시도해주세요.',
  unknown: '기기를 여는 데 실패했어요.',
}

/** 보안 컨텍스트인지 — 여기가 false면 나머지는 볼 것도 없다 */
export function isMediaAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia)
}

function classify(err: unknown): MediaFailure {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound'
  if (name === 'NotReadableError' || name === 'AbortError') return 'inuse'
  return 'unknown'
}

/**
 * 권한을 이미 받았는지 — 받았으면 우리 쪽 안내 화면을 건너뛴다.
 * Permissions API를 지원하지 않는 브라우저(사파리 일부)에서는 null.
 */
export async function permissionState(
  kind: 'camera' | 'microphone'
): Promise<'granted' | 'denied' | 'prompt' | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null
  try {
    const res = await navigator.permissions.query({
      name: kind as PermissionName,
    })
    return res.state
  } catch {
    // 사파리는 camera/microphone 조회를 지원하지 않고 예외를 던진다
    return null
  }
}

/** 스트림을 연다. 실패해도 예외를 던지지 않고 이유를 담아 돌려준다. */
export async function openStream(
  constraints: MediaStreamConstraints
): Promise<MediaResult> {
  if (!isMediaAvailable()) {
    return { stream: null, failure: 'insecure', message: MESSAGES.insecure }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return { stream, failure: null, message: '' }
  } catch (err) {
    const failure = classify(err)
    return { stream: null, failure, message: MESSAGES[failure] }
  }
}

/**
 * 트랙을 확실히 끊는다.
 *
 * 스트림을 살려두면 화면 위쪽 녹화 표시가 계속 켜져 있다. 촬영이 끝나면
 * 즉시 끊어야 한다 — 권한은 브라우저가 기억하므로 다음 단계에서 다시
 * 물어보지 않는다.
 */
export function closeStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop())
}
