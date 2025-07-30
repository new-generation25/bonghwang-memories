import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Vercel 환경에서만 활성화 (개발 및 프로덕션 모두)
  if (!process.env.VERCEL_URL && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Toolbox not available in this environment' }, { status: 404 });
  }

  const toolboxData = {
    environment: process.env.NODE_ENV,
    deployment: {
      url: process.env.VERCEL_URL,
      environment: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION,
      function: process.env.VERCEL_FUNCTION_REGION,
    },
    build: {
      time: process.env.BUILD_TIME,
      commit: process.env.VERCEL_GIT_COMMIT_SHA,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE,
    },
    app: {
      name: '봉황 메모리즈',
      version: '1.0.0',
      lastUpdate: new Date().toISOString(),
    },
    serviceWorker: {
      version: process.env.SW_VERSION || 'v1.0.0',
      cacheName: 'bonghwang-memories-cache',
    }
  };

  return NextResponse.json(toolboxData);
} 