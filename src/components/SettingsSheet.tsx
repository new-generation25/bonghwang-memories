'use client'

/**
 * 내 설정 시트 — 친구들 화면의 닉네임을 눌러 연다.
 *
 * 흩어져 있던 개인 설정(닉네임 변경·로그아웃)과 관리자 진입을 한곳에 모은다.
 * 관리자 항목은 관리자 계정으로 로그인했을 때만 나타난다 — 참여자에게는
 * 존재 자체가 보이지 않아야 한다.
 *
 * 로그아웃은 서버 저장이 확인돼야 이 기기의 기록을 지운다(AuthContext).
 * 저장에 실패하면 걸어온 기록이 사라지므로 그 사실을 화면에 알린다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUser } from '@/lib/admin'
import NicknameEditor from '@/components/NicknameEditor'

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsSheet({ isOpen, onClose }: SettingsSheetProps) {
  const router = useRouter()
  const { profile, logout } = useAuth()
  const [showNickname, setShowNickname] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const handleLogout = async () => {
    if (busy) return
    setBusy(true)
    setNote('')
    try {
      const saved = await logout()
      if (saved) {
        onClose()
        router.push('/')
        return
      }
      // 서버에 저장되지 않았다 — 기록을 지우지 않았음을 알린다
      setNote(
        '기록을 서버에 저장하지 못해 이 기기의 진행도를 남겨두었습니다. 잠시 후 다시 시도해주세요.'
      )
    } catch {
      setNote('로그아웃 중 문제가 생겼습니다. 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-shell/70 px-4 pb-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-paper shadow-2xl"
          style={{
            animation: 'guide-pull-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="stripe-band" />

          <div className="px-5 pb-5 pt-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[18px] text-ink">내 설정</h2>
              <span className="font-mono-retro text-[10px] tracking-wider text-teal">
                ⚙️ SETTINGS
              </span>
            </div>

            {profile ? (
              <p className="mt-1 text-[12px] text-ink-60">
                기록자 <b className="text-ink">{profile.nickname}</b>
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-ink-60">
                로그인하면 기록이 계정에 저장됩니다.
              </p>
            )}

            {note && (
              <p className="mt-3 rounded-lg bg-rec/10 px-3 py-2 text-[11.5px] leading-snug text-rec">
                {note}
              </p>
            )}

            <div className="mt-4 space-y-2">
              {profile && (
                <button
                  onClick={() => setShowNickname(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-cream px-4 py-3 text-left"
                >
                  <span className="text-[13px] font-bold text-ink">닉네임 변경</span>
                  <span className="text-[12px] text-ink-60">
                    {profile.nickname} ›
                  </span>
                </button>
              )}

              {/* 관리자 전용 — 참여자에게는 항목이 아예 보이지 않는다 */}
              {isAdminUser() && (
                <button
                  onClick={() => {
                    onClose()
                    router.push('/admin')
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-teal bg-teal/10 px-4 py-3 text-left"
                >
                  <span className="text-[13px] font-bold text-teal-dk">
                    🛠 관리자 콘솔
                  </span>
                  <span className="text-[12px] text-teal-dk">›</span>
                </button>
              )}

              {profile && (
                <button
                  onClick={handleLogout}
                  disabled={busy}
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13px] font-bold text-rec disabled:opacity-60"
                >
                  {busy ? '기록을 저장하는 중…' : '로그아웃'}
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="mt-3 w-full rounded-xl bg-cream-dp px-4 py-3 text-[13px] font-bold text-ink"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      <NicknameEditor
        isOpen={showNickname}
        onClose={() => setShowNickname(false)}
      />
    </>
  )
}
