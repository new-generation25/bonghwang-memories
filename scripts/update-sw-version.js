const fs = require('fs');
const path = require('path');

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
  
  console.log(`✅ Service Worker 버전 업데이트 완료: ${version}`);
  console.log(`📅 업데이트 시간: ${new Date().toLocaleString('ko-KR')}`);
  
} catch (error) {
  console.error('❌ Service Worker 버전 업데이트 실패:', error);
  process.exit(1);
} 