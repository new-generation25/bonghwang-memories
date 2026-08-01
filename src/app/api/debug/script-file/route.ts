/**
 * 대본 파일 읽기·쓰기 — 개발용 전용 API.
 *
 * `docs/SCRIPT.md`가 대사의 원본인데, 고치려면 편집기를 열고 마크다운
 * 한가운데서 줄을 찾아야 했다. 큐가 스물여덟 개라 어느 줄이 어느 목소리인지
 * 세면서 내려가야 하고, 그러다 번호를 흘리면 되쓰기가 멈춘다.
 *
 * 이 API는 파일을 통째로 주고받기만 한다. 어떤 줄이 무슨 큐인지 가르는 일은
 * 화면(`/debug/script-edit`)이 한다 — 서버가 형식을 안다고 믿게 만들면
 * 대본 형식이 바뀔 때 두 곳을 고쳐야 한다.
 *
 * 프로덕션에서는 404. 인증이 없고 소스를 덮어쓰는 경로다.
 */

import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const IS_DEV = process.env.NODE_ENV !== 'production'

const DOCS = path.join(process.cwd(), 'docs')

/**
 * 열 수 있는 파일은 이 둘뿐이다.
 *
 * 이름을 받아 경로를 만들면 `../`로 저장소 밖까지 나간다. 목록으로 못 박는다.
 * `SCRIPT_READING.md`는 뽑아낸 것이라 여기서 고치면 다음 뽑기에 지워진다 —
 * 그래서 넣지 않는다.
 */
const ALLOWED = new Set(['SCRIPT.md', 'SCRIPT_v2.md'])

export async function GET(req: Request) {
  if (!IS_DEV) return new NextResponse('Not found', { status: 404 })

  const name = new URL(req.url).searchParams.get('file') ?? 'SCRIPT.md'
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ error: `열 수 없는 파일입니다: ${name}` }, { status: 400 })
  }

  try {
    const text = await fs.readFile(path.join(DOCS, name), 'utf8')
    return NextResponse.json({ file: name, text })
  } catch {
    return NextResponse.json({ error: `${name}을 찾지 못했습니다.` }, { status: 404 })
  }
}

export async function POST(req: Request) {
  if (!IS_DEV) return new NextResponse('Not found', { status: 404 })

  const body = (await req.json()) as { file?: string; text?: string }
  const name = body.file ?? ''
  const text = body.text ?? ''

  if (!ALLOWED.has(name)) {
    return NextResponse.json({ error: `쓸 수 없는 파일입니다: ${name}` }, { status: 400 })
  }
  /*
    빈 내용으로 덮어쓰는 것은 막는다. 화면에서 뭔가 잘못돼 빈 문자열이
    올라오면 원본이 통째로 날아간다 — 되돌릴 길이 git뿐이다.
  */
  if (text.trim().length < 200) {
    return NextResponse.json({ error: '내용이 너무 짧습니다. 저장하지 않았습니다.' }, { status: 400 })
  }

  const target = path.join(DOCS, name)

  /*
    덮어쓰기 전에 직전 판을 하나 남긴다. 굽기 전 단계라 git에 안 들어간
    상태로 여러 번 고치게 되는데, 잘못 저장하면 되돌릴 것이 없다.
    한 개만 둔다 — 쌓이면 어느 것이 직전인지 모른다.
  */
  try {
    const before = await fs.readFile(target, 'utf8')
    await fs.writeFile(`${target}.bak`, before, 'utf8')
  } catch {
    // 원본이 없으면 새로 만드는 것이니 백업할 것도 없다
  }

  await fs.writeFile(target, text, 'utf8')
  return NextResponse.json({ saved: name, bytes: Buffer.byteLength(text, 'utf8') })
}
