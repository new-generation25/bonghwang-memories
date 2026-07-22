'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface MissionCameraProps {
  onCapture: (imageData: string) => void
  onClose: () => void
  /**
   * AR 폴백(D11) — 화면과 촬영 결과에 합성되는 오버레이 이미지(예: 능소화 프레임).
   * WebAR이 실패하거나 없는 환경에서 정적 프레임으로 대신한다.
   */
  overlaySrc?: string
}

export default function MissionCamera({ onCapture, onClose, overlaySrc }: MissionCameraProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      setIsMobile(isMobileDevice)
      console.log('카메라 디바이스 감지:', isMobileDevice ? '모바일' : 'PC')
    }
    checkMobile()
  }, [])

  // Initialize camera
  const initCamera = useCallback(async () => {
    // PC에서는 즉시 테스트 모드로 진행
    if (!isMobile) {
      console.log('PC 환경: 카메라 테스트 모드로 진행')
      setIsLoading(false)
      return
    }

    try {
      // Check for existing permissions first
      const permissionStatus = await navigator.permissions?.query({ name: 'camera' as PermissionName })
      console.log('Camera permission status:', permissionStatus?.state)
      
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
        // Save permission granted state
        localStorage.setItem('cameraPermissionGranted', 'true')
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
          localStorage.setItem('cameraPermissionGranted', 'true')
        } catch (userError) {
          console.log('User camera failed, trying basic video:', userError)
          // Final fallback - basic video request
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true
          })
          localStorage.setItem('cameraPermissionGranted', 'true')
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
            } catch (playError) {
              console.log('Video play error:', playError)
              // Try without play() call
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
    } catch (error) {
      console.error('Camera access denied:', error)
      localStorage.setItem('cameraPermissionGranted', 'false')
      alert('카메라 접근이 거부되었습니다. 브라우저 설정을 확인해주세요.')
      onClose()
    }
  }, [isMobile, onClose])

  // Initialize on mount
  useEffect(() => {
    // PC에서는 즉시 테스트 모드로 설정
    if (!isMobile) {
      console.log('PC 환경: 카메라 초기화 건너뛰기')
      setIsLoading(false)
      return
    }
    
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      console.log('모바일 환경: 실제 카메라 초기화')
      initCamera()
    }, 100)
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timer)
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [initCamera, isMobile])

  const capturePhoto = () => {
    if (isMobile) {
      // Mobile: Use actual camera
      if (!videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) return

      // Set canvas dimensions to video dimensions
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const finalize = () => {
        // Convert to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8)

        // Stop camera stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }

        onCapture(imageData)
      }

      // 오버레이(능소화 프레임 등)를 사진에 합성 — 실패해도 원본으로 진행
      if (overlaySrc) {
        const overlay = new Image()
        overlay.onload = () => {
          context.drawImage(overlay, 0, 0, canvas.width, canvas.height)
          finalize()
        }
        overlay.onerror = finalize
        overlay.src = overlaySrc
      } else {
        finalize()
      }
    } else {
      // PC: 모의 촬영 — 실제 촬영과 같은 경로로 오버레이를 합성한다.
      // (M3 능소화 AR 폴백(D11)을 PC에서도 눈으로 검증할 수 있어야 한다)
      const canvas = document.createElement('canvas')
      canvas.width = 480
      canvas.height = 640
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height)
      bg.addColorStop(0, '#F3EAD3')
      bg.addColorStop(1, '#EAE0C4')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#6B6259'
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('모의 촬영 (PC 테스트)', canvas.width / 2, canvas.height / 2)
      const finalize = () => onCapture(canvas.toDataURL('image/jpeg', 0.85))
      if (overlaySrc) {
        const overlay = new Image()
        overlay.onload = () => {
          ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height)
          finalize()
        }
        overlay.onerror = finalize
        overlay.src = overlaySrc
      } else {
        finalize()
      }
    }
  }

  const handleClose = () => {
    // Stop all camera tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop()
        console.log('Camera track stopped:', track.kind)
      })
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    // Reset states
    setStream(null)
    setIsLoading(true)
    
    // Close the component
    onClose()
  }

  // PC Test Mode UI
  if (!isMobile) {
    return (
      <div className="fixed inset-0 bg-cream-base z-50 flex flex-col items-center justify-center" style={{ touchAction: 'none' }}>
        <div className="max-w-md w-full text-center p-6">
          <div className="bg-cream border-2 border-line rounded-lg shadow-2xl p-8">
            <div className="text-6xl mb-6">📸</div>
            
            <h2 className="font-vintage text-2xl text-teal-dk mb-4">
              카메라 미션
            </h2>
            
            <p className="font-handwriting text-lg text-ink mb-6 leading-relaxed">
              PC 테스트 모드에서는 카메라 기능이 비활성화되어 있습니다.<br/>
              모바일에서 접속하시면 실제 카메라를 사용할 수 있습니다.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={capturePhoto}
                className="vintage-button w-full py-3 text-lg font-bold"
              >
                📷 모의 사진 촬영하기
              </button>
              
              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-cream-dp text-ink rounded-lg 
                         hover:bg-line transition-colors duration-200"
              >
                뒤로가기
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-cream border border-line rounded-lg">
              <p className="text-xs text-ink-60 font-handwriting">
                💡 실제 앱에서는 카메라로 사진을 촬영할 수 있습니다
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mobile Camera UI
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
        <h2 className="text-lg font-bold">사진 촬영</h2>
        <div className="w-16"></div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-shell">
            <div className="text-cream text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p>카메라를 준비하는 중...</p>
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

        {/* AR 폴백 오버레이 — 화면 프리뷰에도 겹쳐 보여준다 */}
        {overlaySrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={overlaySrc}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Guide overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-4 border-2 border-white/50 border-dashed rounded-lg"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-shell/70 text-cream px-4 py-2 rounded-lg text-center">
              <p className="text-sm">피사체를 가이드 라인 안에 맞춰주세요</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls — 셔터가 홈 인디케이터에 걸리지 않도록 안전영역만큼 띄운다 */}
      <div
        className="bg-shell/85 p-6 flex items-center justify-center"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={capturePhoto}
          disabled={isLoading}
          className="w-16 h-16 bg-white rounded-full border-4 border-line 
                   hover:bg-cream active:scale-95 transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-full h-full bg-white rounded-full"></div>
        </button>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}