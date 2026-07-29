'use client'

/**
 * 옛 가게 확인 화면 — 이제 내역으로 보낸다.
 *
 * 여기는 사장님이 손님 코드를 받아 대신 사용 처리하던 자리였다. 없앤 이유가
 * 둘이다.
 *
 * 하나. **캡처 전달의 통로였다.** 이 화면만 임의 코드를 받았으므로, 쿠폰 QR을
 * 캡처해 친구에게 보내면 친구가 가게에서 그것을 내밀어 쓸 수 있었다. 이건
 * 게임이고 쿠폰·포인트는 그 계정이 걸어서 얻은 것이라 남에게 넘어가면 안 된다.
 * 지금은 지갑에 든 사람만 쓸 수 있다 — 규칙이 사용 기록의 uid를 요청 계정과
 * 대조한다.
 *
 * 둘. **가게에 기기와 로그인을 요구했다.** 쓰는 쪽을 손님으로 모으면 가게는
 * 스티커 한 장만 비치하면 된다. 손님 카메라가 안 될 때의 대비책은 스티커에
 * 인쇄된 8자리를 손님이 손으로 넣는 길이 대신한다.
 *
 * 주소는 남긴다. 인쇄물과 안내에 이 주소가 적혀 있어서, 없애면 그것들이
 * 전부 막다른 길이 된다.
 */

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function ShopVerifyInner() {
  const router = useRouter()

  // 사장님 기기는 대개 이 주소를 즐겨찾기해 두셨다. 조용히 옮겨드린다
  useEffect(() => {
    const t = setTimeout(() => router.replace('/shop/history'), 2500)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="flex min-h-screen flex-col bg-cream-base px-5 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <p className="text-center font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          봉황 메모리즈 · 가게
        </p>

        <div className="mt-10 rounded-2xl border border-line bg-paper px-5 py-10 text-center">
          <p className="text-[44px] leading-none" aria-hidden>
            📱
          </p>
          <p className="mt-4 font-display text-[20px] text-ink">
            이제 손님이 직접 사용합니다
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
            카운터에 붙은 <b className="text-ink">봉황 메모리즈 스티커</b>를
            손님이 앱으로 찍으면 처리됩니다.
            <br />
            사장님은 손님 화면의 <b className="text-ink">「사용 완료」</b>만
            확인해 주세요.
          </p>
          <p className="mt-4 rounded-xl border border-line bg-cream-dp px-3 py-2.5 text-[12px] leading-relaxed text-ink-60">
            손님 카메라가 안 되면 스티커 QR 아래의{' '}
            <b className="text-ink">8자리</b>를 손님이 직접 입력하시면 됩니다.
          </p>
        </div>

        <Link
          href="/shop/history"
          className="btn-teal mt-6 block w-full text-center"
        >
          사용 내역 · 정산 보기
        </Link>
        <p className="mt-3 text-center text-[11px] text-ink-60">
          잠시 뒤 내역 화면으로 넘어갑니다.
        </p>
      </div>
    </div>
  )
}

export default function ShopVerifyPage() {
  return (
    <Suspense fallback={null}>
      <ShopVerifyInner />
    </Suspense>
  )
}
