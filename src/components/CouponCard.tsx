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
import CouponRedeemSheet from '@/components/CouponRedeemSheet'
import {
  CouponSpec,
  couponQrPayload,
  couponSerial,
  makeCouponCode,
  reissueCoupon,
} from '@/lib/coupons'
import { isCouponUsed } from '@/lib/shops'
import { useSuperAdmin } from '@/lib/superAdmin'

interface CouponCardProps {
  spec: CouponSpec
  uid: string
  /** 로그인 계정이 있는가 — 없으면 스스로 사용 처리를 할 수 없다 */
  signedIn?: boolean
  /** 바깥에서 이미 사용한 것을 아는 경우 */
  used?: boolean
  /**
   * 발급 순번을 바깥에서 정한다 — 뽑기 쿠폰이 쓴다.
   *
   * 같은 쿠폰이 두 칸에서 나올 수 있는데, 순번이 같으면 코드도 같아져
   * 한 장을 쓰는 순간 나머지가 함께 죽는다. 칸 번호를 순번으로 주면
   * 장마다 코드가 갈린다. 이 경우 '새 번호로 받기'는 감춘다 — 순번이
   * 칸을 가리키므로 마음대로 올릴 값이 아니다.
   */
  fixedSerial?: number
}

export default function CouponCard({
  spec,
  uid,
  signedIn = false,
  used = false,
  fixedSerial,
}: CouponCardProps) {
  const [open, setOpen] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  /*
    사용 여부는 기기에 캐시하지 않고 서버에서 확인한다.
    다른 기기에서 쓴 쿠폰도 맞게 보여야 하고, 캐시를 두면 어긋났을 때
    참여자는 '사용함'인데 가게에서는 안 쓴 것으로 나오는 일이 생긴다.
  */
  const [serverUsed, setServerUsed] = useState(false)
  // 슈퍼관리자가 건너뛰며 받은 쿠폰은 시험용 코드로 낸다 — 가게 확인
  // 화면이 알아보고 사용 기록을 남기지 않아 코드가 소진되지 않는다
  const superAdmin = useSuperAdmin()
  /*
    발급 순번. 가게에서 잘못 찍혀 소진된 코드는 다음 번호로 다시 낸다 —
    앞 번호를 되돌리는 것이 아니라 다음 장을 뜯는 것이라, 지난 사용
    기록은 그대로 남는다.
  */
  const [serial, setSerial] = useState(fixedSerial ?? 0)
  useEffect(() => {
    if (fixedSerial !== undefined) return
    setSerial(couponSerial(spec.id, uid))
  }, [spec.id, uid, fixedSerial])
  const code = makeCouponCode(spec.id, uid, superAdmin, serial)

  // 코드가 바뀌면 그려둔 QR을 버린다. 모드를 켜고 끄면 시험용/실제 코드가
  // 갈리는데, 캐시를 그대로 두면 펼쳐놓은 QR이 옛 코드로 남는다.
  useEffect(() => {
    setQr(null)
  }, [code])

  // 코드가 바뀌면(다시 받기·모드 전환) 사용 여부도 다시 본다
  useEffect(() => {
    let alive = true
    setServerUsed(false)
    void isCouponUsed(code).then((v) => {
      if (alive) setServerUsed(v)
    })
    return () => {
      alive = false
    }
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

  const spent = used || serverUsed

  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl border ${
        spent ? 'border-line bg-paper/60 opacity-60' : 'border-sunset-yellow bg-paper'
      }`}
    >
      <button
        onClick={() => !spent && setOpen((v) => !v)}
        disabled={spent}
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
          {spent ? '사용함' : open ? '접기' : '열기'}
        </span>
      </button>

      {open && !spent && (
        <div className="border-t border-line px-4 py-4 text-center">
          {/*
            쓰는 길은 하나다 — 카운터의 스티커를 앱으로 찍는다.

            예전에는 이 아래에 내 QR을 크게 띄웠다. 가게 기기가 그것을 찍어
            대신 처리하는 길이 있었기 때문인데, 그 길을 닫았다(캡처를 남에게
            보내면 그대로 쓰였다). 지금 이 QR이 하는 일은 없으므로 뺐다.
          */}
          {spec.scope === 'info' ? (
            /* 안내소 교환권 — 가게 카운터에서 찍을 것이 아니다 */
            <>
              <p className="rounded-xl border border-sunset-yellow bg-sunset-yellow/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
                <b>안내소에서 교환</b>하는 쿠폰이에요.
                <br />
                <span className="text-ink-60">이 화면을 안내소에 보여주세요.</span>
              </p>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt={`${spec.shop} 쿠폰 QR`}
                  className="mx-auto mt-4 h-44 w-44 rounded-lg"
                />
              ) : (
                <div className="mx-auto mt-4 flex h-44 w-44 items-center justify-center rounded-lg bg-cream-dp text-[12px] text-ink-60">
                  QR 만드는 중…
                </div>
              )}
              <p className="mt-3 font-mono-retro text-[13px] tracking-[0.08em] text-ink">
                {code}
              </p>
            </>
          ) : signedIn ? (
            <>
              <button
                type="button"
                onClick={() => setSheet(true)}
                className="btn-teal w-full text-center"
              >
                🎟 가게에서 사용하기
              </button>
              <p className="mt-2 text-[11px] leading-snug text-ink-60">
                카운터의 <b className="text-ink">봉황 메모리즈 스티커</b>를
                찍으면 됩니다. 한 번만 쓸 수 있어요.
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-line bg-cream-dp px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-60">
              쿠폰을 쓰려면 로그인이 필요해요.
              <br />
              본인이 걸어서 받은 쿠폰이라 계정에 묶여 있습니다.
            </p>
          )}

          {/*
            다시 받기 — 가게에서 실수로 두 번 찍혔거나, 미리 열어보다
            소진됐을 때. 사용 기록은 지울 수 없으므로 되돌리는 대신 다음
            번호를 낸다. 앞 번호의 기록은 그대로 남는다.

            평소에는 눈에 띌 이유가 없어 작은 글자로 둔다 — 잘못 누르면
            멀쩡한 코드가 새 번호로 바뀌어 헷갈린다.
          */}
          {fixedSerial === undefined && (
            <>
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
            </>
          )}
        </div>
      )}

      {sheet && (
        <CouponRedeemSheet
          spec={spec}
          code={code}
          uid={uid}
          onClose={() => setSheet(false)}
          onRedeemed={() => setServerUsed(true)}
        />
      )}
    </div>
  )
}
