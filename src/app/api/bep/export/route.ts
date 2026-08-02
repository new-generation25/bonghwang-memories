/**
 * GET /api/bep/export?token=…
 *
 * 저장된 시나리오 전부를 JSON 한 덩어리로 낸다. 로그인 세션이 아니라
 * **공유 토큰**으로 막으므로 브라우저 밖에서 URL 하나로 읽힌다 — 다른 작업
 * 세션에서 지금 값을 그대로 보게 하는 것이 시뮬레이터를 앱에 넣은 이유다.
 *
 * `BEP_EXPORT_TOKEN`이 없으면 **항상 404**다. 기본값이 안전한 쪽이어야 한다 —
 * 환경변수를 빠뜨린 배포에서 이 주소가 열려 있으면 아무나 읽는다.
 * 없는 척하는 것은 일부러다. 401을 내면 "여기 뭔가 있다"를 알려주게 된다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminStore } from '@/lib/bepStore'
import { runModel, SCENARIO_VERSION } from '@/lib/bepModel'
import { adminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const notFound = () => NextResponse.json({ error: 'not found' }, { status: 404 })

/** 길이가 같을 때 앞글자부터 새어나가지 않도록 전 자리를 비교한다 */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function GET(req: NextRequest) {
  const expected = process.env.BEP_EXPORT_TOKEN
  if (!expected) return notFound()

  const got = req.nextUrl.searchParams.get('token')
  if (!got || !sameToken(got, expected)) return notFound()

  const db = adminDb()
  if (!db) {
    return NextResponse.json({ error: 'admin credentials missing' }, { status: 503 })
  }

  const list = await createAdminStore(db).list()

  /*
    kpi는 저장 시점 값이 아니라 **지금 모델로 다시 계산해** 내보낸다.
    모델을 고친 뒤 옛 kpi를 그대로 주면 읽는 쪽이 조용히 오해한다.
    저장 당시 값은 kpiAtSave로 함께 보내 둘이 다르면 눈에 띄게 한다.
  */
  const scenarios = list.map((s: Record<string, unknown>) => {
    const { kpi } = runModel((s.params as Record<string, number>) ?? {})
    const updatedAt = s.updatedAt as { toDate?: () => Date } | undefined
    return {
      id: s.id,
      name: s.name,
      note: s.note ?? '',
      params: s.params,
      kpi,
      kpiAtSave: s.kpi ?? null,
      updatedAt: updatedAt?.toDate?.()?.toISOString() ?? null,
    }
  })

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      version: SCENARIO_VERSION,
      count: scenarios.length,
      scenarios,
    },
    { headers: { 'cache-control': 'no-store' } }
  )
}
