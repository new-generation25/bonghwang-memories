/**
 * 계정 만들기를 여러 모양으로 돌려본다 — 에뮬레이터에서.
 *
 * 현장에서 "아이디에 밑줄(_)을 넣으면 계정이 안 만들어진다"는 보고가 나왔는데,
 * `validateLoginId()`의 규칙은 밑줄을 허용한다. 그렇다면 막힌 자리는 그 뒤다 —
 * 내부 이메일 변환(`{id}@bonghwang.local`)이거나 Firebase Auth 쪽이다.
 *
 * 화면을 거치지 않고 `signUp()`을 그대로 불러서, 어떤 아이디가 어떤 이유로
 * 막히는지 한 번에 본다. 운영 계정을 만들지 않고 잡을 수 있다.
 *
 *   npm run check:signup
 *
 * 에뮬레이터는 이 스크립트가 직접 띄운다(java 필요). 이미 떠 있으면
 * BH_EMU=1을 붙여 그 위에서 돌린다.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------------------------------------------------------------------------
// 에뮬레이터를 띄우고 나를 다시 부른다
// ---------------------------------------------------------------------------

/** JAVA_HOME이 서 있거나 PATH에 java가 있으면 그대로 쓴다 (run-rules-test와 같다) */
function javaReady() {
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin'))) return true
  try {
    execFileSync('java', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function findJavaHome() {
  const roots = [
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Amazon Corretto',
  ]
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const name of readdirSync(root)) {
      const home = join(root, name)
      if (existsSync(join(home, 'bin', 'java.exe'))) return home
    }
  }
  return null
}

if (!process.env.BH_EMU) {
  if (!javaReady()) {
    const home = findJavaHome()
    if (!home) {
      console.error(
        '\nJava를 찾지 못했습니다. 에뮬레이터가 Java로 돕니다.\n' +
          '  winget install --id Microsoft.OpenJDK.17\n'
      )
      process.exit(1)
    }
    process.env.JAVA_HOME = home
    process.env.PATH = `${join(home, 'bin')};${process.env.PATH}`
  }
  const bin = join('node_modules', '.bin', process.platform === 'win32' ? 'firebase.cmd' : 'firebase')
  const inner = 'node scripts/check-signup.mjs'
  execFileSync(
    process.platform === 'win32' ? 'cmd' : bin,
    process.platform === 'win32'
      ? ['/c', bin, 'emulators:exec', '--only', 'firestore,auth', inner]
      : ['emulators:exec', '--only', 'firestore,auth', inner],
    { stdio: 'inherit', env: { ...process.env, BH_EMU: '1' } }
  )
  process.exit(0)
}

// ---------------------------------------------------------------------------
// 앱의 auth.ts를 그대로 컴파일한다 (check-redeem과 같은 방식)
// ---------------------------------------------------------------------------

const OUT = join(process.cwd(), '.check-signup')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

execFileSync(
  process.execPath,
  [
    join('node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/auth.ts',
    '--outDir', OUT,
    '--module', 'commonjs',
    '--target', 'es2019',
    '--moduleResolution', 'node',
    '--skipLibCheck',
    '--esModuleInterop',
  ],
  { stdio: 'inherit' }
)

writeFileSync(join(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }))
// `./firebase`만 갈아끼운다 — 나머지는 앱 코드 그대로다
writeFileSync(
  join(OUT, 'firebase.js'),
  `Object.defineProperty(exports, 'db', { get: () => globalThis.__bhEmu.db })
Object.defineProperty(exports, 'auth', { get: () => globalThis.__bhEmu.auth })
exports.isFirebaseReady = () => true
`
)

// SDK는 앱과 같은 사본이어야 한다 — 다르면 Firestore 참조가 서로를 못 알아본다
const require = createRequire(pathToFileURL(join(OUT, 'x.cjs')))
const { initializeApp } = require('firebase/app')
const fbAuth = require('firebase/auth')
const fbStore = require('firebase/firestore')

const app = initializeApp({
  apiKey: 'fake-api-key',
  authDomain: 'localhost',
  projectId: 'bonghwang-memories',
  storageBucket: 'fake',
  messagingSenderId: '1',
  appId: '1',
})
const db = fbStore.getFirestore(app)
const auth = fbAuth.getAuth(app)
fbStore.connectFirestoreEmulator(db, '127.0.0.1', 8681)
fbAuth.connectAuthEmulator(auth, 'http://127.0.0.1:9399', { disableWarnings: true })
globalThis.__bhEmu = { db, auth }

const authLib = require('./auth.js')

// ---------------------------------------------------------------------------
// 표를 돌린다
// ---------------------------------------------------------------------------

/*
  기대값은 '규칙이 무엇을 허용하기로 했는가'다.
  ok = 계정이 만들어져야 한다 · reject = 우리 규칙이 미리 막아야 한다
*/
const CASES = [
  { id: 'walker01',      want: 'ok',     why: '평범한 아이디 — 기준선' },
  { id: 'my_name',       want: 'ok',     why: '밑줄 하나 (현장 보고)' },
  { id: '_leading',      want: 'ok',     why: '밑줄로 시작' },
  { id: 'trailing_',     want: 'ok',     why: '밑줄로 끝' },
  { id: 'a__b__c',       want: 'ok',     why: '밑줄 여럿' },
  { id: 'UpperCase',     want: 'ok',     why: '대문자 — 소문자로 접힌다' },
  { id: '2026start',     want: 'ok',     why: '숫자로 시작' },
  { id: 'abcd',          want: 'ok',     why: '최소 길이 4' },
  { id: 'a'.repeat(20),  want: 'ok',     why: '최대 길이 20' },
  { id: 'abc',           want: 'reject', why: '3자 — 너무 짧다' },
  { id: 'a'.repeat(21),  want: 'reject', why: '21자 — 너무 길다' },
  { id: '한글아이디',      want: 'reject', why: '한글' },
  { id: 'has space',     want: 'reject', why: '공백' },
  { id: 'dot.name',      want: 'reject', why: '마침표' },
  { id: 'plus+name',     want: 'reject', why: '더하기 — 이메일에서 뜻이 있는 글자' },
]

let failed = 0
const rows = []

for (const [i, c] of CASES.entries()) {
  // 닉네임은 중복 검사에 걸리므로 매번 다르게 준다
  const nickname = `시험${i}`
  const pre = authLib.validateLoginId(c.id)
  let got = 'ok'
  let detail = ''

  if (pre) {
    got = 'reject'
    detail = `우리 규칙: ${pre}`
  } else {
    try {
      await authLib.signUp(c.id, 'test1234', nickname)
      detail = '계정 생성됨'
    } catch (e) {
      got = 'error'
      detail = `${e.code || ''} ${e.message}`.trim()
    }
  }

  const pass = got === c.want
  if (!pass) failed++
  rows.push({ pass, id: c.id, want: c.want, got, why: c.why, detail })
}

console.log('\n계정 만들기 — 아이디 모양별\n')
for (const r of rows) {
  console.log(
    `  ${r.pass ? 'ok  ' : 'FAIL'} ${r.id.padEnd(22)} ${r.want}→${r.got.padEnd(7)} ${r.why}`
  )
  if (!r.pass || r.got === 'error') console.log(`       ${r.detail}`)
}

if (failed) {
  console.log(`\n❌ ${failed}건이 기대와 다릅니다.\n`)
  process.exit(1)
}
console.log('\n✅ 전부 기대대로입니다.\n')
