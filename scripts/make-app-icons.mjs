/**
 * PWA 아이콘 — 홈 화면에 깔릴 카세트.
 *
 * 앱 안의 카세트(.cassette CSS)를 아이콘 크기로 다시 그린다. 화면의
 * 오브제와 홈 화면 아이콘이 같은 물건이어야, 설치한 사람이 아이콘을
 * 보고 이 앱을 떠올린다.
 *
 * 아이콘은 손톱만 하게 줄어드니 실물의 디테일을 그대로 옮기면 뭉갠다.
 * 남기는 것은 넷뿐이다 — 셸 블랙 몸체, 크림 라벨, 3색 스트라이프,
 * 창 안의 릴 두 개. 나사·헤드 구멍 같은 것은 뺀다.
 *
 * 바탕은 크림이다. 셸 블랙 위에 셸 블랙 카세트를 올리면 형태가 배경에
 * 묻혀 손톱 크기에서는 검은 사각형으로만 보인다. 앱의 종이 바탕과 같은
 * 색을 깔고 그 위에 검은 카세트를 얹으면 대비가 가장 크고, 앱을 열었을
 * 때의 첫 화면과도 같은 그림이 된다.
 *
 * maskable: 안드로이드는 아이콘을 원·둥근네모 등으로 잘라낸다. 잘려도
 * 되는 바깥 20%를 비워야 하는데, 여기서는 배경을 가장자리까지 크림으로
 * 채우고 카세트를 안전 영역(가운데 76%) 안에 앉혀 어떤 모양으로 잘려도
 * 몸체가 상하지 않게 한다.
 *
 * 네이티브 의존 없이 순수 JS로 그린다(다른 스크립트와 같은 방식).
 * 계단을 없애려고 4배로 그린 뒤 평균 내어 줄인다.
 *
 *   node scripts/make-app-icons.mjs
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const OUT = path.join(process.cwd(), 'public')
const SIZES = [192, 512]
const SS = 4 // 슈퍼샘플 배율

// globals.css :root 값 그대로 — 앱과 아이콘의 색이 갈리면 안 된다
const CREAM = [243, 234, 211]
const TEAL = [46, 138, 128]
const YELLOW = [242, 179, 61]
const ORANGE = [232, 114, 44]
const SHELL = [38, 36, 34]
const INK = [43, 36, 32]
const TAPE = [91, 70, 52] // 감긴 테이프 — .cassette .tamount의 그 갈색(#5b4634)
const HUB = [20, 18, 16]

// ── 캔버스 ────────────────────────────────────────────────────
function canvas(w, h, bg) {
  const px = Buffer.alloc(w * h * 3)
  for (let i = 0; i < w * h; i++) {
    px[i * 3] = bg[0]
    px[i * 3 + 1] = bg[1]
    px[i * 3 + 2] = bg[2]
  }
  return { w, h, px }
}

function setPx(c, x, y, color) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const d = (y * c.w + x) * 3
  c.px[d] = color[0]
  c.px[d + 1] = color[1]
  c.px[d + 2] = color[2]
}

/** 둥근 모서리 사각형 */
function roundRect(c, x, y, w, h, r, color) {
  const x1 = x + w
  const y1 = y + h
  for (let py = Math.floor(y); py < Math.ceil(y1); py++) {
    for (let px = Math.floor(x); px < Math.ceil(x1); px++) {
      // 모서리 원 안쪽인지 검사
      const cx = px < x + r ? x + r : px > x1 - r ? x1 - r : px
      const cy = py < y + r ? y + r : py > y1 - r ? y1 - r : py
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy <= r * r) setPx(c, px, py, color)
    }
  }
}

function circle(c, cx, cy, r, color) {
  for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
    for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++) {
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy <= r * r) setPx(c, px, py, color)
    }
  }
}

/** 릴 — 살(빗살) + 감긴 테이프 + 허브 */
function reel(c, cx, cy, r, fill) {
  circle(c, cx, cy, r, CREAM)
  // 살 — 방사형 빗살. 실물 릴의 이빨이다
  const teeth = 10
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2
    for (let t = 0; t < r; t += 0.4) {
      for (let w = -0.09; w <= 0.09; w += 0.03) {
        setPx(
          c,
          Math.round(cx + Math.cos(a0 + w) * t),
          Math.round(cy + Math.sin(a0 + w) * t),
          INK
        )
      }
    }
  }
  // 감긴 테이프 — fill(0~1)만큼 허브에서 바깥으로 자란다
  const hubR = r * 0.3
  const packR = hubR + (r * 0.94 - hubR) * fill
  if (fill > 0.02) circle(c, cx, cy, packR, TAPE)
  circle(c, cx, cy, hubR, HUB)
}

