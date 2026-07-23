'use client'

/**
 * 닉네임 변경.
 *
 * 커뮤니티 글·랭킹에 이 이름이 그대로 나간다. 구글로 가입하면 예전에는
 * 계정 이름이 그대로 들어갔고, 한번 정해지면 바꿀 방법이 없었다.
 * 실명이 공개된 채로 남는 셈이라 여기서 고칠 수 있게 한다.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { changeNickname, validateNickname } from '@/lib/auth'
import { submitOnEnter } from '@/lib/submitOnEnter'

export default function NicknameEditor({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { profile, applyProfile } = useAuth()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setValue(profile?.nickname ?? '')
    setError('')
    // 바꾸러 들어온 것이므로 바로 고칠 수 있게 전체 선택해 둔다
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 60)
    return () => window.clearTimeout(t)
  }, [isOpen, profile?.nickname])

  if (!isOpen || !profile) return null

  const save = async () => {
    if (busy) return
    const trimmed = value.trim()
    if (trimmed === profile.nickname) {
      onClose()
      return
    }
    const invalid = validateNickname(trimmed)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await changeNickname(profile.uid, trimmed)
      applyProfile({ ...profile, nickname: saved })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '바꾸지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-shell/60 px-5"
      onClick={onClose}
    >
      <div
        className="card-paper w-full max-w-[340px] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stripe-band" />
        <div className="p-5">
          <p className="font-mono-retro text-[9px] tracking-widest text-rec">
            PROFILE
          </p>
          <h2 className="mt-1 font-vintage text-[16px] font-black text-teal-dk">
            닉네임 바꾸기
          </h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-60">
            커뮤니티 글과 랭킹에 이 이름으로 나옵니다.
          </p>

          <input
            ref={inputRef}
            type="text"
            value={value}
            maxLength={12}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={submitOnEnter(save)}
            placeholder="12자 이내"
            className="mt-3 w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] outline-none focus:border-teal"
          />

          {error && (
            <p className="mt-2 rounded-lg bg-rec/10 px-3 py-2 text-[11.5px] font-bold text-rec">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-line bg-paper py-2.5 text-[13px] text-ink"
            >
              그대로 두기
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="btn-teal flex-1 text-[14px] disabled:opacity-60"
            >
              {busy ? '바꾸는 중…' : '바꾸기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
