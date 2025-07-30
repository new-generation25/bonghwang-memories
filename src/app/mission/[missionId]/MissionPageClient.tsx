'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mission } from '@/lib/types'
import { mainMissions, subMissions } from '@/lib/missions'
import MissionCamera from '@/components/MissionCamera'
import MissionQuiz from '@/components/MissionQuiz'
import MissionGPS from '@/components/MissionGPS'
import QRScanner from '@/components/QRScanner'

interface MissionPageClientProps {
  missionId: string
}

export default function MissionPageClient({ missionId }: MissionPageClientProps) {
  const [mission, setMission] = useState<Mission | null>(null)
  const [currentStep, setCurrentStep] = useState<'intro' | 'mission' | 'complete'>('intro')
  const [missionData, setMissionData] = useState<any>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showGPS, setShowGPS] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const router = useRouter()

  // Find mission by ID
  useEffect(() => {
    const foundMission = [...mainMissions, ...subMissions].find(m => m.missionId === missionId)
    if (foundMission) {
      setMission(foundMission)
    } else {
      router.push('/exploration')
    }
  }, [missionId, router])

  const handleStartMission = () => {
    if (!mission) return

    setCurrentStep('mission')

    switch (mission.type) {
      case 'PHOTO':
        setShowCamera(true)
        break
      case 'QUIZ':
        setShowQuiz(true)
        break
      case 'GPS':
        setShowGPS(true)
        break
      case 'QR':
        setShowQRScanner(true)
        break
      case 'AR':
        // AR implementation would go here
        alert('AR 기능은 준비 중입니다!')
        break
    }
  }

  const handleMissionComplete = (success: boolean, data?: any) => {
    if (success) {
      setMissionData(data)
      setCurrentStep('complete')
      
      // Save to localStorage
      const completedMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
      if (!completedMissions.includes(mission!.missionId)) {
        completedMissions.push(mission!.missionId)
        localStorage.setItem('completedMissions', JSON.stringify(completedMissions))
      }

      // Save score
      const currentScore = parseInt(localStorage.getItem('totalScore') || '0')
      const points = data?.usedHint ? mission!.points - 20 : mission!.points
      localStorage.setItem('totalScore', (currentScore + points).toString())
    }
    
    // Close all modals
    setShowCamera(false)
    setShowQuiz(false)
    setShowGPS(false)
    setShowQRScanner(false)
  }

  const handlePhotoCapture = (imageData: string) => {
    handleMissionComplete(true, { imageData })
  }

  const handleQuizComplete = (success: boolean, usedHint: boolean) => {
    handleMissionComplete(success, { usedHint })
  }

  const handleGPSComplete = (success: boolean) => {
    handleMissionComplete(success)
  }

  const handleQRScanSuccess = (data: string) => {
    // Verify QR code data (you can implement validation logic here)
    const isValidQR = data.includes('bonghwang-memories') // Example validation
    handleMissionComplete(isValidQR, { qrData: data })
  }

  const handleGoBack = () => {
    router.push('/exploration')
  }

  if (!mission) return null

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))'
    }}>
      {currentStep === 'intro' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          {/* Mission intro */}
          <div className="max-w-md w-full">
            <div className="border-2 rounded-lg shadow-2xl p-6 mb-6" style={{
              backgroundColor: '#F5F5DC',
              borderColor: '#D4B896'
            }}>
              <h1 className="text-2xl mb-4 text-center font-bold" style={{
                color: '#8B4513',
                fontFamily: 'Noto Serif KR, serif'
              }}>
                {mission.title}
              </h1>
              
              <div className="mb-4 text-center">
                <span className="inline-block px-4 py-2 rounded-full text-sm font-bold" style={{
                  backgroundColor: '#F0E6D2',
                  color: '#856447'
                }}>
                  {mission.type === 'PHOTO' && '📸 사진 촬영'}
                  {mission.type === 'QUIZ' && '🧩 퀴즈'}
                  {mission.type === 'GPS' && '📍 위치 인증'}
                  {mission.type === 'QR' && '📱 QR 스캔'}
                  {mission.type === 'AR' && '🔍 AR 체험'}
                </span>
              </div>

              <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
                <p className="text-base leading-relaxed" style={{
                  color: '#856447',
                  fontFamily: 'Noto Sans KR, sans-serif'
                }}>
                  "{mission.story.intro}"
                </p>
              </div>

              <div className="text-center text-sm mb-6" style={{ color: '#A67C5A' }}>
                <p>보상: <span className="font-bold" style={{ color: '#DAA520' }}>{mission.points}점</span></p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleGoBack}
                  className="flex-1 py-3 px-4 rounded-lg transition-colors duration-200"
                  style={{
                    backgroundColor: '#F0E6D2',
                    color: '#856447'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#E8D5B7'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#F0E6D2'}
                >
                  뒤로가기
                </button>
                <button
                  onClick={handleStartMission}
                  className="flex-1 vintage-button py-3 text-lg font-bold"
                >
                  시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'complete' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Success animation */}
            <div className="text-8xl mb-6 animate-bounce">🎉</div>
            
            <h1 className="text-3xl mb-4 font-bold" style={{
              color: '#8B4513',
              fontFamily: 'Noto Serif KR, serif'
            }}>
              미션 완료!
            </h1>
            
            <div className="border-2 rounded-lg p-6 mb-6" style={{
              backgroundColor: '#F5F5DC',
              borderColor: '#DAA520'
            }}>
              <p className="text-lg mb-4" style={{
                color: '#856447',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}>
                "{mission.story.outro}"
              </p>
              
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(218, 165, 32, 0.2)' }}>
                <p className="font-bold text-xl" style={{ color: '#8B4513' }}>
                  +{missionData?.usedHint ? mission.points - 20 : mission.points}점 획득!
                </p>
              </div>
            </div>

            {/* Display captured photo if it's a photo mission */}
            {mission.type === 'PHOTO' && missionData?.imageData && (
              <div className="polaroid mb-6">
                <img 
                  src={missionData.imageData} 
                  alt="Captured photo"
                  className="w-full h-40 object-cover rounded"
                />
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleGoBack}
                className="flex-1 vintage-button py-3 text-lg font-bold"
              >
                탐험으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mission components */}
      {showCamera && (
        <MissionCamera
          onCapture={handlePhotoCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {showQuiz && (
        <MissionQuiz
          mission={mission}
          onComplete={handleQuizComplete}
          onClose={() => setShowQuiz(false)}
        />
      )}

      {showGPS && (
        <MissionGPS
          mission={mission}
          onComplete={handleGPSComplete}
          onClose={() => setShowGPS(false)}
        />
      )}

      {showQRScanner && (
        <QRScanner
          onScanSuccess={handleQRScanSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  )
}