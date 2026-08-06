/**
 * 관리자 이메일 — 클라이언트와 서버가 함께 보는 한 곳.
 *
 * `admin.ts`에 두면 서버 라우트가 못 쓴다. 그 파일은 `'use client'`이고
 * firebase 클라이언트 SDK를 끌고 오므로, 라우트 핸들러에서 import하면
 * 브라우저용 번들이 서버로 딸려 들어온다.
 *
 * ## 등급이 둘이다
 *
 * | | 여는 것 |
 * |---|---|
 * | 슈퍼관리자 | **참여자 데이터 전량** — 콘트롤 패널 · 라이브 · BEP 내보내기 · 대본 편집 |
 * | 일반관리자 | **진행 과정** — 순서·QR을 건너뛰며 전 구간을 직접 돌려본다 |
 *
 * 가른 이유는 두 일이 같은 사람의 것이 아니기 때문이다. 현장에서 앱을
 * 걸어보는 사람은 계속 늘어나는데, 목록이 하나였을 때는 시험 계정을 하나
 * 늘릴 때마다 참여자 전원의 진행 상황·결제 여부까지 함께 열렸다.
 *
 * 슈퍼관리자는 일반관리자가 여는 것을 모두 연다 — 위 등급이 아래를
 * 포함하지 않으면, 데이터를 보는 사람이 정작 앱을 못 걸어본다.
 *
 * **`firestore.rules`의 `isAdmin()`은 `SUPER_ADMIN_EMAILS`와 같은 값이어야
 * 한다.** 규칙이 여는 것은 데이터뿐이다. 일반관리자는 규칙 위에서 평범한
 * 참여자다 — 건너뛰기는 이 기기의 진행 상태를 바꾸는 일이라 서버 권한이
 * 필요 없다.
 */

/** 참여자 데이터를 보는 사람. 구글 로그인이라 진짜 이메일이다 */
export const SUPER_ADMIN_EMAILS = ['socialceos@gmail.com']

/**
 * 앱을 걸어보는 사람.
 *
 * 아이디로 로그인하는 계정이라 `{아이디}@bonghwang.local` 꼴이다 —
 * `auth.ts`가 아이디를 내부 이메일로 바꿔 저장하고, 여기서 보는 값은
 * 토큰에 실려 오는 그 이메일이다(`ID_DOMAIN`과 같아야 한다).
 */
export const GENERAL_ADMIN_EMAILS = [
  'test_01@bonghwang.local',
  'test_02@bonghwang.local',
]

/** 등급 불문 관리자 전부 — 시험 기록을 집계에서 뺄 때 이 기준으로 본다 */
export const ADMIN_EMAILS = [...SUPER_ADMIN_EMAILS, ...GENERAL_ADMIN_EMAILS]

const has = (list: string[], email: string | null | undefined): boolean =>
  Boolean(email && list.includes(email.toLowerCase()))

/** 관리자인가 — 등급을 가리지 않는다 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return has(ADMIN_EMAILS, email)
}

/** 데이터를 볼 수 있는가 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return has(SUPER_ADMIN_EMAILS, email)
}
