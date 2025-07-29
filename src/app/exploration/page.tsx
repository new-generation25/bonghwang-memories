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
    <div className="min-h-screen bg-vintage-paper pb-32">
      {/* Header */}
      <div className="bg-vintage-cream border-b-2 border-sepia-300 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="font-vintage text-lg text-vintage-brown text-center leading-tight">
            {getCurrentMissionTitle()}
          </h1>
          
          {/* Progress indicator */}
          <div className="mt-3 flex items-center justify-center space-x-2">
            {mainMissions.map((mission, index) => (
              <div
                key={mission.missionId}
                className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                  completedMissions.includes(mission.missionId)
                    ? 'bg-vintage-gold border-vintage-gold'
                    : index === completedMissions.length
                    ? 'bg-white border-vintage-brown animate-pulse'
                    : 'bg-sepia-200 border-sepia-300'
                }`}
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
        <div className="mt-6 bg-vintage-cream rounded-lg p-4 shadow-lg">
          <h3 className="font-handwriting text-lg text-vintage-brown mb-3 text-center">
            탐험 현황
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-vintage-gold">
                {completedMissions.length}
              </div>
              <div className="text-sm text-sepia-600 font-handwriting">
                완료한 기억
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-sepia-700">
                {5 - completedMissions.length}
              </div>
              <div className="text-sm text-sepia-600 font-handwriting">
                남은 기억
              </div>
            </div>
          </div>

          {/* Next mission hint */}
          {completedMissions.length < 5 && (
            <div className="mt-4 p-3 bg-sepia-100 rounded-lg">
              <h4 className="font-handwriting text-sm text-sepia-700 mb-1">
                다음 기억을 찾으려면:
              </h4>
              <p className="text-xs text-sepia-600 font-handwriting">
                지도의 나침반 아이콘을 터치해보세요
              </p>
            </div>
          )}

          {/* All completed message */}
          {completedMissions.length === 5 && (
            <div className="mt-4 p-3 bg-vintage-gold/20 border border-vintage-gold rounded-lg">
              <h4 className="font-handwriting text-sm text-vintage-brown mb-1">
                🎉 모든 기억을 되찾았습니다!
              </h4>
              <p className="text-xs text-sepia-600 font-handwriting">
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