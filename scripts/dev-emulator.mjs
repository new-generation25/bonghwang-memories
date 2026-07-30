/**
 * 개발 서버를 에뮬레이터에 붙여 띄운다.
 *
 * 환경변수를 명령 앞에 붙이는 방식(`VAR=1 next dev`)은 윈도우 cmd에서
 * 동작하지 않고, 이 프로젝트는 두 자리를 오가므로 한쪽에서만 되는 방법을
 * 쓸 수 없다. `.env.development.local`에 두는 방법도 안 된다 — 그 파일은
 * 평소의 `npm run dev`에도 먹어서, 시험이 끝난 뒤 지우는 것을 잊으면
 * 앱이 조용히 빈 서버를 보게 된다.
 *
 * 켜두는 동안만 붙이고, 끄면 원래대로 돌아간다.
 *
 *   npm run dev:emulator
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'

console.log(
  '\n🧪 에뮬레이터에 붙여 띄웁니다 — 이 서버의 기록은 운영에 남지 않습니다.\n' +
    '   에뮬레이터가 먼저 떠 있어야 합니다:\n' +
    '     npx firebase emulators:start --only firestore,auth\n' +
    '   가게·계정을 심으려면:  npm run seed:emulator\n'
)

const next = join('node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next')
const child = spawn(
  process.platform === 'win32' ? 'cmd' : next,
  process.platform === 'win32'
    ? ['/c', next, 'dev', '-p', '3000']
    : ['dev', '-p', '3000'],
  {
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_USE_EMULATOR: '1' },
  }
)
child.on('exit', (code) => process.exit(code ?? 0))
