'use client'

/**
 * 가게에서 쿠폰 쓰기 — 참여자가 가게 스티커를 찍는다.
 *
 * 이 화면이 있는 이유가 이 시스템의 전부다. 예전에는 참여자가 가게에 가지
 * 않고도 확인 주소를 자기 폰에서 열어 쿠폰을 사용 처리할 수 있었다. 카운터에 붙은
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
import { parseShopQr, redeemCoupon, shopName, type RedeemOutcome } from '@/lib/shops'

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
  /**
   * 찍기는 했고 아직 사용 처리는 안 한 상태.
   *
   * 예전에는 QR을 읽는 순간 그대로 사용 처리했다. 카메라는 손에 들고 있으면
   * 저 혼자 읽는 물건이라, 스티커 근처에 카메라를 켜 둔 것만으로 쿠폰이
   * 없어졌다 — 참여자는 무엇을 눌러서 그렇게 됐는지도 모른다.
   * 되돌리는 길은 새 번호를 뜯는 것뿐이라(사용 기록은 관리자만 지운다)
   * 예방이 유일한 방어다.
   */
  const [pending, setPending] = useState<{ token: string; shopId: string } | null>(
    null
  )

  const run = useCallback(
    async (t: string, atShop: string) => {
      if (busy) return
      setBusy(true)
      setHint('')
      const outcome = await redeemCoupon({
        code,
        // 찍은 가게에서 쓴다 — 공용 할인권은 쿠폰에 가게가 적혀 있지 않다
        shopId: atShop,
        /*
          공용 할인권의 무리 확인은 여기서 못 한다 — 참여자는 가게 문서를
          읽을 수 없어(규칙) 그 가게가 협력 카페인지 알 방법이 없다.
          형식만 통과시키고, '협력 가게가 맞는가'는 규칙이 맡아야 한다.
        */
        shopGroup: spec.group,
        byUid: uid,
        via: 'guest',
        uid,
        token: t,
      })
      setResult(outcome)
      setBusy(false)
      if (outcome.kind === 'ok') onRedeemed()
    },
    [busy, code, spec.group, uid, onRedeemed]
  )

  /** 스캔값은 가게 스티커여야 한다 — 참여자 쿠폰 QR을 찍으면 여기서 걸린다 */
  const onScan = useCallback(
    (raw: string) => {
      const shop = parseShopQr(raw)
      if (!shop) {
        setHint('가게 QR이 아니에요. 카운터에 붙은 스티커를 찍어주세요.')
        return
      }
      // 특정 가게 쿠폰만 여기서 거른다. 공용 할인권은 어느 협력 가게든 된다
      if (spec.scope === 'shop' && shop.shopId !== spec.shopId) {
        setHint(`이 쿠폰은 ${spec.shop}에서만 쓸 수 있어요.`)
        return
      }
      // 찍었다고 곧바로 사용 처리하지 않는다 — 무엇을 어디서 쓰는지 보여주고 묻는다
      setPending({ token: shop.token, shopId: shop.shopId })
    },
    [spec.scope, spec.shopId, spec.shop]
  )

  /*
    확인 화면에 적을 가게 이름.

    참여자는 가게 문서를 읽을 수 없으므로(읽히면 스티커 토큰이 샌다)
    카탈로그에서 찾는다. 공용 할인권을 카탈로그에 없는 협력 가게에서
    쓰면 id가 그대로 보이는데, 그때도 무엇을 쓰는지(혜택 문구)는 맞다.
  */
  const atShopName = pending ? shopName(pending.shopId) : ''

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

  /*
    확인 — 무엇을, 어디서.

    카운터 앞에서 참여자가 답해야 하는 질문은 하나다. "이거 여기서 쓰는
    거 맞아?" 그래서 가게 이름과 혜택을 크게 놓고 묻는다. 되돌릴 수 없다는
    말을 함께 두는 이유는, 이 화면이 마지막 문이기 때문이다.
  */
  if (pending) {
    return (
      <Shell onClose={onClose}>
        <div className="rounded-2xl border-2 border-sunset-yellow bg-sunset-yellow/10 px-5 py-8 text-center">
          <p className="font-mono-retro text-[11px] tracking-[0.2em] text-ink-60">
            여기서 사용합니다
          </p>
          <p className="mt-3 font-display text-[24px] text-ink">{atShopName}</p>
          <p className="mt-2 text-[17px] font-bold text-ink">{spec.benefit}</p>
          <p className="mt-5 text-[14px] leading-relaxed text-ink">
            이 쿠폰을 사용할까요?
          </p>
          <p className="mt-1 text-[11.5px] text-ink-60">
            한 번 쓰면 되돌릴 수 없어요
          </p>
        </div>
        <button
          onClick={() => void run(pending.token, pending.shopId)}
          disabled={busy}
          className="btn-teal mt-5 w-full text-center disabled:opacity-40"
        >
          {busy ? '사용 처리 중…' : '사용하기'}
        </button>
        <button
          onClick={() => {
            setPending(null)
            setToken('')
          }}
          className="mt-2 w-full rounded-xl border border-line bg-paper py-3 text-[13px] font-bold text-ink"
        >
          취소
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

  /*
    손으로 넣는 길은 '그 가게 쿠폰'에만 연다.

    토큰만으로는 어느 가게인지 알 수 없다 — 그 값이 곧 가게의 비밀이라
    참여자 쪽에서 되짚을 방법이 없다. 특정 가게 쿠폰은 쿠폰에 가게가
    적혀 있어 괜찮지만, 공용 할인권은 QR을 찍어야 어느 가게인지 정해진다.
  */
  const manualShopId = spec.scope === 'shop' ? spec.shopId : null

  return (
    <Shell onClose={onClose}>
      {manualShopId ? (
        <>
          <p className="text-center text-[13px] leading-relaxed text-ink-60">
            스티커 QR 아래에 적힌 <b className="text-ink">8자리</b>를 입력해 주세요.
          </p>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            onKeyDown={submitOnEnter(
              () => setPending({ token, shopId: manualShopId }),
              token.trim().length === 8
            )}
            placeholder="XXXXXXXX"
            maxLength={8}
            autoCapitalize="characters"
            className="mt-4 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono-retro text-[17px] tracking-[0.18em] text-ink"
          />
          {/* 손으로 넣는 길도 같은 문을 지난다 — 확인 화면이 하나여야 한다 */}
          <button
            onClick={() => setPending({ token, shopId: manualShopId })}
            disabled={token.trim().length !== 8}
            className="btn-teal mt-3 w-full text-center disabled:opacity-40"
          >
            확인
          </button>
        </>
      ) : (
        <p className="rounded-xl border border-line bg-cream-dp px-4 py-4 text-center text-[12.5px] leading-relaxed text-ink-60">
          공용 할인권은 <b className="text-ink">QR을 찍어야</b> 어느 가게에서
          쓰는지 정해져요.
          <br />
          카운터의 스티커를 카메라로 찍어주세요.
        </p>
      )}
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
