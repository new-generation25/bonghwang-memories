'use client'

import { useState } from 'react'
import {
  signUp,
  signIn,
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

type Mode = 'login' | 'signup'

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { available, applyProfile } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const reset = () => {
    setError('')
    setPassword('')
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    reset()
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-shell/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-paper shadow-2xl">
        {/* 3색 밴드 — 브랜드 식별 */}
        <div className="stripe-band" />

        <div className="trackbar px-5 py-4">
          <div className="font-mono-retro text-[10px] text-sunset">
            {mode === 'login' ? 'PLAY ▶ 기록자 인증' : 'REC ● 새 기록자 등록'}
          </div>
          <h2 className="appbar-title mt-1 text-[19px]">
            {mode === 'login' ? '다시 오셨군요' : '기록자로 등록하기'}
          </h2>
        </div>

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
                placeholder="커뮤니티에 표시될 이름 (12자 이하)"
                className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-teal"
              />
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
            disabled={busy}
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

          {/* 소셜 로그인 자리 — 연동 시 이 영역에 버튼을 추가한다 */}
          <p className="mt-3 text-center text-[10px] text-ink-60">
            카카오 · 구글 로그인은 준비 중입니다
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
      </div>
    </div>
  )
}
