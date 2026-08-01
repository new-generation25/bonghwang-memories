/**
 * 어디서 열렸는지 — 기기와 브라우저 갈래.
 *
 * QR을 카톡 대화에서 찍으면 카카오톡 안의 브라우저가 열린다. 그 안에서는
 * 홈 화면에 추가를 못 하고, 서비스워커가 붙지 않아 오프라인 재생이 안 되며,
 * 창을 닫으면 저장한 기록이 사라지는 기기가 있다. 골목 한복판에서 그러면
 * 걸어온 만큼이 통째로 없어진다.
 *
 * 그래서 어디서 열렸는지 먼저 알아야 한다. 여기서는 **판별만** 한다 —
 * 무엇을 보여줄지는 화면이 정한다.
 */

/** 문자열을 못 읽는 자리(서버 렌더)에서는 전부 false다 */
const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)

export type InApp = 'kakao' | 'naver' | 'line' | 'instagram' | 'facebook' | null

/**
 * 앱 안에 갇힌 브라우저인가.
 *
 * 카카오톡은 UA에 `KAKAOTALK`을 넣는다. 네이버 앱은 `NAVER(inapp;`,
 * 인스타그램은 `Instagram`, 페이스북은 `FBAN`/`FBAV`다.
 */
export function inAppBrowser(): InApp {
  const s = ua()
  if (/KAKAOTALK/i.test(s)) return 'kakao'
  if (/NAVER\(inapp/i.test(s)) return 'naver'
  if (/\bLine\//i.test(s)) return 'line'
  if (/Instagram/i.test(s)) return 'instagram'
  if (/FBAN|FBAV/i.test(s)) return 'facebook'
  return null
}

export const IN_APP_NAMES: Record<Exclude<InApp, null>, string> = {
  kakao: '카카오톡',
  naver: '네이버 앱',
  line: '라인',
  instagram: '인스타그램',
  facebook: '페이스북',
}

export const isIOS = () => /iPad|iPhone|iPod/.test(ua()) && !/Windows/.test(ua())
export const isAndroid = () => /Android/i.test(ua())

/** 홈 화면에서 띄운 판인가 — 이미 설치했으면 안내할 것이 없다 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS 사파리는 표준 대신 이 값을 쓴다
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * 안드로이드에서 기본 브라우저로 넘기는 주소.
 *
 * `intent://`는 안드로이드가 알아듣는 형식이라 크롬이 대신 연다.
 * 아이폰에는 같은 길이 없다 — 사파리로 넘기는 것을 애플이 막아두어서,
 * 그쪽은 사람이 직접 눌러야 하고 화면이 그 방법을 알려준다.
 */
export function androidIntentUrl(href: string): string {
  const bare = href.replace(/^https?:\/\//, '')
  return `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`
}
