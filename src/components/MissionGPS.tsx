'use client'

import { useState, useEffect } from 'react'
import { Mission, LocationData } from '@/lib/types'

interface MissionGPSProps {
  mission: Mission
  onComplete: (success: boolean) => void
  onClose: () => void
}

export default function MissionGPS({ mission, onComplete, onClose }: MissionGPSProps) {
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [isInRange, setIsInRange] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string>('')

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c * 1000 // Return distance in meters
  }

  // Get current location
  const getCurrentLocation = () => {
    setChecking(true)
    setError('')

    if (!navigator.geolocation) {
      setError('위치 서비스가 지원되지 않습니다.')
      setChecking(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        }
        
        setUserLocation(location)
        
        const dist = calculateDistance(
          location.latitude,
          location.longitude,
          mission.location.lat,
          mission.location.lng
        )
        
        setDistance(Math.round(dist))
        setIsInRange(dist <= 50) // 50m range
        setChecking(false)
      },
      (error) => {
        let errorMessage = '위치를 가져올 수 없습니다.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '위치 권한이 거부되었습니다.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = '위치 정보를 사용할 수 없습니다.'
            break
          case error.TIMEOUT:
            errorMessage = '위치 요청 시간이 초과되었습니다.'
            break
        }
        setError(errorMessage)
        setChecking(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    )
  }

  // Auto-check location on mount
  useEffect(() => {
    getCurrentLocation()
  }, [])

  const handleVerifyLocation = () => {
    if (isInRange) {
      onComplete(true)
    } else {
      alert('목표 지점에 더 가까이 가야 합니다!')
    }
  }

  const getDistanceMessage = () => {
    if (distance === null) return ''
    if (distance <= 50) return '🎯 목표 지점에 도착했습니다!'
    if (distance <= 100) return '🚶‍♂️ 거의 다 왔습니다!'
    if (distance <= 500) return '🏃‍♂️ 조금 더 가까이 가세요'
    return '🗺️ 목표 지점까지 멀리 있습니다'
  }

  const getDirectionHint = () => {
    if (!userLocation || distance === null || distance <= 50) return ''
    
    const bearing = Math.atan2(
      mission.location.lng - userLocation.longitude,
      mission.location.lat - userLocation.latitude
    ) * 180 / Math.PI

    const directions = ['북쪽', '북동쪽', '동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽']
    const index = Math.round(bearing / 45) % 8
    return `🧭 ${directions[index]} 방향으로 이동하세요`
  }

  return (
    <div className="fixed inset-0 bg-vintage-paper z-50 flex flex-col">
      {/* Header */}
      <div className="bg-vintage-cream border-b-2 border-sepia-300 shadow-lg">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 text-sepia-700 hover:text-sepia-900"
          >
            <span className="text-xl">←</span>
            <span className="font-handwriting">뒤로</span>
          </button>
          <h2 className="font-vintage text-lg text-vintage-brown">
            📍 위치 인증
          </h2>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {/* Story */}
          <div className="mb-6 bg-vintage-cream p-4 rounded-lg border-2 border-sepia-300">
            <h3 className="font-handwriting text-lg text-vintage-brown mb-2">
              아버지의 이야기
            </h3>
            <p className="font-handwriting text-base text-sepia-700 leading-relaxed">
              "{mission.story.intro}"
            </p>
          </div>

          {/* Location status */}
          <div className="mb-6 text-center">
            <div className="text-6xl mb-4">
              {checking ? '🔄' : isInRange ? '🎯' : '📍'}
            </div>
            
            <h3 className="font-vintage text-xl text-vintage-brown mb-2">
              {mission.title.split(':')[1] || mission.title}
            </h3>

            {checking && (
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-4">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="font-handwriting text-blue-700">
                  현재 위치를 확인하는 중...
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
                <p className="font-handwriting text-red-700 mb-2">⚠️ {error}</p>
                <button
                  onClick={getCurrentLocation}
                  className="text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors"
                >
                  다시 시도
                </button>
              </div>
            )}

            {distance !== null && !error && (
              <div className={`rounded-lg p-4 mb-4 ${
                isInRange 
                  ? 'bg-green-50 border border-green-300' 
                  : 'bg-yellow-50 border border-yellow-300'
              }`}>
                <p className={`font-handwriting text-lg mb-2 ${
                  isInRange ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {getDistanceMessage()}
                </p>
                
                <div className="text-sm space-y-1">
                  <p className={`font-handwriting ${
                    isInRange ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    거리: {distance}m
                  </p>
                  
                  {getDirectionHint() && (
                    <p className="font-handwriting text-gray-600">
                      {getDirectionHint()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={getCurrentLocation}
              disabled={checking}
              className={`w-full p-3 border-2 border-sepia-300 rounded-lg
                       bg-white hover:bg-sepia-50 transition-colors duration-200
                       ${checking ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="font-handwriting text-sepia-700">
                🔄 위치 새로고침
              </span>
            </button>

            <button
              onClick={handleVerifyLocation}
              disabled={!isInRange || checking}
              className={`w-full vintage-button py-4 text-lg font-bold ${
                !isInRange || checking ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isInRange ? '✅ 위치 인증하기' : '📍 목표 지점 도달 필요'}
            </button>
          </div>

          {/* Map placeholder */}
          <div className="mt-6 bg-sepia-100 rounded-lg p-4 text-center">
            <div className="text-sepia-500 mb-2">🗺️</div>
            <p className="font-handwriting text-sm text-sepia-600">
              정확한 위치는 현장에서 확인해주세요
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}