'use client'

import { useState, useRef, useCallback } from 'react'

interface MissionCameraProps {
  onCapture: (imageData: string) => void
  onClose: () => void
}

export default function MissionCamera({ onCapture, onClose }: MissionCameraProps) {
  // PC Testing Mode - Camera disabled
  return (
    <div className="fixed inset-0 bg-vintage-paper z-50 flex flex-col items-center justify-center">
      <div className="max-w-md w-full text-center p-6">
        <div className="bg-vintage-cream border-2 border-sepia-400 rounded-lg shadow-2xl p-8">
          <div className="text-6xl mb-6">📸</div>
          
          <h2 className="font-vintage text-2xl text-vintage-brown mb-4">
            카메라 미션
          </h2>
          
          <p className="font-handwriting text-lg text-sepia-700 mb-6 leading-relaxed">
            PC 테스트 모드에서는 카메라 기능이 비활성화되어 있습니다.<br/>
            모바일에서 접속하시면 실제 카메라를 사용할 수 있습니다.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                // Simulate photo capture for PC testing
                const mockImageData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                onCapture(mockImageData)
              }}
              className="vintage-button w-full py-3 text-lg font-bold"
            >
              📷 모의 사진 촬영하기
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-sepia-200 text-sepia-700 rounded-lg 
                       hover:bg-sepia-300 transition-colors duration-200"
            >
              뒤로가기
            </button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-xs text-blue-700 font-handwriting">
              💡 실제 앱에서는 카메라로 사진을 촬영할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  /* 
  // Original camera code (commented out for PC testing)
  const [isLoading, setIsLoading] = useState(true)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.onloadedmetadata = () => {
          setIsLoading(false)
        }
      }
    } catch (error) {
      console.error('Camera access denied:', error)
      alert('카메라 접근이 거부되었습니다. 브라우저 설정을 확인해주세요.')
      onClose()
    }
  }, [onClose])

  // Initialize on mount
  useState(() => {
    initCamera()
    
    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  })

  const capturePhoto = () => {
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

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8)
    
    // Stop camera stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }

    onCapture(imageData)
  }

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/80 text-white">
        <button
          onClick={handleClose}
          className="flex items-center space-x-2 text-white hover:text-gray-300"
        >
          <span className="text-xl">←</span>
          <span>뒤로</span>
        </button>
        <h2 className="text-lg font-bold">사진 촬영</h2>
        <div className="w-16"></div>
      </div>

      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-center">
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
          className="w-full h-full object-cover"
        />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-4 border-2 border-white/50 border-dashed rounded-lg"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-black/60 text-white px-4 py-2 rounded-lg text-center">
              <p className="text-sm">피사체를 가이드 라인 안에 맞춰주세요</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black/80 p-6 flex items-center justify-center">
        <button
          onClick={capturePhoto}
          disabled={isLoading}
          className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 
                   hover:bg-gray-100 active:scale-95 transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-full h-full bg-white rounded-full"></div>
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
  */
}