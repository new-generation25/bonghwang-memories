import type { Metadata, Viewport } from 'next'
import VercelToolbox from '@/components/VercelToolbox'
import './globals.css'

export const metadata: Metadata = {
  title: '봉황 메모리즈: 아버지의 유산을 찾아서',
  description: '봉황동의 역사와 문화를 스토리텔링과 게임형 미션을 통해 체험하는 인터랙티브 투어 앱',
  keywords: '봉황동, 메모리즈, 투어, 가족, 추억, 문화체험',
  openGraph: {
    title: '봉황 메모리즈: 아버지의 유산을 찾아서',
    description: '봉황동의 역사와 문화를 스토리텔링과 게임형 미션을 통해 체험하는 인터랙티브 투어 앱',
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
  // CSP 헤더 추가로 document.write 경고 방지
  other: {
    'Content-Security-Policy': "script-src 'self' 'unsafe-inline' https://oapi.map.naver.com https://*.naver.com; object-src 'none';"
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#8B4513',
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
        <meta name="theme-color" content="#8B4513" />
        
        {/* 네이버 지도 API 개선된 로딩 방식 - document.write 경고 해결 */}
        <script dangerouslySetInnerHTML={{
          __html: `
            window.naverMapLoadError = false;
            window.naverMapLoaded = false;
            window.naverMapLoading = false;
            
            // API 키 검증
            const clientId = '${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}';
            if (!clientId || clientId === 'undefined') {
              console.error('네이버 지도 API 키가 설정되지 않았습니다.');
              window.naverMapLoadError = true;
            }
            
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
              console.error('네이버 지도 API 인증 실패');
              window.naverMapLoadError = true;
              
              // 상세한 오류 정보 제공
              const currentDomain = window.location.hostname;
              console.error('인증 실패 상세 정보:');
              console.error('- 현재 도메인:', currentDomain);
              console.error('- API 키:', clientId);
              console.error('- User Agent:', navigator.userAgent);
              
              // 사용자에게 친화적인 메시지
              if (currentDomain.includes('vercel.app')) {
                console.warn('Vercel 도메인에서 인증 실패. 네이버 클라우드 플랫폼에서 도메인을 등록해주세요.');
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
              if (window.naverMapLoading || window.naverMapLoaded) return;
              
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
                console.error('네이버 지도 API 스크립트 로드 실패');
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
          `
        }} />
        
        {/* PWA Service Worker 등록 및 자동 업데이트 */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Service Worker 등록
            if ('serviceWorker' in navigator) {
              let refreshing = false;
              
              // 새로고침 중복 방지
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                  refreshing = true;
                  window.location.reload();
                }
              });
              
              // Service Worker 등록
              navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                  // 앱 시작 시 1회만 업데이트 확인
                  registration.update();
                  
                  // 업데이트 발견 시 처리
                  registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // 사용자에게 업데이트 알림
                        if (confirm('새로운 버전이 있습니다. 업데이트하시겠습니까?')) {
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                      }
                    });
                  });
                })
                .catch((error) => {
                  console.error('Service Worker 등록 실패:', error);
                });
            }
          `
        }} />
        
        {/* CSS 강제 로드 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Noto+Serif+KR:wght@400;700&display=swap');
            body { font-family: 'Noto Sans KR', sans-serif; }
          `
        }} />
      </head>
      <body className="min-h-screen" style={{
        background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))'
      }}>
        {children}
        <VercelToolbox />
      </body>
    </html>
  )
}