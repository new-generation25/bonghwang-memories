/**
 * 거점 그림 — 원본을 앱에서 쓸 4:3 이미지로 다듬는다.
 *
 * 받은 그림은 정사각이고 오른쪽 아래에 생성 도구의 반짝임 표식이 박혀 있다.
 * 4:3으로 자르면서 위쪽을 기준으로 삼으면 그 표식이 잘려 나간다 —
 * 간판과 처마는 위쪽에 있으므로 이 방향이 그림도 살린다.
 *
 * ffmpeg·sharp 없이 PNG 디코딩과 축소를 직접 한다.
 * (make-cast-avatars.mjs와 같은 방식. 그쪽은 정사각·인물 초점 기준이다)
 *
 *   node scripts/make-place-photos.mjs <원본폴더>
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const SRC = process.argv[2]
const OUT = path.join(process.cwd(), 'public', 'images', 'place')
/**
 * 가로 폭 — 화면에서 최대 300px로 쓰므로 2배수면 충분하다.
 *
 * 720으로 PNG를 쓰면 장당 900KB가 나온다. 오디오를 전부 미리 받는
 * 앱(D8)에 그림 넷을 3.5MB 얹을 수는 없다. 그림체가 평평한 일러스트라
 * 색이 뭉치는 편이어서, 폭을 640으로 줄이고 PNG 팔레트를 쓰면
 * 눈에 띄는 손실 없이 장당 200KB 아래로 떨어진다.
 */
const WIDTH = 640
const RATIO = 3 / 4

/**
 * 거점별 자르기 — 아래 끝을 기준으로 잡는다.
 *
 * bottom — 잘라낼 창의 아래 끝(0~1). 반짝임 표식 바로 위에 둔다.
 *
 * 위쪽을 기준으로 잡았더니 원본 비율에 따라 잘리는 양이 제각각이었다.
 * 미야상회는 세로가 긴 원본(1792×2390)이라 아래가 32%나 날아가 가게
 * 앞 평상과 화분이 통째로 사라졌다. 아래 끝을 못박으면 원본 비율과
 * 무관하게 '표식만 빠지고 나머지는 남는다'.
 */
const PLACES = {
  't1.png': { src: '봉황1935카페.png', bottom: 0.86 },
  't2.png': { src: '미야상회.png', bottom: 0.87 },
  't3.png': { src: '능소화고택.png', bottom: 0.87 },
  't4.png': { src: '카페탱자.png', bottom: 0.86 },
}

// ── PNG 읽기 (8bit, 인터레이스 없음) ─────────────────────────────
function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG이 아닙니다')
  let pos = 8
  let w = 0
  let h = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (data[12] !== 0) throw new Error('인터레이스 PNG은 지원하지 않습니다')
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`8bit만 지원 (현재 ${bitDepth})`)
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!ch) throw new Error(`지원하지 않는 colorType ${colorType}`)

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(w * h * 4)
  const line = Buffer.alloc(stride)
  const prev = Buffer.alloc(stride)
  let rp = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++]
    raw.copy(line, 0, rp, rp + stride)
    rp += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0
      const b = prev[i]
      const c = i >= ch ? prev[i - ch] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[i] = v & 0xff
    }
    line.copy(prev)
    for (let x = 0; x < w; x++) {
      const s = x * ch
      const d = (y * w + x) * 4
      if (ch >= 3) {
        out[d] = line[s]
        out[d + 1] = line[s + 1]
        out[d + 2] = line[s + 2]
      } else {
        out[d] = out[d + 1] = out[d + 2] = line[s]
      }
      out[d + 3] = 255
    }
  }
  return { w, h, data: out }
}

