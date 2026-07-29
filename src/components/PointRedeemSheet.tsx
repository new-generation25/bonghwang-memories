'use client'

/**
 * 가게에서 포인트 쓰기 — 손님이 가게 스티커를 찍는다.
 *
 * 쿠폰과 같은 차례를 지난다: 카운터의 스티커를 찍고, 무엇을 어디서 쓰는지
 * 확인하고, 완료 화면을 사장님께 보여드린다. 가게 담당자가 쿠폰과 포인트를
 * 다르게 익힐 이유가 없다 — 사장님이 보시는 것은 둘 다 「사용 완료」 하나다.
 *
 * 쿠폰과 다른 것은 앞에 한 칸이 더 있다는 것뿐이다. 쿠폰은 액면이 정해져
 * 있지만 포인트는 **얼마를 쓸지가 그 자리에서 정해진다** — 3,200원짜리를
 * 사면서 3,000P를 쓸지 2,000P만 쓸지는 카운터에서 나오는 이야기다.
 *
 * 충당률은 이 화면 어디에도 없고 서버로 보내지도 않는다. 손님 기기는 가게
 * 문서를 읽을 수 없어 그 값을 알 방법이 없고(읽히면 스티커 토큰이 함께
 * 샌다), 사용 기록의 그 칸은 나중에 가게·관리자 화면이 채운다.
 */

import { useCallback, useState } from 'react'
import QRScanner from '@/components/QRScanner'
import { submitOnEnter } from '@/lib/submitOnEnter'
import {
  couponSerial,
  makePointCode,
  reissueCoupon,
} from '@/lib/coupons'
import { POINT_RULES, recordSpend } from '@/lib/points'
import {
  parseShopQr,
  redeemPoints,
  shopName,
  type RedeemOutcome,
} from '@/lib/shops'

interface Props {
  uid: string
  /** 지금 쓸 수 있는 포인트 — 여기를 넘겨 쓸 수 없다 */
  available: number
  onClose: () => void
  /** 사용이 끝나 원장이 줄었을 때 */
  onRedeemed: () => void
}

type Step =
  | { kind: 'amount' }
  | { kind: 'scan' }
  | { kind: 'manual' }
  /** 찍기는 했고 아직 쓰지 않은 상태 — 마지막 문 */
  | { kind: 'confirm'; token: string; shopId: string }
  | { kind: 'done'; out: RedeemOutcome; amount: number }

