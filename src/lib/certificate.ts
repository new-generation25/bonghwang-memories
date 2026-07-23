'use client'

/**
 * 완주 인증서 PNG 합성.
 *
 * 화면(S40)에 이미 있는 물건들을 그대로 인쇄물로 옮긴 것이다 —
 * 셸 블랙 헤더, 3색 스트라이프, 크림 라벨과 손글씨 제목, 레드 도장.
 * 인증서만의 새 조형을 만들지 않는다. 저장본이 화면과 다른 물건처럼
 * 보이면 '오늘 들고 다닌 그 테이프'라는 감각이 끊긴다.
 *
 * 비율은 4:5(1080×1350). 인스타그램 피드에서 잘리지 않는 가장 큰
 * 세로 비율이라, 공유를 전제로 한 결과물은 이 크기로 굽는다.
 *
 * 문구는 S40_TEXT 원문만 쓴다. 인증서 전용 카피를 따로 두면 화면과
 * 저장본이 조용히 갈라진다.
 *
 * 색은 globals.css :root 값을 그대로 옮겨 적었다 — 캔버스는 CSS 변수를
 * 읽지 못하므로 여기서만 이중으로 갖는다. 팔레트를 바꿀 일이 생기면
 * 두 곳을 함께 고쳐야 한다.
 */

import { S40_TEXT } from './cues'

// ---------------------------------------------------------------------------
// 팔레트 · 글꼴
// ---------------------------------------------------------------------------

const C = {
  cream: '#F3EAD3',
  creamDp: '#EAE0C4',
  teal: '#2E8A80',
  tealDk: '#1F625C',
  yellow: '#F2B33D',
  orange: '#E8722C',
  shell: '#262422',
  recRed: '#D93A2B',
  paper: '#FFFDF7',
  line: '#E0D8C6',
  ink: '#2B2420',
  ink60: '#6B6259',
} as const

const FONT = {
  display: '"Black Han Sans", sans-serif',
  body: '"Noto Sans KR", sans-serif',
  pen: '"Nanum Pen Script", cursive',
  mono: '"Nanum Gothic Coding", monospace',
} as const

/**
 * 캔버스에 굽기 전에 실제로 로드해둬야 하는 글꼴 조합.
 *
 * document.fonts.ready만으로는 부족하다 — 아직 한 번도 화면에 쓰이지 않은
 * 조합(예: Black Han Sans 900)은 '대기 중인 폰트'로 잡히지 않아 ready가
 * 즉시 resolve되고, 캔버스는 대체 글꼴로 그려버린다. 그리기 직전에
 * 한글 표본과 함께 명시적으로 load를 걸어야 실제로 받아온다.
 */
const FONT_WARMUP = [
  `900 42px ${FONT.display}`,
  `900 66px ${FONT.display}`,
  `400 40px ${FONT.body}`,
  `700 40px ${FONT.body}`,
  `900 20px ${FONT.body}`,
  `400 26px ${FONT.body}`,
  `400 62px ${FONT.pen}`,
  `400 20px ${FONT.mono}`,
]
const FONT_SAMPLE = '봉황 메모리즈 기록자 소영 아버지의 믹스테이프 0123'

export const CERTIFICATE_WIDTH = 1080
export const CERTIFICATE_HEIGHT = 1350

const W = CERTIFICATE_WIDTH
const H = CERTIFICATE_HEIGHT
/** 좌우 여백 — 모든 구역이 이 선에 맞춰 선다 */
const M = 64
/** 본문 폭 */
const CW = W - M * 2

const HEADER_H = 132
const STRIPE_H = 8
const PLATE_Y = 156
const PLATE_H = 286
const CARD_Y = 474
/** 사진 한 장의 최대 변 */
const THUMB_MAX = 300
/**
 * 마무리 문구가 반드시 확보하는 세로 폭.
 * 사진 크기는 이 값을 먼저 떼어낸 나머지에서 정해진다 — 사진이 커지느라
 * 마지막 한 줄이 도장에 깔리는 일이 없어야 한다.
 */
const CLOSING_BAND = 96
const FOOTER_TOP = H - 164
/** 도장 반지름 — 도장이 푸터 위로 올라오지 않도록 중심을 이 값으로 잡는다 */
const SEAL_R = 62

