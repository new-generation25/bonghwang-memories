/**
 * 관리자 이메일 — 클라이언트와 서버가 함께 보는 한 곳.
 *
 * `admin.ts`에 두면 서버 라우트가 못 쓴다. 그 파일은 `'use client'`이고
 * firebase 클라이언트 SDK를 끌고 오므로, 라우트 핸들러에서 import하면
 * 브라우저용 번들이 서버로 딸려 들어온다.
 *
 * **`firestore.rules`의 `isAdmin()`과 같은 값이어야 한다.** 한쪽만 고치면
 * 화면은 열리는데 규칙이 막거나, 그 반대가 된다.
 */
export const ADMIN_EMAILS = ['socialceos@gmail.com']

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()))
}
