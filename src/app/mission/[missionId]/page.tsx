'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Mission } from '@/lib/types'
import { mainMissions, subMissions } from '@/lib/missions'
import MissionCamera from '@/components/MissionCamera'
import MissionQuiz from '@/components/MissionQuiz'
import MissionGPS from '@/components/MissionGPS'
import QRScanner from '@/components/QRScanner'

export default function MissionPage() {
  const [mission, setMission] = useState<Mission | null>(null)
  const [currentStep, setCurrentStep] = useState<'intro' | 'mission' | 'complete'>('intro')
  const [missionData, setMissionData] = useState<any>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showGPS, setShowGPS] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const router = useRouter()
  const params = useParams()

  // Find mission by ID
  useEffect(() => {
    const missionId = params.missionId as string
    const foundMission = [...mainMissions, ...subMissions].find(m => m.missionId === missionId)
    if (foundMission) {
      setMission(foundMission)
    } else {
      router.push('/exploration')
    }
  }, [params.missionId, router])

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
    <div className="min-h-screen bg-vintage-paper">
      {currentStep === 'intro' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          {/* Mission intro */}
          <div className="max-w-md w-full">
            <div className="bg-vintage-cream border-2 border-sepia-400 rounded-lg shadow-2xl p-6 mb-6">
              <h1 className="font-vintage text-2xl text-vintage-brown mb-4 text-center">
                {mission.title}
              </h1>
              
              <div className="mb-4 text-center">
                <span className="inline-block bg-sepia-200 text-sepia-700 px-4 py-2 rounded-full text-sm font-bold">
                  {mission.type === 'PHOTO' && '📸 사진 촬영'}
                  {mission.type === 'QUIZ' && '🧩 퀴즈'}
                  {mission.type === 'GPS' && '📍 위치 인증'}
                  {mission.type === 'QR' && '📱 QR 스캔'}
                  {mission.type === 'AR' && '🔍 AR 체험'}
                </span>
              </div>

              <div className="bg-white/80 p-4 rounded-lg mb-6">
                <p className="font-handwriting text-base text-sepia-700 leading-relaxed">
                  "{mission.story.intro}"
                </p>
              </div>

              <div className="text-center text-sm text-sepia-600 mb-6">
                <p>보상: <span className="text-vintage-gold font-bold">{mission.points}점</span></p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleGoBack}
                  className="flex-1 py-3 px-4 bg-sepia-200 text-sepia-700 rounded-lg 
                           hover:bg-sepia-300 transition-colors duration-200"
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
            
            <h1 className="font-vintage text-3xl text-vintage-brown mb-4">
              미션 완료!
            </h1>
            
            <div className="bg-vintage-cream border-2 border-vintage-gold rounded-lg p-6 mb-6">
              <p className="font-handwriting text-lg text-sepia-700 mb-4">
                "{mission.story.outro}"
              </p>
              
              <div className="bg-vintage-gold/20 p-4 rounded-lg">
                <p className="text-vintage-brown font-bold text-xl">
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