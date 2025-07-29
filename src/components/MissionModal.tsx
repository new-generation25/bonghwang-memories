'use client'

import { Mission } from '@/lib/types'

interface MissionModalProps {
  mission: Mission | null
  isOpen: boolean
  onClose: () => void
  onStartMission: (mission: Mission) => void
  isCompleted: boolean
}

export default function MissionModal({ 
  mission, 
  isOpen, 
  onClose, 
  onStartMission, 
  isCompleted 
}: MissionModalProps) {
  if (!isOpen || !mission) return null

  const getMissionTypeLabel = (type: string) => {
    switch (type) {
      case 'PHOTO': return '📸 사진 촬영'
      case 'QUIZ': return '🧩 퀴즈'
      case 'GPS': return '📍 위치 인증'
      case 'QR': return '📱 QR 스캔'
      case 'AR': return '🔍 AR 체험'
      default: return type
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-vintage-cream border-2 border-sepia-400 rounded-lg shadow-2xl max-w-md w-full max-h-90vh overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 border-b border-sepia-300">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-sepia-200 hover:bg-sepia-300 
                     flex items-center justify-center transition-colors duration-200"
          >
            <span className="text-sepia-700 font-bold">×</span>
          </button>
          
          <div className="pr-8">
            <h2 className="font-vintage text-xl text-vintage-brown mb-2 leading-tight">
              {mission.title}
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm bg-sepia-200 text-sepia-700 px-3 py-1 rounded-full">
                {getMissionTypeLabel(mission.type)}
              </span>
              {isCompleted && (
                <span className="text-sm bg-vintage-gold text-white px-3 py-1 rounded-full">
                  ✓ 완료
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Story */}
          <div className="mb-6">
            <h3 className="font-handwriting text-lg text-sepia-800 mb-3">
              아버지의 편지
            </h3>
            <div className="bg-white/80 p-4 rounded-lg border border-sepia-200">
              <p className="font-handwriting text-base text-sepia-700 leading-relaxed">
                "{mission.story.intro}"
              </p>
            </div>
          </div>

          {/* Mission info */}
          <div className="mb-6">
            <h3 className="font-handwriting text-lg text-sepia-800 mb-3">
              미션 정보
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sepia-600">미션 타입:</span>
                <span className="text-sepia-800 font-medium">
                  {getMissionTypeLabel(mission.type)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sepia-600">보상 점수:</span>
                <span className="text-vintage-gold font-bold">{mission.points}점</span>
              </div>
              {mission.quiz && (
                <div className="flex justify-between">
                  <span className="text-sepia-600">퀴즈:</span>
                  <span className="text-sepia-800">있음</span>
                </div>
              )}
            </div>
          </div>

          {/* Guide photo preview */}
          {mission.guidePhotoUrl && (
            <div className="mb-6">
              <h3 className="font-handwriting text-lg text-sepia-800 mb-3">
                참고 사진
              </h3>
              <div className="polaroid">
                <div className="w-full h-32 bg-sepia-200 rounded flex items-center justify-center">
                  <span className="text-sepia-500">가이드 사진</span>
                </div>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="text-center">
            {isCompleted ? (
              <div className="bg-vintage-gold/20 border border-vintage-gold rounded-lg p-4">
                <div className="text-vintage-gold font-bold mb-2">✓ 미션 완료!</div>
                <p className="text-sm text-sepia-700">
                  {mission.story.outro}
                </p>
              </div>
            ) : (
              <button
                onClick={() => onStartMission(mission)}
                className="vintage-button w-full py-3 text-lg font-bold"
              >
                미션 시작하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}