/**
 * BEP 시나리오 — 관리자 전용.
 *
 *   GET    /api/bep/scenarios       목록 (최근 수정순)
 *   POST   /api/bep/scenarios       저장 { id?, name, note?, params }
 *   DELETE /api/bep/scenarios?id=   삭제
 *
 * **kpi는 클라이언트가 보낸 값을 쓰지 않는다.** 서버가 `runModel`로 다시
 * 계산해 넣는다 — 화면과 모델이 어긋나면 저장된 숫자부터 틀리기 시작한다.
 *
 * 자격증명이 없는 자리(외장하드에 키를 안 챙겨온 경우)에서는 503을 낸다.
 * 401과 갈라 두는 이유는, 401만 보이면 로그인을 의심하느라 시간을 버리기
 * 때문이다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminStore } from '@/lib/bepStore'
import { adminDb, adminReady, adminUidFromRequest } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 셋 다 앞머리가 같다 — 준비됐나, 관리자인가 */
async function gate(req: NextRequest) {
  if (!adminReady()) {
    return {
      error: NextResponse.json(
        { error: 'admin credentials missing' },
        { status: 503 }
      ),
    }
  }
  const uid = await adminUidFromRequest(req)
  if (!uid) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { uid, store: createAdminStore(adminDb()!) }
}

export async function GET(req: NextRequest) {
  const g = await gate(req)
  if (g.error) return g.error
  return NextResponse.json(
    { scenarios: await g.store!.list() },
    { headers: { 'cache-control': 'no-store' } }
  )
}

export async function POST(req: NextRequest) {
  const g = await gate(req)
  if (g.error) return g.error

  const body = await req.json().catch(() => null)
  if (!body?.params) {
    return NextResponse.json({ error: 'params required' }, { status: 400 })
  }

  const id = await g.store!.save({
    id: body.id,
    name: body.name,
    note: body.note,
    params: body.params,
    uid: g.uid,
  })
  return NextResponse.json({ id, saved: await g.store!.get(id) })
}

export async function DELETE(req: NextRequest) {
  const g = await gate(req)
  if (g.error) return g.error

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await g.store!.remove(id)
  return NextResponse.json({ ok: true })
}