export default function PointRedeemSheet({
  uid,
  available,
  onClose,
  onRedeemed,
}: Props) {
  const [step, setStep] = useState<Step>({ kind: 'amount' })
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  const won = Math.floor(Number(amount) || 0)
  const tooMuch = won > available
  const belowFloor = available < POINT_RULES.minRedeem
  const canGo = won > 0 && !tooMuch && !belowFloor

  const run = useCallback(
    async (t: string, shopId: string) => {
      if (busy) return
      setBusy(true)
      /*
        코드는 쓰는 순간에 만든다. 미리 만들어 두면 화면을 열어놓고 닫기를
        반복하는 사이 번호가 어긋난다.
      */
      const code = makePointCode(uid, couponSerial('pt', uid))
      const out = await redeemPoints({ code, amountWon: won, shopId, uid, token: t })
      /*
        원장은 사용 기록이 만들어진 **뒤에만** 깎는다. 먼저 깎고 기록이
        실패하면 손님은 쓰지도 못한 포인트를 잃는다. 반대 순서면 늦어질
        뿐이다 — 잃는 쪽이 아니라 늦는 쪽으로 실패하게 둔다.
      */
      if (out.kind === 'ok') {
        await recordSpend(code, won)
        // 다음에 열 때 새 번호가 나온다. 쓴 코드가 다시 뜨면 '이미 사용됨'이다
        reissueCoupon('pt', uid)
        onRedeemed()
      }
      setStep({ kind: 'done', out, amount: won })
      setBusy(false)
    },
    [busy, uid, won, onRedeemed]
  )

  /** 스캔값은 가게 스티커여야 한다 — 손님 QR을 찍으면 여기서 걸린다 */
  const onScan = useCallback((raw: string) => {
    const shop = parseShopQr(raw)
    if (!shop) {
      setHint('가게 QR이 아니에요. 카운터에 붙은 스티커를 찍어주세요.')
      return
    }
    setStep({ kind: 'confirm', token: shop.token, shopId: shop.shopId })
  }, [])

  // ── 결과 ──────────────────────────────────────────────
  if (step.kind === 'done') {
    const { out } = step
    return (
      <Shell onClose={onClose}>
        {out.kind === 'ok' && (
          <div className="rounded-2xl border-2 border-teal bg-teal/10 px-5 py-10 text-center">
            <p className="text-[52px] leading-none" aria-hidden>
              ✓
            </p>
            <p className="mt-4 font-display text-[26px] text-teal-dk">사용 완료</p>
            <p className="mt-3 text-[19px] font-bold text-ink">
              {step.amount.toLocaleString()}원 할인
            </p>
            <p className="mt-4 font-mono-retro text-[11px] text-ink-60">
              사장님께 이 화면을 보여주세요
            </p>
          </div>
        )}

        {out.kind === 'used' && (
          <Bad title="이미 사용됨" mark="✕">
            이 코드는 {out.at}에 쓰였어요.
            <br />
            닫았다 다시 열면 새 코드가 나옵니다.
          </Bad>
        )}

        {out.kind === 'denied' && (
          <Bad title="사용할 수 없어요" mark="!">
            {out.reason}
          </Bad>
        )}

        {out.kind === 'test' && (
          <Bad title="시험용 코드입니다" mark="🧪">
            점검용으로 만든 코드라 실제 포인트가 아닙니다.
          </Bad>
        )}

        {out.kind === 'offline' && (
          <Bad title="지금은 확인할 수 없어요" mark="📶">
            통신이 되는 곳에서 다시 시도해 주세요.
            <br />
            확인이 안 된 채로 포인트를 깎지 않습니다.
          </Bad>
        )}

        <button onClick={onClose} className="btn-teal mt-5 w-full text-center">
          닫기
        </button>
      </Shell>
    )
  }

  // ── 확인 — 무엇을, 어디서 ────────────────────────────
  if (step.kind === 'confirm') {
    return (
      <Shell onClose={onClose}>
        <div className="rounded-2xl border-2 border-sunset-yellow bg-sunset-yellow/10 px-5 py-8 text-center">
          <p className="font-mono-retro text-[11px] tracking-[0.2em] text-ink-60">
            여기서 사용합니다
          </p>
          <p className="mt-3 font-display text-[24px] text-ink">
            {shopName(step.shopId)}
          </p>
          <p className="mt-2 text-[19px] font-bold text-ink">
            {won.toLocaleString()}P · {won.toLocaleString()}원 할인
          </p>
          <p className="mt-5 text-[14px] leading-relaxed text-ink">
            포인트를 사용할까요?
          </p>
          <p className="mt-1 text-[11.5px] text-ink-60">
            한 번 쓰면 되돌릴 수 없어요
          </p>
        </div>
        <button
          onClick={() => void run(step.token, step.shopId)}
          disabled={busy}
          className="btn-teal mt-5 w-full text-center disabled:opacity-40"
        >
          {busy ? '사용 처리 중…' : '사용하기'}
        </button>
        <button
          onClick={() => setStep({ kind: 'amount' })}
          className="mt-2 w-full rounded-xl border border-line bg-paper py-3 text-[13px] font-bold text-ink"
        >
          취소
        </button>
      </Shell>
    )
  }

  // ── 스티커 찍기 ──────────────────────────────────────
  if (step.kind === 'scan') {
    return (
      <Shell onClose={onClose}>
        <p className="text-center text-[13px] leading-relaxed text-ink-60">
          카운터에 붙은
          <br />
          <b className="text-ink">봉황 메모리즈 스티커</b>를 찍어주세요.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl">
          <QRScanner onScanSuccess={onScan} onClose={() => setStep({ kind: 'amount' })} />
        </div>
        {hint && <p className="mt-3 text-center text-[12px] text-rec">{hint}</p>}
        <button
          onClick={() => setStep({ kind: 'manual' })}
          className="mt-4 w-full text-center text-[12px] text-ink-60 underline underline-offset-2"
        >
          카메라가 안 되나요? 스티커의 글자 입력하기
        </button>
      </Shell>
    )
  }

  /*
    손으로 넣는 길.

    쿠폰과 달리 포인트는 어느 가게든 쓸 수 있어서, 8자리만으로는 어느
    가게인지 알 수 없다 — 그 값이 곧 가게의 비밀이라 손님 쪽에서 되짚을
    방법이 없다. 그래서 가게를 함께 고르게 한다.
  */
  if (step.kind === 'manual') {
    return (
      <Shell onClose={onClose}>
        <p className="text-center text-[13px] leading-relaxed text-ink-60">
          스티커 QR 아래에 적힌 <b className="text-ink">8자리</b>와
          <br />
          지금 계신 가게를 골라주세요.
        </p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder="XXXXXXXX"
          maxLength={8}
          autoCapitalize="characters"
          className="mt-4 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono-retro text-[17px] tracking-[0.18em] text-ink"
        />
        <select
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value || token.trim().length !== 8) return
            setStep({ kind: 'confirm', token: token.trim(), shopId: e.target.value })
          }}
          className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink"
        >
          <option value="">가게 고르기</option>
          {SHOP_CHOICES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-center text-[11px] text-ink-60">
          8자리를 넣고 가게를 고르면 확인 화면으로 넘어갑니다.
        </p>
        <button
          onClick={() => setStep({ kind: 'scan' })}
          className="mt-4 w-full text-center text-[12px] text-ink-60 underline underline-offset-2"
        >
          카메라로 찍기
        </button>
      </Shell>
    )
  }

  // ── 얼마를 쓸까 ──────────────────────────────────────
  return (
    <Shell onClose={onClose}>
      <div className="rounded-2xl border border-line bg-paper p-4 text-center">
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
      </div>

      <p className="mt-4 text-center text-[13px] leading-relaxed text-ink-60">
        결제 금액에서 <b className="text-ink">얼마를 뺄지</b> 넣어주세요.
      </p>
      <input
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={submitOnEnter(() => setStep({ kind: 'scan' }), canGo)}
        placeholder="0"
        className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-display text-[26px] text-ink"
      />
      {/* 자주 쓰는 액수는 눌러서 — 카운터에서 숫자를 치는 시간이 아깝다 */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[1000, 2000, 3000, 5000].map((v) => (
          <button
            key={v}
            disabled={v > available}
            onClick={() => setAmount(String(v))}
            className="rounded-lg border border-line bg-paper py-2 font-mono-retro text-[12px] text-ink disabled:opacity-30"
          >
            {v.toLocaleString()}
          </button>
        ))}
      </div>

      {belowFloor ? (
        <p className="mt-3 text-center text-[12px] text-rec">
          {POINT_RULES.minRedeem.toLocaleString()}P부터 쓸 수 있어요 — 지금은{' '}
          {available.toLocaleString()}P
        </p>
      ) : tooMuch ? (
        <p className="mt-3 text-center text-[12px] text-rec">
          쓸 수 있는 포인트({available.toLocaleString()}P)를 넘었어요
        </p>
      ) : null}

      <button
        onClick={() => setStep({ kind: 'scan' })}
        disabled={!canGo}
        className="btn-teal mt-4 w-full text-center disabled:opacity-40"
      >
        가게 스티커 찍기
      </button>
    </Shell>
  )
}

/**
 * 손입력에서 고를 가게 목록.
 *
 * 카탈로그의 거점 가게만 담는다 — 손님이 고를 수 있어야 하는데, 가게 목록
 * 자체는 규칙이 막아 읽을 수 없기 때문이다. 고른 값이 틀리면 토큰이 맞지
 * 않아 규칙에서 떨어진다.
 */
const SHOP_CHOICES = [
  { id: 'cp1', name: '봉황1935' },
  { id: 'cp2', name: '미야상회' },
  { id: 'cp3', name: '능소화 고택' },
  { id: 'cp4', name: '카페 탱자' },
  { id: 'cp5', name: '방하림' },
]

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
          <button onClick={onClose} aria-label="닫기" className="text-[18px] text-ink-60">
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
