'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MediaFailure, openStream, closeStream } from '@/lib/media'
import { playShutter } from '@/lib/sfx'
import { useArOverlay } from '@/hooks/useArOverlay'

interface MissionCameraProps {
  /**
   * meta.arActive — 촬영 순간 방향 센서가 실제로 붙어 있었는지.
   * D11의 '폴백 사용' 판정에 쓴다. 오버레이가 고정된 채 찍혔으면 폴백이다.
   */
  onCapture: (imageData: string, meta?: { arActive: boolean }) => void
  onClose: () => void
  /**
   * 화면과 촬영 결과에 합성되는 오버레이 이미지(예: 능소화).
   * 방향 센서가 있으면 폰을 움직일 때 같이 흐르고(AR), 없으면 고정된
   * 프레임으로 남는다 — 그게 D11 폴백이다.
   */
  overlaySrc?: string
}

export default function MissionCamera({ onCapture, onClose, overlaySrc }: MissionCameraProps) {
  const ar = useArOverlay(Boolean(overlaySrc))
  const [isLoading, setIsLoading] = useState(true)
  /** 카메라를 못 연 이유 — alert로 띄우고 닫아버리면 원인을 알 수 없다 */
  const [permissionError, setPermissionError] = useState('')
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

    // 뒤 카메라 → 앞 카메라 → 기본 순으로 시도한다. 세 번 다 getUserMedia를
    // 부르지만 브라우저는 한 번 허용한 권한을 기억하므로 물어보는 건 최초 1회다.
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: true },
    ]

    let mediaStream: MediaStream | null = null
    let lastMessage = ''
    let lastFailure: MediaFailure | null = null

    for (const constraints of attempts) {
      const res = await openStream(constraints)
      if (res.stream) {
        mediaStream = res.stream
        break
      }
      lastMessage = res.message
      lastFailure = res.failure
      // 권한 거부·비보안 컨텍스트는 다음 시도도 똑같이 실패한다 — 바로 끝낸다
      if (res.failure === 'denied' || res.failure === 'insecure') break
    }

    if (!mediaStream) {
      setPermissionError(lastMessage || '카메라를 열지 못했어요.')
      if (lastFailure !== 'insecure') setIsLoading(false)
      return
    }

    setPermissionError('')
    setStream(mediaStream)

    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream
      const playVideo = async () => {
        try {
          await videoRef.current?.play()
        } catch {
          /* 자동재생이 막혀도 프레임은 그려진다 */
        }
        setIsLoading(false)
      }
      videoRef.current.onloadedmetadata = () => {
        playVideo()
      }
      if (videoRef.current.readyState >= 2) playVideo()
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
      closeStream(stream)
    }
  }, [initCamera, isMobile])

  const capturePhoto = () => {
    /*
      찰칵은 셔터를 누른 그 순간에 나야 한다. 아래 인코딩(toDataURL)이
      끝난 뒤에 내면 큰 사진일수록 한 박자 늦어서, 눌린 것과 찍힌 것이
      따로 논다. 실기기·모의 촬영 어느 쪽으로 가든 여기를 지난다.
    */
    playShutter()

    if (isMobile) {
      // Mobile: Use actual camera
      if (!videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) return

      // 정사각형으로 잘라낸다 — 화면 프리뷰가 정사각형이므로 결과도 같아야
      // 한다. 가운데를 기준으로 짧은 변에 맞춰 자른다(object-cover와 동일).
      const side = Math.min(video.videoWidth, video.videoHeight)
      const sx = (video.videoWidth - side) / 2
      const sy = (video.videoHeight - side) / 2

      canvas.width = side
      canvas.height = side
      context.drawImage(video, sx, sy, side, side, 0, 0, side, side)

      const finalize = () => {
        // Convert to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8)

        // Stop camera stream
        closeStream(stream)

        onCapture(imageData, { arActive: ar.active })
      }

      // 오버레이(능소화 프레임 등)를 사진에 합성 — 실패해도 원본으로 진행
      if (overlaySrc) {
        const overlay = new Image()
        overlay.onload = () => {
          // 화면에서 본 그대로 찍혀야 한다 — 프리뷰와 같은 변환을 그대로 쓴다
          const t = ar.transformRef.current
          context.save()
          context.translate(
            canvas.width / 2 + t.x * canvas.width,
            canvas.height / 2 + t.y * canvas.height
          )
          context.rotate((t.rotate * Math.PI) / 180)
          context.drawImage(
            overlay,
            -canvas.width / 2,
            -canvas.height / 2,
            canvas.width,
            canvas.height
          )
          context.restore()
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
      const finalize = () =>
        onCapture(canvas.toDataURL('image/jpeg', 0.85), { arActive: false })
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
    <div
      className="fixed inset-0 z-50 flex flex-col bg-shell"
      style={{
        touchAction: 'none',
        // 100vh는 iOS 사파리에서 주소창 높이를 포함해 화면보다 커진다.
        // 그만큼 하단이 잘려 셔터 버튼이 화면 밖으로 밀려났다.
        height: '100dvh',
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between bg-shell/85 p-4 text-cream">
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

      {/* Camera view — 정사각형 고정. 남는 세로 공간은 위아래로 나눈다 */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative aspect-square w-full overflow-hidden">
          {permissionError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-shell px-6">
              <div className="text-center text-cream">
                <div className="text-3xl">📷</div>
                <p className="mt-2 text-[13px] font-bold">카메라를 열지 못했어요</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-cream/80">
                  {permissionError}
                </p>
                <button
                  onClick={initCamera}
                  className="mt-4 rounded-xl bg-cream px-5 py-2.5 text-[13px] font-bold text-ink"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : (
            isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-shell">
                <div className="text-cream text-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p>카메라를 준비하는 중...</p>
                </div>
              </div>
            )
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
              style={{
                transform: `translate(${ar.transform.x * 100}%, ${ar.transform.y * 100}%) rotate(${ar.transform.rotate}deg)`,
                transition: ar.active ? 'none' : 'transform 0.3s ease-out',
                willChange: 'transform',
              }}
            />
          )}

        {/* Guide overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-4 border-2 border-white/50 border-dashed rounded-lg"></div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="rounded-lg bg-shell/70 px-3 py-1.5 text-center text-cream">
              <p className="text-[12px]">
                {overlaySrc && ar.active
                  ? '폰을 천천히 움직여 능소화를 담아보세요'
                  : '피사체를 가이드 라인 안에 맞춰주세요'}
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* iOS는 사용자가 눌러야 방향 센서를 켤 수 있다 */}
      {overlaySrc && ar.needsPermission && (
        <div className="flex shrink-0 justify-center px-4 pb-1">
          <button
            onClick={ar.requestAccess}
            className="rounded-full bg-sunset-yellow px-4 py-2 text-[12.5px] font-bold text-ink"
          >
            🌺 능소화 깨우기
          </button>
        </div>
      )}

      {/* Controls — 셔터가 홈 인디케이터에 걸리지 않도록 안전영역만큼 띄운다 */}
      <div
        className="flex shrink-0 items-center justify-center bg-shell/85 p-6"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={capturePhoto}
          disabled={isLoading}
          // 셔터도 데크 키와 같은 딸깍 — 실제 카메라의 그 소리 자리다
          data-sfx="key"
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