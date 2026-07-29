/**
 * 규칙 시험을 돌린다 — 에뮬레이터를 띄우고, 끝나면 내린다.
 *
 * 이 한 겹을 두는 이유는 Java 때문이다. Firestore 에뮬레이터는 Java로 도는데,
 * 이 프로젝트는 두 자리(사무실·집)를 외장하드로 오가므로 설치 위치가 같다는
 * 보장이 없고, 방금 설치한 자리에서는 이미 열려 있던 터미널의 PATH에 아직
 * 잡히지 않는다. 그때마다 "왜 안 되지"로 시간을 쓰지 않으려고 여기서 찾는다.
 *
 *   npm run test:rules
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** JAVA_HOME이 이미 서 있거나 PATH에 java가 있으면 그대로 쓴다 */
function javaReady() {
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin'))) return true
  try {
    execFileSync('java', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** 흔한 설치 자리를 훑는다 — winget으로 넣으면 첫 번째에 들어간다 */
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

if (!javaReady()) {
  const home = findJavaHome()
  if (!home) {
    console.error(
      '\nJava를 찾지 못했습니다. Firestore 에뮬레이터가 Java로 돕니다.\n' +
        '  winget install --id Microsoft.OpenJDK.17\n' +
        '설치한 뒤 터미널을 새로 열거나 그대로 다시 돌리세요.\n'
    )
    process.exit(1)
  }
  process.env.JAVA_HOME = home
  process.env.PATH = `${join(home, 'bin')};${process.env.PATH}`
  console.log(`Java를 찾았습니다 — ${home}`)
}

const bin = join('node_modules', '.bin', process.platform === 'win32' ? 'firebase.cmd' : 'firebase')
execFileSync(
  process.platform === 'win32' ? 'cmd' : bin,
  process.platform === 'win32'
    ? ['/c', bin, 'emulators:exec', '--only', 'firestore,auth', 'node --test tests/rules.test.mjs']
    : ['emulators:exec', '--only', 'firestore,auth', 'node --test tests/rules.test.mjs'],
  { stdio: 'inherit' }
)
