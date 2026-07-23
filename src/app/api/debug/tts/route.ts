/**
 * 목소리 미세조정 합성 — 개발용 전용 API.
 *
 * /debug/voice 화면에서 감정·강도·속도·피치를 바꿔가며 바로 들어보기 위한
 * 통로다. 브라우저에서 Typecast를 직접 부를 수는 없다 — 그러려면 API 키를
 * 클라이언트 번들에 실어야 하고, 그 순간 키가 공개된다. 그래서 서버가
 * 대신 부르고 오디오만 돌려준다.
 *
 * 프로덕션 빌드에서는 404로 닫는다. 이 경로는 인증이 없고 호출마다
 * 과금되므로, 배포본에 살아 있으면 누구나 계정으로 음성을 뽑을 수 있다.
 */

import { NextResponse } from 'next/server'

const API_URL = 'https://api.typecast.ai/v1/text-to-speech'

/**
 * 모델은 보이스마다 다르다(/api/debug/voices가 알려준다).
 * 안 넘어오면 후보들이 쓰는 버전으로 떨어진다.
 */
const DEFAULT_MODEL = 'ssfm-v21'

/** 한 번에 굽는 글자 수 상한 — 실수로 긴 대본을 보내 과금이 튀는 것을 막는다 */
const MAX_CHARS = 600

const IS_DEV = process.env.NODE_ENV !== 'production'

interface Body {
  voiceId?: string
  text?: string
  model?: string
  emotion?: string
  intensity?: number
  tempo?: number
  pitch?: number
  /** 같은 값을 주면 같은 결과가 나온다 — 다시 굽기의 재현성 */
  seed?: number
  /** 앞뒤 문맥 — 줄을 따로 구워도 억양이 이어지게 한다 */
  previousText?: string
  nextText?: string
}

/** 괄호 안 연기 지시는 읽지 않는다 — 지문까지 낭독하면 못 쓴다 */
function stripDirections(text: string): string {
  return text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 값이 범위를 벗어나면 API가 400을 주므로 여기서 잘라둔다 */
function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function POST(req: Request) {
  if (!IS_DEV) {
    return new NextResponse('Not found', { status: 404 })
  }

  const apiKey = process.env.TYPECAST_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TYPECAST_API_KEY가 없습니다 — .env.local을 확인하세요.' },
      { status: 500 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  const voiceId = body.voiceId?.trim()
  const text = stripDirections(body.text ?? '')

  if (!voiceId || !text) {
    return NextResponse.json(
      { error: 'voiceId와 text가 필요합니다.' },
      { status: 400 }
    )
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `문장이 너무 깁니다 (${text.length}자 / 최대 ${MAX_CHARS}자).` },
      { status: 400 }
    )
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice_id: voiceId,
      text,
      model: body.model || DEFAULT_MODEL,
      language: 'kor',
      /*
        emotion_type이 받는 값은 preset · smart · embedding 뿐이다.
        자유 텍스트 연기 지시는 422로 거절한다 — 확인해 봤다.
        smart는 글의 내용에서 감정을 스스로 잡는 방식이라 프리셋·강도를
        함께 보내면 'Extra inputs are not permitted'로 막힌다.
        embedding은 1024차원 벡터를 요구해 손으로 쓸 수 있는 값이 아니다.
      */
      prompt:
        body.emotion === 'smart'
          ? { emotion_type: 'smart' }
          : {
              emotion_type: 'preset',
              emotion_preset: body.emotion || 'normal',
              emotion_intensity: clamp(Number(body.intensity), 0, 2, 1),
            },
      /*
        앞뒤 문맥 — 본문 최상위 필드다. prompt 안에 넣으면
        'body.prompt.preset.previous_text: Extra inputs are not permitted'로 막힌다.
        줄을 따로 구우면 각 줄이 '처음이자 끝'인 것처럼 읽혀 억양이 뚝뚝
        끊기는데, 앞뒤 문장을 알려주면 그 흐름에 맞춰 읽는다(읽지는 않는다).
      */
      ...(body.previousText ? { previous_text: body.previousText } : {}),
      ...(body.nextText ? { next_text: body.nextText } : {}),
      /*
        seed — 같은 값이면 같은 결과가 나온다.
        이게 없으면 같은 설정으로 구워도 길이가 매번 달라(실측 4.375 /
        4.432 / 4.830초) 자막 타임라인을 신뢰할 수 없다.
      */
      ...(Number.isFinite(Number(body.seed))
        ? { seed: Math.floor(Number(body.seed)) }
        : {}),
      output: {
        audio_format: 'mp3',
        target_lufs: -16,
        audio_tempo: clamp(Number(body.tempo), 0.5, 2, 1),
        audio_pitch: clamp(Number(body.pitch), -12, 12, 0),
      },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `Typecast ${res.status} — ${detail.slice(0, 300)}` },
      { status: 502 }
    )
  }

  const audio = await res.arrayBuffer()
  return new NextResponse(audio, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}
