/**
 * 등장인물 프로필 — 원본 그림을 앱에서 쓸 아바타로 다듬는다.
 *
 * 받은 그림은 2048×2048 정사각이지만 인물이 놓인 자리가 제각각이다.
 * 어떤 그림은 얼굴이 위쪽에, 어떤 그림은 가운데에 있어서 그대로 원형으로
 * 자르면 누구는 이마가 잘리고 누구는 턱 아래가 비어 보인다.
 *
 * 그래서 얼굴 위치를 사람이 지정하고(FOCUS), 그 지점을 중심으로 정사각을
 * 잘라 512px로 줄인다. 원형 마스크는 CSS가 씌우므로 여기서는 자르기만 한다.
 *
 * ffmpeg이 없으므로 PNG 디코딩·리샘플을 직접 한다(sharp 등 네이티브 의존
 * 없이 순수 JS). 원본이 크지 않아 속도는 문제되지 않는다.
 *
 *   node scripts/make-cast-avatars.mjs
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const SRC = process.argv[2]
const OUT = path.join(process.cwd(), 'public', 'images', 'cast')
const SIZE = 512

/**
 * 인물별 자르기 기준.
 *  cx, cy — 얼굴 중심(0~1). 이 점이 잘라낸 정사각의 가운데로 온다.
 *  zoom   — 1이면 원본 전체 폭, 클수록 얼굴이 크게 잡힌다.
 * 값은 그림을 보고 맞췄다. 넷 다 머리 위 여백과 어깨 폭이 비슷해지도록.
 */
const FOCUS = {
  'father.png': { src: '강민수.png', cx: 0.5, cy: 0.34, zoom: 1.85 },
  'soyoung.png': { src: '강소영.png', cx: 0.5, cy: 0.33, zoom: 1.8 },
  'shopkeeper1.png': { src: '봉황1935사장님.png', cx: 0.5, cy: 0.4, zoom: 1.75 },
  // 받은 파일이 카페탱자 사장님이라 T5(방하림) 자리에 다른 사람 얼굴이 떠 있었다.
  // 대사(B5_T2)는 방하림에서만 성립하므로, 그림 쪽을 방하림 사장님으로 바꿨다.
  'shopkeeper2.png': { src: '방하림 사장님.png', cx: 0.5, cy: 0.36, zoom: 1.8 },
}

// ── PNG 읽기 (RGBA8 · 인터레이스 없음만 다룬다) ───────────────────
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
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`8bit만 지원 (현재 ${bitDepth})`)
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!ch) throw new Error(`지원하지 않는 colorType ${colorType}`)

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(w * h * 4)

  // 필터 해제 — PNG는 줄마다 앞줄/왼쪽 픽셀을 참조하는 예측 필터를 쓴다
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
        out[d + 3] = ch === 4 ? line[s + 3] : 255
      } else {
        out[d] = out[d + 1] = out[d + 2] = line[s]
        out[d + 3] = ch === 2 ? line[s + 1] : 255
      }
    }
  }
  return { w, h, data: out }
}

// ── PNG 쓰기 (RGB8, 필터 없음) ───────────────────────────────────
function writePng(w, h, rgba) {
  const stride = w * 3
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      const d = y * (stride + 1) + 1 + x * 3
      raw[d] = rgba[s]
      raw[d + 1] = rgba[s + 1]
      raw[d + 2] = rgba[s + 2]
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

/** 박스 필터 축소 — 원본 여러 픽셀을 평균한다. 단순 최근접보다 계단이 덜하다 */
function resample(src, sw, sh, box, size) {
  const out = Buffer.alloc(size * size * 4)
  const step = box.side / size
  for (let y = 0; y < size; y++) {
    const y0 = box.top + y * step
    const y1 = y0 + step
    for (let x = 0; x < size; x++) {
      const x0 = box.left + x * step
      const x1 = x0 + step
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let sy = Math.max(0, Math.floor(y0)); sy < Math.min(sh, Math.ceil(y1)); sy++) {
        for (let sx = Math.max(0, Math.floor(x0)); sx < Math.min(sw, Math.ceil(x1)); sx++) {
          const s = (sy * sw + sx) * 4
          r += src[s]
          g += src[s + 1]
          b += src[s + 2]
          n++
        }
      }
      const d = (y * size + x) * 4
      if (n) {
        out[d] = r / n
        out[d + 1] = g / n
        out[d + 2] = b / n
      } else {
        out[d] = out[d + 1] = out[d + 2] = 243 // 크림 배경
      }
      out[d + 3] = 255
    }
  }
  return out
}

fs.mkdirSync(OUT, { recursive: true })

for (const [name, f] of Object.entries(FOCUS)) {
  const srcPath = path.join(SRC, f.src)
  if (!fs.existsSync(srcPath)) {
    console.log(`건너뜀 — 원본 없음: ${f.src}`)
    continue
  }
  const img = readPng(fs.readFileSync(srcPath))
  const side = Math.min(img.w, img.h) / f.zoom
  // 초점이 가장자리에 가까워도 원본 밖으로 나가지 않게 가둔다
  const left = Math.max(0, Math.min(img.w - side, img.w * f.cx - side / 2))
  const top = Math.max(0, Math.min(img.h - side, img.h * f.cy - side / 2))

  const px = resample(img.data, img.w, img.h, { left, top, side }, SIZE)
  const png = writePng(SIZE, SIZE, px)
  fs.writeFileSync(path.join(OUT, name), png)
  console.log(
    `${name.padEnd(18)} ← ${f.src.padEnd(20)} ${img.w}×${img.h} → ${SIZE}×${SIZE} · ${Math.round(png.length / 1024)}KB`
  )
}
