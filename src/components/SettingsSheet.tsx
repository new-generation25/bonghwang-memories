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

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUser, isSuperAdminUser } from '@/lib/admin'
import { linkGoogle } from '@/lib/auth'
import { BUILD_COMMIT } from '@/lib/buildVersion'
import {
  openSuperAdminPanel,
  setSuperAdmin,
  superAdminSwitch,
} from '@/lib/superAdmin'
import { isSfxMuted, playDeckKey, setSfxMuted } from '@/lib/sfx'
import { REHEARSAL } from '@/lib/tracks'
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
  const [superOn, setSuperOn] = useState(false)
  const [sfxOn, setSfxOn] = useState(true)
  const [linking, setLinking] = useState(false)

  /*
    구글 잇기 — 한 사람이 계정 둘을 갖는 것을 막는다.

    아이디로 만든 계정과 구글 계정은 서로 다른 사람으로 잡힌다. 집에서는
    아이디로, 밖에서는 구글로 들어오면 걸어온 기록과 포인트가 반씩 갈린다.
    한 번 이어두면 다음부터 어느 쪽으로 들어와도 같은 계정이다.
  */
  const canLinkGoogle = Boolean(profile) && profile?.provider === 'password'

  const doLinkGoogle = async () => {
    setLinking(true)
    setNote('')
    try {
      await linkGoogle()
      setNote('✅ 구글 계정을 이었어요. 이제 어느 쪽으로 들어와도 같은 기록입니다.')
    } catch (e) {
      setNote(e instanceof Error ? e.message : '잇지 못했습니다.')
    } finally {
      setLinking(false)
    }
  }

  // 시트가 열릴 때 저장값을 읽는다 — 첫 그림에 읽으면 서버 렌더와 어긋난다
  useEffect(() => {
    if (isOpen) {
      setSuperOn(superAdminSwitch())
      setSfxOn(!isSfxMuted())
    }
  }, [isOpen])

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
              <p className="mt-1 flex items-baseline justify-between gap-2 text-[12px] text-ink-60">
                <span>
                  기록자 <b className="text-ink">{profile.nickname}</b>
                </span>
                {/*
                  이 판이 어느 커밋인지 — 관리자에게만.

                  "고쳤다는데 그대로다"를 확인하려고 조작 패널까지 세 번을
                  들어가야 했다. 설정을 여는 순간 보이면 그걸로 끝난다.
                  참여자에게는 알릴 값이 아니라 관리자 계정에서만 뜬다.
                */}
                {isAdminUser() && BUILD_COMMIT && (
                  <span className="shrink-0 font-mono-retro text-[10px] text-ink-60">
                    {BUILD_COMMIT}
                  </span>
                )}
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

              {canLinkGoogle && (
                <button
                  onClick={doLinkGoogle}
                  disabled={linking}
                  className="w-full rounded-xl border border-line bg-cream px-4 py-3 text-left disabled:opacity-50"
                >
                  <span className="text-[13px] font-bold text-ink">
                    {linking ? '잇는 중…' : '구글 계정 잇기'}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-60">
                    다른 기기·브라우저에서도 같은 기록으로 이어집니다
                  </span>
                </button>
              )}

              {/*
                효과음 켬/끔 — 모두에게 보인다.

                끄는 길이 코드에만 있고 화면에는 없었다. 조용해야 하는 자리에
                있는 사람은 앱을 덮어두는 것 말고는 방법이 없었다.
                끄는 것은 딸깍·삑 같은 조작음까지다. 소영의 목소리와 아버지의
                테이프는 이 스위치와 무관하다 — 그건 이야기라서 끄면 진행이
                끊긴다.

                켜는 쪽으로 바꿀 때만 소리를 낸다. 어떤 소리가 돌아왔는지
                그 자리에서 들려줘야 스위치를 믿을 수 있다.
              */}
              <button
                onClick={() => {
                  const next = !sfxOn
                  setSfxOn(next)
                  setSfxMuted(!next)
                  if (next) playDeckKey('play')
                }}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-cream px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-ink">
                    🔊 효과음
                  </span>
                  <span className="block text-[11px] text-ink-60">
                    {sfxOn
                      ? '버튼·확인음이 들립니다'
                      : '조작음만 꺼집니다 (이야기 소리는 그대로)'}
                  </span>
                </span>
                <span
                  className={`ml-3 shrink-0 rounded-lg px-2.5 py-1 font-mono-retro text-[10.5px] tracking-wider ${
                    sfxOn ? 'bg-teal text-cream' : 'bg-cream-dp text-ink-60'
                  }`}
                >
                  {sfxOn ? 'ON' : 'OFF'}
                </span>
              </button>

              {/*
                콘솔은 슈퍼관리자만 — 참여자 데이터가 열리는 문이라
                아래 건너뛰기 모드와 등급이 다르다(adminEmails.ts).
                일반관리자에게는 항목이 아예 보이지 않는다. 눌러봐야
                화면이 '권한 없음'을 내는 문을 세워둘 이유가 없다.
              */}
              {(isSuperAdminUser() || REHEARSAL) && (
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

              {/*
                건너뛰기는 일반관리자부터 — 앱을 걸어보는 것이 그 등급의 일이다.
                참여자에게는 항목이 아예 보이지 않는다.

                리허설 빌드에서는 계정 없이도 보인다. 자동 검증이 구글
                OAuth를 통과할 수 없어서, 계정을 요구하면 이 아래 화면
                전체가 검증 밖으로 빠진다(superAdmin.ts와 같은 이유).
                배포본은 그대로 관리자 이메일을 요구한다.
              */}
              {(isAdminUser() || REHEARSAL) && (
                <>
                  {/*
                    켜면 순서를 무시하고, 끄면 참여자와 똑같이 진행한다.
                    끄는 것으로 되감기지는 않는다 — 그 안내는 띠 안에 있다.
                  */}
                  <button
                    onClick={() => {
                      const next = !superOn
                      setSuperOn(next)
                      setSuperAdmin(next)
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                      superOn ? 'border-rec bg-rec/10' : 'border-line bg-cream'
                    }`}
                  >
                    <span className="min-w-0">
                      <span
                        className={`block text-[13px] font-bold ${
                          superOn ? 'text-rec' : 'text-ink'
                        }`}
                      >
                        🔓 진행 건너뛰기 모드
                      </span>
                      <span className="block text-[11px] text-ink-60">
                        {superOn
                          ? '진행 순서를 무시하고 있습니다'
                          : '참여자와 같은 순서로 진행합니다'}
                      </span>
                    </span>
                    <span
                      className={`ml-3 shrink-0 rounded-lg px-2.5 py-1 font-mono-retro text-[10.5px] tracking-wider ${
                        superOn ? 'bg-rec text-cream' : 'bg-cream-dp text-ink-60'
                      }`}
                    >
                      {superOn ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/*
                    조작은 켠 자리에서 연다. 예전에는 화면 맨 위 띠를 눌러
                    열었는데, 앱바가 통째로 레드가 되는 지금은 그 띠가 같은
                    말을 두 번 하는 것이라 걷어냈다.
                  */}
                  {superOn && (
                    <button
                      onClick={() => {
                        onClose()
                        openSuperAdminPanel()
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-rec/40 bg-rec/5 px-4 py-3 text-left"
                    >
                      <span className="text-[13px] font-bold text-rec">
                        순서 무시 조작 열기
                      </span>
                      <span className="text-[12px] text-rec">›</span>
                    </button>
                  )}
                </>
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
