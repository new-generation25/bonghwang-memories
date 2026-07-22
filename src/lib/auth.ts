import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
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
  if (trimmed.length < 2) return '닉네임은 2자 이상이어야 합니다.'
  if (trimmed.length > 12) return '닉네임은 12자 이하여야 합니다.'
  return null
}

/**
 * 닉네임 중복 확인.
 *
 * users 문서는 읽기 공개(firestore.rules)라 클라이언트에서 조회할 수 있다.
 * 대소문자·앞뒤 공백 차이로 같은 이름이 여러 개 생기지 않도록
 * 비교용 소문자 키(nicknameKey)를 함께 저장하고 그 키로 찾는다.
 *
 * 주의: 이건 편의 검사다. 두 사람이 동시에 같은 이름을 넣으면 둘 다 통과할 수
 * 있다. 완전한 유일성이 필요해지면 Firestore 트랜잭션이나
 * nicknames/{key} 예약 문서가 필요하다.
 */
export function toNicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase()
}

export async function isNicknameTaken(
  nickname: string,
  /** 본인 문서는 중복으로 치지 않는다(닉네임 변경 시) */
  exceptUid?: string
): Promise<boolean> {
  if (!isFirebaseReady() || !db) return false
  const key = toNicknameKey(nickname)
  if (!key) return false

  const users = collection(db, 'users')
  // nicknameKey는 이번 개편부터 저장한다. 그 전에 만들어진 문서에는 없으므로
  // 원문 nickname으로도 한 번 더 찾는다(대소문자까지는 못 잡지만 정확 일치는 잡힌다).
  const [byKey, byName] = await Promise.all([
    getDocs(query(users, where('nicknameKey', '==', key), limit(2))),
    getDocs(query(users, where('nickname', '==', nickname.trim()), limit(2))),
  ])

  return [...byKey.docs, ...byName.docs].some((d) => d.id !== exceptUid)
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
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '로그인 창이 닫혔습니다. 다시 시도해주세요.'
    case 'auth/popup-blocked':
      return '브라우저가 팝업을 차단했습니다. 팝업을 허용한 뒤 다시 시도해주세요.'
    case 'auth/account-exists-with-different-credential':
      return '이미 다른 방식으로 가입된 계정입니다. 기존 방식으로 로그인해주세요.'
    case 'auth/unauthorized-domain':
      return '이 도메인은 로그인이 허용되지 않았습니다. 관리자에게 문의해주세요.'
    default:
      return '처리 중 문제가 발생했습니다. 다시 시도해주세요.'
  }
}

/** 닉네임 규칙(12자 이하)에 맞게 다듬는다. 구글 이름이 길 수 있다 */
function toNickname(displayName: string | null, uid: string): string {
  const trimmed = (displayName ?? '').trim()
  if (trimmed) return trimmed.slice(0, 12)
  return `기록자${uid.slice(0, 4)}`
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
  const trimmedNickname = nickname.trim()

  // 계정을 만들기 전에 닉네임부터 확인한다 —
  // 계정 생성 후에 실패하면 닉네임 없는 계정이 남는다
  if (await isNicknameTaken(trimmedNickname)) {
    throw new Error('이미 사용 중인 닉네임입니다. 다른 이름을 골라주세요.')
  }

  try {
    const cred = await createUserWithEmailAndPassword(a, toInternalEmail(loginId), password)

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
      nicknameKey: toNicknameKey(trimmedNickname),
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

/** 구글 로그인 결과 — 신규 계정이면 닉네임을 받아야 한다 */
export type GoogleSignInResult =
  | { kind: 'existing'; profile: Profile }
  | { kind: 'new'; uid: string; suggestedNickname: string }

/**
 * 구글 로그인.
 *
 * 기존 사용자면 프로필을 그대로 돌려준다.
 * 신규면 여기서 문서를 만들지 않고 'new'를 돌려준다 — 구글 계정의 실명이
 * 커뮤니티에 그대로 노출되지 않도록, 닉네임을 직접 정한 뒤에 문서를 만든다
 * (completeGoogleSignUp).
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const { auth: a } = requireAuth()

  try {
    const provider = new GoogleAuthProvider()
    // 계정이 여러 개일 때 매번 고를 수 있도록
    provider.setCustomParameters({ prompt: 'select_account' })

    const cred = await signInWithPopup(a, provider)
    const existing = await getProfile(cred.user.uid)
    if (existing) return { kind: 'existing', profile: existing }

    return {
      kind: 'new',
      uid: cred.user.uid,
      // 실명을 기본값으로 넣지 않는다 — 사용자가 의식하지 않고 넘기면
      // 그대로 공개되기 때문. 자동 생성 이름을 제안한다.
      suggestedNickname: toNickname(null, cred.user.uid),
    }
  } catch (error) {
    if (error instanceof AuthUnavailableError) throw error
    const code = (error as { code?: string }).code ?? ''
    throw new Error(toKoreanError(code))
  }
}

/** 구글 신규 가입 마무리 — 닉네임을 확정하고 프로필 문서를 만든다 */
export async function completeGoogleSignUp(
  uid: string,
  nickname: string
): Promise<Profile> {
  const { auth: a, db: d } = requireAuth()
  const trimmed = nickname.trim()

  const invalid = validateNickname(trimmed)
  if (invalid) throw new Error(invalid)
  if (await isNicknameTaken(trimmed, uid)) {
    throw new Error('이미 사용 중인 닉네임입니다. 다른 이름을 골라주세요.')
  }

  const profile: Profile = {
    uid,
    loginId: '', // 구글 계정은 아이디/비밀번호를 쓰지 않는다
    nickname: trimmed,
    provider: 'google',
    totalScore: 0,
    completedMissions: [],
  }

  await setDoc(doc(d, 'users', uid), {
    ...profile,
    nicknameKey: toNicknameKey(trimmed),
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  })

  if (a.currentUser && a.currentUser.uid === uid) {
    await updateProfile(a.currentUser, { displayName: trimmed })
  }

  return profile
}

/** 닉네임 변경 — 중복 확인 후 프로필 문서와 Auth displayName을 함께 갱신 */
export async function changeNickname(
  uid: string,
  nickname: string
): Promise<string> {
  const { auth: a, db: d } = requireAuth()
  const trimmed = nickname.trim()

  const invalid = validateNickname(trimmed)
  if (invalid) throw new Error(invalid)
  if (await isNicknameTaken(trimmed, uid)) {
    throw new Error('이미 사용 중인 닉네임입니다. 다른 이름을 골라주세요.')
  }

  await updateDoc(doc(d, 'users', uid), {
    nickname: trimmed,
    nicknameKey: toNicknameKey(trimmed),
    lastUpdated: serverTimestamp(),
  })

  if (a.currentUser && a.currentUser.uid === uid) {
    await updateProfile(a.currentUser, { displayName: trimmed })
  }

  return trimmed
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
