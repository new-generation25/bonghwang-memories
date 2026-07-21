'use client'

import { useEffect, useState, useRef } from 'react'
import { Mission, NaverMapWindow, NaverMap, NaverMarker } from '@/lib/types'
import { mainMissions } from '@/lib/missions'

interface MapProps {
  onMissionSelect: (mission: Mission) => void
  completedMissions: string[]
  userLocation?: { lat: number; lng: number }
}

declare global {
  interface Window extends NaverMapWindow {
    selectMission?: (missionId: string) => void
  }
}

export default function Map({ onMissionSelect, completedMissions, userLocation }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<NaverMap | null>(null)
  const [markers, setMarkers] = useState<NaverMarker[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // 네이버 지도 초기화
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current) return

      // 네이버 지도 API 사용 가능성 확인
      if (!window.naver || !window.naver.maps) {
        console.warn('네이버 지도 API를 사용할 수 없습니다. Mock 지도를 표시합니다.')
        showMockMap('API 로딩 실패')
        return
      }

      try {
        // 김해 중심 좌표
        const center = new window.naver.maps.LatLng(35.228802, 128.877551)
        
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
        
        // 지도 로드 완료 이벤트 리스너
        window.naver.maps.Event.addListener(naverMap, 'init', () => {
          console.log('네이버 지도 초기화 완료')
          setMap(naverMap)
          setIsLoaded(true)
        })

        // 지도 로드 실패 처리 (타임아웃을 제거하여 충돌 방지)
        // setTimeout 제거 - checkNaverMaps에서 타임아웃 처리

      } catch (error) {
        console.error('네이버 지도 초기화 실패:', error)
        
        // 상세한 오류 분석
        let errorType = '알 수 없는 오류'
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        if (errorMessage.includes('인증') || errorMessage.includes('auth')) {
          errorType = 'API 인증 실패'
        } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
          errorType = 'API 할당량 초과'
        } else if (errorMessage.includes('domain') || errorMessage.includes('referer')) {
          errorType = '도메인 인증 실패'
        }
        
        showMockMap(errorType)
      }
    }

    const checkNaverMaps = (attempts = 0) => {
      const maxAttempts = 100 // 10초 대기 (타임아웃 단축)

      // 전역 오류 상태 확인
      if (window.naverMapLoadError) {
        console.warn('네이버 지도 API 로딩 오류 감지 - Mock 지도로 대체')
        showMockMap('API 로딩 실패')
        return
      }

      // 개선된 로딩 상태 확인 및 중복 초기화 방지
      if (window.naverMapLoaded && window.naver && window.naver.maps && !isLoaded) {
        console.log('네이버 지도 API 로딩 완료 확인됨')
        initMap()
      } else if (attempts < maxAttempts && !isLoaded) {
        setTimeout(() => checkNaverMaps(attempts + 1), 100)
      } else if (!isLoaded) {
        console.warn('네이버 지도 API 로딩 타임아웃. Mock 지도를 표시합니다.')
        showMockMap('로딩 타임아웃')
      }
    }

    // API 로딩이 시작되지 않았다면 수동으로 시작
    if (typeof window.loadNaverMapAPI === 'function' && !window.naverMapLoading && !window.naverMapLoaded) {
      console.log('네이버 지도 API 수동 로딩 시작')
      try {
        window.loadNaverMapAPI()
      } catch (error) {
        console.warn('네이버 지도 API 수동 로딩 실패:', error)
        showMockMap('수동 로딩 실패')
      }
    }

    checkNaverMaps()
  }, [isLoaded])

  // 미션 마커 추가
  useEffect(() => {
    if (!map || !isLoaded) return

    // 기존 마커 제거
    markers.forEach(marker => marker.setMap(null))
    
    const newMarkers: NaverMarker[] = []

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
            background-color: ${isCompleted ? '#2E8A80' : '#262422'}; 
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
            <h4 style="margin: 0 0 8px 0; color: #1F625C; font-weight: bold;">
              ${mission.title}
            </h4>
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B6259;">
              ${mission.story.intro.substring(0, 50)}...
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #1F625C; font-weight: bold;">
                ${mission.points}점
              </span>
              <button onclick="window.selectMission && window.selectMission('${mission.missionId}')" 
                      style="
                        background: #2E8A80; 
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
    window.selectMission = (missionId: string) => {
      const mission = mainMissions.find(m => m.missionId === missionId)
      if (mission) {
        onMissionSelect(mission)
      }
    }

    setMarkers(newMarkers)
  }, [map, completedMissions, onMissionSelect, isLoaded])

  // 사용자 위치 마커
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
              background-color: #E8722C; 
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
  const showMockMap = (errorType: string = '연결 오류') => {
    if (!mapRef.current) return

    // Mock 지도 배경 생성
    const mockMapBg = document.createElement('div')
    mockMapBg.className = 'relative w-full h-full rounded-lg overflow-hidden'
    mockMapBg.style.cssText = `
      background-image: 
        radial-gradient(circle at 20% 30%, rgba(212, 184, 150, 0.3) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(193, 154, 107, 0.3) 0%, transparent 50%),
        linear-gradient(45deg, rgba(244, 241, 232, 0.8) 0%, rgba(232, 213, 183, 0.8) 100%);
    `

    // 빈티지 텍스처 오버레이
    const overlay = document.createElement('div')
    overlay.className = 'absolute inset-0 opacity-20'
    overlay.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-opacity='0.1'%3E%3Cpolygon fill='%23000' points='50 0 60 40 100 50 60 60 50 100 40 60 0 50 40 40'/%3E%3C/g%3E%3C/svg%3E")`
    mockMapBg.appendChild(overlay)

    // 오류 유형별 메시지와 해결책
    const getErrorMessage = (type: string) => {
      switch (type) {
        case 'API 인증 실패':
          return {
            icon: '🔐',
            title: '지도 API 인증 실패',
            message: '도메인 등록이 필요할 수 있습니다',
            suggestion: '잠시 후 다시 시도해주세요'
          }
        case '도메인 인증 실패':
          return {
            icon: '🌐',
            title: '도메인 인증 오류',
            message: '등록되지 않은 도메인입니다',
            suggestion: 'API 키 설정을 확인해주세요'
          }
        case 'API 할당량 초과':
          return {
            icon: '📊',
            title: 'API 사용량 초과',
            message: '일일 할당량을 초과했습니다',
            suggestion: '내일 다시 시도해주세요'
          }
        case '로딩 타임아웃':
          return {
            icon: '⏰',
            title: '지도 로딩 시간 초과',
            message: '네트워크 연결을 확인해주세요',
            suggestion: '페이지를 새로고침해보세요'
          }
        default:
          return {
            icon: '⚠️',
            title: '지도 서비스 연결 중',
            message: '네이버 지도 연결을 시도 중입니다',
            suggestion: '잠시만 기다려주세요'
          }
      }
    }

    const errorInfo = getErrorMessage(errorType)

    // 상태 메시지
    const statusDiv = document.createElement('div')
    statusDiv.className = 'absolute top-4 left-4 right-4 bg-paper/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border-l-4 border-retro'
    statusDiv.innerHTML = `
      <div class="text-center">
        <div class="text-2xl mb-2">${errorInfo.icon}</div>
        <h3 class="text-sm font-bold text-teal-dk mb-1">${errorInfo.title}</h3>
        <p class="text-xs text-ink-60 mb-2">${errorInfo.message}</p>
        <p class="text-xs text-teal-dk font-medium">${errorInfo.suggestion}</p>
        ${errorType === 'API 인증 실패' ? `
          <div class="mt-3 p-2 bg-cream rounded text-xs">
            <p class="text-ink-60">
              <strong>개발자 정보:</strong><br>
              현재 도메인이 네이버 클라우드 플랫폼에<br>
              등록되지 않았을 수 있습니다.
            </p>
          </div>
        ` : ''}
      </div>
    `
    mockMapBg.appendChild(statusDiv)

    // Mock 미션 마커들 추가
    mainMissions.forEach((mission, index) => {
      const marker = document.createElement('button')
      marker.className = 'absolute w-12 h-12 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-110 z-10'
      
      const isCompleted = completedMissions.includes(mission.missionId)
      
      // Mock 위치 (화면 좌표)
      const positions = [
        { top: '25%', left: '30%' },
        { top: '45%', left: '65%' },
        { top: '65%', left: '25%' },
        { top: '35%', left: '75%' },
        { top: '75%', left: '50%' }
      ]
      
      marker.style.top = positions[index]?.top || '50%'
      marker.style.left = positions[index]?.left || '50%'
      
      marker.innerHTML = `
        <div style="position: relative;">
          <div style="
            width: 48px; 
            height: 48px; 
            border-radius: 50%; 
            background-color: ${isCompleted ? '#2E8A80' : '#262422'}; 
            border: 3px solid white; 
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">
            ${isCompleted ? '✓' : index + 1}
          </div>
        </div>
      `
      
      marker.onclick = () => onMissionSelect(mission)
      mockMapBg.appendChild(marker)
    })

    // 사용자 위치 마커 (Mock)
    if (userLocation) {
      const userMarker = document.createElement('div')
      userMarker.className = 'absolute w-4 h-4 transform -translate-x-1/2 -translate-y-1/2 z-20'
      userMarker.style.top = '50%'
      userMarker.style.left = '45%'
      
      userMarker.innerHTML = `
        <div style="position: relative;">
          <div style="
            width: 16px; 
            height: 16px; 
            border-radius: 50%; 
            background-color: #E8722C; 
            border: 2px solid white; 
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
      `
      mockMapBg.appendChild(userMarker)
    }

    mapRef.current.innerHTML = ''
    mapRef.current.appendChild(mockMapBg)
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
            alert('위치 정보를 가져오는 데 실패했습니다. 브라우저 설정을 확인해주세요.')
            // 김해 중심으로 이동
            const center = new window.naver.maps.LatLng(35.228802, 128.877551)
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
          className="w-10 h-10 bg-paper text-teal-dk rounded-full shadow-lg flex items-center justify-center hover:bg-cream transition-colors"
          title="현재 위치"
        >
          📍
        </button>
        <button 
          onClick={zoomIn}
          className="w-10 h-10 bg-paper text-teal-dk rounded-full shadow-lg flex items-center justify-center hover:bg-cream transition-colors"
          title="확대"
        >
          <span style={{ fontSize: '16px' }}>+</span>
        </button>
        <button 
          onClick={zoomOut}
          className="w-10 h-10 bg-paper text-teal-dk rounded-full shadow-lg flex items-center justify-center hover:bg-cream transition-colors"
          title="축소"
        >
          <span style={{ fontSize: '18px' }}>-</span>
        </button>
      </div>

      {/* 지도 범례 */}
      <div className="absolute bottom-4 left-4 bg-paper/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="text-xs text-ink-60">
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-shell"></div>
            <span>미녹음 트랙</span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-teal"></div>
            <span>기록된 트랙</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-retro"></div>
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