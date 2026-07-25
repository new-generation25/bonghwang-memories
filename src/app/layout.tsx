import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import PointToast from '@/components/PointToast'
import SuperAdminBar from '@/components/SuperAdminBar'

export const metadata: Metadata = {
  title: '봉황 메모리즈 — 봉황 메모리즈 EP.1 「아버지의 믹스테이프」',
  description:
    '골목에 남겨진 카세트테이프와 손글씨 쪽지 한 장. 1988년 아버지가 태어날 딸에게 남긴 다섯 가지 소원을 따라 걷는 90분 오디오 드라마 투어.',
  keywords: '봉황동, 봉황 메모리즈, 로컬 메모리즈, 오디오 드라마 투어, 워킹투어, 김해, 믹스테이프',
  openGraph: {
    title: '봉황 메모리즈 — 봉황 메모리즈 EP.1 「아버지의 믹스테이프」',
    description:
      '골목에 남겨진 카세트테이프와 손글씨 쪽지 한 장. 아버지의 다섯 가지 소원을 따라 걷는 90분 오디오 드라마 투어.',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '봉황 메모리즈',
  },
  formatDetection: {
    telephone: false,
  },
  // CSP 헤더 추가로 document.write 경고 방지 (unsafe-eval 추가)
  other: {
    'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.naver.com http://*.naver.com https://*.naver.net http://*.naver.net https://*.pstatic.net http://*.pstatic.net; object-src 'none';",
    'vercel-toolbar': 'true'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2E8A80', // P3 딥 티얼 — 구조색
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="봉황 메모리즈" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#2E8A80" />
        
        {/* 네이버 지도 API 개선된 로딩 방식 - document.write 경고 해결 */}
        <script dangerouslySetInnerHTML={{
          __html: `
            window.naverMapLoadError = false;
            window.naverMapLoaded = false;
            window.naverMapLoading = false;
            
            // API 키 검증
            const clientId = '${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}';
            if (!clientId || clientId === 'undefined') {
              console.warn('네이버 지도 API 키가 설정되지 않았습니다. 지도 기능이 비활성화됩니다.');
              window.naverMapLoadError = true;
              // API 키가 없으면 지도 로딩 함수 실행하지 않음
            } else {
              // API 키가 있을 때만 지도 로딩 로직 실행
            
            // 도메인 검증 (개발환경에서만)
            if (typeof window !== 'undefined' && window.location) {
              const currentDomain = window.location.hostname;
              const currentUrl = window.location.href;
              const currentProtocol = window.location.protocol;
              console.log('=== 네이버 지도 API 도메인 정보 ===');
              console.log('현재 도메인:', currentDomain);
              console.log('현재 URL:', currentUrl);
              console.log('현재 프로토콜:', currentProtocol);
              console.log('네이버 지도 API 키:', clientId);
              console.log('================================');
            }
            
            // 네이버 지도 인증 실패 처리 (공식 문서 권장 방식)
            window.navermap_authFailure = function () {
              console.warn('네이버 지도 API 인증 실패 - 개발 환경에서는 정상적인 현상입니다.');
              window.naverMapLoadError = true;
              
              // 상세한 오류 정보 제공 (개발환경에서만)
              const currentDomain = window.location.hostname;
              if (currentDomain === 'localhost' || currentDomain === '127.0.0.1') {
                console.info('로컬 개발 환경에서는 네이버 지도 API 인증이 제한됩니다.');
                console.info('배포 환경에서 도메인을 등록하면 정상 작동합니다.');
              } else {
                console.error('인증 실패 상세 정보:');
                console.error('- 현재 도메인:', currentDomain);
                console.error('- API 키:', clientId);
              }
            };
            
            // 네이버 지도 로딩 완료 처리 (공식 문서 권장 방식)
            window.initNaverMap = function () {
              console.log('네이버 지도 API 로딩 완료');
              window.naverMapLoaded = true;
              window.naverMapLoading = false;
            };
            
            // 개선된 네이버 지도 API 로딩 함수 - document.write 경고 해결
            window.loadNaverMapAPI = function() {
              if (window.naverMapLoading || window.naverMapLoaded || window.naverMapLoadError) return;

              window.naverMapLoading = true;
              console.log('네이버 지도 API 로딩 시작...');
              
              // 동적 스크립트 로딩 (document.write 대신 createElement 사용)
              const script = document.createElement('script');
              script.type = 'text/javascript';
              script.async = true;
              script.defer = true;
              script.crossOrigin = 'anonymous';
              
              // URL 파라미터를 안전하게 구성
              const apiUrl = new URL('https://oapi.map.naver.com/openapi/v3/maps.js');
              apiUrl.searchParams.set('ncpKeyId', clientId);
              apiUrl.searchParams.set('callback', 'initNaverMap');
              apiUrl.searchParams.set('submodules', 'geocoder');
              
              script.src = apiUrl.toString();
              
              script.onload = function() {
                console.log('네이버 지도 API 스크립트 로드 완료');
              };
              
              script.onerror = function() {
                console.warn('네이버 지도 API 스크립트 로드 실패 - 개발 환경에서는 정상입니다.');
                window.naverMapLoadError = true;
                window.naverMapLoading = false;
              };
              
              // 스크립트를 head에 추가
              document.head.appendChild(script);
            };
            
              // 페이지 로드 완료 후 API 로딩 시작 (지연 로딩)
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                  // 약간의 지연을 두어 페이지 렌더링 최적화
                  setTimeout(window.loadNaverMapAPI, 100);
                });
              } else {
                setTimeout(window.loadNaverMapAPI, 100);
              }
            } // API 키 검증 else 블록 종료
          `
        }} />
        
        {/* PWA Service Worker 등록 및 자동 업데이트 */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Service Worker 등록
            if ('serviceWorker' in navigator) {
              const swHost = window.location.hostname;
              const isLocalhost = swHost === 'localhost' || swHost === '127.0.0.1';

              if (isLocalhost) {
                // 개발 환경: 서비스 워커가 오래된 페이지/CSP를 캐시하면 서버 변경이
                // 반영되지 않으므로, 등록을 건너뛰고 기존 워커와 캐시를 정리한다.
                navigator.serviceWorker.getRegistrations().then((regs) => {
                  regs.forEach((reg) => reg.unregister());
                });
                if (window.caches && caches.keys) {
                  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
                }
              } else {
              let refreshing = false;

              /*
                갈아탄 뒤 새로고침한다. 그 새로고침이 곧 화면이 한 번
                깜빡이는 일이라, 무슨 일이 있었는지 다음 화면에 한 줄
                남긴다 — 까닭 없이 깜빡이면 앱이 흔들린 줄 안다.
              */
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                  refreshing = true;
                  try { sessionStorage.setItem('bh_updated', '1'); } catch (e) {}
                  window.location.reload();
                }
              });

              /*
                새 버전으로 갈아타는 시점을 페이지가 정한다.

                묻지 않는다. 예전에는 confirm으로 물었는데, sw.js가 설치와
                동시에 스스로 활성화하는 바람에 묻기도 전에 새로고침되는
                일이 잦았다 — "어떤 때는 물어보고 어떤 때는 안 물어보는"
                것이 그래서였다. 이제 워커는 기다리고, 갈아탈 자리는
                여기서 고른다.

                갈아타는 자리는 '앱을 여는 순간' 하나뿐이다. 쓰는 도중에
                새 버전을 발견해도 손대지 않는다 — 사진을 찍던 중이거나
                미션을 풀던 중에 새로고침되면 하던 것이 날아간다. 다음에
                앱을 열 때 조용히 반영된다.
              */
              // 이 스크립트가 도는 지금이 곧 '앱을 여는 순간'이다.
              // 이후(visibilitychange 등)에 발견한 것은 받아만 두고 넘긴다.
              let atStartup = true;

              const applyUpdate = (reg) => {
                if (!reg.waiting) return;
                if (!atStartup) return;
                if (window.__bhPlaying) return;
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              };

              navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                  // 지난번에 받아두고 아직 못 갈아탄 버전이 있으면 지금 적용한다.
                  // updatefound는 '새로 설치될 때'만 오므로 이 확인이 없으면
                  // 이미 대기 중인 새 버전을 영영 놓친다.
                  applyUpdate(registration);
                  registration.update();

                  registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        applyUpdate(registration);
                      }
                    });
                  });

                  /*
                    시작 순간이 지나면 받아두기만 한다.

                    화면이 그려지고 나면 사용자는 이미 무언가를 하고 있다.
                    그때 새로고침하면 하던 것이 날아가므로, 새 버전은
                    받아두고 다음에 앱을 열 때 갈아탄다.
                  */
                  setTimeout(() => { atStartup = false; }, 3000);

                  /*
                    앱으로 돌아올 때마다 확인만 해둔다.

                    홈 화면에서 띄운 PWA는 좀처럼 죽지 않아서, 등록할 때 한 번
                    본 것이 며칠 전 확인일 수 있다. 미리 받아두면 다음 실행이
                    곧바로 최신이 된다.
                  */
                  document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState !== 'visible') return;
                    registration.update();
                  });
                })
                .catch((error) => {
                  console.warn('Service Worker 등록 실패:', error.message);
                  console.info('PWA 기능이 비활성화됩니다. 프로덕션 환경에서는 정상 작동합니다.');
                });
              }
            }
          `
        }} />
        
        {/* CSS 강제 로드 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Nanum+Pen+Script&family=Noto+Sans+KR:wght@300;400;500;700;900&family=Noto+Serif+KR:wght@600;900&family=Nanum+Gothic+Coding&display=swap');
            body { font-family: 'Noto Sans KR', sans-serif; }
          `
        }} />
      </head>
      <body className="min-h-screen bg-cream-base">
        <AuthProvider>
          {children}
          <PointToast />
          {/* 켜져 있을 때만 그려진다 — 참여자에게는 존재하지 않는 것과 같다 */}
          <SuperAdminBar />
        </AuthProvider>
      </body>
    </html>
  )
}