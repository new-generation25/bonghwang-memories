'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import { subscribeAuth, getProfile, signOutUser, Profile } from '@/lib/auth'
import { auth, isFirebaseReady } from '@/lib/firebase'
import {
  claimTour,
  pullTour,
  pushTour,
  releaseTour,
  startTourSync,
  syncUserStats,
} from '@/lib/tourSync'
import { clearLocalPoints, flushPendingPoints } from '@/lib/points'
import { markAdminAccount } from '@/lib/admin'
import { resetTour } from '@/lib/tourState'

interface AuthContextValue {
  profile: Profile | null
  /** 최초 로그인 상태 확인이 끝났는지 — 확인 전에는 UI를 확정하지 않는다 */
  loading: boolean
  /** Firebase 환경 변수가 설정되어 계정 기능을 쓸 수 있는지 */
  available: boolean
  /** 로그인/가입 직후 이미 받아둔 프로필을 즉시 반영한다 */
  applyProfile: (profile: Profile) => void
  refresh: () => Promise<void>
  /** 서버 저장이 확인돼 이 기기의 기록까지 지웠으면 true */
  logout: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  available: false,
  applyProfile: () => {},
  refresh: async () => {},
  logout: async () => false,
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

  // 진행도 동기화 구독 해제 함수 — 로그아웃·계정 전환 때 끊는다
  const stopSyncRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setAvailable(isFirebaseReady())

    const unsubscribe = subscribeAuth(async (user) => {
      // 이전 계정의 동기화를 먼저 끊는다
      stopSyncRef.current?.()
      stopSyncRef.current = null

      if (user) {
        try {
          setProfile(await getProfileWithRetry(user.uid))
        } catch {
          setProfile(null)
        }
        // 서버 기록을 로컬과 병합한 뒤(기기 교체 대비) 이후 변경을 계속 올린다
        try {
          // 남이 쓰던 기기면 그 기록을 먼저 비운다 — 안 그러면 남의 진행도가
          // 내 투어에 섞여 서버로 올라간다
          claimTour(user.uid)
          await pullTour(user.uid)
          await pushTour(user.uid)
          stopSyncRef.current = startTourSync(user.uid)
          // 로그인 전에 쌓인 적립을 올린다 — 투어 도중 로그인하는 경우가 있다
          await flushPendingPoints(user.uid)
          await syncUserStats(user.uid)
          // 관리자 계정이면 문서에 표시를 남긴다. 랭킹처럼 남이 보는
          // 화면에서 관리자를 빼려면 토큰이 아니라 문서에 있어야 한다.
          await markAdminAccount(user.uid)
        } catch {
          // 동기화 실패로 투어를 막지 않는다 — localStorage가 원본이다
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      stopSyncRef.current?.()
      stopSyncRef.current = null
      unsubscribe()
    }
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

  /**
   * 로그아웃.
   *
   * 예전에는 서버 저장과 signOut만 하고 이 기기의 기록은 그대로 뒀다.
   * 그래서 로그아웃해도 랜딩에는 '이어서 걷기'가 남고 포인트도 그대로라
   * 로그아웃이 안 된 것처럼 보였다. 다음 사람이 같은 폰을 쓰면 남의 진행도를
   * 이어받는다.
   *
   * 지우기 전에 서버 저장이 정말 됐는지 확인한다. 저장되지 않았는데 지우면
   * 걸어온 90분이 사라진다 — 그럴 땐 로컬을 남기고 false를 돌려준다.
   */
  const logout = useCallback(async (): Promise<boolean> => {
    const uid = auth?.currentUser?.uid
    const saved = uid ? await pushTour(uid) : false

    stopSyncRef.current?.()
    stopSyncRef.current = null
    await signOutUser()
    setProfile(null)

    if (saved) {
      resetTour()
      clearLocalPoints()
      releaseTour()
    }
    return saved
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
