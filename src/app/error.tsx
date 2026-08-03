'use client'

/**
 * 무언가 잘못됐을 때 보이는 화면.
 *
 * 이것이 없으면 Next.js의 맨 화면이 뜬다 — 영어 한 줄에 돌아갈 문도
 * 없다. 골목 한복판에서 그것을 보는 사람은 앱이 죽었다고 여기고 투어를
 * 그만둔다. **진행은 기기에 남아 있으므로 그만둘 일이 아니다.**
 *
 * 그래서 여기서 하는 말은 셋이다 — 잃은 것이 없다 · 다시 해보자 ·
 * 안 되면 이 길로 돌아가라.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { logEvent } from '@/lib/analytics'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  /*
    관리자 화면에서 무슨 일이 났는지 볼 수 있게 남긴다. 현장에서
    "화면이 이상해요"라는 말만 듣고는 어디를 봐야 할지 알 수 없다.
  */
  useEffect(() => {
    logEvent('app_error', { message: error.message.slice(0, 120), digest: error.digest ?? '' })
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-base px-5">
      <div className="card-paper w-full max-w-sm p-6 text-center">
        <div className="text-4xl">📼</div>
        <h1 className="mt-2 font-display text-[18px] text-ink">
          테이프가 잠깐 엉켰어요
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-60">
          걸어온 길과 이룬 소원은 그대로 있습니다.
          <br />
          다시 감아보면 대개 이어집니다.
        </p>

        <button onClick={reset} className="btn-teal mt-5 w-full text-[14px]">
          ↻ 다시 감기
        </button>
        <Link
          href="/play"
          className="mt-2 block w-full rounded-xl border border-line bg-cream-base py-2.5 text-[13px] text-ink"
        >
          📼 플레이어로 가기
        </Link>

        {/* 무엇이 났는지는 접어 둔다 — 필요한 사람만 편다 */}
        {error.digest && (
          <p className="mt-4 font-mono-retro text-[10px] text-ink-60">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
