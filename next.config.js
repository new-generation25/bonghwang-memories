/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 배포를 위한 설정
  images: {
    unoptimized: true,
  },
  
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
  
  // 빌드 오류 무시
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  /*
    CSP 헤더 설정.

    blob:이 img-src·media-src에 있어야 한다. 사진을 고르면 올리기 전에
    URL.createObjectURL로 미리보기를 띄우고(PostComposer), '나의 육십 초'
    녹음도 blob URL로 되듣는다(RecorderBside). 빠뜨리면 개발 서버에서는
    멀쩡한데 배포본에서만 미리보기가 통째로 막힌다 — 실제로 그랬다.

    media-src를 따로 적는 이유는 default-src 'self'로 떨어지면 blob:
    오디오가 함께 막히기 때문이다.
  */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://apis.google.com https://accounts.google.com https://www.gstatic.com https://*.naver.com http://*.naver.com https://*.naver.net http://*.naver.net https://*.pstatic.net http://*.pstatic.net; connect-src 'self' https://*.googleapis.com https://apis.google.com https://accounts.google.com https://*.firebaseapp.com https://*.naver.com http://*.naver.com https://*.naver.net http://*.naver.net https://*.pstatic.net http://*.pstatic.net https://*.navercorp.com https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https: http://*.naver.net http://*.naver.com http://*.pstatic.net; media-src 'self' blob:; object-src 'none'; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.googleapis.com https://bonghwang-memories.firebaseapp.com;"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig