// 캐시하는 파일(오디오 포함)을 교체할 때는 반드시 이 버전을 올려야 한다.
// 버전이 같으면 기존 기기가 옛 캐시를 계속 쓴다.
const CACHE_NAME = 'bonghwang-memories-v1.0.1784654346885';
const urlsToCache = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 큐 오디오 — 골목에서 신호가 끊겨도 재생되어야 하므로 미리 받아둔다(D8).
// 파일명은 src/lib/cues.ts의 audioFile과 1:1 대응. 아직 준비되지 않은
// 파일이 있을 수 있어 개별로 담고 실패는 무시한다.
// (addAll은 하나만 404여도 설치 전체가 실패한다)
const CUE_AUDIO_NAMES = [
  // INTRO
  'c0_a', 'c0_b', 'c0_c',
  // TRACK 1~5
  'c1_1', 'c1_2', 'c1_3', 'c1_4', 'c1_5',
  'c2_1', 'c2_2', 'c2_3', 'c2_4',
  'c3_1', 'c3_2', 'c3_3', 'c3_4',
  'c4_1', 'c4_2', 'c4_3', 'c4_4', 'c4_5',
  'c5_1', 'c5_2', 'c5_3', 'c5_4', 'c5_5',
  // ACT 2 + FINALE
  'c6_0', 'c6_x_bunsik', 'c6_x_byeokhwa', 'c6_x_bonghwangdae',
  'c7_0', 'c7_1',
  // 구 파일명 별칭 (C0_C)
  'intro-soyoung'
];

const audioToCache = CUE_AUDIO_NAMES.flatMap((name) => [
  `/audio/${name}.m4a`,
  `/audio/${name}.mp3`
]).concat([
  // SFX (선택 — 없으면 조용히 생략)
  '/audio/sfx/tape_hiss.mp3',
  '/audio/sfx/tape_stop.mp3',
  '/audio/sfx/call_ring.mp3',
  // M3 능소화 정적 프레임 (D11 폴백)
  '/images/neungsohwa-overlay.png'
]);

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
