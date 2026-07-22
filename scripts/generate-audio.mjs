#!/usr/bin/env node
/**
 * 대사 음성 자동 생성 — Typecast SSFM.
 *
 * src/lib/cues.ts의 대사 원문을 읽어 줄 단위로 합성하고, 명세 §5·§6의
 * 사이(pause)·채널 후처리까지 적용해 public/audio/*.mp3로 떨어뜨린다.
 * 앱은 지금처럼 정적 파일만 재생한다 — 실시간 호출이 아니다.
 * (D8: 전 큐 선다운로드가 전제라 재생 시점에 네트워크를 타면 안 된다.)
 *
 *   node scripts/generate-audio.mjs --dry-run      비용만 계산 (API 호출 없음)
 *   node scripts/generate-audio.mjs                바뀐 줄만 생성
 *   node scripts/generate-audio.mjs --only b0_tape 특정 번들만
 *   node scripts/generate-audio.mjs --force        캐시 무시하고 전부 다시
 *   node scripts/generate-audio.mjs --skip b0_tape 특정 번들 제외(성우 녹음 보호)
 *
 * 준비물
 *   · TYPECAST_API_KEY 환경변수 (.env.local)
 *   · scripts/voices.json  (voices.example.json 복사 후 voice_id 채우기)
 *   · ffmpeg  (조립·후처리용. winget install Gyan.FFmpeg)
 *
 * 줄 단위 원본은 .audio-cache/에 해시로 남는다 — 대사가 바뀐 줄만 다시 만들어
 * 크레딧을 아낀다. 캐시는 커밋하지 않는다.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { pathToFileURL } from 'url'

const run = promisify(execFile)

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'public', 'audio')
const CACHE_DIR = path.join(ROOT, '.audio-cache')
const API_URL = 'https://api.typecast.ai/v1/text-to-speech'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f) => {
  const i = argv.indexOf(f)
  return i >= 0 ? argv[i + 1] : null
}
const DRY = has('--dry-run')
const FORCE = has('--force')
const ONLY = val('--only')
/**
 * 생성에서 제외할 번들 (쉼표 구분).
 * 성우 녹음이 이미 들어온 파일을 TTS로 덮어쓰지 않기 위한 안전장치다.
 */
