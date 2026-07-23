/**
 * 구운 음성을 앱에 반영 — 개발용 전용 API.
 *
 * 더빙을 바꿔 넣을 때마다 손이 가던 일을 한 번에 한다:
 *   1. WAV → MP3 인코딩 후 public/audio/{audioFile}.mp3 로 저장
 *   2. src/lib/audioTimings.ts 의 줄별 시작 시각 갱신
 *   3. src/lib/cues.ts 의 durationSec 갱신
 *   4. 대사가 고쳐졌으면 subtitleLines 텍스트도 갱신
 *
 * 2~4를 빼먹으면 자막이 통째로 어긋난다. 음성만 바꾸고 시각을 그대로 두면
 * 새 음원의 줄 길이와 옛 시각이 섞여 자막이 엉뚱한 데서 넘어간다.
 * 실제로 그런 일이 있었기 때문에 사람 손을 거치지 않게 묶었다.
 *
 * 프로덕션에서는 404. 인증이 없고 소스와 에셋을 덮어쓰는 경로다.
 */

import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import lame from '@breezystack/lamejs'

const IS_DEV = process.env.NODE_ENV !== 'production'
const ROOT = process.cwd()

/** 96kbps 모노 — 나레이션에 충분하고 46초에 540KB다 */
const KBPS = 96

interface Line {
  text: string
  /** 이 줄이 시작하는 초 */
  start: number
}

interface Body {
  cueId: string
  audioFile: string
  durationSec: number
  lines: Line[]
  /** 이어붙인 WAV(16bit) — base64 */
  wavBase64: string
}

/** 이름에 쓸 수 없는 문자를 막는다 — 소스 경로를 다루므로 엄격하게 */
const SAFE_ID = /^[A-Z0-9_]+$/
const SAFE_FILE = /^[a-z0-9_]+$/

/** WAV(16bit) → MP3. ffmpeg이 없어 순수 JS 인코더를 쓴다 */
function wavToMp3(wav: Buffer): Buffer {
  if (wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('WAV이 아닙니다')

  let pos = 12
  let fmt = -1
  let data: { pos: number; size: number } | null = null
  while (pos + 8 <= wav.length) {
    const id = wav.toString('ascii', pos, pos + 4)
    const size = wav.readUInt32LE(pos + 4)
    if (id === 'fmt ') fmt = pos + 8
    if (id === 'data') data = { pos: pos + 8, size }
    pos += 8 + size + (size % 2)
  }
  if (fmt < 0 || !data) throw new Error('fmt/data 청크가 없습니다')

  const channels = wav.readUInt16LE(fmt + 2)
  const rate = wav.readUInt32LE(fmt + 4)
  const bits = wav.readUInt16LE(fmt + 14)
  if (bits !== 16) throw new Error(`16bit만 지원합니다 (현재 ${bits})`)

  const frames = data.size / (channels * 2)
  const samples = new Int16Array(frames)
  for (let i = 0; i < frames; i++) {
    // 스테레오면 왼쪽만 — 나레이션은 모노로 충분하고 용량이 절반이다
    samples[i] = wav.readInt16LE(data.pos + i * channels * 2)
  }

  const enc = new lame.Mp3Encoder(1, rate, KBPS)
  const out: Buffer[] = []
  for (let i = 0; i < samples.length; i += 1152) {
    const chunk = enc.encodeBuffer(samples.subarray(i, Math.min(i + 1152, samples.length)))
    if (chunk.length) out.push(Buffer.from(chunk))
  }
  const tail = enc.flush()
  if (tail.length) out.push(Buffer.from(tail))
  return Buffer.concat(out)
}

/** audioTimings.ts 의 한 줄을 갈아끼운다 */
function replaceTimings(src: string, audioFile: string, starts: number[]): string {
  const row = `  ${audioFile}: [${starts.map((s) => Number(s.toFixed(2))).join(', ')}],`
  const re = new RegExp(`^ {2}${audioFile}: \\[[^\\]]*\\],$`, 'm')
  if (re.test(src)) return src.replace(re, row)
  // 없던 키면 표 끝에 넣는다
  return src.replace(/(\n)(\}\n\n\/\*\*\n \* 이 큐에 쓸 수)/, `\n${row}\n$2`)
}

