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
      // Try different camera configurations for better compatibility
      let mediaStream: MediaStream | null = null
      
      // First try with environment camera (back camera)
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })
      } catch (envError) {
        console.log('Environment camera failed, trying user camera:', envError)
        // Fallback to user camera (front camera)
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          })
        } catch (userError) {
          console.log('User camera failed, trying basic video:', userError)
          // Final fallback - basic video request
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true
          })
        }
      }
      
      if (mediaStream) {
        setStream(mediaStream)
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          
          // Wait for video to be ready
          const playVideo = async () => {
            try {
              await videoRef.current?.play()
              setIsLoading(false)
              // Start scanning after a short delay to ensure video is stable
              setTimeout(() => {
                startScanning()
              }, 500)
            } catch (playError) {
              console.log('Video play error:', playError)
              setError('카메라 재생에 실패했습니다. 다시 시도해주세요.')
              setIsLoading(false)
            }
          }
          
          videoRef.current.onloadedmetadata = () => {
            playVideo()
          }
          
          // Ensure video is properly loaded
          if (videoRef.current.readyState >= 2) {
            playVideo()
          }
        }
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setError('카메라에 접근할 수 없습니다. 카메라 권한을 허용해주세요.')
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
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert"
        })

        if (code && code.data) {
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
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      initCamera()
    }, 100)
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timer)
      scanningRef.current = false
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [initCamera])

  const handleClose = () => {
    scanningRef.current = false
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ touchAction: 'none' }}>
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
          controls={false}
          preload="metadata"
          className="w-full h-full object-cover"
          style={{ background: '#000' }}
        />

        {/* Scanning overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Dark overlay with hole in center */}
          <div className="absolute inset-0 bg-black bg-opacity-50">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white rounded-lg"></div>
          </div>
          
          {/* Scanning corners */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
            {/* Top-left corner */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
            {/* Top-right corner */}
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
            {/* Bottom-left corner */}
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
            {/* Bottom-right corner */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
            
            {/* Scanning line */}
            <div className="absolute top-0 left-2 right-2 h-0.5 bg-green-400 animate-pulse"></div>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-32 left-4 right-4">
            <div className="bg-black/60 text-white p-4 rounded-lg text-center">
              <p className="text-lg font-bold mb-2">QR 코드를 찾아주세요</p>
              <p className="text-sm opacity-80 mb-3">
                QR 코드를 화면 중앙의 사각형 안에 맞춰주세요
              </p>
              
              {/* Test button for development */}
              <button 
                onClick={() => onScanSuccess('test-qr-code-data')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
              >
                🧪 테스트용 QR 스캔
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for QR scanning */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}