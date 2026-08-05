/**
 * GET /api/bep/diag — 운영에서 왜 죽는지 재는 임시 자.
 *
 * `/api/bep/*` 넷이 전부 500인데, 그 라우트들은 오류를 삼키도록 짜여 있어
 * 무엇이 터졌는지 몸통이 안 나온다. 추측을 두 번 했고 두 번 다 틀렸다 —
 * 이번에는 잰다.
 *
 * **값은 내보내지 않는다.** 있다/없다와 오류 문구만 낸다. 서비스 계정 키나
 * 토큰이 응답에 섞이면 그 자체가 사고다.
 *
 * `firebase-admin`을 **동적으로** 불러오는 것이 핵심이다. 다른 라우트는
 * 파일 맨 위에서 정적으로 불러오므로, 그 모듈이 터지면 라우트 코드가 한 줄도
 * 안 돌고 500이 된다. 여기서는 try 안에서 부르므로 터진 이유를 잡아낼 수 있다.
 *
 * **확인이 끝나면 지운다.** 진단용이지 기능이 아니다.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const out: Record<string, unknown> = {
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    hasExportToken: Boolean(process.env.BEP_EXPORT_TOKEN),
  }

  // 서비스 계정이 JSON으로 읽히는가 — 값은 안 보고 모양만 본다
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (raw) {
      const sa = JSON.parse(raw)
      out.serviceAccountParses = true
      out.serviceAccountKeys = Object.keys(sa).length
      out.hasProjectId = Boolean(sa.project_id)
      out.hasClientEmail = Boolean(sa.client_email)
      out.privateKeyLooksRight = String(sa.private_key ?? '').includes('BEGIN PRIVATE KEY')
    }
  } catch (e) {
    out.serviceAccountParses = false
    out.serviceAccountError = (e as Error)?.message ?? 'unknown'
  }

  // firebase-admin이 불러지는가 — 다른 라우트가 죽는 자리로 의심되는 곳
  try {
    const mod = await import('firebase-admin/app')
    out.firebaseAdminImport = 'ok'
    out.firebaseAdminExports = Object.keys(mod).length
  } catch (e) {
    out.firebaseAdminImport = 'failed'
    out.firebaseAdminError = (e as Error)?.message ?? 'unknown'
    out.firebaseAdminStack = String((e as Error)?.stack ?? '').split('\n').slice(0, 4)
  }

  // 모델도 함께 본다 — .js를 ESM으로 읽는 자리라 여기서 걸릴 수도 있다
  try {
    const m = await import('@/lib/bepModel')
    out.bepModelImport = typeof m.runModel === 'function' ? 'ok' : 'no runModel'
  } catch (e) {
    out.bepModelImport = 'failed'
    out.bepModelError = (e as Error)?.message ?? 'unknown'
  }

  return NextResponse.json(out, { headers: { 'cache-control': 'no-store' } })
}
