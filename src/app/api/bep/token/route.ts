/**
 * GET /api/bep/token — 시뮬레이터가 쓸 반영 열쇠를 관리자에게만 건넨다.
 *
 * 시뮬레이터(`/bep/index.html`)는 로그인이 없는 정적 파일이라 공유 토큰으로
 * 인증한다. 그런데 그 열쇠를 사람에게 손으로 넣게 하면, 관리자 화면에서
 * 이미 구글 로그인을 마친 사람에게 **한 번 더 신분을 대라고 묻는 꼴**이다.
 *
 * 그래서 관리자 화면이 대신 받아 링크에 실어 준다. 여기 문지기는 진짜
 * 로그인이다 — `adminUidFromRequest()`가 Firebase ID 토큰을 검증하고
 * 이메일이 관리자 목록에 있는지 본다(`firestore.rules`의 `isAdmin()`과 같은 값).
 *
 * **새 노출이 아니다.** 열쇠는 어차피 그 브라우저에 남는다 — 사람이 타이핑
 * 하느냐, 이미 인증된 자리에서 받아 오느냐의 차이다. 손으로 나르는 쪽이
 * 오히려 위험하다. 쪽지에 적히고 대화창에 붙는다.
 *
 * `BEP_EXPORT_TOKEN`이 없으면 404다 — 다른 BEP 라우트와 같은 규칙이다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminReady, adminUidFromRequest } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = process.env.BEP_EXPORT_TOKEN
  if (!token) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (!adminReady()) {
    // 401과 갈라 둔다 — 401만 보이면 로그인을 의심하느라 시간을 버린다
    return NextResponse.json({ error: 'admin credentials missing' }, { status: 503 })
  }
  if (!(await adminUidFromRequest(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ token }, { headers: { 'cache-control': 'no-store' } })
}