/** cues.ts 에서 한 큐의 블록 범위를 찾는다 */
function cueBlock(src: string, cueId: string): { start: number; end: number } {
  const head = src.indexOf(`\n  ${cueId}: {\n`)
  if (head < 0) throw new Error(`cues.ts에서 ${cueId}를 찾지 못했습니다.`)
  // 같은 들여쓰기의 닫는 괄호까지가 그 큐다
  const end = src.indexOf('\n  },\n', head)
  if (end < 0) throw new Error(`${cueId} 블록의 끝을 찾지 못했습니다.`)
  return { start: head, end: end + 6 }
}

/** 큐 블록 안의 durationSec 과 subtitleLines 를 갈아끼운다 */
function replaceCue(
  src: string,
  cueId: string,
  durationSec: number,
  texts: string[]
): { out: string; textChanged: boolean } {
  const { start, end } = cueBlock(src, cueId)
  let block = src.slice(start, end)

  block = block.replace(/^(\s*)durationSec: [\d.]+,$/m, `$1durationSec: ${durationSec},`)

  const linesRe = /^(\s*)subtitleLines: \[\n([\s\S]*?)^\1\],$/m
  const m = block.match(linesRe)
  if (!m) throw new Error(`${cueId}의 subtitleLines를 찾지 못했습니다.`)

  const indent = m[1]
  const old = m[2]
  const oldEntries = old.split('\n').filter((l) => l.trim().startsWith('{'))
  if (oldEntries.length !== texts.length) {
    throw new Error(
      `줄 수가 다릅니다 — cues.ts ${oldEntries.length}줄, 보내신 것 ${texts.length}줄. ` +
        `줄을 더하거나 뺐다면 cues.ts를 먼저 손봐야 합니다.`
    )
  }

  let textChanged = false
  const rebuilt = oldEntries
    .map((line, i) => {
      // speaker가 붙은 줄은 그 표기를 지킨다
      const sp = line.match(/speaker: '([^']*)'/)
      const before = line.match(/text: '((?:[^'\\]|\\.)*)'/)?.[1]
      const next = texts[i].replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      if (before !== next) textChanged = true
      return sp
        ? `${indent}  { speaker: '${sp[1]}', text: '${next}' },`
        : `${indent}  { text: '${next}' },`
    })
    .join('\n')

  block = block.replace(linesRe, `${indent}subtitleLines: [\n${rebuilt}\n${indent}],`)
  return { out: src.slice(0, start) + block + src.slice(end), textChanged }
}

export async function POST(req: Request) {
  if (!IS_DEV) return new NextResponse('Not found', { status: 404 })

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  const { cueId, audioFile, durationSec, lines, wavBase64 } = body
  if (!SAFE_ID.test(cueId ?? '')) {
    return NextResponse.json({ error: `큐 이름이 올바르지 않습니다: ${cueId}` }, { status: 400 })
  }
  if (!SAFE_FILE.test(audioFile ?? '')) {
    return NextResponse.json(
      { error: `파일 이름이 올바르지 않습니다: ${audioFile}` },
      { status: 400 }
    )
  }
  if (!lines?.length || !wavBase64) {
    return NextResponse.json({ error: '줄과 음원이 필요합니다.' }, { status: 400 })
  }

  const changed: string[] = []
  try {
    // 1) 음원
    const mp3 = wavToMp3(Buffer.from(wavBase64, 'base64'))
    const audioPath = path.join(ROOT, 'public', 'audio', `${audioFile}.mp3`)
    await fs.writeFile(audioPath, mp3)
    changed.push(`public/audio/${audioFile}.mp3 (${Math.round(mp3.length / 1024)}KB)`)

    // 2) 자막 시각
    const timingsPath = path.join(ROOT, 'src', 'lib', 'audioTimings.ts')
    const timingsSrc = await fs.readFile(timingsPath, 'utf8')
    const starts = lines.map((l) => l.start)
    await fs.writeFile(timingsPath, replaceTimings(timingsSrc, audioFile, starts))
    changed.push(`audioTimings.ts — ${audioFile} ${starts.length}줄`)

    // 3~4) 길이 · 대사
    const cuesPath = path.join(ROOT, 'src', 'lib', 'cues.ts')
    const cuesSrc = await fs.readFile(cuesPath, 'utf8')
    const { out, textChanged } = replaceCue(
      cuesSrc,
      cueId,
      Math.ceil(durationSec),
      lines.map((l) => l.text)
    )
    await fs.writeFile(cuesPath, out)
    changed.push(`cues.ts — durationSec ${Math.ceil(durationSec)}`)
    if (textChanged) changed.push('cues.ts — 대사 수정분 반영')

    return NextResponse.json({ changed, textChanged })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '반영 실패', changed },
      { status: 500 }
    )
  }
}
