/**
 * 대본과 코드 사이를 오간다 — docs/SCRIPT.md ↔ src/lib/cues.ts.
 *
 *   node scripts/script.mjs apply [--dry-run]   md → cues.ts (평소 쓰는 쪽)
 *   node scripts/script.mjs dump                cues.ts → md (큐를 새로 만든 뒤)
 *
 * SCRIPT.md가 대사의 원본이다. 예전에는 cues.ts가 원본이고 md는 뽑아낸
 * 사본이라, 글을 고치면 사람이 손으로 옮겨 적어야 했다. 그 한 칸 때문에
 * "문서를 고치면 나머지가 따라온다"가 성립하지 않았다.
 *
 * 산문은 건드리지 않는다. '# 대본' 표식 앞은 사람이 쓰는 자리이고 뒤만
 * 기계가 읽고 쓴다.
 *
 * 파이썬으로 쓰지 않은 이유: 이 저장소는 두 대의 컴퓨터를 외장하드로
 * 오가는데, 한쪽에서 python이 WindowsApps 스텁에 가려 실행되지 않았다.
 * npm 스크립트로 엮이는 도구가 그 자리에서 끊기면 자동화가 의미가 없다.
 */

import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const SCRIPT = path.join(ROOT, 'docs', 'SCRIPT.md')
const CUES = path.join(ROOT, 'src', 'lib', 'cues.ts')

/** 이 줄부터 기계가 읽고 쓴다 */
const MARKER = '# 대본'

const NAMES = {
  father: '아버지',
  soyoung: '소영',
  shopkeeper1: '봉황1935 사장님',
  shopkeeper2: '방하림 사장님',
  dj_father: '라디오',
  father_soyoung: '아버지·소영',
}

// 큐 ID만으로는 어디서 나오는 대사인지 알 수 없어 사람이 읽을 이름을 붙인다
const WHERE = {
  B0_TAPE: '인트로 · 테이프',
  B0_CALL: '인트로 · 첫 통화',
  B1_A: 'A1 봉황1935 · 도착',
  B1_OK: 'A1 · 개수 정답',
  B1_S: 'A1 · 사장님 증언',
  B1_B: 'A1 · 완료',
  B2_A: 'A2 미야상회 · 도착',
  B2_B: 'A2 · 완료',
  B3_A: 'A3 능소화 고택 · 도착',
  B3_B: 'A3 · 완료',
  B4_A: 'A4 카페 탱자 · 도착',
  B4_RADIO: 'A4 · 1988년 라디오',
  B4_B: 'A4 · 완료',
  B4_C: 'A4 · 다음 안내',
  B5_A: 'A5 방하림 · 도착',
  B5_T1: 'A5 · 여쭤보기 전',
  B5_T2: 'A5 · 사장님 증언',
  B5_T3: 'A5 · B면 안내',
  B5_LETTER: 'B면 · 아버지의 편지',
  B5_F: 'A5 · 1막 마무리',
  B6_0: '2막 · 빙고 시작',
  B6_X_BUNSIK: '빙고 · 분식점',
  B6_X_BYEOKHWA: '빙고 · 벽화골목',
  B6_X_BONGHWANGDAE: '빙고 · 봉황대',
  B7_0: '피날레',
  B7_1: '에필로그(선택)',
}

const die = (msg) => {
  process.stderr.write(msg.endsWith('\n') ? msg : msg + '\n')
  process.exit(1)
}

/**
 * 줄끝 다루기 — cues.ts는 CRLF, SCRIPT.md는 LF다.
 *
 * 정규식은 \n만 보므로 읽을 때 LF로 맞추고, 쓸 때 원래대로 돌려놓는다.
 * 안 그러면 한 줄만 고쳐도 파일 전체가 바뀐 것으로 잡혀 diff를 못 읽는다.
 */
function readText(file) {
  const raw = fs.readFileSync(file, 'utf8')
  return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') }
}

function writeText(file, text, crlf) {
  fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text)
}

// ---------------------------------------------------------------------------
// cues.ts 읽기
// ---------------------------------------------------------------------------

/** 대사에 따옴표가 섞여 있어(작은·큰 양쪽) 두 형태를 모두 본다 */
const SQ = /text:\s*'((?:[^'\\]|\\.)*)'/
const DQ = /text:\s*"((?:[^"\\]|\\.)*)"/

const unescape = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"')

/**
 * cues.ts를 실행하지 않고 글자만 읽는다 — TypeScript라 그냥 불러올 수 없고,
 * 대본 하나 오가자고 빌드 도구를 얹을 이유가 없다.
 *
 * 되쓰기가 자리를 찾아야 하므로 블록의 시작·끝 위치도 함께 돌려준다.
 */
