/**
 * cues.ts의 durationSec을 실제 mp3 길이로 맞춘다.
 *
 *   node scripts/fix-durations.mjs [--dry-run]
 *
 * 이 값은 음성을 못 받았을 때 자막을 넘기는 합성 클록이 쓴다. 실제보다
 * 길면 마지막 자막이 그만큼 멈춰 선 채 미션이 열리지 않는다. 음성이
 * 정상 재생되면 재생기가 실제 길이로 덮으므로 평소엔 드러나지 않는다 —
 * 그래서 스무 개가 어긋난 채로 한참을 갔다.
 *
 * generate-audio.mjs는 이 값을 읽고 경고만 한다. 고치는 것은 여기다.
 * 줄을 나누거나 합쳐 다시 구운 뒤에 돌린다.
 *
 * ffprobe가 없으면 조용히 건너뛴다 — 굽기 사슬 한가운데에 있어서,
 * 도구가 없는 자리에서 사슬 전체가 끊기면 곤란하다.
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const CUES = path.join(ROOT, 'src', 'lib', 'cues.ts')
const DRY = process.argv.includes('--dry-run')

function haveFfprobe() {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!haveFfprobe()) {
  process.stdout.write(
    'ffprobe가 없어 durationSec 보정을 건너뛴다.\n' +
      '  winget install Gyan.FFmpeg\n'
  )
  process.exit(0)
}

// cues.ts는 CRLF다 — 정규식은 \n만 보므로 맞춰 읽고 되돌려 쓴다
const raw = fs.readFileSync(CUES, 'utf8')
const crlf = raw.includes('\r\n')
let src = raw.replace(/\r\n/g, '\n')

// audioFile 뒤에 오는 durationSec을 같은 큐 안에서만 찾는다
const re = /audioFile: '([a-z0-9_]+)',[\s\S]{0,500}?durationSec: (\d+),/g

const jobs = []
let m
while ((m = re.exec(src))) {
  const [, file, spec] = m
  const p = path.join(ROOT, 'public', 'audio', `${file}.mp3`)
  if (!fs.existsSync(p)) continue // 아직 안 구운 것 — 조용히 넘어간다

  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p,
  ])
    .toString()
    .trim()

  const actual = parseFloat(out)
  if (!Number.isFinite(actual)) continue

  const want = Math.ceil(actual)
  if (want !== Number(spec)) jobs.push({ file, old: Number(spec), want, actual })
}

if (!jobs.length) {
  process.stdout.write('durationSec 전부 실제 길이와 맞다.\n')
  process.exit(0)
}

const failed = []
for (const j of jobs) {
  const anchor = `audioFile: '${j.file}',`
  const at = src.indexOf(anchor)
  if (at < 0) {
    failed.push(`${j.file} (앵커 없음)`)
    continue
  }

  // 이 큐 블록 안에서만 바꾼다 — 뒤 큐의 값을 건드리면 안 된다
  const win = src.slice(at, at + 600)
  const dre = new RegExp(`durationSec: ${j.old},`)
  if (!dre.test(win)) {
    failed.push(`${j.file} (durationSec ${j.old} 없음)`)
    continue
  }

  if (!DRY) {
    src = src.slice(0, at) + win.replace(dre, `durationSec: ${j.want},`) + src.slice(at + 600)
  }
  process.stdout.write(
    `${j.file.padEnd(20)} ${String(j.old).padStart(3)} → ${String(j.want).padStart(3)}` +
      `  (실측 ${j.actual.toFixed(2)})\n`
  )
}

if (DRY) {
  process.stdout.write(`\n--dry-run — ${jobs.length}개가 어긋나 있다. 고치지 않았다.\n`)
} else {
  fs.writeFileSync(CUES, crlf ? src.replace(/\n/g, '\r\n') : src)
  process.stdout.write(`\n${jobs.length - failed.length}개 고침 -> src/lib/cues.ts\n`)
}

if (failed.length) {
  process.stderr.write(`실패: ${failed.join(', ')}\n`)
  process.exit(1)
}
