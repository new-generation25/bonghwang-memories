'use client'

import { useState, useEffect } from 'react'

interface ToolboxData {
  environment: string
  deployment: {
    url: string
    environment: string
    region: string
    function?: string
  }
  build: {
    time?: string
    commit?: string
    message?: string
  }
  app: {
    name: string
    version: string
    lastUpdate: string
  }
  serviceWorker: {
    version: string
    cacheName: string
  }
}

export default function VercelToolbox() {
  const [isVisible, setIsVisible] = useState(false)
  const [data, setData] = useState<ToolboxData | null>(null)
  const [loading, setLoading] = useState(false)

  // 개발 환경에서만 표시
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development' || 
                  window.location.hostname.includes('vercel.app')
    setIsVisible(isDev)
  }, [])

  const fetchToolboxData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vercel-toolbox')
      if (response.ok) {
        const toolboxData = await response.json()
        setData(toolboxData)
      }
    } catch (error) {
      console.error('Vercel Toolbox 데이터 로드 실패:', error)
    }
    setLoading(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={fetchToolboxData}
        className="bg-black bg-opacity-80 text-white px-3 py-2 rounded text-xs hover:bg-opacity-90 transition-all"
      >
        🔧 Vercel Toolbox
      </button>
      
      {data && (
        <div className="absolute bottom-12 right-0 bg-black bg-opacity-90 text-white p-4 rounded text-xs max-w-xs">
          <h3 className="font-bold mb-2">🔧 Vercel Toolbox</h3>
          
          <div className="space-y-2">
            <div>
              <strong>Environment:</strong> {data.environment}
            </div>
            
            <div>
              <strong>Deployment:</strong>
              <div className="ml-2">
                <div>URL: {data.deployment.url}</div>
                <div>Env: {data.deployment.environment}</div>
                <div>Region: {data.deployment.region}</div>
              </div>
            </div>
            
            {data.build.commit && (
              <div>
                <strong>Build:</strong>
                <div className="ml-2">
                  <div>Commit: {data.build.commit.substring(0, 7)}</div>
                  {data.build.message && (
                    <div>Message: {data.build.message}</div>
                  )}
                </div>
              </div>
            )}
            
            <div>
              <strong>App:</strong>
              <div className="ml-2">
                <div>Name: {data.app.name}</div>
                <div>Version: {data.app.version}</div>
                <div>Updated: {new Date(data.app.lastUpdate).toLocaleString()}</div>
              </div>
            </div>
            
            <div>
              <strong>Service Worker:</strong>
              <div className="ml-2">
                <div>Version: {data.serviceWorker.version}</div>
                <div>Cache: {data.serviceWorker.cacheName}</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setData(null)}
            className="mt-3 bg-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-500"
          >
            닫기
          </button>
        </div>
      )}
      
      {loading && (
        <div className="absolute bottom-12 right-0 bg-black bg-opacity-90 text-white p-4 rounded text-xs">
          로딩 중...
        </div>
      )}
    </div>
  )
} 