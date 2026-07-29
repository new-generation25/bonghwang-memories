'use client'

/**
 * 가게에서 포인트 쓰기 — 참여자는 코드를 보여주고, 금액은 사장님이 넣는다.
 *
 * 쿠폰과 흐름이 반대인 데는 이유가 둘 있다.
 *
 * 쿠폰은 액면이 정해져 있어 참여자가 스티커를 찍는 것만으로 끝난다. 포인트는
 * **얼마를 쓸지가 카운터에서 정해진다** — 3,200원짜리를 사면서 3,000p를 쓸지
 * 2,000p만 쓸지는 그 자리에서 나오는 이야기다. 참여자 화면에 금액 칸을 두면
 * 사장님이 확인하지 않은 숫자가 그대로 기록이 된다.
 *
 * 그리고 사용 기록에는 충당률이 스냅샷으로 들어가야 하는데, 그 값은
 * 참여자에게 보이면 안 된다. 쓰는 쪽이 가게 기기이므로 참여자 기기는 율을
 * 알 필요도, 알 방법도 없다 — 가게 문서를 읽히면 스티커 토큰이 함께 샌다.
 *
 * 그래서 이 화면이 하는 일은 셋뿐이다: 코드를 띄우고, 결과를 기다리고,
 * 확인되면 원장에서 깎는다. 기다리다 닫아도 다음에 열 때 맞춰진다.
 */

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  couponSerial,
  makePointCode,
  pointQrPayload,
  reissueCoupon,
} from '@/lib/coupons'
import {
  POINT_RULES,
  reconcilePointSpends,
  trackPointCode,
} from '@/lib/points'

/** 코드가 쓰였는지 되묻는 간격. 카운터에서 기다리는 시간이라 짧게 잡는다 */
const POLL_MS = 3000

interface Props {
  uid: string
  /** 지금 쓸 수 있는 포인트 — 사장님께 보여줄 숫자다 */
  available: number
  onClose: () => void
  /** 사용이 확인돼 원장이 깎였을 때 */
  onRedeemed: () => void
}

export default function PointRedeemSheet({
  uid,
  available,
  onClose,
  onRedeemed,
}: Props) {
  const [code, setCode] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // 코드는 열 때 한 번만 만든다. 그리는 중에 만들면 폴링이 돌 때마다
  // 새 코드가 나와, 사장님이 방금 찍은 것과 화면의 것이 달라진다
  useEffect(() => {
    setCode(makePointCode(uid, couponSerial('pt', uid)))
  }, [uid])

  useEffect(() => {
    if (!code) return
    trackPointCode(code)
    QRCode.toDataURL(pointQrPayload(code, window.location.origin), {
      width: 480,
      margin: 1,
      color: { dark: '#262422', light: '#F3EAD3' },
      errorCorrectionLevel: 'M',
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [code])

  /*
    쓰였는지를 되묻는다.

    실시간 구독(onSnapshot)을 쓰지 않는 이유가 있다. 이 화면은 카운터에서
    한두 번 열리고 닫히는데, 구독은 열린 채 잊히면 계속 붙어 있다 —
    골목에서 신호가 오갈 때마다 재연결을 시도한다. 3초 간격이면 사람이
    기다리기에 충분히 빠르고, 닫으면 확실히 끊긴다.
  */
  const check = useCallback(async () => {
    if (!(await reconcilePointSpends())) return
    setDone(true)
    /*
      다음 번호로 넘겨 둔다. 안 그러면 다음에 이 화면을 열었을 때 방금 쓴
      코드가 그대로 뜨고, 사장님이 찍으면 '이미 사용됨'이 된다 — 손님은
      왜 안 되는지 알 수 없다.
    */
    reissueCoupon('pt', uid)
    onRedeemed()
  }, [onRedeemed, uid])

  useEffect(() => {
    if (!code || done) return
    const t = setInterval(() => void check(), POLL_MS)
    return () => clearInterval(t)
  }, [code, done, check])

  // 닫을 때 한 번 더 본다 — 마지막 폴링과 닫기 사이에 찍혔을 수 있다
  const close = useCallback(() => {
    void reconcilePointSpends().then((n) => {
      if (n) onRedeemed()
    })
    onClose()
  }, [onClose, onRedeemed])

  if (done) {
    return (
      <Shell onClose={close}>
        <div className="rounded-2xl border-2 border-teal bg-teal/10 px-5 py-10 text-center">
          <p className="text-[52px] leading-none" aria-hidden>
            ✓
          </p>
          <p className="mt-4 font-display text-[26px] text-teal-dk">사용 완료</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
            남은 포인트는 잠시 뒤 새로 고쳐집니다.
          </p>
        </div>
        <button onClick={close} className="btn-teal mt-5 w-full text-center">
          닫기
        </button>
      </Shell>
    )
  }

  return (
    <Shell onClose={close}>
      <p className="text-center text-[13px] leading-relaxed text-ink-60">
        사장님께 이 코드를 보여주세요.
        <br />
        <b className="text-ink">쓸 금액은 사장님이 넣습니다.</b>
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-paper p-4 text-center">
        <p className="font-mono-retro text-[10px] tracking-[0.2em] text-ink-60">
          쓸 수 있는 포인트
        </p>
        <p className="mt-1 font-display text-[30px] leading-none text-teal">
          {available.toLocaleString()}
          <span className="ml-0.5 text-[14px]">P</span>
        </p>
        <p className="mt-0.5 font-mono-retro text-[11px] text-ink-60">
          = {available.toLocaleString()}원 · 1P = 1원
        </p>

        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="포인트 사용 코드"
            className="mx-auto mt-4 h-44 w-44 rounded-lg"
          />
        ) : (
          <div className="mx-auto mt-4 h-44 w-44 animate-pulse rounded-lg bg-cream-dp" />
        )}

        {/* 카메라가 안 되는 기기가 있어 글자도 함께 둔다 — 사장님이 손으로 넣는다 */}
        <p className="mt-3 font-mono-retro text-[13px] tracking-[0.12em] text-ink">
          {code}
        </p>
      </div>

      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-ink-60">
        결제가 끝나면 이 화면이 저절로 바뀝니다.
        <br />
        먼저 닫아도 사용한 만큼은 반영돼요.
      </p>

      {/*
        코드를 새로 뽑는 길을 남긴다. 가게 기기가 잘못 찍어 소진된 코드는
        되돌릴 수 없으므로(사용 기록은 관리자만 지운다) 다음 번호를 뜯는다.
      */}
      <button
        onClick={() => setCode(makePointCode(uid, reissueCoupon('pt', uid)))}
        className="mt-4 w-full text-center text-[12px] text-ink-60 underline underline-offset-2"
      >
        코드가 이미 쓰였다고 나오나요? 새 코드 받기
      </button>

      <p className="mt-3 text-center text-[10.5px] text-ink-60">
        {POINT_RULES.minRedeem.toLocaleString()}P부터 사용할 수 있어요
      </p>
    </Shell>
  )
}

function Shell({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[420px] overflow-y-auto rounded-t-2xl bg-cream-base px-5 pb-8 pt-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
            포인트 사용하기
          </p>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-[18px] text-ink-60"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
