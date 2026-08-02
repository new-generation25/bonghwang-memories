'use client'

/**
 * /admin/bep — BEP 시뮬레이터.
 *
 * 본체는 `public/bep/index.html` 하나로 완결돼 있어 iframe으로 띄운다.
 * React로 다시 쓰지 않는 이유는 실익이 없어서다 — 계산은 이미
 * `lib/bepModel.js`로 갈라져 있고, 남은 것은 입력 60여 개와 표 40열이라
 * 컴포넌트로 옮겨봐야 같은 화면을 더 어렵게 만드는 일이다.
 *
 * 시뮬레이터는 **혼자서도 돌아간다.** 서버가 없으면 localStorage 슬롯에
 * 저장하고, 관리자 토큰이 들어오면 그때부터 서버 시나리오를 함께 쓴다.
 * 그래서 여기서 하는 일은 토큰을 한 번 넣어주는 것뿐이다.
 *
 * 접근 판정은 관리자 화면과 같다(이메일). 화면 차단은 편의일 뿐이고 실제
 * 방어는 라우트와 firestore.rules다 — 이 페이지를 우회해도 서버가 남의
 * 시나리오를 내주지 않는다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/firebase'
import { isAdminUser } from '@/lib/admin'

/** iframe 안에서 시뮬레이터가 내보내는 인증 훅 */
type BepWindow = Window & { bepAuth?: (token: string) => void }

export default function BepPage() {
  const { profile, loading } = useAuth()
  const frame = useRef<HTMLIFrameElement>(null)
  const [note, setNote] = useState('')

  /*
    `profile`이 아니라 Auth의 현재 사용자를 본다 — Profile에는 이메일이
    없다(아이디·비밀번호 계정도 있어서다). 관리자 화면과 같은 판정이다.
  */
  const allowed = isAdminUser()

  /*
    토큰은 iframe이 다 뜬 **뒤에** 넣는다. 먼저 넣으면 bepAuth가 아직
    없어 조용히 무시되고, 화면은 멀쩡한데 서버 목록만 비어 보인다.

    그래서 다 떴는지를 따로 들고 있는다. 로그인이 iframe보다 늦게 끝나는
    경우가 있어 양쪽에서 부르는데, 아직 안 뜬 상태에서 부르면 "훅이 없다"는
    **거짓 경고**가 잠깐 떴다 사라진다.
  */
  const ready = useRef(false)

  const inject = useCallback(async () => {
    const el = frame.current
    if (!el || !allowed || !ready.current) return
    try {
      const token = await auth?.currentUser?.getIdToken()
      const w = el.contentWindow as BepWindow | null
      if (!token || !w) return
      if (typeof w.bepAuth !== 'function') {
        setNote('시뮬레이터가 서버 저장 훅을 내보내지 않았습니다 — 이 기기에만 저장됩니다.')
        return
      }
      w.bepAuth(token)
      setNote('')
    } catch {
      setNote('관리자 토큰을 얻지 못했습니다 — 이 기기에만 저장됩니다.')
    }
  }, [allowed])

  useEffect(() => {
    void inject()
  }, [inject])

  if (loading) {
    return <Shell><p className="text-[13px] text-ink-60">불러오는 중…</p></Shell>
  }

  if (!allowed) {
    return (
      <Shell>
        <div className="card-paper p-6 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="mt-2 font-display text-[17px] text-ink">관리자 전용</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
            {profile
              ? '이 계정에는 권한이 없습니다. 관리자 구글 계정으로 로그인해주세요.'
              : '구글 계정으로 로그인해주세요.'}
          </p>
          <Link href="/" className="btn-teal mt-4 inline-block px-5 text-[14px]">
            홈으로
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-cream-base">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <Link href="/admin" className="text-[12px] text-ink-60 underline underline-offset-2">
          ← 관리자
        </Link>
        {note && <p className="text-[11px] text-rec">{note}</p>}
      </div>
      <iframe
        ref={frame}
        onLoad={() => {
          ready.current = true
          void inject()
        }}
        src="/bep/index.html"
        title="BEP 시뮬레이터"
        className="w-full flex-1 border-0"
      />
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[560px] px-4 py-10">{children}</main>
  )
}
