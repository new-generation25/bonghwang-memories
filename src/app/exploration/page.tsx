'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mission, LocationData } from '@/lib/types'
import { mainMissions } from '@/lib/missions'
import Map from '@/components/Map'
import MissionModal from '@/components/MissionModal'
import Navigation from '@/components/Navigation'
import { syncToLocalStorage } from '@/lib/database'

export default function ExplorationPage() {
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [completedMissions, setCompletedMissions] = useState<string[]>([])
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [currentMissionStep, setCurrentMissionStep] = useState(1)
  const router = useRouter()

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          console.error('Location error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 600000
        }
      )
    }
  }, [])

  // Load completed missions from localStorage and sync with Firebase
  useEffect(() => {
    const loadMissions = async () => {
      const userId = localStorage.getItem('userId')
      
      if (userId) {
        try {
          // Sync Firebase data to localStorage
          await syncToLocalStorage(userId)
        } catch (error) {
          console.error('Error syncing from Firebase:', error)
        }
      }
      
      // Load from localStorage (either original or synced data)
      const saved = localStorage.getItem('completedMissions')
      if (saved) {
        setCompletedMissions(JSON.parse(saved))
      }
    }
    
    loadMissions()
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

  // 새 제목 형식: "첫 번째 소원: 엄마와의 러브스토리 — 봉황1935"
  const getCurrentMissionTitle = () => {
    const nextMission = mainMissions.find(m => !completedMissions.includes(m.missionId))
    if (nextMission) {
      return nextMission.title
    }
    return completedMissions.length === 5 ? '다섯 소원을 모두 이뤘습니다!' : '첫 번째 소원을 찾아서'
  }

  const progressPct = Math.round((completedMissions.length / 5) * 100)

  return (
    <div className="min-h-screen pb-32 bg-cream-base">
      {/* 앱바 — 티얼 구조색 */}
      <header className="appbar px-4 pt-3 pb-3">
        <div className="max-w-md mx-auto">
          <span className="appbar-badge">SIDE A · 아버지의 타임캡슐</span>
          <h1 className="appbar-title mt-1 text-[17px] leading-tight">
            {getCurrentMissionTitle()}
          </h1>
        </div>
      </header>

      {/* 트랙바 — 테이프 감김으로 진행률 표시 */}
      <div className="trackbar px-4 py-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between font-mono-retro text-[10px] text-sunset">
            <span>TRACK {Math.min(completedMissions.length + 1, 5)} / 5</span>
            <span className="rec-dot">REC</span>
          </div>
          <div className="tape-prog mt-2">
            <div className={completedMissions.length < 5 ? 'reel spin' : 'reel'}>
              <span className="hub" />
            </div>
            <div className="bar">
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <div className="reel">
              <span className="hub" />
            </div>
          </div>

          {/* 트랙 단위 진행 표기 — 완료는 티얼, 현재는 레드 */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {mainMissions.map((mission, index) => {
              const done = completedMissions.includes(mission.missionId)
              const current = index === completedMissions.length
              return (
                <span
                  key={mission.missionId}
                  className={`flex h-6 w-6 items-center justify-center rounded text-[9px] font-black ${
                    done
                      ? 'bg-teal text-cream'
                      : current
                      ? 'bg-cream text-shell outline outline-2 outline-rec'
                      : 'bg-white/10 text-cream/40'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="card-paper shadow-lg overflow-hidden">
          <Map
            onMissionSelect={handleMissionSelect}
            completedMissions={completedMissions}
            userLocation={userLocation ? { 
              lat: userLocation.latitude, 
              lng: userLocation.longitude 
            } : undefined}
          />
        </div>

        {/* 녹음 현황 */}
        <div className="card-paper mt-6 p-4 shadow-lg">
          <h3 className="mb-3 text-center font-vintage text-base font-black text-teal-dk">
            녹음 현황
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-black text-teal-dk">
                {completedMissions.length}
              </div>
              <div className="text-xs text-ink-60">기록한 트랙</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-black text-ink-60">
                {5 - completedMissions.length}
              </div>
              <div className="text-xs text-ink-60">남은 트랙</div>
            </div>
          </div>

          {/* 다음 트랙 안내 */}
          {completedMissions.length < 5 && (
            <div className="story-card mt-4 px-3 py-2.5">
              <div className="font-mono-retro text-[9px] text-rec">NEXT TRACK</div>
              <p className="mt-1 text-xs text-ink-60">
                지도의 나침반 아이콘을 터치해 다음 이야기를 찾아보세요
              </p>
            </div>
          )}

          {/* 완주 — 노을 그라데이션은 축하 지면에만 */}
          {completedMissions.length === 5 && (
            <div className="sunset-head mt-4 rounded-lg px-3 py-3 text-center">
              <div className="font-display text-base">SIDE A 녹음 완료!</div>
              <p className="mt-1 text-[11px] font-bold">
                보물 페이지에서 남은 트랙을 수집하세요
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