export interface CertificatePhoto {
  track: number
  url: string
}

export interface CertificateData {
  /** 기록자 일련번호 */
  serial: string
  /** 완주일 (YYYY.MM.DD) */
  date: string
  partySize: number
  /** 함께한 시간 — formatElapsed 결과 */
  elapsed: string
  bingoCount: number
  /** 미션 사진. 0장일 수도 있고, 넘치면 앞 4장만 쓴다 */
  photos: CertificatePhoto[]
}

// ---------------------------------------------------------------------------
// 그리기 보조
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D

/** 둥근 사각형 경로. ctx.roundRect는 구형 웹뷰에 없어 직접 그린다 */
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.arcTo(x + w, y, x + w, y + h, k)
  ctx.arcTo(x + w, y + h, x, y + h, k)
  ctx.arcTo(x, y + h, x, y, k)
  ctx.arcTo(x, y, x + w, y, k)
  ctx.closePath()
}

/**
 * 자간을 벌려 그린다.
 *
 * ctx.letterSpacing은 사파리에 아직 없다. 기계식 표기(.font-mono-retro)는
 * 벌어진 자간이 곧 성격이라, 없으면 다른 글씨가 된다 — 직접 배치한다.
 */
function tracked(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' | 'right' = 'left'
): number {
  // target es5라 문자열 전개(spread)를 못 쓴다 — 한글은 BMP라 코드유닛 분해로 충분하다
  const chars = Array.from(text)
  const total =
    chars.reduce((s, c) => s + ctx.measureText(c).width, 0) +
    spacing * Math.max(0, chars.length - 1)
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2
  const prev = ctx.textAlign
  ctx.textAlign = 'left'
  for (const c of chars) {
    ctx.fillText(c, cx, y)
    cx += ctx.measureText(c).width + spacing
  }
  ctx.textAlign = prev
  return total
}

/**
 * 줄바꿈. 한글은 공백이 드물어 어절 단위만으로는 넘치는 줄이 남는다 —
 * 어절로 자른 뒤 그래도 넘치는 줄만 글자 단위로 한 번 더 쪼갠다.
 */
function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const byWord: string[] = []
  let cur = ''
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word
    if (!cur || ctx.measureText(next).width <= maxW) {
      cur = next
      continue
    }
    byWord.push(cur)
    cur = word
  }
  if (cur) byWord.push(cur)

  const out: string[] = []
  for (const line of byWord) {
    if (ctx.measureText(line).width <= maxW) {
      out.push(line)
      continue
    }
    let buf = ''
    for (const ch of Array.from(line)) {
      if (buf && ctx.measureText(buf + ch).width > maxW) {
        out.push(buf)
        buf = ch
      } else {
        buf += ch
      }
    }
    if (buf) out.push(buf)
  }
  return out
}

/** 기울기 -4°는 브랜드 고정값(.font-display) — 캔버스에도 그대로 건다 */
function skewed(ctx: Ctx, text: string, x: number, y: number, deg = -4) {
  ctx.save()
  ctx.translate(x, y)
  ctx.transform(1, 0, Math.tan((deg * Math.PI) / 180), 1, 0, 0)
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/** 3색 스트라이프 — 옐로·오렌지·티얼 (.stripe-band) */
function stripeBand(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const third = w / 3
  const colors = [C.yellow, C.orange, C.teal]
  colors.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(x + third * i, y, i === 2 ? w - third * 2 : third, h)
  })
}

/** 비율을 유지한 채 프레임을 채우도록 잘라 그린다 (object-fit: cover) */
function drawCover(
  ctx: Ctx,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** 한 장이라도 못 읽으면 그 자리만 비운다 — 인증서 전체를 포기하지 않는다 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all(FONT_WARMUP.map((spec) => document.fonts.load(spec, FONT_SAMPLE)))
    await document.fonts.ready
  } catch {
    // 폰트를 못 받아도 대체 글꼴로 굽는다 — 저장 자체가 실패하는 편이 더 나쁘다
  }
}

// ---------------------------------------------------------------------------
// 구역별 그리기
// ---------------------------------------------------------------------------