function readCues(src) {
  const from = src.indexOf('export const CUES')
  if (from < 0) die('cues.ts에서 export const CUES를 찾지 못했다.')

  const re = /\n {2}([A-Z0-9_]+): \{\n([\s\S]*?)\n {2}\},\n/g
  re.lastIndex = from

  const cues = []
  let m
  while ((m = re.exec(src))) {
    const [whole, id, blk] = m
    const speaker = /speaker: '([^']+)'/.exec(blk)
    const audioFile = /audioFile: '([^']+)'/.exec(blk)
    const sl = /subtitleLines: \[([\s\S]*?)\n {4}\]/.exec(blk)

    const lines = []
    if (sl) {
      for (const seg of sl[1].match(/\{[^{}]*?\}/g) ?? []) {
        const t = SQ.exec(seg) ?? DQ.exec(seg)
        if (t) lines.push(unescape(t[1]))
      }
    }

    cues.push({
      id,
      speaker: speaker ? speaker[1] : '',
      audioFile: audioFile ? audioFile[1] : '',
      lines,
      hasLines: Boolean(sl),
      // 블록 안에서의 subtitleLines 절대 위치 — 되쓰기가 여기만 갈아끼운다
      slStart: sl ? m.index + whole.indexOf(sl[0]) : -1,
      slEnd: sl ? m.index + whole.indexOf(sl[0]) + sl[0].length : -1,
    })
  }
  return cues
}

/**
 * 대사에 작은따옴표가 흔하다 — '이게… 내 마음이오.' 같은 인용.
 * 그럴 때는 큰따옴표로 감싼다. cues.ts가 이미 쓰는 방식이라 그대로 따른다.
 */
function quote(text) {
  const hasS = text.includes("'")
  const hasD = text.includes('"')
  if (hasS && !hasD) return `"${text}"`
  if (hasS && hasD) return `'${text.replace(/'/g, "\\'")}'`
  return `'${text}'`
}

const renderLines = (lines) =>
  'subtitleLines: [\n' +
  lines.map((t) => `      { text: ${quote(t)} },`).join('\n') +
  '\n    ]'

// ---------------------------------------------------------------------------
// SCRIPT.md 읽기
// ---------------------------------------------------------------------------

/** 표식 앞의 산문. 표식이 없으면 멈춘다 — 덮어쓰면 산문이 날아간다 */
function splitHead(md) {
  const m = new RegExp(`^${MARKER}\\s*$`, 'm').exec(md)
  if (!m) {
    die(
      `docs/SCRIPT.md에 '${MARKER}' 표식이 없다.\n` +
        `이 표식 앞은 사람이 쓴 산문이고 뒤만 기계가 갈아끼운다.\n` +
        `표식 없이 덮어쓰면 산문이 날아가므로 멈춘다.`
    )
  }
  return { head: md.slice(0, m.index), body: md.slice(m.index + m[0].length) }
}

const CUE_HEAD = /^`([A-Z0-9_]+)` · .+? · `([a-z0-9_]+)\.mp3`\s*$/
const NUMBERED = /^(\d+)\.\s+(.*)$/

/**
 * 「대본」 절을 읽는다.
 *
 * 번호가 없는 채로 대사를 끼워 넣으면 조용히 사라지는 것이 가장 무섭다.
 * 그래서 큐 안에서 번호도 제목도 아닌 줄을 만나면 멈춘다.
 */
function parseScript(body) {
  const out = new Map()
  let cur = null

  for (const raw of body.split('\n')) {
    const line = raw.trimEnd()

    if (CUE_HEAD.test(line)) {
      const [, id] = CUE_HEAD.exec(line)
      if (out.has(id)) die(`대본에 ${id}가 두 번 나온다.`)
      cur = []
      out.set(id, cur)
      continue
    }

    if (line.startsWith('#')) {
      cur = null // 제목 — 큐 사이의 구분
      continue
    }

    if (!line.trim()) continue
    if (!cur) continue // 큐가 시작되기 전의 글은 지나친다

    const n = NUMBERED.exec(line)
    if (!n) {
      die(
        `대본에서 번호가 없는 줄을 만났다:\n  ${line}\n` +
          `대사는 "1. 내용" 꼴이어야 한다. 번호를 붙이거나, 설명이라면\n` +
          `'${MARKER}' 표식 위 산문 쪽으로 옮겨라.`
      )
    }
    cur.push(n[2].trim())
  }
  return out
}

// ---------------------------------------------------------------------------
// apply — md → cues.ts
// ---------------------------------------------------------------------------

const stripBr = (s) => s.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()

