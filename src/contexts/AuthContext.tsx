'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { subscribeAuth, getProfile, signOutUser, Profile } from '@/lib/auth'
import { isFirebaseReady } from '@/lib/firebase'

interface AuthContextValue {
  profile: Profile | null
  /** 최초 로그인 상태 확인이 끝났는지 — 확인 전에는 UI를 확정하지 않는다 */
  loading: boolean
  /** Firebase 환경 변수가 설정되어 계정 기능을 쓸 수 있는지 */
  available: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  available: false,
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    setAvailable(isFirebaseReady())

    const unsubscribe = subscribeAuth(async (user) => {
      if (user) {
        try {
          setProfile(await getProfile(user.uid))
        } catch {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const refresh = useCallback(async () => {
    if (!profile) return
    try {
      setProfile(await getProfile(profile.uid))
    } catch {
      // 새로고침 실패는 조용히 무시 — 기존 프로필을 유지한다
    }
  }, [profile])

  const logout = useCallback(async () => {
    await signOutUser()
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider value={{ profile, loading, available, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