/** 크림 바탕 + 점 텍스처 (.bg-cream-base와 같은 패턴, 인쇄 배율로 확대) */
function drawBackground(ctx: Ctx) {
  ctx.fillStyle = C.cream
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(224, 216, 198, 0.55)'
  const grid = 200
  for (let y = 50; y < H; y += grid) {
    for (let x = 50; x < W; x += grid) {
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + grid / 2, y + grid / 2, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** 상단 앱바 — 화면의 .appbar를 그대로 옮긴다(티얼 아닌 셸: 인쇄물은 카세트 몸체) */
function drawHeader(ctx: Ctx) {
  ctx.fillStyle = C.shell
  ctx.fillRect(0, 0, W, HEADER_H)
  stripeBand(ctx, 0, HEADER_H, W, STRIPE_H)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `900 42px ${FONT.display}`
  ctx.fillStyle = 'rgba(31, 98, 92, 0.85)'
  skewed(ctx, '봉황 메모리즈', M + 3, 65 + 3)
  ctx.fillStyle = C.cream
  skewed(ctx, '봉황 메모리즈', M, 65)

  ctx.font = `400 22px ${FONT.body}`
  ctx.fillStyle = 'rgba(243, 234, 211, 0.72)'
  ctx.fillText('EP.1 「아버지의 믹스테이프」', M, 104)

  ctx.font = `400 20px ${FONT.mono}`
  ctx.fillStyle = C.yellow
  tracked(ctx, 'CERTIFICATE', W - M, 62, 4, 'right')
  ctx.fillStyle = 'rgba(243, 234, 211, 0.55)'
  ctx.font = `400 18px ${FONT.mono}`
  tracked(ctx, 'OF COMPLETION', W - M, 92, 3.4, 'right')
}

/**
 * 테이프 창 — 릴 두 개와 다 감긴 테이프.
 *
 * 라벨만 있으면 '스티커'로 읽힌다. 창과 릴이 있어야 카세트가 된다.
 * 테이프는 오른쪽 릴까지 가득 차 있다 — 완주는 곧 끝까지 감긴 테이프다.
 */
function drawTapeWindow(ctx: Ctx, top: number) {
  const winW = 430
  const winH = 76
  const x = (W - winW) / 2
  const cy = top + winH / 2

  ctx.fillStyle = '#141210'
  rr(ctx, x, top, winW, winH, winH / 2)
  ctx.fill()

  ctx.fillStyle = '#5B4634'
  rr(ctx, x + 92, cy - 22, winW - 184, 44, 4)
  ctx.fill()

  for (const cx of [x + 50, x + winW - 50]) {
    ctx.fillStyle = '#EFEBE2'
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, Math.PI * 2)
    ctx.fill()
    // 릴 살 — 원본은 conic gradient지만 캔버스에는 없어 부채꼴로 대신한다
    ctx.fillStyle = '#B9B2A6'
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, 28, a, a + Math.PI / 10)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#141210'
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * 카세트 — 인증서의 주인공.
 *
 * Cassette.tsx를 인쇄 배율로 다시 그린 것이다. 실물 비율(300×190)을 그대로
 * 키우면 세로 600px을 넘어 다른 구역이 설 자리가 없어서, 라벨 띠와 테이프
 * 창만 남기고 몸체를 납작하게 눌렀다. 스트라이프가 손글씨 제목 뒤로
 * 지나가는 것은 원본 그대로다 — 그 겹침 자체가 브랜드 표식이다.
 */
function drawCassetteLabel(ctx: Ctx) {
  ctx.save()
  ctx.shadowColor = 'rgba(43, 36, 32, 0.35)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 12
  ctx.fillStyle = C.shell
  rr(ctx, M, PLATE_Y, CW, PLATE_H, 22)
  ctx.fill()
  ctx.restore()

  // 몸체 나사 — 카세트임을 알리는 최소 단서
  ctx.fillStyle = '#45403C'
  const screws: [number, number][] = [
    [M + 24, PLATE_Y + 24],
    [M + CW - 24, PLATE_Y + 24],
    [M + 24, PLATE_Y + PLATE_H - 24],
    [M + CW - 24, PLATE_Y + PLATE_H - 24],
  ]
  for (const [sx, sy] of screws) {
    ctx.beginPath()
    ctx.arc(sx, sy, 9, 0, Math.PI * 2)
    ctx.fill()
  }

  const lx = M + 26
  const ly = PLATE_Y + 20
  const lw = CW - 52
  const lh = 152

  ctx.save()
  ctx.fillStyle = C.cream
  rr(ctx, lx, ly, lw, lh, 10)
  ctx.fill()
  ctx.clip()

  // 스트라이프 — 라벨 높이 대비 위치는 .cassette .stripes 비율 그대로
  const sTop = ly + lh * 0.291
  const sH = lh * 0.055
  const sGap = lh * 0.032
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = [C.yellow, C.orange, C.teal][i]
    ctx.fillRect(lx, sTop + (sH + sGap) * i, lw, sH)
  }

  // 라벨 머리말 — 화면 S40의 headLeft / headRight와 같은 값
  ctx.fillStyle = C.shell
  ctx.font = `900 20px ${FONT.body}`
  ctx.textAlign = 'left'
  tracked(ctx, 'A면 소원 · B면 편지', lx + 24, ly + 32, 2.8, 'left')
  tracked(ctx, 'DONE', lx + lw - 24, ly + 32, 3.4, 'right')

  ctx.font = `400 64px ${FONT.pen}`
  ctx.textAlign = 'center'
  ctx.fillText('아버지의 믹스테이프', lx + lw / 2, ly + lh * 0.68)

  ctx.font = `900 36px ${FONT.display}`
  ctx.fillStyle = C.recRed
  ctx.textAlign = 'right'
  ctx.fillText('88', lx + lw - 24, ly + lh - 14)
  ctx.restore()

  drawTapeWindow(ctx, ly + lh + 12)

  // SIDE 배지 — 완주는 레드 체크(.cassette .stag.done)
  const bx = M
  const by = PLATE_Y + 42
  ctx.fillStyle = C.recRed
  ctx.beginPath()
  ctx.arc(bx, by, 27, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = C.cream
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(bx - 11, by + 1)
  ctx.lineTo(bx - 3, by + 9)
  ctx.lineTo(bx + 12, by - 9)
  ctx.stroke()
}

/**
 * 인증 문구 카드 — S40_TEXT 세 줄.
 * 높이는 줄바꿈 결과로 정해진다(시리얼 길이·경과 시간에 따라 달라진다).
 */
function drawStatement(ctx: Ctx, data: CertificateData): number {
  const pad = 36
  const innerW = CW - pad * 2

  ctx.font = `700 40px ${FONT.body}`
  const titleLines = wrap(ctx, S40_TEXT.title(data.serial), innerW)
  ctx.font = `400 26px ${FONT.body}`
  const journeyLines = wrap(ctx, S40_TEXT.journey(data.date, data.partySize), innerW)
  const statsLines = wrap(ctx, S40_TEXT.stats(data.elapsed, data.bingoCount), innerW)

  const cardH =
    pad +
    22 +
    22 +
    titleLines.length * 56 +
    16 +
    journeyLines.length * 40 +
    4 +
    statsLines.length * 40 +
    pad

  ctx.save()
  ctx.shadowColor = 'rgba(43, 36, 32, 0.16)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  ctx.fillStyle = C.paper
  rr(ctx, M, CARD_Y, CW, cardH, 18)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = C.line
  ctx.lineWidth = 2
  rr(ctx, M, CARD_Y, CW, cardH, 18)
  ctx.stroke()

  let y = CARD_Y + pad + 20
  ctx.textAlign = 'center'
  ctx.font = `400 20px ${FONT.mono}`
  ctx.fillStyle = C.teal
  tracked(ctx, 'EP.1 · 완주 인증', W / 2, y, 4, 'center')

  y += 22
  ctx.fillStyle = C.ink
  ctx.font = `700 40px ${FONT.body}`
  for (const line of titleLines) {
    y += 56
    ctx.fillText(line, W / 2, y)
  }

  ctx.fillStyle = C.ink60
  ctx.font = `400 26px ${FONT.body}`
  y += 16
  for (const line of journeyLines) {
    y += 40
    ctx.fillText(line, W / 2, y)
  }
  y += 4
  for (const line of statsLines) {
    y += 40
    ctx.fillText(line, W / 2, y)
  }

  return CARD_Y + cardH
}

/**
 * 미션 사진 띠.
 *
 * 장수(0~4)에 따라 한 줄 안에서 크기만 줄인다. 격자로 접으면 0·1·3장에서
 * 빈 칸이 생겨 레이아웃이 무너지는데, 한 줄 정렬은 어떤 장수에서도
 * '오늘 찍은 것들'로 읽힌다.
 *
 * 크기는 가로(남은 폭)와 세로(푸터·마무리 문구를 뺀 나머지) 중 좁은 쪽을
 * 따른다. 세로를 함께 보지 않으면 1~3장일 때 사진이 커지면서 마무리
 * 문구를 도장 위로 밀어낸다.
 */
function drawPhotoStrip(
  ctx: Ctx,
  photos: { track: number; img: HTMLImageElement }[],
  top: number
): number {
  if (photos.length === 0) return top

  ctx.textAlign = 'left'
  ctx.font = `400 20px ${FONT.mono}`
  ctx.fillStyle = C.teal
  const labelW = tracked(ctx, '우리의 테이프 · OUR TAPE', M, top + 16, 3, 'left')
  ctx.strokeStyle = C.line
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(M + labelW + 18, top + 10)
  ctx.lineTo(W - M, top + 10)
  ctx.stroke()

  const gap = 26
  const n = photos.length
  const stripTop = top + 44
  // 폴라로이드 프레임 전체 높이는 사진 변의 1.215배(위 여백 + 아래 캡션 자리)
  const roomH = (FOOTER_TOP - CLOSING_BAND - stripTop) / 1.215
  const size = Math.min(THUMB_MAX, (CW - gap * (n - 1)) / n, roomH)
  const padSide = size * 0.045
  const padBottom = size * 0.17
  const frameW = size + padSide * 2
  const frameH = size + padSide + padBottom
  const stripW = frameW * n + gap * (n - 1)
  let x = (W - stripW) / 2

  photos.forEach((photo, i) => {
    // 폴라로이드는 원래 반듯하게 붙지 않는다(.polaroid) — 번갈아 기울인다
    const angle = ((i % 2 === 0 ? -1 : 1) * 1.2 * Math.PI) / 180
    ctx.save()
    ctx.translate(x + frameW / 2, stripTop + frameH / 2)
    ctx.rotate(angle)
    ctx.translate(-frameW / 2, -frameH / 2)

    ctx.save()
    ctx.shadowColor = 'rgba(43, 36, 32, 0.3)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 6
    ctx.fillStyle = C.paper
    ctx.fillRect(0, 0, frameW, frameH)
    ctx.restore()

    drawCover(ctx, photo.img, padSide, padSide, size, size)

    ctx.fillStyle = C.ink60
    ctx.font = `400 ${Math.round(size * 0.075)}px ${FONT.mono}`
    tracked(
      ctx,
      `TRACK ${photo.track}`,
      frameW / 2,
      frameH - padBottom * 0.32,
      2,
      'center'
    )
    ctx.restore()

    x += frameW + gap
  })

  return stripTop + frameH
}

/**
 * 마무리 문구 — 손글씨. 남은 세로 공간 한가운데 놓아 여운을 준다.
 *
 * 글자 크기를 위에서부터 낮춰 가며 맞춘다. 문구는 S40_TEXT 고정이지만
 * 손글씨 글꼴이 로드되지 않아 대체 글꼴로 그려지면 폭이 크게 달라져
 * 두 줄이 될 수 있고, 그때 밴드를 넘치면 도장 위로 올라탄다.
 *
 * framed는 사진이 한 장도 없을 때만 켠다 — 그때는 이 한 줄이 지면 한가운데
 * 홀로 남아 허전해서, 3색 룰로 위아래를 잡아 '놓인 자리'를 만들어 준다.
 */
function drawClosing(ctx: Ctx, top: number, bottom: number, framed: boolean) {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  const band = bottom - top
  let lines: string[] = []
  let lineH = 68
  for (const size of [62, 52, 44]) {
    ctx.font = `400 ${size}px ${FONT.pen}`
    lineH = Math.round(size * 1.1)
    lines = wrap(ctx, S40_TEXT.closing, CW - 40)
    if (lines.length * lineH <= band) break
  }
  const start = (top + bottom) / 2 - (lines.length * lineH) / 2
  let y = start
  for (const line of lines) {
    y += lineH
    ctx.fillText(line, W / 2, y)
  }

  if (framed) {
    const ruleW = 180
    stripeBand(ctx, (W - ruleW) / 2, start + lineH * 0.25 - 54, ruleW, 6)
    stripeBand(ctx, (W - ruleW) / 2, y + 40, ruleW, 6)
  }
}

/** 인증 도장 — 레드는 REC·'88'·도장 전용(.seal) */
function drawSeal(ctx: Ctx, cx: number, cy: number, data: CertificateData) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((-9 * Math.PI) / 180)

  ctx.fillStyle = 'rgba(243, 234, 211, 0.92)'
  ctx.beginPath()
  ctx.arc(0, 0, SEAL_R, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = C.recRed
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(0, 0, SEAL_R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, SEAL_R - 9, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = C.recRed
  ctx.textAlign = 'center'
  ctx.font = `400 14px ${FONT.mono}`
  tracked(ctx, 'BONGHWANG-DONG', 0, -22, 1, 'center')
  ctx.font = `900 30px ${FONT.display}`
  ctx.fillText('기록자', 0, 12)
  ctx.font = `400 14px ${FONT.mono}`
  tracked(ctx, data.date, 0, 38, 1.2, 'center')
  ctx.restore()
}

/** 푸터 — 일련번호와 브랜드 표기, 그리고 맨 아래 3색 밴드 */
function drawFooter(ctx: Ctx, data: CertificateData) {
  ctx.textAlign = 'left'
  ctx.font = `400 22px ${FONT.mono}`
  ctx.fillStyle = C.teal
  tracked(ctx, `SERIAL No.${data.serial}`, M, FOOTER_TOP + 46, 3, 'left')
  ctx.font = `400 20px ${FONT.body}`
  ctx.fillStyle = C.ink60
  ctx.fillText('봉황 메모리즈 · 김해 봉황동 오디오드라마 도보투어', M, FOOTER_TOP + 82)

  // 도장은 푸터 안에 완전히 들어와야 한다 — 위로 삐져나오면 마무리 문구를 깐다
  drawSeal(ctx, W - M - 70, FOOTER_TOP + SEAL_R + 6, data)
  stripeBand(ctx, 0, H - 14, W, 14)
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/** 인증서를 캔버스에 굽는다. 캔버스 크기는 여기서 정한다 */
export async function renderCertificate(
  canvas: HTMLCanvasElement,
  data: CertificateData
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 이미지와 글꼴을 모두 확보한 뒤에 한 번에 그린다 — 중간에 그리면
  // 대체 글꼴로 구워진 글자가 그대로 남는다
  const [loaded] = await Promise.all([
    Promise.all(
      data.photos.slice(0, 4).map(async (p) => ({
        track: p.track,
        img: await loadImage(p.url),
      }))
    ),
    waitForFonts(),
  ])
  const photos = loaded.filter(
    (p): p is { track: number; img: HTMLImageElement } => p.img !== null
  )

  canvas.width = W
  canvas.height = H
  ctx.textBaseline = 'alphabetic'

  drawBackground(ctx)
  drawHeader(ctx)
  drawCassetteLabel(ctx)
  const cardBottom = drawStatement(ctx, data)
  const stripBottom = drawPhotoStrip(ctx, photos, cardBottom + 34)
  drawClosing(ctx, stripBottom, FOOTER_TOP, photos.length === 0)
  drawFooter(ctx, data)
}

/** 저장 파일명 — 시리얼로 서로 다른 투어를 구분한다 */
export function certificateFileName(serial: string): string {
  return `bonghwang-memories-ep1-${serial}.png`
}

/** 굽고 바로 내려받는다. S40의 [우리의 테이프 저장하기]가 부르는 유일한 입구 */
export async function saveCertificate(
  canvas: HTMLCanvasElement,
  data: CertificateData
): Promise<void> {
  await renderCertificate(canvas, data)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = certificateFileName(data.serial)
  a.click()
}
