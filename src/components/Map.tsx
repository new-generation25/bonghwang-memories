'use client'

import { useEffect, useState, useRef } from 'react'
import { Mission } from '@/lib/types'
import { mainMissions } from '@/lib/missions'

interface MapProps {
  onMissionSelect: (mission: Mission) => void
  completedMissions: string[]
  userLocation?: { lat: number; lng: number }
}

declare global {
  interface Window {
    naver: any
  }
}

export default function Map({ onMissionSelect, completedMissions, userLocation }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // 네이버 지도 초기화
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.naver) return

      try {
        // 봉황동 중심 좌표
        const center = new window.naver.maps.LatLng(35.2285, 128.6815)
        
        const mapOptions = {
          center: center,
          zoom: 17,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: window.naver.maps.MapTypeControlStyle.BUTTON,
            position: window.naver.maps.Position.TOP_RIGHT
          },
          zoomControl: true,
          zoomControlOptions: {
            style: window.naver.maps.ZoomControlStyle.SMALL,
            position: window.naver.maps.Position.TOP_LEFT
          }
        }

        const naverMap = new window.naver.maps.Map(mapRef.current, mapOptions)
        setMap(naverMap)
        setIsLoaded(true)
      } catch (error) {
        console.error('네이버 지도 초기화 실패:', error)
        // 폴백으로 기존 Mock 지도 표시
        showMockMap()
      }
    }

    const checkNaverMaps = () => {
      if (window.naver && window.naver.maps) {
        initMap()
      } else {
        setTimeout(checkNaverMaps, 100)
      }
    }

    checkNaverMaps()
  }, [])

  // 미션 마커 추가
  useEffect(() => {
    if (!map || !isLoaded) return

    // 기존 마커 제거
    markers.forEach(marker => marker.setMap(null))
    
    const newMarkers: any[] = []

    mainMissions.forEach((mission, index) => {
      const isCompleted = completedMissions.includes(mission.missionId)
      
      const position = new window.naver.maps.LatLng(
        mission.location.lat, 
        mission.location.lng
      )

      // 커스텀 마커 아이콘 생성
      const content = `
        <div style="position: relative; cursor: pointer;">
          <div style="
            width: 48px; 
            height: 48px; 
            border-radius: 50%; 
            background-color: ${isCompleted ? '#DAA520' : '#8B4513'}; 
            border: 3px solid white; 
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            transform: translate(-50%, -50%);
          ">
            ${isCompleted ? '✓' : index + 1}
          </div>
          ${!isCompleted ? `
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              width: 12px;
              height: 12px;
              background-color: #FCD34D;
              border-radius: 50%;
              animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
          ` : ''}
        </div>
      `

      const marker = new window.naver.maps.Marker({
        position: position,
        map: map,
        icon: {
          content: content,
          anchor: new window.naver.maps.Point(24, 24)
        },
        title: mission.title
      })

      // 마커 클릭 이벤트
      window.naver.maps.Event.addListener(marker, 'click', () => {
        onMissionSelect(mission)
      })

      // 정보창 생성
      const infoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="padding: 10px; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #8B4513; font-weight: bold;">
              ${mission.title}
            </h4>
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">
              ${mission.story.intro.substring(0, 50)}...
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #DAA520; font-weight: bold;">
                ${mission.points}점
              </span>
              <button onclick="window.selectMission && window.selectMission('${mission.missionId}')" 
                      style="
                        background: #8B4513; 
                        color: white; 
                        border: none; 
                        padding: 4px 8px; 
                        border-radius: 4px; 
                        font-size: 12px; 
                        cursor: pointer;
                      ">
                ${isCompleted ? '완료됨' : '시작하기'}
              </button>
            </div>
          </div>
        `
      })

      // 마커 호버 이벤트
      window.naver.maps.Event.addListener(marker, 'mouseover', () => {
        infoWindow.open(map, marker)
      })

      window.naver.maps.Event.addListener(marker, 'mouseout', () => {
        infoWindow.close()
      })

      newMarkers.push(marker)
    })

    // 전역 미션 선택 함수
    ;(window as any).selectMission = (missionId: string) => {
      const mission = mainMissions.find(m => m.missionId === missionId)
      if (mission) {
        onMissionSelect(mission)
      }
    }

    setMarkers(newMarkers)
  }, [map, completedMissions, onMissionSelect, isLoaded])

  // 사용자 위치 마커 추가
  useEffect(() => {
    if (!map || !userLocation || !isLoaded) return

    const userPosition = new window.naver.maps.LatLng(
      userLocation.lat, 
      userLocation.lng
    )

    const userMarker = new window.naver.maps.Marker({
      position: userPosition,
      map: map,
      icon: {
        content: `
          <div style="position: relative;">
            <div style="
              width: 16px; 
              height: 16px; 
              border-radius: 50%; 
              background-color: #3B82F6; 
              border: 3px solid white; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 16px; 
              height: 16px; 
              border-radius: 50%; 
              background-color: rgba(59, 130, 246, 0.3);
              animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
          </div>
        `,
        anchor: new window.naver.maps.Point(8, 8)
      },
      title: '현재 위치'
    })

    return () => {
      userMarker.setMap(null)
    }
  }, [map, userLocation, isLoaded])

  // 폴백 Mock 지도 함수
  const showMockMap = () => {
    if (!mapRef.current) return

    mapRef.current.innerHTML = `
      <div class="relative w-full h-full bg-sepia-200 rounded-lg overflow-hidden" style="
        background-image: 
          radial-gradient(circle at 20% 30%, rgba(212, 184, 150, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(193, 154, 107, 0.3) 0%, transparent 50%),
          linear-gradient(45deg, rgba(244, 241, 232, 0.8) 0%, rgba(232, 213, 183, 0.8) 100%);
      ">
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="text-6xl mb-4">🗺️</div>
            <h3 class="text-lg font-bold text-gray-800 mb-2">지도 로딩 중...</h3>
            <p class="text-sm text-gray-600">네이버 지도 API를 불러오고 있습니다</p>
          </div>
        </div>
      </div>
    `
  }

  // 지도 컨트롤 함수들
  const zoomIn = () => {
    if (map) {
      map.setZoom(map.getZoom() + 1)
    }
  }

  const zoomOut = () => {
    if (map) {
      map.setZoom(map.getZoom() - 1)
    }
  }

  const moveToCurrentLocation = () => {
    if (map && userLocation) {
      const position = new window.naver.maps.LatLng(userLocation.lat, userLocation.lng)
      map.panTo(position)
    } else if (map) {
      // 현재 위치 요청
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords
            const newPosition = new window.naver.maps.LatLng(latitude, longitude)
            map.panTo(newPosition)
          },
          (error) => {
            console.error('위치 정보를 가져올 수 없습니다:', error)
            // 봉황동 중심으로 이동
            const center = new window.naver.maps.LatLng(35.2285, 128.6815)
            map.panTo(center)
          }
        )
      }
    }
  }

  return (
    <div className="w-full h-full min-h-[400px] relative">
      <div 
        ref={mapRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '400px' }}
      />
      
      {/* 지도 컨트롤 */}
      <div className="absolute top-4 right-4 space-y-2">
        <button 
          onClick={moveToCurrentLocation}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="현재 위치"
        >
          📍
        </button>
        <button 
          onClick={zoomIn}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="확대"
        >
          <span style={{ fontSize: '16px' }}>+</span>
        </button>
        <button 
          onClick={zoomOut}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="축소"
        >
          <span style={{ fontSize: '18px' }}>-</span>
        </button>
      </div>

      {/* 지도 범례 */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="text-sm text-gray-700">
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B4513' }}></div>
            <span>미완료 미션</span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#DAA520' }}></div>
            <span>완료된 미션</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>현재 위치</span>
          </div>
        </div>
      </div>

      {/* 애니메이션 스타일 */}
      <style jsx>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}