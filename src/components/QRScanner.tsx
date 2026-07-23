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
  /**
   * 정리용 스트림 참조.
   *
   * state만 쓰면 언마운트 정리 함수가 처음 값(null)을 붙잡은 채로 남아
   * 트랙이 꺼지지 않는다. 그러면 스캔이 끝나 다음 화면으로 넘어간 뒤에도
   * 아이폰 상태표시줄에 카메라 사용 표시가 계속 켜져 있다.
   * 권한은 한 번 허용하면 유지되므로, 쓰지 않을 때 꺼도 다시 묻지 않는다.
   */
  const streamRef = useRef<MediaStream | null>(null)

  /** 카메라를 완전히 끈다 — 트랙을 멈추고 video에서도 떼어낸다 */
  const stopCamera = useCallback(() => {
    scanningRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])
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
        streamRef.current = mediaStream
        
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
          // 넘어가기 전에 끈다 — 읽은 뒤에도 켜져 있으면 다음 화면에서
          // 상태표시줄의 카메라 표시만 남는다
          stopCamera()
          onScanSuccess(code.data)
          return
        }
      }

      requestAnimationFrame(scan)
    }

    scan()
    // stream은 더 이상 읽지 않는다 — 정리는 streamRef가 맡는다.
    // 이 콜백은 영상이 재생된 뒤 직접 불리므로 스트림 변화에 묶일 필요가 없다.
  }, [onScanSuccess, stopCamera])

  // Initialize on mount
  useEffect(() => {
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      initCamera()
    }, 100)
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timer)
      stopCamera()
    }
  }, [initCamera, stopCamera])

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-shell z-50 flex flex-col" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-shell/85 text-cream">
        <button
          onClick={handleClose}
          className="flex items-center space-x-2 text-cream hover:text-cream"
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
          <div className="absolute inset-0 flex items-center justify-center bg-shell">
            <div className="text-cream text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p>카메라를 준비하는 중...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-shell">
            <div className="text-cream text-center max-w-sm px-4">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="mb-4">{error}</p>
              <button
                onClick={handleClose}
                className="bg-cream text-shell px-6 py-2 rounded-lg hover:bg-cream-dp"
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

        {/*
          스캔 오버레이.

          조준 틀을 화면 세로 38% 자리에 둔다. 가운데(50%)에 두면 QR을
          맞추려고 팔을 들 때 안내 문구와 겹치고, 벽 높이에 붙은 실물 QR을
          겨누려면 어차피 카메라가 위를 향한다.
        */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Dark overlay with hole in center */}
          <div className="absolute inset-0 bg-shell/50">
            <div className="absolute top-[38%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white rounded-lg"></div>
          </div>

          {/* Scanning corners */}
          <div className="absolute top-[38%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
            {/* Top-left corner */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-sunset rounded-tl-lg"></div>
            {/* Top-right corner */}
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-sunset rounded-tr-lg"></div>
            {/* Bottom-left corner */}
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-sunset rounded-bl-lg"></div>
            {/* Bottom-right corner */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-sunset rounded-br-lg"></div>
            
            {/* Scanning line */}
            <div className="absolute top-0 left-2 right-2 h-0.5 bg-sunset animate-pulse"></div>
          </div>

          {/*
            안내 — 틀 바로 아래.
            찍는 버튼은 두지 않는다. 인식되면 스스로 넘어가므로 누를 일이 없고,
            버튼이 있으면 '눌러야 되는 것'으로 오해해 QR을 맞춰두고도 기다린다.
          */}
          <div className="absolute left-6 right-6 top-[calc(38%+9.5rem)]">
            <p className="text-center text-[15px] font-bold text-cream drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              QR 코드를 사각형 안에 맞춰주세요
            </p>
          </div>
        </div>
      </div>

      {/* Hidden canvas for QR scanning */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}