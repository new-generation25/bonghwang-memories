/**
 * 구운 음원을 개발 폴더에 바로 저장 — 개발용 전용 API.
 *
 * 브라우저 내려받기를 쓰면 저장 대화상자가 뜨고 사람이 눌러야 한다.
 * 한 줄 고칠 때마다 그러면 작업이 안 된다. 서버가 파일로 떨군다.
 *
 * 저장 위치는 public/audio/_raw/bake/ 로 고정한다 —
 * _raw는 gitignore 대상이라 작업물이 저장소에 섞이지 않는다.
 * 채택한 파일만 사람이 public/audio/로 옮긴다.
 *
 * 프로덕션에서는 404. 인증이 없고 디스크에 쓰는 경로다.
 */

import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const IS_DEV = process.env.NODE_ENV !== 'production'

/** 저장 뿌리 — 이 밖으로는 절대 못 쓴다 */
const ROOT = path.join(process.cwd(), 'public', 'audio', '_raw', 'bake')

/** 확장자별 허용 — 임의 파일을 심지 못하게 한다 */
const ALLOWED = new Set(['mp3', 'wav'])

export async function POST(req: Request) {
  if (!IS_DEV) return new NextResponse('Not found', { status: 404 })

  const url = new URL(req.url)
  const rawName = url.searchParams.get('name') ?? ''

  /*
    파일명 검사 — 경로 조각을 지운다.
    '../../../.env' 같은 이름이 오면 저장소 밖에 쓰게 된다. 개발용이라도
    브라우저가 보내는 값이므로 그대로 믿지 않는다.
  */
  const name = path.basename(rawName).replace(/[^\w.-]+/g, '_')
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (!name || !ALLOWED.has(ext)) {
    return NextResponse.json(
      { error: `파일명이 올바르지 않습니다 (mp3·wav만): ${rawName}` },
      { status: 400 }
    )
  }

  const dest = path.join(ROOT, name)
  // basename을 거쳤어도 한 번 더 확인한다 — 뿌리 밖이면 거부
  if (!dest.startsWith(ROOT)) {
    return NextResponse.json({ error: '경로가 올바르지 않습니다.' }, { status: 400 })
  }

  const body = Buffer.from(await req.arrayBuffer())
  if (!body.length) {
    return NextResponse.json({ error: '빈 파일입니다.' }, { status: 400 })
  }

  await fs.mkdir(ROOT, { recursive: true })
  await fs.writeFile(dest, body)

  return NextResponse.json({
    saved: path.relative(process.cwd(), dest).replace(/\\/g, '/'),
    kb: Math.round(body.length / 1024),
  })
}
