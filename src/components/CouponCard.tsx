'use client'

/**
 * 쿠폰 한 장 — 참여자 화면.
 *
 * 접혀 있다가 누르면 QR이 펼쳐진다. 목록에 QR을 다 펼쳐두면 화면이 길어지고,
 * 무엇보다 가게 앞에서 엉뚱한 쿠폰을 내밀기 쉽다. 한 번에 하나만 연다.
 *
 * QR은 화면에서 만든다 — 서버를 거치지 않으므로 신호가 약한 골목에서도
 * 뜬다. 담는 값은 가게 기기가 열 확인 화면 주소다.
 */

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  CouponSpec,
  couponQrPayload,
  couponSerial,
  makeCouponCode,
  reissueCoupon,
} from '@/lib/coupons'
import { useSuperAdmin } from '@/lib/superAdmin'

interface CouponCardProps {
  spec: CouponSpec
  uid: string
  /** 이미 사용한 쿠폰이면 QR을 열지 않는다 */
  used?: boolean
}

export default function CouponCard({ spec, uid, used = false }: CouponCardProps) {
  const [open, setOpen] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  // 슈퍼관리자가 건너뛰며 받은 쿠폰은 시험용 코드로 낸다 — 가게 확인
  // 화면이 알아보고 사용 기록을 남기지 않아 코드가 소진되지 않는다
  const superAdmin = useSuperAdmin()
  /*
    발급 순번. 가게에서 잘못 찍혀 소진된 코드는 다음 번호로 다시 낸다 —
    앞 번호를 되돌리는 것이 아니라 다음 장을 뜯는 것이라, 지난 사용
    기록은 그대로 남는다.
  */
  const [serial, setSerial] = useState(0)
  useEffect(() => {
    setSerial(couponSerial(spec.id, uid))
  }, [spec.id, uid])
  const code = makeCouponCode(spec.id, uid, superAdmin, serial)

  // 코드가 바뀌면 그려둔 QR을 버린다. 모드를 켜고 끄면 시험용/실제 코드가
  // 갈리는데, 캐시를 그대로 두면 펼쳐놓은 QR이 옛 코드로 남는다.
  useEffect(() => {
    setQr(null)
  }, [code])

  useEffect(() => {
    if (!open || qr) return
    QRCode.toDataURL(couponQrPayload(code, window.location.origin), {
      width: 480,
      margin: 1,
      // 셸 블랙 · 크림 — 실물 QR처럼 보이되 앱 팔레트 안에 있는다
      color: { dark: '#262422', light: '#F3EAD3' },
      errorCorrectionLevel: 'M',
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [open, qr, code])

  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl border ${
        used ? 'border-line bg-paper/60 opacity-60' : 'border-sunset-yellow bg-paper'
      }`}
    >
      <button
        onClick={() => !used && setOpen((v) => !v)}
        disabled={used}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-[20px]" aria-hidden>
          🎟
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold text-ink">
            {spec.shop}
          </span>
          <span className="block truncate font-mono-retro text-[10.5px] text-ink-60">
            {spec.benefit}
          </span>
        </span>
        <span className="shrink-0 font-mono-retro text-[10.5px] text-teal-dk">
          {used ? '사용함' : open ? '접기' : 'QR 보기'}
        </span>
      </button>

      {open && !used && (
        <div className="border-t border-line px-4 py-4 text-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={`${spec.shop} 쿠폰 QR`}
              className="mx-auto h-44 w-44 rounded-lg"
            />
          ) : (
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-lg bg-cream-dp text-[12px] text-ink-60">
              QR 만드는 중…
            </div>
          )}

          {/*
            코드 글자도 함께 보여준다. 가게 기기가 QR을 못 읽을 때
            (화면 밝기·필름·구형 기기) 불러서 입력할 수 있어야 한다.
          */}
          <p className="mt-3 font-mono-retro text-[13px] tracking-[0.08em] text-ink">
            {code}
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-ink-60">
            가게에서 이 QR을 찍어 주세요. 한 번만 사용할 수 있습니다.
          </p>

          {/*
            다시 받기 — 가게에서 실수로 두 번 찍혔거나, 미리 열어보다
            소진됐을 때. 사용 기록은 지울 수 없으므로 되돌리는 대신 다음
            번호를 낸다. 앞 번호의 기록은 그대로 남는다.

            평소에는 눈에 띌 이유가 없어 작은 글자로 둔다 — 잘못 누르면
            멀쩡한 코드가 새 번호로 바뀌어 헷갈린다.
          */}
          <button
            type="button"
            onClick={() => setSerial(reissueCoupon(spec.id, uid))}
            className="mt-3 text-[11px] text-ink-60 underline underline-offset-2"
          >
            이미 사용됨으로 나오나요? 새 번호로 받기
          </button>
          {serial > 0 && (
            <p className="mt-1 font-mono-retro text-[10px] text-ink-60">
              {serial + 1}번째 발급
            </p>
          )}
        </div>
      )}
    </div>
  )
}