const SKIP = (val('--skip') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

// ---------------------------------------------------------------------------
// 1. 대사 추출 — cues.ts가 원본이다 (손으로 옮기지 않는다)
// ---------------------------------------------------------------------------

function extractBundles() {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/cues.ts'), 'utf8')
  const body = src.slice(src.indexOf('export const CUES'))

  const marks = []
  const re = /^ {2}([A-Z][A-Z0-9_]*): \{$/gm
  let m
  while ((m = re.exec(body)) !== null) marks.push({ id: m[1], start: m.index })

  const field = (chunk, name) => {
    const hit = new RegExp(`^\\s{4}${name}: (.+?),?$`, 'm').exec(chunk)
    return hit ? hit[1].replace(/,$/, '').replace(/^'|'$/g, '') : null
  }

  const parseLines = (chunk) => {
    const at = chunk.indexOf('subtitleLines: [')
    if (at < 0) return []
    let i = chunk.indexOf('[', at)
    let depth = 0
    let end = i
    for (; i < chunk.length; i++) {
      if (chunk[i] === '[') depth++
      else if (chunk[i] === ']' && --depth === 0) { end = i; break }
    }
    const arr = chunk.slice(at, end)
    const out = []
    const itemRe =
      /\{\s*(?:speaker:\s*(['"])(.*?)\1,\s*)?text:\s*(['"])([\s\S]*?)\3\s*\}/g
    let it
    while ((it = itemRe.exec(arr)) !== null) {
      out.push({ speaker: it[2] || null, text: it[4] })
    }
    return out
  }

  return marks.map((mk, i) => {
    const chunk = body.slice(mk.start, marks[i + 1]?.start ?? body.length)
    return {
      id: mk.id,
      track: Number(field(chunk, 'track')),
      channel: field(chunk, 'channel'),
      speaker: field(chunk, 'speaker'),
      voiceAge: field(chunk, 'voiceAge'),
      audioFile: field(chunk, 'audioFile'),
      durationSec: Number(field(chunk, 'durationSec')),
      lines: parseLines(chunk),
    }
  })
}

// ---------------------------------------------------------------------------
// 2. 배역·감정 매핑
// ---------------------------------------------------------------------------

/** 줄 하나가 어느 배역의 것인지 — 합본 파일은 줄의 speaker 라벨이 우선한다 */
function roleOf(bundle, line) {
  const label = line.speaker
  if (label) {
    if (label.startsWith('아버지')) return bundle.voiceAge === 'young' ? 'father_young' : 'father_old'
    if (label.startsWith('소영')) return 'soyoung'
    if (label.includes('DJ')) return 'dj'
  }
  switch (bundle.speaker) {
    case 'father':
    case 'father_soyoung':
      return bundle.voiceAge === 'young' ? 'father_young' : 'father_old'
    case 'dj_father':
      return 'dj'
    case 'shopkeeper1':
      return 'shopkeeper1'
    case 'shopkeeper2':
      return 'shopkeeper2'
    default:
      return 'soyoung'
  }
}

/**
 * 번들별 감정 프리셋 — §12 톤 지시를 SSFM 프리셋으로 옮긴 것.
 * 지정하지 않으면 smart(문맥 자동 판별)를 쓴다.
 */
const EMOTION = {
  b0_tape: { emotion_type: 'preset', emotion_preset: 'normal', emotion_intensity: 0.8 },
  b2_b: { emotion_type: 'preset', emotion_preset: 'sad', emotion_intensity: 1.1 },
  b4_b: { emotion_type: 'preset', emotion_preset: 'sad', emotion_intensity: 1.4 },
  b5_t3: { emotion_type: 'preset', emotion_preset: 'sad', emotion_intensity: 1.0 },
  b5_letter: { emotion_type: 'preset', emotion_preset: 'sad', emotion_intensity: 1.2 },
  b5_f: { emotion_type: 'preset', emotion_preset: 'sad', emotion_intensity: 1.3 },
  b6_0: { emotion_type: 'preset', emotion_preset: 'happy', emotion_intensity: 1.0 },
  b7_0: { emotion_type: 'preset', emotion_preset: 'normal', emotion_intensity: 0.9 },
  b7_1: { emotion_type: 'preset', emotion_preset: 'whisper', emotion_intensity: 1.0 },
}

/** 줄 사이 기본 호흡(초). 번들 성격에 따라 다르게 준다 (D13) */
const GAP = { tape: 0.9, call: 0.55, shop: 0.6 }

/**
 * 특수 연출 — 명세에 못박힌 것들.
 * lead: 첫 줄 앞 무음(초) / gapsAfter: N번째 줄 뒤에 추가로 넣을 무음(초)
 */
const SPECIAL = {
  // 라디오: 도입 잡음만 10초 (여기서는 무음으로 두고 후처리에서 잡음을 얹는다)
  b4_radio: { lead: 10 },
  // B면 편지: 릴 감기 15초 → 소영 1줄 → 잡음 5초 → 편지 (총 공백 20초)
  b5_letter: { lead: 15, gapsAfter: { 0: 5 } },
  // 메모 직전 — 한동안 말 없이 숨소리만
  b4_b: { lead: 4 },
  // 울음 5초
  b5_f: { lead: 5 },
}

// ---------------------------------------------------------------------------
// 3. Typecast 호출
// ---------------------------------------------------------------------------

function lineHash(role, cfg, text, prompt) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ role, voice: cfg.voice_id, out: cfg.output, text, prompt }))
    .digest('hex')
    .slice(0, 16)
}

async function synthLine({ apiKey, model, role, cfg, text, prompt }) {
  const hash = lineHash(role, cfg, text, prompt)
  const cached = path.join(CACHE_DIR, `${hash}.wav`)
  if (!FORCE && fs.existsSync(cached)) return { file: cached, cached: true, chars: 0 }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice_id: cfg.voice_id,
      text,
      model,
      language: 'kor',
      prompt,
      output: { audio_format: 'wav', target_lufs: -16, ...(cfg.output ?? {}) },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Typecast ${res.status} — ${detail.slice(0, 300)}`)
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(cached, Buffer.from(await res.arrayBuffer()))
  return { file: cached, cached: false, chars: text.length }
}

// ---------------------------------------------------------------------------
// 4. 조립 — 무음 삽입 + 채널 후처리 + mp3 인코딩 (ffmpeg)
// ---------------------------------------------------------------------------

/**
 * 채널별 후처리 (§5).
 *
 * 마지막에 loudnorm으로 -16 LUFS에 맞춘다. 이게 없으면 채널마다 음량이
 * 제각각이 된다 — 테이프 필터(대역 제한 + 압축)는 신호를 11dB나 깎아서,
 * 통화 구간을 듣다가 아버지 테이프로 넘어가면 소리가 뚝 작아진다.
 * 야외에서 이어폰으로 듣는 투어라 구간별 음량 차이는 치명적이다.
 */
function channelFilter(channel) {
  const norm = 'loudnorm=I=-16:TP=-1.5:LRA=11'
  switch (channel) {
    case 'tape':
      // 로파이: 대역 제한 + 살짝 뭉갠 다이내믹
      return `highpass=f=280,lowpass=f=5200,acompressor=ratio=3:threshold=-18dB,aecho=0.8:0.7:12:0.08,${norm}`
    case 'shop':
      // 약한 룸톤
      return `aecho=0.85:0.6:22:0.12,highpass=f=140,${norm}`
    default:
      // call — 클린 (전화 대역만 살짝)
      return `highpass=f=110,lowpass=f=9000,${norm}`
  }
}

/**
 * ffmpeg / ffprobe 실행 경로.
 *
 * winget으로 갓 설치하면 이미 떠 있던 터미널은 PATH 갱신을 못 봐서
 * 'ffmpeg'을 못 찾는다. PATH를 먼저 보고, 없으면 winget이 만드는
 * 표준 위치를 뒤진다. 그래도 없으면 null.
 */
let FF = null

function wingetCandidates(name) {
  const local = process.env.LOCALAPPDATA
  if (!local) return []
  const out = [path.join(local, 'Microsoft', 'WinGet', 'Links', `${name}.exe`)]
  const pkgRoot = path.join(local, 'Microsoft', 'WinGet', 'Packages')
  try {
    for (const dir of fs.readdirSync(pkgRoot)) {
      if (!dir.toLowerCase().includes('ffmpeg')) continue
      const inner = path.join(pkgRoot, dir)
      for (const build of fs.readdirSync(inner)) {
        out.push(path.join(inner, build, 'bin', `${name}.exe`))
      }
    }
  } catch {
    /* 폴더가 없으면 후보도 없다 */
  }
  return out
}

async function resolveFfmpeg() {
  const probe = async (bin) => {
    try {
      await run(bin, ['-version'])
      return true
    } catch {
      return false
    }
  }

  if (await probe('ffmpeg')) {
    FF = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' }
    return true
  }
  for (const c of wingetCandidates('ffmpeg')) {
    if (fs.existsSync(c) && (await probe(c))) {
      FF = { ffmpeg: c, ffprobe: c.replace(/ffmpeg\.exe$/i, 'ffprobe.exe') }
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 4-b. ffmpeg 없이 조립 (톤 확인용 임시 경로)
// ---------------------------------------------------------------------------

/**
 * WAV 청크를 훑어 포맷과 PCM 데이터 위치를 찾는다.
 * Typecast는 44.1kHz 16bit PCM을 주지만 LIST 같은 부가 청크가 낄 수 있어
 * 고정 오프셋(44)을 가정하지 않는다.
 */
function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('WAV 형식이 아닙니다')
  }
  let pos = 12
  let fmt = null
  let data = null
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    const body = pos + 8
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length))
    }
    pos = body + size + (size % 2) // 청크는 짝수 정렬
  }
  if (!fmt || !data) throw new Error('WAV 청크를 찾지 못했습니다')
  return { ...fmt, data }
}

function wavHeader({ channels, sampleRate, bits, dataLength }) {
  const h = Buffer.alloc(44)
  const byteRate = sampleRate * channels * (bits / 8)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + dataLength, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20) // PCM
  h.writeUInt16LE(channels, 22)
  h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(byteRate, 28)
  h.writeUInt16LE(channels * (bits / 8), 32)
  h.writeUInt16LE(bits, 34)
  h.write('data', 36)
  h.writeUInt32LE(dataLength, 40)
  return h
}

/**
 * ffmpeg 없이 WAV들을 무음과 함께 이어 붙인다.
 * 채널 후처리(로파이·룸톤)와 mp3 인코딩은 못 한다 — 톤 확인용이다.
 */
function assemblePureWav({ bundle, parts, outFile }) {
  const special = SPECIAL[bundle.audioFile] ?? {}
  const gap = GAP[bundle.channel] ?? 0.6

  const decoded = parts.map((p) => parseWav(fs.readFileSync(p)))
  const { channels, sampleRate, bits } = decoded[0]
  const silence = (sec) =>
    Buffer.alloc(Math.round(sec * sampleRate) * channels * (bits / 8))

  const chunks = []
  if (special.lead) chunks.push(silence(special.lead))
  decoded.forEach((d, i) => {
    chunks.push(d.data)
    if (i < decoded.length - 1) {
      chunks.push(silence(gap + (special.gapsAfter?.[i] ?? 0)))
    }
  })

  const body = Buffer.concat(chunks)
  fs.writeFileSync(
    outFile,
    Buffer.concat([wavHeader({ channels, sampleRate, bits, dataLength: body.length }), body])
  )
  return body.length / (sampleRate * channels * (bits / 8))
}

async function assemble({ bundle, parts, outFile }) {
  const special = SPECIAL[bundle.audioFile] ?? {}
  const gap = GAP[bundle.channel] ?? 0.6

  // 입력: 각 줄 wav + 무음들
  const inputs = []
  const chain = []

  const pushSilence = (sec) => {
    inputs.push('-f', 'lavfi', '-t', String(sec), '-i', 'anullsrc=r=44100:cl=mono')
  }

  if (special.lead) pushSilence(special.lead)
  parts.forEach((p, i) => {
    inputs.push('-i', p)
    const extra = special.gapsAfter?.[i]
    const isLast = i === parts.length - 1
    if (!isLast) pushSilence(extra ? gap + extra : gap)
  })

  const n = inputs.filter((a) => a === '-i').length
  for (let i = 0; i < n; i++) chain.push(`[${i}:a]`)

  const filter =
    `${chain.join('')}concat=n=${n}:v=0:a=1[cat];` +
    `[cat]aformat=channel_layouts=mono,aresample=44100,${channelFilter(bundle.channel)}[out]`

  await run(FF.ffmpeg, [
    '-y',
    ...inputs,
    '-filter_complex', filter,
    '-map', '[out]',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    outFile,
  ])
}

async function durationOf(file) {
  const { stdout } = await run(FF.ffprobe, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ])
  return Math.round(parseFloat(stdout) * 100) / 100
}

/**
 * 각 자막 줄이 시작하는 시각을 계산한다.
 *
 * 줄마다 따로 합성했으므로 길이를 정확히 안다. 조립 순서
 * (앞 무음 → 줄1 → 사이 → 줄2 → …)를 그대로 누적하면 실측 시작 시각이 나온다.
 * 이 값이 있으면 앱은 글자 수 비례 추정을 쓰지 않는다(audioTimings.ts).
 */
async function lineStartTimes(bundle, parts) {
  const special = SPECIAL[bundle.audioFile] ?? {}
  const gap = GAP[bundle.channel] ?? 0.6

  let t = special.lead ?? 0
  const starts = []
  for (let i = 0; i < parts.length; i++) {
    starts.push(Math.round(t * 100) / 100)
    t += await durationOf(parts[i])
    if (i < parts.length - 1) t += gap + (special.gapsAfter?.[i] ?? 0)
  }
  return starts
}

/** src/lib/audioTimings.ts의 표를 갱신한다 (자막 싱크용) */
export function writeTimings(map) {
  const file = path.join(ROOT, 'src', 'lib', 'audioTimings.ts')
  const src = fs.readFileSync(file, 'utf8')

  const open = src.indexOf('export const AUDIO_TIMINGS')
  const braceStart = src.indexOf('{', open)
  let depth = 0
  let braceEnd = braceStart
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) { braceEnd = i; break }
  }

  // 기존 값을 읽어 이번에 만든 것만 덮어쓴다 (일부만 생성했을 수 있다)
  const existing = {}
  const entryRe = /^\s*([a-z0-9_]+):\s*\[([^\]]*)\],?\s*$/gim
  let e
  const inner = src.slice(braceStart + 1, braceEnd)
  while ((e = entryRe.exec(inner)) !== null) {
    existing[e[1]] = e[2].split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
  }
  Object.assign(existing, map)

  const lines = Object.keys(existing)
    .sort()
    .map((k) => `  ${k}: [${existing[k].join(', ')}],`)
    .join('\n')

  const next =
    src.slice(0, braceStart + 1) +
    '\n' +
    lines +
    '\n' +
    src.slice(braceEnd)
  fs.writeFileSync(file, next, 'utf8')
}

// ---------------------------------------------------------------------------
// 5. 실행
// ---------------------------------------------------------------------------

function loadEnvKey() {
  if (process.env.TYPECAST_API_KEY) return process.env.TYPECAST_API_KEY
  const envFile = path.join(ROOT, '.env.local')
  if (fs.existsSync(envFile)) {
    const hit = /^TYPECAST_API_KEY\s*=\s*(.+)$/m.exec(fs.readFileSync(envFile, 'utf8'))
    if (hit) return hit[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}

async function main() {
  let bundles = extractBundles()
  if (ONLY) bundles = bundles.filter((b) => b.audioFile === ONLY || b.id === ONLY)
  if (SKIP.length) {
    const before = bundles.length
    bundles = bundles.filter((b) => !SKIP.includes(b.audioFile) && !SKIP.includes(b.id))
    console.log(`제외: ${SKIP.join(', ')} (${before - bundles.length}개)
`)
  }
  if (bundles.length === 0) {
    console.error(`대상 번들이 없습니다: ${ONLY}`)
    process.exit(1)
  }

  // ── 비용 계산 (--dry-run은 여기서 끝)
  const totalChars = bundles.reduce(
    (a, b) => a + b.lines.reduce((x, l) => x + l.text.length, 0),
    0
  )
  const totalLines = bundles.reduce((a, b) => a + b.lines.length, 0)
  console.log(`번들 ${bundles.length}개 · 대사 ${totalLines}줄 · ${totalChars.toLocaleString()}자`)
  console.log(`크레딧 ${totalChars.toLocaleString()} (글자당 1) — 무료 플랜 월 30,000 기준 ${Math.floor(30000 / totalChars)}회 생성 가능\n`)
  if (DRY) {
    for (const b of bundles) {
      const c = b.lines.reduce((x, l) => x + l.text.length, 0)
      console.log(`  ${b.audioFile.padEnd(20)} ${String(b.lines.length).padStart(2)}줄 ${String(c).padStart(5)}자`)
    }
    return
  }

  // ── 준비물 확인
  const apiKey = loadEnvKey()
  if (!apiKey) {
    console.error('TYPECAST_API_KEY가 없습니다. .env.local에 넣어주세요.')
    process.exit(1)
  }
  const voicesPath = path.join(ROOT, 'scripts', 'voices.json')
  if (!fs.existsSync(voicesPath)) {
    console.error('scripts/voices.json이 없습니다. voices.example.json을 복사해 voice_id를 채워주세요.')
    process.exit(1)
  }
  const voices = JSON.parse(fs.readFileSync(voicesPath, 'utf8'))
  if (!(await resolveFfmpeg())) {
    console.error('ffmpeg을 찾지 못했습니다 (조립·후처리·mp3 인코딩에 필요).\n  winget install Gyan.FFmpeg')
    process.exit(1)
  }
  if (FF.ffmpeg !== 'ffmpeg') {
    console.log(`ffmpeg: 설치 위치에서 직접 사용합니다 (PATH 미반영 — 터미널을 새로 열면 해결)\n`)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  let spent = 0
  const timings = {}

  for (const b of bundles) {
    process.stdout.write(`▶ ${b.audioFile} (${b.lines.length}줄) … `)
    const parts = []

    for (let i = 0; i < b.lines.length; i++) {
      const line = b.lines[i]
      const role = roleOf(b, line)
      const cfg = voices.roles?.[role]
      if (!cfg?.voice_id || cfg.voice_id.includes('___')) {
        throw new Error(`voices.json에 '${role}'의 voice_id가 비어 있습니다`)
      }

      // 앞뒤 문장을 넘겨 감정 문맥을 잡게 한다
      const prompt = EMOTION[b.audioFile] ?? {
        emotion_type: 'smart',
        previous_text: b.lines[i - 1]?.text ?? '',
        next_text: b.lines[i + 1]?.text ?? '',
      }

      const r = await synthLine({
        apiKey,
        model: voices.model ?? 'ssfm-v30',
        role,
        cfg,
        text: line.text,
        prompt,
      })
      parts.push(r.file)
      spent += r.chars
    }

    const outFile = path.join(OUT_DIR, `${b.audioFile}.mp3`)
    await assemble({ bundle: b, parts, outFile })

    // 자막이 음성과 정확히 맞도록 줄별 시작 시각을 기록한다
    timings[b.audioFile] = await lineStartTimes(b, parts)

    const sec = await durationOf(outFile)
    const diff = sec - b.durationSec
    console.log(
      `${Math.round(sec)}초 (명세 ${b.durationSec}초, ${diff >= 0 ? '+' : ''}${Math.round(diff)}초)`
    )
  }

  writeTimings(timings)
  console.log(`\n자막 시작 시각 ${Object.keys(timings).length}개 기록 → src/lib/audioTimings.ts`)
  console.log(`완료. 이번 실행에서 쓴 크레딧: ${spent.toLocaleString()}`)
  console.log('캐시된 줄은 재호출하지 않았습니다 (.audio-cache).')
  console.log('\n다음 단계 — 서비스워커 캐시 버전을 올려야 기존 기기가 새 음성을 받습니다:')
  console.log('  node scripts/update-sw-version.js')
}

// 직접 실행할 때만 돈다 — 테스트에서 함수만 가져다 쓸 수 있도록
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((e) => {
    console.error('\n실패:', e.message)
    process.exit(1)
  })
}
