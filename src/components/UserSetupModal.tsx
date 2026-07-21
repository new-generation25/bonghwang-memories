'use client'

import { useState } from 'react'
import { createOrUpdateUser, migrateFromLocalStorage } from '@/lib/database'

interface UserSetupModalProps {
  isOpen: boolean
  onComplete: (userId: string, gender: string) => void
}

export default function UserSetupModal({ isOpen, onComplete }: UserSetupModalProps) {
  const [userId, setUserId] = useState('')
  const [gender, setGender] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!userId.trim() || !gender) return

    setIsLoading(true)
    
    try {
      const trimmedUserId = userId.trim()
      
      // Save to localStorage
      localStorage.setItem('userId', trimmedUserId)
      localStorage.setItem('userGender', gender)
      
      // Create/update user in Firebase
      await createOrUpdateUser(trimmedUserId, trimmedUserId)
      
      // Migrate existing localStorage data to Firebase
      await migrateFromLocalStorage(trimmedUserId)
      
      // Complete setup
      onComplete(trimmedUserId, gender)
    } catch (error) {
      console.error('Error setting up user:', error)
      // Fallback to localStorage only
      onComplete(userId.trim(), gender)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-cream border-2 border-line rounded-lg shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="font-vintage text-2xl text-teal-dk mb-2">
            봉황동에 오신 것을 환영합니다
          </h2>
          <p className="font-handwriting text-base text-ink">
            아버지의 추억을 따라가기 전에, 당신을 어떻게 불러드릴까요?
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-handwriting text-ink mb-2">
              닉네임을 입력해주세요
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="예: 철수, 영희, 봉황이 등"
              className="w-full px-4 py-3 rounded-lg border-2 border-line 
                       bg-white/90 font-handwriting text-ink
                       focus:border-sunset focus:outline-none
                       placeholder:text-ink-60"
              maxLength={20}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block font-handwriting text-ink mb-3">
              성별을 선택해주세요
            </label>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setGender('male')}
                disabled={isLoading}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-handwriting text-lg
                         transition-all duration-200 disabled:opacity-50
                         ${gender === 'male' 
                           ? 'border-sunset bg-sunset/20 text-teal-dk' 
                           : 'border-line bg-white/90 text-ink hover:border-line'}`}
              >
                👦 남자아이
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                disabled={isLoading}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-handwriting text-lg
                         transition-all duration-200 disabled:opacity-50
                         ${gender === 'female' 
                           ? 'border-sunset bg-sunset/20 text-teal-dk' 
                           : 'border-line bg-white/90 text-ink hover:border-line'}`}
              >
                👧 여자아이
              </button>
            </div>
          </div>

          <div className="text-center pt-4">
            <button
              type="submit"
              disabled={!userId.trim() || !gender || isLoading}
              className="vintage-button w-full py-3 text-lg font-bold
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '설정 중...' : '추억 여행 시작하기'}
            </button>
          </div>
        </form>

        {/* Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-ink-60 font-handwriting">
            * 닉네임은 커뮤니티에서 다른 사용자들에게 표시됩니다
          </p>
        </div>
      </div>
    </div>
  )
}