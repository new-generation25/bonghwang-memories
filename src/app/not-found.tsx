/**
 * 없는 주소로 왔을 때.
 *
 * QR을 비뚤게 찍거나 옛 링크를 눌렀을 때 여기로 온다. 기본 화면은
 * "404 This page could not be found" 한 줄이라 골목에서는 앱이 망가진
 * 것으로 보인다 — 돌아갈 문을 주는 것이 이 화면의 전부다.
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-base px-5">
      <div className="card-paper w-full max-w-sm p-6 text-center">
        <div className="text-4xl">🔦</div>
        <h1 className="mt-2 font-display text-[18px] text-ink">
          여기엔 아무것도 없어요
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-60">
          주소가 바뀌었거나, QR이 비뚤게 찍혔을 수 있습니다.
          <br />
          플레이어에서 다음 거점을 고르면 이어집니다.
        </p>

        <Link href="/play" className="btn-teal mt-5 block w-full text-[14px]">
          📼 플레이어로 가기
        </Link>
        <Link
          href="/"
          className="mt-2 block w-full rounded-xl border border-line bg-cream-base py-2.5 text-[13px] text-ink"
        >
          처음으로
        </Link>
      </div>
    </div>
  )
}
