import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
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
        <link rel="apple-touch-icon" href="/icon-192x192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="봉황 메모리즈" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#8B4513" />
        {/* 네이버 지도 오류 처리 */}
        <script dangerouslySetInnerHTML={{
          __html: `
            window.naverMapLoadError = false;
            window.naverMapLoaded = false;
            
            // API 키 검증
            const clientId = '${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}';
            if (!clientId || clientId === 'undefined') {
              console.error('네이버 지도 API 키가 설정되지 않았습니다.');
              window.naverMapLoadError = true;
            }
            
            // 도메인 검증 (개발환경에서만)
            if (typeof window !== 'undefined' && window.location) {
              const currentDomain = window.location.hostname;
              console.log('현재 도메인:', currentDomain);
              console.log('네이버 지도 API 키:', clientId);
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
        
        {/* 네이버 지도 API - next/script 사용 */}
        <Script
          strategy="afterInteractive"
          src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}`}
          onLoad={() => {
            console.log('네이버 지도 API 로딩 성공');
            window.naverMapLoaded = true;
          }}
          onError={() => {
            console.error('네이버 지도 API 로딩 실패');
            window.naverMapLoadError = true;
          }}
        />
      </body>
    </html>
  )
}