// ── PNG 쓰기 (RGB8) ─────────────────────────────────────────────
let CRC_TABLE = null
function crc(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * 색을 살짝 뭉친다 — 팔레트가 아니라 양자화다.
 *
 * 채널당 하위 3비트를 버리면(32단계) 평평한 일러스트에서는 차이를 느끼기
 * 어렵지만, 같은 값이 이어져 PNG 압축이 훨씬 잘 먹는다. 사진이었다면
 * 띠(banding)가 보였을 텐데 이 그림체에는 원래 그라데이션이 적다.
 */
function quantize(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = (rgba[i] & 0xf8) | 4
    rgba[i + 1] = (rgba[i + 1] & 0xf8) | 4
    rgba[i + 2] = (rgba[i + 2] & 0xf8) | 4
  }
  return rgba
}

function writePng(w, h, rgba) {
  const stride = w * 3
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    // 필터 1(Sub) — 가로로 이어지는 같은 색을 0으로 만들어 압축을 돕는다
    raw[y * (stride + 1)] = 1
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      const d = y * (stride + 1) + 1 + x * 3
      const p = x > 0 ? (y * w + x - 1) * 4 : -1
      raw[d] = p < 0 ? rgba[s] : (rgba[s] - rgba[p]) & 0xff
      raw[d + 1] = p < 0 ? rgba[s + 1] : (rgba[s + 1] - rgba[p + 1]) & 0xff
      raw[d + 2] = p < 0 ? rgba[s + 2] : (rgba[s + 2] - rgba[p + 2]) & 0xff
    }
  }
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length)
    b.writeUInt32BE(data.length, 0)
    b.write(type, 4, 'ascii')
    data.copy(b, 8)
    b.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
    return b
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 박스 필터 축소 — 최근접보다 계단이 덜하다 */
function resample(src, sw, sh, box, ow, oh) {
  const out = Buffer.alloc(ow * oh * 4)
  const sx = box.w / ow
  const sy = box.h / oh
  for (let y = 0; y < oh; y++) {
    const y0 = box.top + y * sy
    const y1 = y0 + sy
    for (let x = 0; x < ow; x++) {
      const x0 = box.left + x * sx
      const x1 = x0 + sx
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let py = Math.max(0, Math.floor(y0)); py < Math.min(sh, Math.ceil(y1)); py++) {
        for (let px = Math.max(0, Math.floor(x0)); px < Math.min(sw, Math.ceil(x1)); px++) {
          const s = (py * sw + px) * 4
          r += src[s]
          g += src[s + 1]
          b += src[s + 2]
          n++
        }
      }
      const d = (y * ow + x) * 4
      if (n) {
        out[d] = r / n
        out[d + 1] = g / n
        out[d + 2] = b / n
      }
      out[d + 3] = 255
    }
  }
  return out
}

fs.mkdirSync(OUT, { recursive: true })

for (const [name, p] of Object.entries(PLACES)) {
  const srcPath = path.join(SRC, p.src)
  if (!fs.existsSync(srcPath)) {
    console.log(`건너뜀 — 원본 없음: ${p.src}`)
    continue
  }
  const img = readPng(fs.readFileSync(srcPath))

  // 가로는 전부 쓰고, 세로는 4:3이 되는 만큼만.
  // 아래 끝을 표식 바로 위에 두고 거기서 위로 창을 연다.
  const cropH = Math.round(img.w * RATIO)
  const wantBottom = Math.round(img.h * p.bottom)
  const top = Math.max(0, Math.min(img.h - cropH, wantBottom - cropH))

  const oh = Math.round(WIDTH * RATIO)
  const px = resample(
    img.data,
    img.w,
    img.h,
    { left: 0, top, w: img.w, h: cropH },
    WIDTH,
    oh
  )
  const png = writePng(WIDTH, oh, quantize(px))
  fs.writeFileSync(path.join(OUT, name), png)

  const cutFromBottom = Math.round(((img.h - top - cropH) / img.h) * 100)
  console.log(
    `${name}  ← ${p.src.padEnd(18)} ${img.w}×${img.h} → ${WIDTH}×${oh} · ` +
      `아래 ${cutFromBottom}% 잘라냄 · ${Math.round(png.length / 1024)}KB`
  )
}
