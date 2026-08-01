/**
 * 이 기기가 쓰던 계정을 기억한다 — 한 사람이 계정 둘을 갖지 않게.
 *
 * 아이디로 만든 계정과 구글 계정은 파이어베이스가 서로 다른 사람으로 잡는다.
 * 그래서 같은 폰에서 오늘은 아이디로, 내일은 구글로 들어오면 계정이 둘이 되고
 * 걸어온 기록과 포인트가 반씩 갈린다. 갈라진 뒤에는 어느 쪽을 남길지 자동으로
 * 정할 수 없으므로, **갈라지기 전에 막는 것**이 유일한 방법이다.
 *
 * 여기서는 기억만 한다 — 이 기기가 마지막으로 쓴 계정이 무엇이었는지.
 * 그것을 보고 무엇을 권할지는 로그인 화면이 정한다.
 *
 * 지운 적 있는 사람(로그아웃 뒤 다른 사람에게 폰을 빌려준 경우 등)을 막지는
 * 않는다. 이 기억은 **권유의 근거**이지 자물쇠가 아니다.
 */

const KEY = 'bh_device_account'

export interface DeviceAccount {
  uid: string
  /** 어떻게 들어왔는지 — 다음에 같은 길을 권한다 */
  provider: 'password' | 'google'
  /** 아이디 계정이면 그 아이디. 구글이면 빈 문자열 */
  loginId: string
  nickname: string
}

export function rememberAccount(a: DeviceAccount): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    // 저장이 막힌 브라우저(앱 안 브라우저 등) — 기억 못 해도 흐름은 굴러간다
  }
}

export function deviceAccount(): DeviceAccount | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DeviceAccount
    return parsed && parsed.uid ? parsed : null
  } catch {
    return null
  }
}

/**
 * 기억을 지운다.
 *
 * 로그아웃에서는 **부르지 않는다.** 잠깐 나갔다 오는 사람에게도 다음에
 * 같은 계정을 권해야 하기 때문이다. 폰을 넘겨주는 자리처럼 정말 남남이
 * 될 때만 부른다.
 */
export function forgetAccount(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 지우지 못해도 할 수 있는 것이 없다
  }
}
