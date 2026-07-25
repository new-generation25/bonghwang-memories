const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 이 판이 어느 커밋인지.
 *
 * Vercel은 빌드할 때 커밋 해시를 환경변수로 준다. 로컬에서는 git에게
 * 직접 묻는다. 둘 다 없으면 빈 값으로 두고, 화면은 그 줄을 접는다 —
 * 없는 값을 '알 수 없음'이라 적어봐야 읽는 사람이 할 일이 없다.
 */
function commitHash() {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

// 현재 타임스탬프를 기반으로 한 버전 생성
const timestamp = Date.now();
const version = `v1.0.${timestamp}`;

// Service Worker 파일 경로
const swPath = path.join(__dirname, '../public/sw.js');

try {
  // Service Worker 파일 읽기
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // 캐시 이름 업데이트
  swContent = swContent.replace(
    /const CACHE_NAME = ['"]bonghwang-memories-[^'"]+['"];/,
    `const CACHE_NAME = 'bonghwang-memories-${version}';`
  );
  
  // 파일 다시 쓰기
  fs.writeFileSync(swPath, swContent, 'utf8');
  
  /*
    앱 번들에도 같은 버전을 심는다.

    앱이 자기 버전과 서버의 sw.js 버전을 견주어, 다르면 스스로 새로고침해
    최신 판을 받는다. 서비스워커가 갈아타는 것을 기다리지 않는 길이다 —
    그 생명주기는 브라우저마다 다르고 iOS PWA에서는 특히 굼뜨다.
  */
  const versionTs = path.join(__dirname, '../src/lib/buildVersion.ts');
  const commit = commitHash();
  fs.writeFileSync(
    versionTs,
    `/**
 * 이 판의 버전 — 빌드할 때마다 scripts/update-sw-version.js가 다시 쓴다.
 *
 * 손으로 고치지 마라. 서버의 sw.js에 박힌 값과 견주어 다르면 새 배포가
 * 있다는 뜻이고, 앱이 스스로 새로고침한다.
 */
export const BUILD_VERSION = '${version}'

/** 이 판이 어느 커밋인지 — 관리자 화면에서 반영 여부를 눈으로 가린다 */
export const BUILD_COMMIT = '${commit}'
`,
    'utf8'
  );

  console.log(`✅ Service Worker 버전 업데이트 완료: ${version}`);
  console.log(`📅 업데이트 시간: ${new Date().toLocaleString('ko-KR')}`);
  
} catch (error) {
  console.error('❌ Service Worker 버전 업데이트 실패:', error);
  process.exit(1);
} 