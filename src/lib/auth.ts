import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseReady } from './firebase'

/**
 * 계정 시스템.
 *
 * 지금은 아이디/비밀번호만 지원한다. Firebase Auth는 이메일을 식별자로 쓰므로
 * 아이디를 `{id}@ID_DOMAIN` 형태의 내부 이메일로 변환해 저장한다.
 * 사용자에게는 이 이메일이 노출되지 않는다.
 *
 * 나중에 카카오/구글을 붙일 때는 signInWithPopup 계열을 추가하고
 * 프로필의 provider 값만 'kakao' | 'google'로 넣으면 나머지 계층은 그대로 쓸 수 있다.
 */
const ID_DOMAIN = 'bonghwang.local'

export type AuthProvider = 'password' | 'google' | 'kakao'

export interface Profile {
  uid: string
  loginId: string
  nickname: string
  provider: AuthProvider
  totalScore: number
  completedMissions: string[]
}

/** 도메인 로직상 로그인 아이디 규칙 — 영문/숫자/밑줄 4~20자 */
const ID_PATTERN = /^[a-zA-Z0-9_]{4,20}$/
/** Firebase Auth가 요구하는 최소 길이 */
const MIN_PASSWORD_LENGTH = 6

export function validateLoginId(loginId: string): string | null {
  if (!loginId) return '아이디를 입력해주세요.'
  if (!ID_PATTERN.test(loginId)) {
    return '아이디는 영문·숫자·밑줄 4~20자여야 합니다.'
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return '비밀번호를 입력해주세요.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  }
  return null
}

export function validateNickname(nickname: string): string | null {
  const trimmed = nickname.trim()
  if (!trimmed) return '닉네임을 입력해주세요.'
  if (trimmed.length > 12) return '닉네임은 12자 이하여야 합니다.'
  return null
}

const toInternalEmail = (loginId: string) => `${loginId.toLowerCase()}@${ID_DOMAIN}`

/** Firebase 오류 코드를 사용자가 읽을 수 있는 한국어로 변환 */
function toKoreanError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 아이디입니다.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '아이디 또는 비밀번호가 올바르지 않습니다.'
    case 'auth/weak-password':
      return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
    case 'auth/too-many-requests':
      return '시도가 너무 잦습니다. 잠시 후 다시 시도해주세요.'
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.'
    default:
      return '처리 중 문제가 발생했습니다. 다시 시도해주세요.'
  }
}

class AuthUnavailableError extends Error {
  constructor() {
    super('계정 기능이 아직 설정되지 않았습니다. (Firebase 환경 변수 필요)')
    this.name = 'AuthUnavailableError'
  }
}

function requireAuth() {
  if (!isFirebaseReady() || !auth || !db) throw new AuthUnavailableError()
  return { auth, db }
}

/** 회원가입 — 계정 생성 후 Firestore에 프로필 문서를 만든다 */
export async function signUp(
  loginId: string,
  password: string,
  nickname: string
): Promise<Profile> {
  const { auth: a, db: d } = requireAuth()

  try {
    const cred = await createUserWithEmailAndPassword(a, toInternalEmail(loginId), password)
    const trimmedNickname = nickname.trim()

    await updateProfile(cred.user, { displayName: trimmedNickname })

    const profile: Profile = {
      uid: cred.user.uid,
      loginId: loginId.toLowerCase(),
      nickname: trimmedNickname,
      provider: 'password',
      totalScore: 0,
      completedMissions: [],
    }

    await setDoc(doc(d, 'users', cred.user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    })

    return profile
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    throw new Error(toKoreanError(code))
  }
}

/** 로그인 */
export async function signIn(loginId: string, password: string): Promise<Profile> {
  const { auth: a } = requireAuth()

  try {
    const cred = await signInWithEmailAndPassword(a, toInternalEmail(loginId), password)
    const profile = await getProfile(cred.user.uid)
    if (profile) return profile

    // 프로필 문서가 없는 계정(수동 생성 등) — 최소 정보로 복구
    return {
      uid: cred.user.uid,
      loginId: loginId.toLowerCase(),
      nickname: cred.user.displayName || loginId,
      provider: 'password',
      totalScore: 0,
      completedMissions: [],
    }
  } catch (error) {
    if (error instanceof AuthUnavailableError) throw error
    const code = (error as { code?: string }).code ?? ''
    throw new Error(toKoreanError(code))
  }
}

export async function signOutUser(): Promise<void> {
  if (!auth) return
  await signOut(auth)
}

export async function getProfile(uid: string): Promise<Profile | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as Profile) : null
}

/** 로그인 상태 구독. Firebase 미설정이면 즉시 비로그인으로 통지한다 */
export function subscribeAuth(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}
