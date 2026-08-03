import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
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
  serverTimestamp,
  deleteField,
} from 'firebase/firestore'
import { auth, db, isFirebaseReady } from './firebase'
import {
  claimNickname,
  isNicknameTaken,
  releaseNickname,
  syncRanking,
  toNicknameKey,
} from './publicMirror'

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

/*
  닉네임 열쇠와 중복 확인은 publicMirror로 옮겼다.

  예전에는 users를 직접 뒤졌다 — 읽기가 공개라 가능했던 일이다. 그 공개가
  바로 참여자 진행 상황을 통째로 새게 한 구멍이라 닫았고, '이름이
  쓰이는가'만 공개 문서(nicknames/{key})가 답한다.

  덤으로 겹침도 없어졌다. 예전 검사는 '확인하고 만드는' 두 걸음 사이에
  남이 끼어들 수 있었는데, 이제 문서 ID가 곧 이름이라 먼저 만든 쪽이 이긴다.

  부르는 쪽(AuthModal)이 여기서 가져다 쓰고 있어 이름은 그대로 내보낸다.
*/
export { toNicknameKey, isNicknameTaken } from './publicMirror'

const toInternalEmail = (loginId: string) => `${loginId.toLowerCase()}@${ID_DOMAIN}`

/**
 * 아이디를 **문서에 적지 않는다.**
 *
 * users 문서는 공개로 읽힌다 — 닉네임을 게시글·랭킹에 띄워야 해서다
 * (firestore.rules의 `allow read: if true`). 거기에 아이디가 함께 들어
 * 있으면 게시글의 authorUid로 문서를 열어 가입자 아이디를 통째로
 * 긁을 수 있다. 비밀번호의 절반이 공개돼 있는 셈이었다.
 *
 * 지울 수 있는 것은 이미 내부 이메일에 같은 값이 들어 있기 때문이다 —
 * `{아이디}@bonghwang.local`. 그 이메일은 로그인한 본인만 읽는다.
 */
const fromInternalEmail = (email: string | null | undefined): string => {
  if (!email) return ''
  const [id, domain] = email.split('@')
  return domain === ID_DOMAIN ? id : ''
}

/** 문서에 적을 몫 — loginId만 뺀다. 새 칸이 늘어도 여기 한 곳만 본다 */
const toStoredProfile = (p: Profile) => ({
  uid: p.uid,
  nickname: p.nickname,
  provider: p.provider,
  totalScore: p.totalScore,
  completedMissions: p.completedMissions,
})

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

    // loginId는 빼고 적는다 — 위 fromInternalEmail 주석 참고
    await setDoc(doc(d, 'users', cred.user.uid), {
      ...toStoredProfile(profile),
      nicknameKey: toNicknameKey(trimmedNickname),
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    })

    /*
      이름을 맡고 랭킹판에 자리를 낸다. users는 이제 본인·관리자만 읽으므로
      밖에서 보이는 것은 이 둘뿐이다.

      맡기에 실패해도 가입은 살린다 — 이미 계정이 만들어진 뒤라, 여기서
      던지면 로그인은 되는데 프로필이 없는 계정이 남는다. 겹친 이름은
      다음에 바꿀 때 걸린다.
    */
    await claimNickname(cred.user.uid, trimmedNickname).catch(() => {})
    await syncRanking(cred.user.uid, { nickname: trimmedNickname, totalPoints: 0 })

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
    /*
      prompt를 지정하지 않는다.

      전에는 `select_account`를 넣어 계정이 여러 개일 때 고를 수 있게 했는데,
      그 값은 **고를 것이 하나뿐일 때도** 선택 화면을 강제로 띄운다. 이미
      로그인해둔 사람에게도 매번 창이 떠서 "또 로그인하네"로 읽혔다.
      비워두면 구글이 알아서 판단한다 — 계정이 여럿이면 그때만 고르라고 한다.
    */
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

/**
 * 지금 계정에 구글을 잇는다.
 *
 * 왜 필요한가 — 아이디로 만든 계정과 구글 계정은 서로 다른 사람으로 잡힌다.
 * 그래서 집에서는 아이디로, 밖에서는 구글로 들어오면 **한 사람이 계정 둘**을
 * 갖게 되고 걸어온 기록과 포인트가 반씩 갈린다. 여기서 이어두면 다음부터
 * 어느 쪽으로 들어와도 같은 계정이다.
 *
 * 이미 그 구글 계정으로 만든 다른 계정이 있으면 잇지 못한다. 두 쪽에 각각
 * 기록이 쌓여 있어 하나로 합치는 것은 **자동으로 판단할 수 없다** — 어느
 * 쪽을 남길지는 사람이 정해야 한다. 그 경우를 구별해서 알려준다.
 */
