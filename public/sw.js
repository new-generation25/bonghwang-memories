// 캐시하는 파일(오디오 포함)을 교체할 때는 반드시 이 버전을 올려야 한다.
// 버전이 같으면 기존 기기가 옛 캐시를 계속 쓴다.
const CACHE_NAME = 'bonghwang-memories-v1.1.1';
const urlsToCache = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 내레이션 음성 — 골목에서 신호가 끊겨도 재생되어야 하므로 미리 받아둔다.
// 아직 준비되지 않은 파일이 있을 수 있어 개별로 담고 실패는 무시한다.
// (addAll은 하나만 404여도 설치 전체가 실패한다)
const audioToCache = [
  '/audio/intro-soyoung.mp3',
  '/audio/prologue.m4a',
  '/audio/prologue.mp3',
  '/audio/mission-main-1-outro.m4a',
  '/audio/mission-main-2-outro.m4a',
  '/audio/mission-main-3-outro.m4a',
  '/audio/mission-main-4-outro.m4a',
  '/audio/mission-main-5-outro.m4a',
  '/audio/mission-sub-1-outro.m4a',
  '/audio/mission-sub-2-outro.m4a'
];

// Install - 정적 자원만 프리캐시하고 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(urlsToCache);
      await Promise.all(
        audioToCache.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 교차 출처(폰트, 네이버 지도 등)는 서비스 워커가 가로채지 않는다.
  // (가로채면 문서 CSP가 적용되어 외부 리소스가 차단되는 문제가 발생)
  if (new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // HTML 네비게이션은 네트워크 우선 → 새 배포/CSP가 즉시 반영된다.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // 그 외 동일 출처 정적 자원은 캐시 우선, 없으면 네트워크
  event.respondWith(caches.match(req).then((r) => r || fetch(req)));
});

// Activate - 옛 캐시 정리 후 열려있는 페이지를 즉시 제어
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null))))
      .then(() => self.clients.claim())
  );
});

// 수동 업데이트 트리거
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
