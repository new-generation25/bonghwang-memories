import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // 개발 환경에서만 Vercel Toolbox 활성화
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_TOOLBOX) {
    return NextResponse.json({ error: 'Toolbox not available in production' }, { status: 404 });
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