export async function linkGoogle(): Promise<void> {
  const { auth: a, db: d } = requireAuth()
  const user = a.currentUser
  if (!user) throw new Error('먼저 로그인해주세요.')

  try {
    await linkWithPopup(user, new GoogleAuthProvider())
    // 프로필에도 남긴다 — 화면이 "이미 이어져 있음"을 알아야 또 권하지 않는다
    await updateDoc(doc(d, 'users', user.uid), { googleLinked: true })
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    if (code === 'auth/credential-already-in-use') {
      throw new Error(
        '그 구글 계정으로 이미 만든 기록이 따로 있어요. ' +
          '두 기록을 합치려면 운영자에게 알려주세요.'
      )
    }
    if (code === 'auth/provider-already-linked') return // 이미 이어져 있으면 할 일 없음
    throw new Error(toKoreanError(code))
  }
}

/**
 * 지금 계정에 아이디·비밀번호를 잇는다 — 구글로 시작한 사람의 반대편 길.
 *
 * 구글 로그인이 막히는 자리(앱 안 브라우저 등)에서도 들어올 수 있게 한다.
 */
export async function linkPassword(loginId: string, password: string): Promise<void> {
  const { auth: a, db: d } = requireAuth()
  const user = a.currentUser
  if (!user) throw new Error('먼저 로그인해주세요.')

  const idError = validateLoginId(loginId)
  if (idError) throw new Error(idError)
  const pwError = validatePassword(password)
  if (pwError) throw new Error(pwError)

  try {
    const credential = EmailAuthProvider.credential(toInternalEmail(loginId), password)
    await linkWithCredential(user, credential)
    /*
      아이디는 문서에 안 적는다. 이제 잇고 나면 내부 이메일이 곧 아이디라
      본인만 읽는다 — 예전에 적어 두던 것을 지우기까지 한다.
    */
    await updateDoc(doc(d, 'users', user.uid), {
      loginId: deleteField(),
      lastUpdated: serverTimestamp(),
    })
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') {
      throw new Error('이미 쓰이고 있는 아이디예요. 다른 아이디로 해주세요.')
    }
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
    ...toStoredProfile(profile),
    nicknameKey: toNicknameKey(trimmed),
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  })

  await claimNickname(uid, trimmed).catch(() => {})
  await syncRanking(uid, { nickname: trimmed, totalPoints: 0 })

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

  /*
    새 이름을 **먼저 맡는다.** 놓기부터 하면 그 사이에 남이 채갈 수 있고,
    맡기에 실패했는데 옛 이름을 이미 놓았으면 둘 다 없는 상태가 된다.
  */
  const before = (await getProfile(uid))?.nickname ?? ''
  await claimNickname(uid, trimmed)

  await updateDoc(doc(d, 'users', uid), {
    nickname: trimmed,
    nicknameKey: toNicknameKey(trimmed),
    lastUpdated: serverTimestamp(),
  })
  await syncRanking(uid, { nickname: trimmed })
  if (before && toNicknameKey(before) !== toNicknameKey(trimmed)) {
    await releaseNickname(before)
  }

  if (a.currentUser && a.currentUser.uid === uid) {
    await updateProfile(a.currentUser, { displayName: trimmed })
  }

  return trimmed
}

export async function signOutUser(): Promise<void> {
  if (!auth) return
  await signOut(auth)
}

/**
 * 프로필을 읽는다.
 *
 * `loginId`는 문서에 없다(공개로 읽히는 자리다). 본인 것을 볼 때만
 * 내부 이메일에서 되찾아 채운다 — 남의 프로필에서는 빈 문자열이고,
 * 그것이 맞다.
 */
export async function getProfile(uid: string): Promise<Profile | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data() as Profile
  const mine = auth?.currentUser?.uid === uid
  return { ...data, loginId: mine ? fromInternalEmail(auth?.currentUser?.email) : '' }
}

/** 로그인 상태 구독. Firebase 미설정이면 즉시 비로그인으로 통지한다 */
export function subscribeAuth(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}
