'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mission, LocationData } from '@/lib/types'
import { mainMissions } from '@/lib/missions'
import Map from '@/components/Map'
import MissionModal from '@/components/MissionModal'
import Navigation from '@/components/Navigation'

export default function ExplorationPage() {
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [completedMissions, setCompletedMissions] = useState<string[]>([])
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [currentMissionStep, setCurrentMissionStep] = useState(1)
  const router = useRouter()

  // Get user location (disabled for PC testing)
  // TODO: Re-enable for mobile testing
  // useEffect(() => {
  //   if ('geolocation' in navigator) {
  //     navigator.geolocation.getCurrentPosition(
  //       (position) => {
  //         setUserLocation({
  //           latitude: position.coords.latitude,
  //           longitude: position.coords.longitude,
  //           accuracy: position.coords.accuracy
  //         })
  //       },
  //       (error) => {
  //         console.error('Location error:', error)
  //       },
  //       {
  //         enableHighAccuracy: true,
  //         timeout: 10000,
  //         maximumAge: 600000
  //       }
  //     )
  //   }
  // }, [])

  // Load completed missions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('completedMissions')
    if (saved) {
      setCompletedMissions(JSON.parse(saved))
    }
  }, [])

  const handleMissionSelect = (mission: Mission) => {
    setSelectedMission(mission)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedMission(null)
  }

  const handleStartMission = (mission: Mission) => {
    setIsModalOpen(false)
    router.push(`/mission/${mission.missionId}`)
  }

  const getCurrentMissionTitle = () => {
    const nextMission = mainMissions.find(m => !completedMissions.includes(m.missionId))
    if (nextMission) {
      return `${nextMission.order}단계: ${nextMission.title.split(':')[0]}를 찾아서`
    }
    return completedMissions.length === 5 ? '모든 기억을 되찾았습니다!' : '아버지의 첫 번째 기억을 찾아서'
  }

  return (
    <div className="min-h-screen pb-32" style={{
      background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))'
    }}>
      {/* Header */}
      <div className="border-b-2 shadow-lg" style={{ 
        backgroundColor: '#F5F5DC', 
        borderColor: '#E8D5B7' 
      }}>
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg text-center leading-tight font-bold" style={{
            color: '#8B4513',
            fontFamily: 'Noto Serif KR, serif'
          }}>
            {getCurrentMissionTitle()}
          </h1>
          
          {/* Progress indicator */}
          <div className="mt-3 flex items-center justify-center space-x-2">
            {mainMissions.map((mission, index) => (
              <div
                key={mission.missionId}
                className="w-3 h-3 rounded-full border-2 transition-all duration-300"
                style={{
                  backgroundColor: completedMissions.includes(mission.missionId)
                    ? '#DAA520'
                    : index === completedMissions.length
                    ? 'white'
                    : '#F0E6D2',
                  borderColor: completedMissions.includes(mission.missionId)
                    ? '#DAA520'
                    : index === completedMissions.length
                    ? '#8B4513'
                    : '#E8D5B7',
                  animation: index === completedMissions.length ? 'pulse 2s infinite' : 'none'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <Map
            onMissionSelect={handleMissionSelect}
            completedMissions={completedMissions}
            userLocation={userLocation ? { 
              lat: userLocation.latitude, 
              lng: userLocation.longitude 
            } : undefined}
          />
        </div>

        {/* Mission statistics */}
        <div className="mt-6 rounded-lg p-4 shadow-lg" style={{ backgroundColor: '#F5F5DC' }}>
          <h3 className="text-lg mb-3 text-center font-bold" style={{
            color: '#8B4513',
            fontFamily: 'Noto Sans KR, sans-serif'
          }}>
            탐험 현황
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#DAA520' }}>
                {completedMissions.length}
              </div>
              <div className="text-sm" style={{ 
                color: '#A67C5A',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}>
                완료한 기억
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#856447' }}>
                {5 - completedMissions.length}
              </div>
              <div className="text-sm" style={{ 
                color: '#A67C5A',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}>
                남은 기억
              </div>
            </div>
          </div>

          {/* Next mission hint */}
          {completedMissions.length < 5 && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#F7F3E9' }}>
              <h4 className="text-sm mb-1 font-bold" style={{
                color: '#856447',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}>
                다음 기억을 찾으려면:
              </h4>
              <p className="text-xs" style={{
                color: '#A67C5A',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}>
                지도의 나침반 아이콘을 터치해보세요
              </p>
            </div>
          )}

          {/* All completed message */}
          {completedMissions.length === 5 && (
            <div className="mt-4 p-3 border rounded-lg" style={{
              backgroundColor: 'rgba(218, 165, 32, 0.2)',
              borderColor: '#DAA520'
            }}>
              <h4 className="text-sm mb-1 font-bold" style={{
                color: '#8B4513',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}>
                🎉 모든 기억을 되찾았습니다!
              </h4>
              <p className="text-xs" style={{
                color: '#A67C5A',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}>
                이제 보물 페이지에서 숨겨진 보물들을 찾아보세요
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mission Modal */}
      <MissionModal
        mission={selectedMission}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onStartMission={handleStartMission}
        isCompleted={selectedMission ? completedMissions.includes(selectedMission.missionId) : false}
      />

      {/* Navigation */}
      <Navigation completedMainMissions={completedMissions.length} />
    </div>
  )
}