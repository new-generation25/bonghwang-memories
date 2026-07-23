/**
 * WAV(16bit) → MP3. ffmpeg이 없어 순수 JS 인코더를 쓴다.
 *
 * 브라우저에서 승인한 그 음원을 그대로 옮기는 것이 요점이다.
 * 서버에서 다시 구우면 같은 설정이라도 결과가 달라지므로(비결정적)
 * 이미 들어보고 고른 파형을 인코딩만 바꿔서 넣는다.
 *
 *   node wav2mp3.mjs 입력.wav 출력.mp3 [비트레이트]
 */
import fs from 'fs'
import path from 'path'
import lame from '@breezystack/lamejs'

const [, , inPath, outPath, kbpsArg] = process.argv
const KBPS = Number(kbpsArg ?? 96)

const buf = fs.readFileSync(inPath)
if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('WAV이 아닙니다')

// 청크를 순회해 fmt/data를 찾는다
let pos = 12
let fmt = null
let data = null
while (pos + 8 <= buf.length) {
  const id = buf.toString('ascii', pos, pos + 4)
  const size = buf.readUInt32LE(pos + 4)
  if (id === 'fmt ') fmt = pos + 8
  if (id === 'data') data = { pos: pos + 8, size }
  pos += 8 + size + (size % 2)
}
if (fmt === null || !data) throw new Error('fmt/data 청크 없음')

const channels = buf.readUInt16LE(fmt + 2)
const rate = buf.readUInt32LE(fmt + 4)
const bits = buf.readUInt16LE(fmt + 14)
if (bits !== 16) throw new Error(`16bit만 지원 (현재 ${bits})`)

const frames = data.size / (channels * 2)
const samples = new Int16Array(frames)
for (let i = 0; i < frames; i++) {
  // 스테레오면 왼쪽만 — 나레이션은 모노로 충분하고 용량이 절반이다
  samples[i] = buf.readInt16LE(data.pos + i * channels * 2)
}

const enc = new lame.Mp3Encoder(1, rate, KBPS)
const out = []
const BLOCK = 1152
for (let i = 0; i < samples.length; i += BLOCK) {
  const chunk = samples.subarray(i, Math.min(i + BLOCK, samples.length))
  const mp3 = enc.encodeBuffer(chunk)
  if (mp3.length) out.push(Buffer.from(mp3))
}
const tail = enc.flush()
if (tail.length) out.push(Buffer.from(tail))

const result = Buffer.concat(out)
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
fs.writeFileSync(outPath, result)

console.log(`입력  ${channels}ch ${rate}Hz ${bits}bit · ${(frames / rate).toFixed(2)}초 · ${(buf.length / 1024 / 1024).toFixed(2)}MB`)
console.log(`출력  1ch ${rate}Hz ${KBPS}kbps · ${Math.round(result.length / 1024)}KB`)
console.log(`저장  ${path.resolve(outPath)}`)
