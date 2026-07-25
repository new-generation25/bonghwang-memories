// 캐시하는 파일(오디오 포함)을 교체할 때는 반드시 이 버전을 올려야 한다.
// 버전이 같으면 기존 기기가 옛 캐시를 계속 쓴다.
const CACHE_NAME = 'bonghwang-memories-v1.0.1784991800175';
const urlsToCache = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

/*
  설치 때 담는 것 — 그림과 효과음만.

  번들 오디오는 여기서 빼고 앱이 순서대로 받는다(인트로 먼저). 설치가
  10MB를 기다리면 새 버전으로 갈아타는 것도 그만큼 늦어진다.
*/
const assetsToCache = [
  // SFX (선택 — 없으면 조용히 생략)
  '/audio/sfx/tape_hiss.mp3',
  '/audio/sfx/tape_stop.mp3',
  '/audio/sfx/call_ring.mp3',
  // 데크 키음 — 오프라인에서도 버튼 피드백이 있어야 한다
  '/audio/sfx/deck-key.wav',
  // M3 능소화 정적 프레임 (D11 폴백)
  '/images/neungsohwa-overlay.png',
  // 등장인물 얼굴 — 통화·테이프 화면에 뜬다. 골목에서 신호가 약할 때
  // 얼굴만 빈 칸으로 남으면 인물이 사라진 것처럼 보인다.
  '/images/cast/father.png',
  '/images/cast/soyoung.png',
  '/images/cast/shopkeeper1.png',
  '/images/cast/shopkeeper2.png',
  // 거점 그림 — 골목에서 신호가 약해도 '여기가 맞나' 대조할 수 있어야 한다
  '/images/place/t1.png',
  '/images/place/t2.png',
  '/images/place/t3.png',
  '/images/place/t4.png'
];

/*
  Install — 프리캐시만 하고 기다린다.

  전에는 여기서 곧바로 skipWaiting()을 불렀다. 그러면 새 버전이 설치되는
  순간 스스로 활성화되어, 페이지가 "업데이트하시겠습니까"를 띄우기도 전에
  controllerchange가 나고 조용히 새로고침돼 버렸다. 어느 쪽이 먼저냐가
  그때그때 달라서, 어떤 날은 묻고 어떤 날은 묻지 않았다.

  이제는 대기 상태로 남아 있다가 페이지가 SKIP_WAITING을 보낼 때만
  넘어간다. 언제 갈아탈지는 페이지가 정한다 — 이야기가 재생 중이면
  끊지 않고 미룬다.
*/
self.addEventListener('install', (event) => {
  /*
    설치 때는 뼈대만 담는다.

    전에는 여기서 오디오 26개(10MB)를 통째로 받았다. 앱도 같은 파일을
    받고 있으니 같은 것을 두 번 내려받는 셈이고, 설치가 끝나야 새
    버전으로 갈아탈 수 있어 업데이트도 그만큼 늦어졌다.

    오디오는 앱이 순서대로 받고(인트로 먼저), 못 받은 것은 PRECACHE_AUDIO
    메시지로 이 워커가 마저 받는다.
  */
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(urlsToCache);
      await Promise.all(
        assetsToCache.map((url) => cache.add(url).catch(() => null))
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

// 수동 업데이트 트리거 + 나머지 오디오 뒤늦게 받기
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  /*
    인트로 뒤의 오디오를 화면과 무관하게 받아둔다.

    받는 일을 페이지에만 맡기면 다른 화면으로 넘어가는 순간 요청이
    끊길 수 있다. 워커는 화면이 바뀌어도 살아 있으므로 여기서도 같은
    일을 한다 — 이미 캐시에 있으면 건너뛰니 두 번 받지 않는다.
  */
  if (event.data.type === 'PRECACHE_AUDIO' && Array.isArray(event.data.names)) {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        for (const name of event.data.names) {
          for (const ext of ['m4a', 'mp3']) {
            const url = `/audio/${name}.${ext}`;
            if (await cache.match(url)) break;
            try {
              const res = await fetch(url);
              if (res.ok) {
                await cache.put(url, res.clone());
                break;
              }
            } catch (e) {
              // 이 확장자는 없거나 네트워크 오류 — 다음으로
            }
          }
        }
      })
    );
  }
});
