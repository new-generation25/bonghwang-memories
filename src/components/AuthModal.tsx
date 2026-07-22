'use client'

import { useEffect, useState } from 'react'
import {
  signUp,
  signIn,
  signInWithGoogle,
  completeGoogleSignUp,
  isNicknameTaken,
  validateLoginId,
  validatePassword,
  validateNickname,
} from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose?: () => void
  onSuccess?: () => void
}

type Mode = 'login' | 'signup' | 'google-nickname'

/** 닉네임 중복 확인 상태 */
type NickCheck =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok' }
  | { state: 'taken' }
  | { state: 'invalid'; message: string }

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { available, applyProfile } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // 구글 신규 가입 — 닉네임을 정하기 전까지 프로필 문서를 만들지 않는다
  const [googleUid, setGoogleUid] = useState<string | null>(null)
  const [nickCheck, setNickCheck] = useState<NickCheck>({ state: 'idle' })

  /**
   * 닉네임 중복 확인 — 입력이 멈춘 뒤에 조회한다.
   * 매 글자마다 Firestore를 때리지 않도록 400ms 기다린다.
   */
  useEffect(() => {
    const trimmed = nickname.trim()
    if (!trimmed) {
      setNickCheck({ state: 'idle' })
      return
    }
    const invalid = validateNickname(trimmed)
    if (invalid) {
      setNickCheck({ state: 'invalid', message: invalid })
      return
    }

    setNickCheck({ state: 'checking' })
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const taken = await isNicknameTaken(trimmed, googleUid ?? undefined)
        if (!cancelled) setNickCheck({ state: taken ? 'taken' : 'ok' })
      } catch {
        // 조회 실패로 가입을 막지 않는다 — 최종 확인은 제출 시점에 한 번 더 한다
        if (!cancelled) setNickCheck({ state: 'idle' })
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [nickname, googleUid])

  if (!isOpen) return null

  const reset = () => {
    setError('')
    setPassword('')
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    reset()
  }

  const handleGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await signInWithGoogle()
      if (result.kind === 'existing') {
        applyProfile(result.profile)
        onSuccess?.()
        return
      }
      // 신규 — 구글 실명이 그대로 노출되지 않도록 닉네임부터 정한다
      setGoogleUid(result.uid)
      setNickname(result.suggestedNickname)
      setMode('google-nickname')
    } catch (err) {
      setError(err instanceof Error ? err.message : '구글 로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  /** 구글 신규 가입 마무리 */
  const handleGoogleNickname = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleUid) return
    setError('')
    setBusy(true)
    try {
      applyProfile(await completeGoogleSignUp(googleUid, nickname))
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '닉네임 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const idError = validateLoginId(loginId)
    if (idError) return setError(idError)

    const pwError = validatePassword(password)
    if (pwError) return setError(pwError)

    if (mode === 'signup') {
      const nickError = validateNickname(nickname)
      if (nickError) return setError(nickError)
    }

    setBusy(true)
    try {
      // 가입 직후에는 onAuthStateChanged가 프로필 문서보다 먼저 도착한다.
      // 여기서 받은 프로필을 바로 넣어 로그인 상태가 즉시 반영되게 한다.
      const profile =
        mode === 'signup'
          ? await signUp(loginId, password, nickname)
          : await signIn(loginId, password)

      applyProfile(profile)
      setPassword('')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 중 문제가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  // 가입 모드는 필드가 늘어 작은 기기에서 뷰포트를 넘는다.
  // 바깥에 세로 스크롤을 열어두지 않으면 버튼에 닿을 방법이 아예 없다.
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-shell/60 p-4 py-8 backdrop-blur-sm">
      <div className="my-auto w-full max-w-sm overflow-hidden rounded-xl bg-paper shadow-2xl">
        {/* 3색 밴드 — 브랜드 식별 */}
        <div className="stripe-rule" />

        <div className="trackbar px-5 py-4">
          <div className="font-mono-retro text-[10px] text-sunset">
            {mode === 'login'
              ? 'PLAY ▶ 기록자 인증'
              : mode === 'google-nickname'
                ? 'REC ● 이름 정하기'
                : 'REC ● 새 기록자 등록'}
          </div>
          <h2 className="appbar-title mt-1 text-[19px]">
            {mode === 'login'
              ? '다시 오셨군요'
              : mode === 'google-nickname'
                ? '어떤 이름으로 기록할까요?'
                : '기록자로 등록하기'}
          </h2>
        </div>

        {/* 구글 신규 가입 — 닉네임만 받는다 */}
        {mode === 'google-nickname' && (
          <form onSubmit={handleGoogleNickname} className="px-5 py-5">
            <p className="mb-4 rounded-lg bg-cream px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-60">
              커뮤니티와 랭킹에는 이 이름만 보입니다. 구글 계정의 실명은
              표시되지 않아요.
            </p>

            <label className="mb-1 block text-[11px] font-bold text-teal-dk">
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="2~12자"
              maxLength={12}
              autoFocus
              className="w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-teal"
            />
            <NicknameHint check={nickCheck} />

            {error && (
              <p className="mt-3 rounded-lg bg-rec/10 px-3 py-2 text-[11px] font-bold text-rec">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || nickCheck.state !== 'ok'}
              className="btn-teal mt-4 w-full text-[15px] disabled:opacity-60"
            >
              {busy ? '저장 중...' : '이 이름으로 시작하기'}
            </button>
          </form>
        )}

        {mode !== 'google-nickname' && (
        <form onSubmit={handleSubmit} className="px-5 py-5">
          {!available && (
            <div className="mb-4 rounded-lg border border-rec bg-rec/10 px-3 py-2.5 text-[11px] text-rec">
              계정 기능이 아직 연결되지 않았습니다. Firebase 환경 변수를 설정해야 로그인과
              커뮤니티가 동작합니다.
            </div>
          )}

          <label className="mb-1 block text-[11px] font-bold text-teal-dk">아이디</label>
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="영문·숫자·밑줄 4~20자"
            autoComplete="username"
            className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-teal"
          />

          {mode === 'signup' && (
            <>
              <label className="mb-1 block text-[11px] font-bold text-teal-dk">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="커뮤니티에 표시될 이름 (2~12자)"
                maxLength={12}
                className="w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-teal"
              />
              <div className="mb-3">
                <NicknameHint check={nickCheck} />
              </div>
            </>
          )}

          <label className="mb-1 block text-[11px] font-bold text-teal-dk">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-teal"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-rec/10 px-3 py-2 text-[11px] font-bold text-rec">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || (mode === 'signup' && nickCheck.state !== 'ok')}
            className="btn-teal mt-4 w-full text-[15px] disabled:opacity-60"
          >
            {busy ? '처리 중...' : mode === 'login' ? '▶ 로그인' : '● 등록하고 시작하기'}
          </button>

          <div className="mt-4 border-t border-line pt-3 text-center text-[11px] text-ink-60">
            {mode === 'login' ? (
              <>
                아직 계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-bold text-teal-dk underline"
                >
                  기록자 등록
                </button>
              </>
            ) : (
              <>
                이미 계정이 있으신가요?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-teal-dk underline"
                >
                  로그인
                </button>
              </>
            )}
          </div>

          {/* 소셜 로그인 */}
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] text-ink-60">또는</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-paper py-2.5 text-[13px] font-bold text-ink transition-colors hover:bg-cream disabled:opacity-60"
          >
            {/* 구글 브랜드 마크 */}
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
              />
              <path
                fill="#34A853"
                d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
              />
              <path
                fill="#FBBC05"
                d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
              />
              <path
                fill="#EA4335"
                d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
              />
            </svg>
            구글 계정으로 계속하기
          </button>

          <p className="mt-3 text-center text-[10px] text-ink-60">
            카카오 로그인은 준비 중입니다
          </p>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-2 text-[11px] text-ink-60 hover:text-ink"
            >
              나중에 하기
            </button>
          )}
        </form>
        )}
      </div>
    </div>
  )
}

/** 닉네임 중복 확인 결과 표시 */
function NicknameHint({ check }: { check: NickCheck }) {
  if (check.state === 'idle') return null

  const style =
    check.state === 'ok'
      ? 'text-teal-dk'
      : check.state === 'checking'
        ? 'text-ink-60'
        : 'text-rec'

  const text =
    check.state === 'checking'
      ? '확인 중…'
      : check.state === 'ok'
        ? '✓ 사용할 수 있는 이름이에요'
        : check.state === 'taken'
          ? '이미 사용 중인 이름이에요'
          : check.message

  return <p className={`mt-1 text-[11px] font-bold ${style}`}>{text}</p>
}