function apply(dry) {
  const { body } = splitHead(readText(SCRIPT).text)
  const want = parseScript(body)

  const { text: src, crlf } = readText(CUES)
  const cues = readCues(src)
  const have = new Map(cues.map((c) => [c.id, c]))

  // 큐의 뼈대(trigger·next·ui)는 md가 표현하지 못한다 — 집합이 어긋나면 멈춘다
  const onlyMd = [...want.keys()].filter((id) => !have.has(id))
  const onlyTs = [...have.keys()].filter((id) => !want.has(id))
  if (onlyMd.length || onlyTs.length) {
    const parts = []
    if (onlyMd.length) parts.push(`대본에만 있는 큐: ${onlyMd.join(', ')}`)
    if (onlyTs.length) parts.push(`cues.ts에만 있는 큐: ${onlyTs.join(', ')}`)
    die(
      parts.join('\n') +
        `\n\n큐를 늘리거나 지우는 것은 이 문서로 못 한다.\n` +
        `trigger·next·ui·channel은 대본이 표현하지 못하기 때문이다.\n` +
        `cues.ts에서 먼저 만든 뒤 'node scripts/script.mjs dump'로 대본을 따라오게 하라.`
    )
  }

  const edits = [] // { cue, lines }
  const report = { br: [], text: [], count: [] }

  for (const [id, lines] of want) {
    const cue = have.get(id)
    if (!cue.hasLines) continue
    const old = cue.lines

    if (lines.length !== old.length) {
      report.count.push({ id, from: old.length, to: lines.length })
      edits.push({ cue, lines })
      continue
    }

    let brOnly = 0
    let changed = 0
    lines.forEach((t, i) => {
      if (t === old[i]) return
      if (stripBr(t) === stripBr(old[i])) brOnly++
      else changed++
    })

    if (!brOnly && !changed) continue
    if (changed) report.text.push({ id, n: changed, br: brOnly })
    else report.br.push({ id, n: brOnly })
    edits.push({ cue, lines })
  }

  if (!edits.length) {
    process.stdout.write('변경 없음 — cues.ts는 대본과 같다.\n')
    return
  }

  // 보고
  for (const r of report.br) {
    process.stdout.write(`${r.id.padEnd(18)} 줄바꿈 ${r.n}곳 — 굽지 않아도 된다\n`)
  }
  for (const r of report.text) {
    const extra = r.br ? ` (+ 줄바꿈 ${r.br}곳)` : ''
    process.stdout.write(`${r.id.padEnd(18)} 대사 ${r.n}줄 바뀜${extra} — 그 줄만 다시 굽힌다\n`)
  }
  for (const r of report.count) {
    process.stdout.write(
      `${r.id.padEnd(18)} 줄 수 ${r.from} → ${r.to} — ★ 이 큐는 통째로 다시 굽고 길이를 다시 잰다\n`
    )
  }

  if (dry) {
    process.stdout.write('\n--dry-run — 아무것도 고치지 않았다.\n')
    if (report.count.length) {
      process.stdout.write('줄 수가 바뀐 큐가 있다. 굽기 뒤 fix-durations가 durationSec을 맞춘다.\n')
    }
    return
  }

  // 뒤에서부터 갈아끼운다 — 앞을 먼저 고치면 뒤 큐의 위치가 밀린다
  let next = src
  for (const { cue, lines } of [...edits].sort((a, b) => b.cue.slStart - a.cue.slStart)) {
    next = next.slice(0, cue.slStart) + renderLines(lines) + next.slice(cue.slEnd)
  }
  writeText(CUES, next, crlf)

  process.stdout.write(`\n${edits.length}개 큐를 cues.ts에 반영했다.\n`)
  if (report.count.length) {
    process.stdout.write('줄 수가 바뀐 큐가 있다 — 굽기 뒤 durationSec을 다시 잰다.\n')
  }
}

// ---------------------------------------------------------------------------
// dump — cues.ts → md (「대본」 절만)
// ---------------------------------------------------------------------------

function dump() {
  const cues = readCues(readText(CUES).text)
  const { text: md, crlf } = readText(SCRIPT)
  const { head } = splitHead(md)

  const out = []
  for (const c of cues) {
    out.push(`## ${WHERE[c.id] ?? c.id}`, '')
    out.push(`\`${c.id}\` · ${NAMES[c.speaker] ?? c.speaker} · \`${c.audioFile}.mp3\``, '')
    c.lines.forEach((t, i) => out.push(`${i + 1}. ${t}`))
    out.push('')
  }

  writeText(SCRIPT, `${head}${MARKER}\n\n${out.join('\n')}`, crlf)
  const total = cues.reduce((n, c) => n + c.lines.length, 0)
  process.stdout.write(`큐 ${cues.length}개 · ${total}줄 -> docs/SCRIPT.md (산문 보존)\n`)
}

// ---------------------------------------------------------------------------

const cmd = process.argv[2]
if (cmd === 'apply') apply(process.argv.includes('--dry-run'))
else if (cmd === 'dump') dump()
else die('쓰는 법:\n  node scripts/script.mjs apply [--dry-run]\n  node scripts/script.mjs dump')
