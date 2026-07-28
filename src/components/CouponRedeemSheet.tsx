'use client'

/**
 * 가게에서 쿠폰 쓰기 — 참여자가 가게 스티커를 찍는다.
 *
 * 이 화면이 있는 이유가 이 시스템의 전부다. 예전에는 참여자가 가게에 가지
 * 않고도 확인 주소를 자기 폰에서 열어 쿠폰을 태울 수 있었다. 카운터에 붙은
 * 스티커의 토큰을 읽어야만 사용 처리가 되게 하면, 그 앞에 서 본 사람만
 * 쿠폰을 쓸 수 있다.
 *
 * 찍고 나면 사장님께 보여주는 화면이 된다 — 그래서 결과를 크게, 가게
 * 이름과 혜택을 함께 띄운다. 사장님이 보고 물건을 내주신다.
 *
 * 카메라를 못 여는 기기가 있어 토큰을 손으로 넣는 길도 남긴다. 그 글자는
 * 스티커에 인쇄돼 있으므로, 읽으려면 어차피 그 앞에 서 있어야 한다 —
 * QR과 신뢰 수준이 같다.
 */

import { useCallback, useState } from 'react'
import QRScanner from '@/components/QRScanner'
import { submitOnEnter } from '@/lib/submitOnEnter'
import type { CouponSpec } from '@/lib/coupons'
import { parseShopQr, redeemCoupon, type RedeemOutcome } from '@/lib/shops'

interface Props {
  spec: CouponSpec
  /** 참여자 쿠폰 코드 — 문서 id가 된다 */
  code: string
  /** 로그인 계정. 없으면 이 시트를 열지 않는다 */
  uid: string
  onClose: () => void
  /** 사용 처리가 끝났을 때 — 지갑이 '사용함'으로 바뀐다 */
  onRedeemed: () => void
}

export default function CouponRedeemSheet({
  spec,
  code,
  uid,
  onClose,
  onRedeemed,
}: Props) {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RedeemOutcome | null>(null)
  const [hint, setHint] = useState('')

  const run = useCallback(
    async (t: string) => {
      if (busy) return
      setBusy(true)
      setHint('')
      const outcome = await redeemCoupon({
        code,
        shopId: spec.shopId,
        byUid: uid,
        via: 'guest',
        uid,
        token: t,
      })
      setResult(outcome)
      setBusy(false)
      if (outcome.kind === 'ok') onRedeemed()
    },
    [busy, code, spec.shopId, uid, onRedeemed]
  )

  /** 스캔값은 가게 스티커여야 한다 — 참여자 쿠폰 QR을 찍으면 여기서 걸린다 */
  const onScan = useCallback(
    (raw: string) => {
      const shop = parseShopQr(raw)
      if (!shop) {
        setHint('가게 QR이 아니에요. 카운터에 붙은 스티커를 찍어주세요.')
        return
      }
      if (shop.shopId !== spec.shopId) {
        setHint(`이 쿠폰은 ${spec.shop}에서만 쓸 수 있어요.`)
        return
      }
      void run(shop.token)
    },
    [run, spec.shopId, spec.shop]
  )

  // 결과 화면 — 사장님께 보여주는 자리라 크고 단순하게
  if (result) {
    return (
      <Shell onClose={onClose}>
        {result.kind === 'ok' && (
          <div className="rounded-2xl border-2 border-teal bg-teal/10 px-5 py-10 text-center">
            <p className="text-[52px] leading-none" aria-hidden>
              ✓
            </p>
            <p className="mt-4 font-display text-[26px] text-teal-dk">사용 완료</p>
            <p className="mt-3 text-[16px] font-bold text-ink">{spec.shop}</p>
            <p className="mt-1 text-[17px] font-bold text-ink">{spec.benefit}</p>
            <p className="mt-4 font-mono-retro text-[11px] text-ink-60">
              사장님께 이 화면을 보여주세요
            </p>
          </div>
        )}

        {result.kind === 'used' && (
          <Bad title="이미 사용됨" mark="✕">
            {spec.shop} · {spec.benefit}
            <br />
            사용 시각 {result.at}
          </Bad>
        )}

        {result.kind === 'denied' && (
          <Bad title="사용할 수 없어요" mark="!">
            {result.reason}
          </Bad>
        )}

        {result.kind === 'test' && (
          <Bad title="시험용 코드입니다" mark="🧪">
            점검용으로 만든 코드라 실제 쿠폰이 아닙니다.
          </Bad>
        )}

        {result.kind === 'offline' && (
          <Bad title="지금은 확인할 수 없어요" mark="📶">
            통신이 되는 곳에서 다시 시도해 주세요.
            <br />
            이미 쓴 쿠폰인지 알 수 없어 그냥 통과시키지 않습니다.
          </Bad>
        )}

        <button
          onClick={onClose}
          className="btn-teal mt-5 w-full text-center"
        >
          닫기
        </button>
      </Shell>
    )
  }

  if (mode === 'scan') {
    return (
      <Shell onClose={onClose}>
        <p className="text-center text-[13px] leading-relaxed text-ink-60">
          <b className="text-ink">{spec.shop}</b> 카운터에 붙은
          <br />
          봉황 메모리즈 스티커를 찍어주세요.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl">
          <QRScanner onScanSuccess={onScan} onClose={onClose} />
        </div>
        {hint && <p className="mt-3 text-center text-[12px] text-rec">{hint}</p>}
        <button
          onClick={() => setMode('manual')}
          className="mt-4 w-full text-center text-[12px] text-ink-60 underline underline-offset-2"
        >
          카메라가 안 되나요? 스티커의 글자 입력하기
        </button>
      </Shell>
    )
  }

  return (
    <Shell onClose={onClose}>
      <p className="text-center text-[13px] leading-relaxed text-ink-60">
        스티커 QR 아래에 적힌 <b className="text-ink">8자리</b>를 입력해 주세요.
      </p>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value.toUpperCase())}
        onKeyDown={submitOnEnter(() => void run(token), token.trim().length === 8)}
        placeholder="XXXXXXXX"
        maxLength={8}
        autoCapitalize="characters"
        className="mt-4 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono-retro text-[17px] tracking-[0.18em] text-ink"
      />
      <button
        onClick={() => void run(token)}
        disabled={busy || token.trim().length !== 8}
        className="btn-teal mt-3 w-full text-center disabled:opacity-40"
      >
        {busy ? '확인 중…' : '사용하기'}
      </button>
      <button
        onClick={() => setMode('scan')}
        className="mt-4 w-full text-center text-[12px] text-ink-60 underline underline-offset-2"
      >
        카메라로 찍기
      </button>
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
            가게에서 사용하기
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

function Bad({
  title,
  mark,
  children,
}: {
  title: string
  mark: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border-2 border-rec bg-rec/10 px-5 py-10 text-center">
      <p className="text-[44px] leading-none" aria-hidden>
        {mark}
      </p>
      <p className="mt-4 font-display text-[22px] text-rec">{title}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-60">{children}</p>
    </div>
  )
}
