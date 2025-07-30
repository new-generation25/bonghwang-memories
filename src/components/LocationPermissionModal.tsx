'use client'

import { useState, useEffect } from 'react'

interface LocationPermissionModalProps {
  isOpen: boolean
  onGranted: () => void
  onDenied: () => void
  onClose: () => void
}

export default function LocationPermissionModal({ 
  isOpen, 
  onGranted, 
  onDenied, 
  onClose 
}: LocationPermissionModalProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')

  // 권한 상태 확인
  useEffect(() => {
    if (isOpen) {
      checkPermissionState()
    }
  }, [isOpen])

  const checkPermissionState = async () => {
    try {
      // 권한 API 지원 여부 확인
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        setPermissionState(permission.state)
        
        // 이미 허용된 경우 바로 위치와 카메라 권한 확인
        if (permission.state === 'granted') {
          console.log('이미 위치 권한이 허용되어 있습니다.')
          await requestAllPermissions()
          return
        }
      } else {
        // 권한 API를 지원하지 않는 브라우저
        setPermissionState('prompt')
      }
    } catch (error) {
      console.log('권한 상태 확인 실패, 기본 요청으로 진행')
      setPermissionState('prompt')
    }
  }

  const requestAllPermissions = async () => {
    setIsRequesting(true)
    
    try {
      // 1. 위치 권한 요청
      if (!navigator.geolocation) {
        alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.')
        onDenied()
        return
      }

      // 위치 권한 요청
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        })
      })

      // 2. 카메라 권한 요청
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('이 브라우저에서는 카메라 서비스를 지원하지 않습니다.')
        onDenied()
        return
      }

      // 카메라 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'environment', // 후면 카메라 우선
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      // 스트림 즉시 정리 (권한만 확인)
      stream.getTracks().forEach(track => track.stop())

      console.log('위치와 카메라 권한이 모두 허용되었습니다.')
      onGranted()

    } catch (error: any) {
      console.error('Permission error:', error)
      
      let errorMessage = '권한이 거부되었습니다.'
      if (error.name === 'NotAllowedError') {
        errorMessage = '위치 또는 카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = '카메라에 접근할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = '카메라를 찾을 수 없습니다.'
      } else if (error.code === 1) {
        errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
      } else if (error.code === 2) {
        errorMessage = '위치 정보를 사용할 수 없습니다.'
      } else if (error.code === 3) {
        errorMessage = '위치 요청 시간이 초과되었습니다.'
      }
      
      alert(errorMessage)
      onDenied()
    } finally {
      setIsRequesting(false)
    }
  }

  const getCurrentLocation = async () => {
    setIsRequesting(true)
    
    try {
      if (!navigator.geolocation) {
        alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.')
        onDenied()
        return
      }

      // 실제 위치 가져오기
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        })
      })

      onGranted()
    } catch (error: any) {
      console.error('Location error:', error)
      
      let errorMessage = '위치를 가져올 수 없습니다.'
      if (error.code === 1) {
        errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
      } else if (error.code === 2) {
        errorMessage = '위치 정보를 사용할 수 없습니다.'
      } else if (error.code === 3) {
        errorMessage = '위치 요청 시간이 초과되었습니다.'
      }
      
      alert(errorMessage)
      onDenied()
    } finally {
      setIsRequesting(false)
    }
  }

  const requestLocationPermission = async () => {
    // 위치와 카메라 권한을 동시에 요청
    await requestAllPermissions()
  }

  if (!isOpen) return null

  // 이미 권한이 허용된 경우 로딩 화면만 표시
  if (permissionState === 'granted' && isRequesting) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-vintage-brown rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏛️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">봉황 메모리즈</h2>
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">권한을 확인하는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
        {/* 앱 아이콘과 이름 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-vintage-brown rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🏛️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            봉황 메모리즈
          </h2>
          <p className="text-sm text-gray-600">
            위치 및 카메라 권한 요청
          </p>
        </div>

        {/* 권한 설명 */}
        <div className="mb-6">
          <div className="space-y-4">
            {/* 위치 권한 */}
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600">📍</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">
                  내 위치 확인
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  미션 수행을 위한 현재 위치 정보가 필요합니다.
                </p>
              </div>
            </div>

            {/* 카메라 권한 */}
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600">📸</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">
                  카메라 접근
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  사진 촬영 미션을 위한 카메라 접근이 필요합니다.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <p className="text-xs text-blue-700">
              💡 위치와 카메라 정보는 미션 수행에만 사용되며, 다른 용도로 사용되지 않습니다.
            </p>
          </div>
        </div>

        {/* 버튼들 */}
        <div className="space-y-3">
          <button
            onClick={requestLocationPermission}
            disabled={isRequesting}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isRequesting 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRequesting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>권한 요청 중...</span>
              </div>
            ) : (
              '위치 및 카메라 권한 허용'
            )}
          </button>

          <button
            onClick={onDenied}
            disabled={isRequesting}
            className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            거부
          </button>

          <button
            onClick={onClose}
            disabled={isRequesting}
            className="w-full py-2 px-4 text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            나중에
          </button>
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
} 