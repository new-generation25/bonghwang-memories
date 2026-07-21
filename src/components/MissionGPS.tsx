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

  // 🚫 Get current location - 임시 비활성화
  const getCurrentLocation = () => {
    // 🚫 위치 기능 임시 비활성화 - 다른 오류 해결 후 재활성화 예정
    console.log('🚫 GPS 위치 기능이 임시로 비활성화되어 있습니다.')
    setError('🚫 GPS 위치 기능이 임시로 비활성화되어 있습니다.')
    setChecking(false)
    
    // setChecking(true)
    // setError('')

    // if (!navigator.geolocation) {
    //   setError('위치 서비스가 지원되지 않습니다.')
    //   setChecking(false)
    //   return
    // }

    // navigator.geolocation.getCurrentPosition(
    //   (position) => {
    //     const location: LocationData = {
    //       latitude: position.coords.latitude,
    //       longitude: position.coords.longitude,
    //       accuracy: position.coords.accuracy
    //     }
        
    //     setUserLocation(location)
        
    //     const dist = calculateDistance(
    //       location.latitude,
    //       location.longitude,
    //       mission.location.lat,
    //       mission.location.lng
    //     )
        
    //     setDistance(Math.round(dist))
    //     setIsInRange(dist <= 50) // 50m range
    //     setChecking(false)
    //   },
    //   (error) => {
    //     let errorMessage = '위치를 가져올 수 없습니다.'
    //     switch (error.code) {
    //       case error.PERMISSION_DENIED:
    //         errorMessage = '위치 권한이 거부되었습니다.'
    //         break
    //       case error.POSITION_UNAVAILABLE:
    //         errorMessage = '위치 정보를 사용할 수 없습니다.'
    //         break
    //       case error.TIMEOUT:
    //         errorMessage = '위치 요청 시간이 초과되었습니다.'
    //         break
    //     }
    //     setError(errorMessage)
    //     setChecking(false)
    //   },
    //   {
    //     enableHighAccuracy: true,
    //     timeout: 15000,
    //     maximumAge: 60000
    //   }
    // )
  }

  // 🚫 Auto-check location on mount - 임시 비활성화
  useEffect(() => {
    // 🚫 위치 기능 임시 비활성화 - 다른 오류 해결 후 재활성화 예정
    console.log('🚫 자동 위치 체크가 임시로 비활성화되어 있습니다.')
    // getCurrentLocation()
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{
      background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))',
      touchAction: 'none'
    }}>
      {/* Header */}
      <div className="border-b-2 shadow-lg" style={{
        backgroundColor: '#F3EAD3',
        borderColor: '#E0D8C6'
      }}>
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 text-ink hover:text-ink"
          >
            <span className="text-xl">←</span>
            <span className="font-handwriting">뒤로</span>
          </button>
          <h2 className="font-vintage text-lg text-teal-dk">
            📍 위치 인증
          </h2>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {/* Story */}
          <div className="mb-6 bg-cream p-4 rounded-lg border-2 border-line">
            <h3 className="font-handwriting text-lg text-teal-dk mb-2">
              아버지의 이야기
            </h3>
            <p className="font-handwriting text-base text-ink leading-relaxed">
              "{mission.story.intro}"
            </p>
          </div>

          {/* Location status */}
          <div className="mb-6 text-center">
            <div className="text-6xl mb-4">
              {checking ? '🔄' : isInRange ? '🎯' : '📍'}
            </div>
            
            <h3 className="font-vintage text-xl text-teal-dk mb-2">
              {mission.title.split(':')[1] || mission.title}
            </h3>

            {checking && (
              <div className="bg-cream border border-line rounded-lg p-4 mb-4">
                <div className="animate-spin w-6 h-6 border-2 border-teal border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="font-handwriting text-ink-60">
                  현재 위치를 확인하는 중...
                </p>
              </div>
            )}

            {error && (
              <div className="bg-rec/10 border border-rec rounded-lg p-4 mb-4">
                <p className="font-handwriting text-rec mb-2">⚠️ {error}</p>
                <button
                  onClick={getCurrentLocation}
                  className="text-sm bg-rec/15 hover:bg-rec/20 px-3 py-1 rounded transition-colors"
                >
                  다시 시도
                </button>
              </div>
            )}

            {distance !== null && !error && (
              <div className={`rounded-lg p-4 mb-4 ${
                isInRange 
                  ? 'bg-teal/10 border border-teal' 
                  : 'bg-sunset/15 border border-sunset'
              }`}>
                <p className={`font-handwriting text-lg mb-2 ${
                  isInRange ? 'text-teal-dk' : 'text-shell'
                }`}>
                  {getDistanceMessage()}
                </p>
                
                <div className="text-sm space-y-1">
                  <p className={`font-handwriting ${
                    isInRange ? 'text-teal-dk' : 'text-retro'
                  }`}>
                    거리: {distance}m
                  </p>
                  
                  {getDirectionHint() && (
                    <p className="font-handwriting text-ink-60">
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
              className={`w-full p-3 border-2 border-line rounded-lg
                       bg-white hover:bg-paper transition-colors duration-200
                       ${checking ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="font-handwriting text-ink">
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

          {/* Map placeholder with Naver Map integration */}
          <div className="mt-6 bg-cream rounded-lg overflow-hidden" style={{ height: '200px' }}>
            <div 
              id="gps-mini-map" 
              style={{ width: '100%', height: '100%' }}
              ref={(ref) => {
                if (ref && window.naver && userLocation) {
                  try {
                    const miniMap = new window.naver.maps.Map(ref, {
                      center: new window.naver.maps.LatLng(mission.location.lat, mission.location.lng),
                      zoom: 18,
                      mapTypeControl: false,
                      zoomControl: false
                    })

                    // 미션 위치 마커
                    new window.naver.maps.Marker({
                      position: new window.naver.maps.LatLng(mission.location.lat, mission.location.lng),
                      map: miniMap,
                      icon: {
                        content: `
                          <div style="
                            width: 24px; 
                            height: 24px; 
                            border-radius: 50%; 
                            background-color: #1F625C; 
                            border: 2px solid white; 
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 12px;
                            font-weight: bold;
                          ">🎯</div>
                        `,
                        anchor: new window.naver.maps.Point(12, 12)
                      }
                    })

                    // 사용자 위치 마커
                    if (userLocation) {
                      new window.naver.maps.Marker({
                        position: new window.naver.maps.LatLng(userLocation.latitude, userLocation.longitude),
                        map: miniMap,
                        icon: {
                          content: `
                            <div style="
                              width: 16px; 
                              height: 16px; 
                              border-radius: 50%; 
                              background-color: #E8722C; 
                              border: 2px solid white; 
                              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            "></div>
                          `,
                          anchor: new window.naver.maps.Point(8, 8)
                        }
                      })
                    }

                    // 50m 반경 원 표시
                    new window.naver.maps.Circle({
                      map: miniMap,
                      center: new window.naver.maps.LatLng(mission.location.lat, mission.location.lng),
                      radius: 50,
                      fillColor: isInRange ? '#2E8A80' : '#F2B33D',
                      fillOpacity: 0.2,
                      strokeColor: isInRange ? '#2E8A80' : '#F2B33D',
                      strokeOpacity: 0.6,
                      strokeWeight: 2
                    })
                  } catch (error) {
                    console.error('Mini map error:', error)
                    // 폴백 표시
                    ref.innerHTML = `
                      <div style="
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        height: 100%; 
                        background-color: #F3EAD3;
                        color: #6B6259;
                      ">
                        <div style="text-align: center;">
                          <div style="font-size: 2rem; margin-bottom: 8px;">🗺️</div>
                          <p style="font-size: 0.875rem;">위치 확인 중...</p>
                        </div>
                      </div>
                    `
                  }
                } else if (ref) {
                  // 네이버 지도 로딩 중이거나 위치 정보 없음
                  ref.innerHTML = `
                    <div style="
                      display: flex; 
                      align-items: center; 
                      justify-content: center; 
                      height: 100%; 
                      background-color: #F3EAD3;
                      color: #6B6259;
                    ">
                      <div style="text-align: center;">
                        <div style="font-size: 2rem; margin-bottom: 8px;">🗺️</div>
                        <p style="font-size: 0.875rem;">위치 정보를 확인하는 중...</p>
                      </div>
                    </div>
                  `
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}