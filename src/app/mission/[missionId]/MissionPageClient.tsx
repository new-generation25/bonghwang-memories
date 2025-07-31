'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mission } from '@/lib/types'
import { mainMissions, subMissions } from '@/lib/missions'
import MissionCamera from '@/components/MissionCamera'
import MissionQuiz from '@/components/MissionQuiz'
import MissionGPS from '@/components/MissionGPS'
import QRScanner from '@/components/QRScanner'
import { completeMission } from '@/lib/database'

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

  // Find mission by ID and start immediately
  useEffect(() => {
    const foundMission = [...mainMissions, ...subMissions].find(m => m.missionId === missionId)
    if (foundMission) {
      setMission(foundMission)
      // Start mission immediately
      setCurrentStep('mission')
      
      switch (foundMission.type) {
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
          alert('AR 기능은 준비 중입니다!')
          break
      }
    } else {
      router.push('/exploration')
    }
  }, [missionId, router])


  const handleMissionComplete = async (success: boolean, data?: any) => {
    if (success) {
      setMissionData(data)
      setCurrentStep('complete')
      
      const userId = localStorage.getItem('userId')
      const points = data?.usedHint ? mission!.points - 20 : mission!.points
      
      // Save to localStorage (fallback)
      const completedMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
      if (!completedMissions.includes(mission!.missionId)) {
        completedMissions.push(mission!.missionId)
        localStorage.setItem('completedMissions', JSON.stringify(completedMissions))
      }
      const currentScore = parseInt(localStorage.getItem('totalScore') || '0')
      localStorage.setItem('totalScore', (currentScore + points).toString())

      // Save to Firebase
      if (userId) {
        try {
          await completeMission(userId, mission.missionId, points)
        } catch (error) {
          console.error('Error saving mission to Firebase:', error)
        }
      }
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
    // Accept any valid QR code for demo purposes
    // You can add specific validation logic here if needed
    console.log('QR Code scanned:', data)
    handleMissionComplete(true, { qrData: data })
  }

  const handleGoBack = () => {
    router.push('/exploration')
  }

  if (!mission) return null

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(145deg, rgb(244, 241, 232), rgb(240, 230, 210))'
    }}>

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
미션 완료!
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
          onClose={() => {
            setShowCamera(false)
            router.push('/exploration')
          }}
        />
      )}

      {showQuiz && (
        <MissionQuiz
          mission={mission}
          onComplete={handleQuizComplete}
          onClose={() => {
            setShowQuiz(false)
            router.push('/exploration')
          }}
        />
      )}

      {showGPS && (
        <MissionGPS
          mission={mission}
          onComplete={handleGPSComplete}
          onClose={() => {
            setShowGPS(false)
            router.push('/exploration')
          }}
        />
      )}

      {showQRScanner && (
        <QRScanner
          onScanSuccess={handleQRScanSuccess}
          onClose={() => {
            setShowQRScanner(false)
            router.push('/exploration')
          }}
        />
      )}
    </div>
  )
}