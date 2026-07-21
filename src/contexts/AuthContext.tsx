'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { subscribeAuth, getProfile, signOutUser, Profile } from '@/lib/auth'
import { auth, isFirebaseReady } from '@/lib/firebase'

interface AuthContextValue {
  profile: Profile | null
  /** 최초 로그인 상태 확인이 끝났는지 — 확인 전에는 UI를 확정하지 않는다 */
  loading: boolean
  /** Firebase 환경 변수가 설정되어 계정 기능을 쓸 수 있는지 */
  available: boolean
  /** 로그인/가입 직후 이미 받아둔 프로필을 즉시 반영한다 */
  applyProfile: (profile: Profile) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  available: false,
  applyProfile: () => {},
  refresh: async () => {},
  logout: async () => {},
})

/**
 * 가입 직후에는 onAuthStateChanged가 프로필 문서 생성보다 먼저 발화한다.
 * 그 순간 조회하면 null이 나오므로, 잠깐 간격을 두고 몇 번 다시 읽는다.
 */
async function getProfileWithRetry(uid: string, attempts = 4): Promise<Profile | null> {
  for (let i = 0; i < attempts; i++) {
    const profile = await getProfile(uid)
    if (profile) return profile
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)))
    }
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    setAvailable(isFirebaseReady())

    const unsubscribe = subscribeAuth(async (user) => {
      if (user) {
        try {
          setProfile(await getProfileWithRetry(user.uid))
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

  const applyProfile = useCallback((next: Profile) => {
    setProfile(next)
    setLoading(false)
  }, [])

  const refresh = useCallback(async () => {
    // profile이 아직 없어도 로그인 세션만 있으면 다시 읽을 수 있어야 한다
    const uid = profile?.uid ?? auth?.currentUser?.uid
    if (!uid) return
    try {
      const next = await getProfileWithRetry(uid)
      if (next) setProfile(next)
    } catch {
      // 새로고침 실패는 조용히 무시 — 기존 프로필을 유지한다
    }
  }, [profile])

  const logout = useCallback(async () => {
    await signOutUser()
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ profile, loading, available, applyProfile, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
