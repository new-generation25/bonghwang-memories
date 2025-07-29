'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import jsQR from 'jsqr'

interface QRScannerProps {
  onScanSuccess: (data: string) => void
  onClose: () => void
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanningRef = useRef<boolean>(false)

  // Initialize camera and start scanning
  const initCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.onloadedmetadata = () => {
          setIsLoading(false)
          startScanning()
        }
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setError('카메라 접근이 거부되었습니다. 브라우저 설정을 확인해주세요.')
      setIsLoading(false)
    }
  }, [])

  // QR code scanning logic
  const startScanning = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    scanningRef.current = true

    const scan = () => {
      if (!scanningRef.current || !video || !canvas || !context) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code) {
          scanningRef.current = false
          // Stop camera stream
          if (stream) {
            stream.getTracks().forEach(track => track.stop())
          }
          onScanSuccess(code.data)
          return
        }
      }

      requestAnimationFrame(scan)
    }

    scan()
  }, [stream, onScanSuccess])

  // Initialize on mount
  useEffect(() => {
    initCamera()
    
    // Cleanup on unmount
    return () => {
      scanningRef.current = false
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [initCamera, stream])

  const handleClose = () => {
    scanningRef.current = false
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 text-white">
        <button
          onClick={handleClose}
          className="flex items-center space-x-2 text-white hover:text-gray-300"
        >
          <span className="text-xl">←</span>
          <span>뒤로</span>
        </button>
        <h2 className="text-lg font-bold">QR 코드 스캔</h2>
        <div className="w-16"></div>
      </div>

      {/* Scanner view */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p>카메라를 준비하는 중...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-center max-w-sm px-4">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="mb-4">{error}</p>
              <button
                onClick={handleClose}
                className="bg-white text-black px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Scanning overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Corners */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
            {/* Top-left corner */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
            {/* Top-right corner */}
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
            {/* Bottom-left corner */}
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
            {/* Bottom-right corner */}
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
            
            {/* Scanning line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-bounce"></div>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-32 left-4 right-4">
            <div className="bg-black/60 text-white p-4 rounded-lg text-center">
              <p className="text-lg font-bold mb-2">QR 코드를 찾아주세요</p>
              <p className="text-sm opacity-80">
                QR 코드를 화면 중앙의 사각형 안에 맞춰주세요
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for QR scanning */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}