// ── PNG 쓰기 (RGB8) ──────────────────────────────────────────
let CRC_TABLE = null
function crc(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let x = n
      for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1
      CRC_TABLE[n] = x
    }
  }
  let x = 0xffffffff
  for (let i = 0; i < buf.length; i++) x = CRC_TABLE[(x ^ buf[i]) & 0xff] ^ (x >>> 8)
  return (x ^ 0xffffffff) >>> 0
}

function writePng(c) {
  const stride = c.w * 3
  const raw = Buffer.alloc((stride + 1) * c.h)
  for (let y = 0; y < c.h; y++) {
    raw[y * (stride + 1)] = 0
    c.px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length)
    b.writeUInt32BE(data.length, 0)
    b.write(type, 4, 'ascii')
    data.copy(b, 8)
    b.writeUInt32BE(
      crc(Buffer.concat([Buffer.from(type, 'ascii'), data])),
      8 + data.length
    )
    return b
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(c.w, 0)
  ihdr.writeUInt32BE(c.h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 슈퍼샘플 축소 — 계단을 없앤다 */
function downscale(c, size) {
  const out = canvas(size, size, CREAM)
  const step = c.w / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let sy = Math.floor(y * step); sy < Math.floor((y + 1) * step); sy++) {
        for (let sx = Math.floor(x * step); sx < Math.floor((x + 1) * step); sx++) {
          const d = (sy * c.w + sx) * 3
          r += c.px[d]
          g += c.px[d + 1]
          b += c.px[d + 2]
          n++
        }
      }
      setPx(out, x, y, [r / n, g / n, b / n])
    }
  }
  return out
}

// ── 그리기 ────────────────────────────────────────────────────
function drawIcon(size) {
  const S = size * SS
  const c = canvas(S, S, CREAM)
  const u = S / 100 // 1 = 아이콘 폭의 1%

  /*
    카세트 몸체. 안전 영역(가운데 76%) 안에 앉힌다 — 원으로 잘려도
    모서리가 상하지 않는다. 실물 카세트는 가로가 긴 직사각이라
    폭 76 · 높이 50으로 둔다.
  */
  const bw = 76 * u
  const bh = 50 * u
  const bx = (S - bw) / 2
  const by = (S - bh) / 2
  roundRect(c, bx, by, bw, bh, 4 * u, SHELL)

  // 라벨 — 크림 종이. 몸체 위쪽 절반을 덮는다
  const lx = bx + 4 * u
  const ly = by + 4 * u
  const lw = bw - 8 * u
  const lh = 20 * u
  roundRect(c, lx, ly, lw, lh, 1.5 * u, CREAM)

  // 3색 스트라이프 — 브랜드 고정 요소. 라벨 아래를 가로지른다
  const sy = ly + lh - 5 * u
  const sh = 2.6 * u
  const seg = lw / 3
  roundRect(c, lx, sy, seg, sh, 0, YELLOW)
  roundRect(c, lx + seg, sy, seg, sh, 0, ORANGE)
  roundRect(c, lx + seg * 2, sy, seg, sh, 0, TEAL)

  /*
    창. 여기서 릴이 돈다 — 아이콘에서 '이것이 카세트'임을 정하는 부분이다.
    실물처럼 살짝 어두운 유리로 두고 그 안에 릴 둘을 넣는다.
  */
  const wx = bx + 8 * u
  const wy = ly + lh + 3 * u
  const ww = bw - 16 * u
  const wh = by + bh - wy - 5 * u
  roundRect(c, wx, wy, ww, wh, 1.5 * u, [22, 20, 18])

  /*
    릴 둘. 왼쪽은 거의 다 감긴 채, 오른쪽은 조금 — 이야기가 이제
    막 시작된 테이프다. 두 뭉치의 두께가 다른 것이 '재생 중'을 만든다.
  */
  const rr = wh * 0.34
  const rcy = wy + wh / 2
  reel(c, wx + ww * 0.26, rcy, rr, 0.85)
  reel(c, wx + ww * 0.74, rcy, rr, 0.28)

  return downscale(c, size)
}

for (const size of SIZES) {
  const png = writePng(drawIcon(size))
  const file = path.join(OUT, `icon-${size}x${size}.png`)
  fs.writeFileSync(file, png)
  console.log(`icon-${size}x${size}.png · ${Math.round(png.length / 1024)}KB`)
}
