/**
 * POST /api/bep/settings — BEP 시뮬레이터의 값을 앱 설정으로 반영한다.
 *
 * 시뮬레이터(`/bep/index.html`)는 로그인이 없는 정적 파일이다. 그래서
 * 로그인 세션이 아니라 **공유 토큰**으로 막는다 — `/api/bep/export`와 같은
 * 방식이다. 창을 새로 열어 앱에 로그인시키는 길도 있었지만, 값을 고치던
 * 화면에서 손이 떠나면 그게 곧 안 쓰는 기능이 된다.
 *
 * `BEP_EXPORT_TOKEN`이 없으면 **항상 404**다. 없는 척하는 것은 일부러다 —
 * 401을 내면 "여기 뭔가 있다"를 알려주게 된다.
 *
 * `dryRun`이 참이면 **아무것도 쓰지 않고** 무엇이 바뀌는지만 돌려준다.
 * 확인 창이 보여주는 목록과 실제로 쓰이는 값이 어긋나면 안 되므로,
 * 미리보기와 반영이 같은 계산을 지나가게 했다.
 *
 * **충당률은 받지 않는다.** `applyBepPatch()`가 버린다 — BEP는 연차별로
 * 잡고 앱은 등급별로 잡아 옮길 대응이 없고, 시범운영 중인 지금 잘못
 * 넘어가면 가게에 할인액 전액이 청구된다.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  applyBepPatch,
  mergeSettlementConfig,
  splitSettlementConfig,
} from '@/lib/coverage'
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

/** 헤더와 쿼리 둘 다 받는다 — 브라우저는 헤더, 손으로 부를 때는 주소 */
function tokenOf(req: NextRequest): string {
  const header = req.headers.get('authorization') ?? ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return req.nextUrl.searchParams.get('token') ?? ''
}

export async function POST(req: NextRequest) {
  const expected = process.env.BEP_EXPORT_TOKEN
  if (!expected) return notFound()
  if (!sameToken(tokenOf(req), expected)) return notFound()

  const db = adminDb()
  if (!db) {
    // 401과 갈라 둔다 — 401만 보이면 토큰을 의심하느라 시간을 버린다
    return NextResponse.json({ error: 'admin credentials missing' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || !body.patch) {
    return NextResponse.json({ error: 'patch required' }, { status: 400 })
  }

  /*
    지금 값을 두 문서에서 읽어 합친다. 없는 칸은 mergeSettlementConfig가
    기본값으로 메우므로, 문서가 비어 있는 첫 배포에서도 무엇이 바뀌는지
    말할 수 있다.
  */
  const [pts, stl] = await Promise.all([
    db.doc('config/points').get(),
    db.doc('config/settlement').get(),
  ])
  const current = mergeSettlementConfig({
    ...(stl.exists ? stl.data() : {}),
    ...(pts.exists ? pts.data() : {}),
  })

  const { next, changes, ignored } = applyBepPatch(current, body.patch)

  if (body.dryRun) {
    return NextResponse.json(
      { dryRun: true, changes, ignored },
      { headers: { 'cache-control': 'no-store' } }
    )
  }

  const { publicPart, privatePart } = splitSettlementConfig(next)
  await Promise.all([
    db.doc('config/points').set(publicPart, { merge: true }),
    db.doc('config/settlement').set(privatePart, { merge: true }),
  ])

  return NextResponse.json(
    { applied: true, changes, ignored },
    { headers: { 'cache-control': 'no-store' } }
  )
}
