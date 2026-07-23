/**
 * 보이스 메타 조회 — 개발용 전용 API.
 *
 * 감정 프리셋은 보이스마다 다르다. 지원하지 않는 값을 보내면 Typecast가
 * 422(EMOTION_NOT_SUPPORTED)를 준다. 그래서 조정판에는 그 보이스가 실제로
 * 지원하는 감정만 띄워야 한다 — 목록을 하드코딩하면 다른 보이스를 넣는
 * 순간 또 틀린다.
 *
 * 모델 버전도 여기서 받아 그대로 합성에 쓴다. 후보들은 ssfm-v21이다.
 *
 * 프로덕션에서는 404 — 인증이 없는 경로다.
 */

import { NextResponse } from 'next/server'

const VOICES_URL = 'https://api.typecast.ai/v1/voices'

const IS_DEV = process.env.NODE_ENV !== 'production'

interface TypecastVoice {
  voice_id: string
  voice_name?: string
  model?: string
  emotions?: string[]
}

export async function GET(req: Request) {
  if (!IS_DEV) return new NextResponse('Not found', { status: 404 })

  const apiKey = process.env.TYPECAST_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TYPECAST_API_KEY가 없습니다 — .env.local을 확인하세요.' },
      { status: 500 }
    )
  }

  // ?ids=tc_a,tc_b — 목록이 1000개가 넘어 필요한 것만 골라 돌려준다
  const wanted = new URL(req.url).searchParams.get('ids')?.split(',').filter(Boolean)

  const res = await fetch(VOICES_URL, { headers: { 'X-API-KEY': apiKey } })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `Typecast ${res.status} — ${detail.slice(0, 300)}` },
      { status: 502 }
    )
  }

  const raw = (await res.json()) as TypecastVoice[] | { voices?: TypecastVoice[] }
  const all: TypecastVoice[] = Array.isArray(raw) ? raw : (raw.voices ?? [])

  const picked = wanted
    ? wanted
        .map((id) => all.find((v) => v.voice_id === id))
        .filter((v): v is TypecastVoice => Boolean(v))
    : all

  return NextResponse.json(
    {
      voices: picked.map((v) => ({
        voiceId: v.voice_id,
        name: v.voice_name ?? v.voice_id,
        model: v.model ?? 'ssfm-v21',
        emotions: v.emotions ?? ['normal'],
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
