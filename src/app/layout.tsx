import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '봉황동 메모리즈: 아버지의 유산을 찾아서',
  description: '봉황동의 역사와 문화를 스토리텔링과 게임형 미션을 통해 체험하는 인터랙티브 투어 앱',
  keywords: '봉황동, 메모리즈, 투어, 가족, 추억, 문화체험',
  openGraph: {
    title: '봉황동 메모리즈: 아버지의 유산을 찾아서',
    description: '봉황동의 역사와 문화를 스토리텔링과 게임형 미션을 통해 체험하는 인터랙티브 투어 앱',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
      </head>
      <body className="min-h-screen bg-vintage-paper">
        {children}
      </body>
    </html>
  )
}