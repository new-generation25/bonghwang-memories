import type { Metadata, Viewport } from 'next'
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
        
        {/* 네이버 지도 API 개선된 로딩 방식 */}
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
            
            // 개선된 네이버 지도 API 로딩 함수
            window.loadNaverMapAPI = function() {
              if (window.naverMapLoading || window.naverMapLoaded) return;
              
              window.naverMapLoading = true;
              console.log('네이버 지도 API 로딩 시작...');
              
              // 동적 스크립트 로딩 (document.write 대신)
              const script = document.createElement('script');
              script.type = 'text/javascript';
              script.async = true;
              script.defer = true;
              script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + clientId + '&callback=initNaverMap&submodules=geocoder';
              
              script.onload = function() {
                console.log('네이버 지도 API 스크립트 로드 완료');
              };
              
              script.onerror = function() {
                console.error('네이버 지도 API 스크립트 로드 실패');
                window.naverMapLoadError = true;
                window.naverMapLoading = false;
              };
              
              document.head.appendChild(script);
            };
            
            // 페이지 로드 완료 후 API 로딩 시작
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', window.loadNaverMapAPI);
            } else {
              window.loadNaverMapAPI();
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
      </body>
    </html>
  )
}