/**
 * 콘텐츠 가드 — 발견 시 종료 코드 1로 빌드를 막는다.
 *  - D6  : 병명('치매')은 텍스트·코드 어디에도 노출 금지. "깜빡깜빡"만 허용.
 *  - D6b : '미움/미워하다'는 전 대사·카피에서 금지.
 *          서운함·원망·"관심이 없는 줄 알았다"의 결로만 표현.
 *
 * 사용: npm run check:forbidden
 */

const fs = require('fs')
const path = require('path')

// '미워'는 '미워하다/미워했다/미워' 전부를 잡는다.
const FORBIDDEN = ['치매', '미움', '미워']
const TARGET_DIRS = ['src', 'public']
const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html'])

/**
 * 예외 표식 — 이 글자가 있는 줄은 넘어간다.
 *
 * 금지어를 **찾아내는 쪽**도 그 글자를 적어야 한다. 대본 고치기 화면이
 * 같은 목록을 들고 있는데, 검사기는 그 자리가 검사하는 자리인지 모르고
 * 잡아서 빌드를 멈췄다.
 *
 * **대본(.md)에는 먹지 않는다.** 코드에서만 열어둔다 — 대사에 표식 한 줄로
 * 금지어를 넣을 수 있게 되면 이 검사가 있으나 마나다.
 */
const ALLOW_MARK = 'forbidden-check:allow'
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

const hits = []

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      scan(full)
    } else if (TARGET_EXTS.has(path.extname(entry.name))) {
      const content = fs.readFileSync(full, 'utf8')
      const isCode = CODE_EXTS.has(path.extname(entry.name))
      const lines = content.split('\n')
      lines.forEach((line, i) => {
        if (isCode && line.includes(ALLOW_MARK)) return
        for (const word of FORBIDDEN) {
          if (line.includes(word)) {
            hits.push(`${full}:${i + 1} — "${word}"`)
          }
        }
      })
    }
  }
}

for (const dir of TARGET_DIRS) {
  if (fs.existsSync(dir)) scan(dir)
}

if (hits.length > 0) {
  console.error('🚫 금지어 발견 (D6 — 병명 노출 금지):')
  hits.forEach((h) => console.error('  ' + h))
  process.exit(1)
}
console.log('✅ D6 검사 통과 — 금지어 없음')
