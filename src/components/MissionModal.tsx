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
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      style={{ touchAction: 'none' }}
      onTouchMove={(e) => e.preventDefault()}
      onWheel={(e) => e.preventDefault()}
    >
      <div className="bg-cream border-2 border-line rounded-lg shadow-2xl max-w-md w-full max-h-90vh overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 border-b border-line">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-dp hover:bg-line 
                     flex items-center justify-center transition-colors duration-200"
          >
            <span className="text-ink font-bold">×</span>
          </button>
          
          <div className="pr-8">
            <h2 className="font-vintage text-xl text-teal-dk mb-2 leading-tight">
              {mission.title}
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm bg-cream-dp text-ink px-3 py-1 rounded-full">
                {getMissionTypeLabel(mission.type)}
              </span>
              {isCompleted && (
                <span className="text-sm bg-sunset text-white px-3 py-1 rounded-full">
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
            <h3 className="font-handwriting text-lg text-ink mb-3">
              아버지의 편지
            </h3>
            <div className="bg-white/80 p-4 rounded-lg border border-line">
              <p className="font-handwriting text-base text-ink leading-relaxed">
                "{mission.story.intro}"
              </p>
            </div>
          </div>

          {/* Mission info */}
          <div className="mb-6">
            <h3 className="font-handwriting text-lg text-ink mb-3">
              미션 정보
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-60">미션 타입:</span>
                <span className="text-ink font-medium">
                  {getMissionTypeLabel(mission.type)}
                </span>
              </div>
              {mission.quiz && (
                <div className="flex justify-between">
                  <span className="text-ink-60">퀴즈:</span>
                  <span className="text-ink">있음</span>
                </div>
              )}
            </div>
          </div>

          {/* Guide photo preview */}
          {mission.guidePhotoUrl && (
            <div className="mb-6">
              <h3 className="font-handwriting text-lg text-ink mb-3">
                참고 사진
              </h3>
              <div className="polaroid">
                <div className="w-full h-32 bg-cream-dp rounded flex items-center justify-center">
                  <span className="text-ink-60">가이드 사진</span>
                </div>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="text-center">
            {isCompleted ? (
              <div className="bg-sunset/20 border border-sunset rounded-lg p-4">
                <div className="text-sunset font-bold mb-2">✓ 미션 완료!</div>
                <p className="text-sm text-ink">
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