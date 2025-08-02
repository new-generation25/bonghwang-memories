/** @type {import('next').NextConfig} */
const nextConfig = {
  // 개발 환경에서는 export 설정 완전 비활성화
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'export',
    trailingSlash: true,
    images: {
      unoptimized: true,
    },
  } : {
    // 개발 환경 설정 - export 관련 설정 제거
    images: {
      unoptimized: true,
    },
  }),
  
  // Environment variables
  env: {
    NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  
  // 개발 환경에서 빌드 오류 무시
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // CSP 헤더 - 개발 환경에서만 적용
  ...(process.env.NODE_ENV === 'development' && {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://apis.google.com https://accounts.google.com https://www.gstatic.com https://oapi.map.naver.com https://*.naver.com https://*.pstatic.net; connect-src 'self' https://*.googleapis.com https://apis.google.com https://accounts.google.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; object-src 'none'; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.googleapis.com https://bonghwang-memories.firebaseapp.com;"
            }
          ]
        }
      ]
    }
  })
}

module.exports = nextConfig