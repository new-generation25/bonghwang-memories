/**
 * 서버용 Firebase — BEP 시나리오 저장/내보내기 라우트만 쓴다.
 *
 * 이 앱에는 원래 서버가 없다. 집계도 정산도 클라이언트가 하고 권한은
 * firestore.rules가 막는다. 여기 Admin SDK를 들이는 이유는 하나다 —
 * `/api/bep/export`가 **로그인 세션 없이 토큰 하나로** 읽혀야 하기
 * 때문이다. 브라우저 밖(다른 작업 세션·분석 도구)에서 URL로 같은 값을
 * 보는 것이 시뮬레이터를 앱에 넣는 목적이었다.
 *
 * **자격증명이 없으면 null을 낸다.** 던지지 않는 것이 중요하다 — 키는
 * 저장소에 없고 외장하드를 따라다니므로, 키가 없는 자리에서 라우트 하나가
 * 앱 전체를 못 켜게 만들면 안 된다. 부르는 쪽이 503으로 답한다.
 *
 * 자격증명은 둘 중 하나로 준다.
 *  · `FIREBASE_SERVICE_ACCOUNT`      서비스 계정 JSON을 통째로 담은 문자열
 *  · `GOOGLE_APPLICATION_CREDENTIALS` 키 파일 경로 (gcloud 기본 방식)
 */

import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { isAdminEmail } from './adminEmails'

const APP_NAME = 'bonghwang-admin'

let cached: App | null | undefined

/** 초기화된 Admin 앱 — 자격증명이 없으면 null */
function adminApp(): App | null {
  if (cached !== undefined) return cached

  const existing = getApps().find((a) => a.name === APP_NAME)
  if (existing) return (cached = existing)

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  try {
    if (raw) {
      const sa = JSON.parse(raw)
      cached = initializeApp(
        {
          credential: cert({
            projectId: sa.project_id,
            clientEmail: sa.client_email,
            // .env 한 줄에 담으면 줄바꿈이 \n 두 글자로 들어온다
            privateKey: String(sa.private_key ?? '').replace(/\\n/g, '\n'),
          }),
        },
        APP_NAME
      )
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      cached = initializeApp({ credential: applicationDefault() }, APP_NAME)
    } else {
      cached = null
    }
  } catch (err) {
    // 키가 깨졌을 때 조용히 넘어가면 "왜 401이지"만 남는다
    console.error('[firebase-admin 초기화 실패]', (err as Error)?.message)
    cached = null
  }
  return cached
}

export function adminDb(): Firestore | null {
  const app = adminApp()
  return app ? getFirestore(app) : null
}

export function adminAuth(): Auth | null {
  const app = adminApp()
  return app ? getAuth(app) : null
}

/**
 * 요청 헤더의 ID 토큰을 검증하고 관리자면 uid를 낸다.
 *
 * 커스텀 클레임(`admin === true`)이 아니라 **토큰의 이메일**로 판정한다.
 * 이 프로젝트는 처음부터 그렇게 갈랐고 firestore.rules도 같은 식이다 —
 * 클레임을 쓰려면 누군가 한 번은 클레임을 심어야 하는데, 그 부트스트랩을
 * 두지 않으려고 이메일로 정한 것이다.
 */
export async function adminUidFromRequest(req: Request): Promise<string | null> {
  const auth = adminAuth()
  if (!auth) return null

  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  try {
    const decoded = await auth.verifyIdToken(token)
    return isAdminEmail(decoded.email) ? decoded.uid : null
  } catch {
    return null
  }
}

/** 자격증명 자체가 없는 상태인가 — 401(권한 없음)과 503(설비 없음)을 가른다 */
export function adminReady(): boolean {
  return adminApp() !== null
}
