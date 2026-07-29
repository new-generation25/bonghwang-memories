'use client'

/**
 * 가게용 쿠폰 확인 화면 — 보조 경로.
 *
 * 참여자가 스스로 쓰는 길(가게 스티커를 앱으로 찍기)이 주 경로이고,
 * 여기는 그것이 안 될 때 사장님이 대신 처리하는 자리다. 참여자 카메라가
 * 고장났거나 계정이 없을 때가 그렇다.
 *
 * 로그인을 요구한다. 예전에는 이 주소가 아무나 열 수 있었는데, 그러면
 * 참여자가 가게에 오지 않고 자기 폰에서 열어 쿠폰을 태울 수 있었다 —
 * '가게에서 쓰는 시스템'이라는 말이 성립하지 않았다. 사장님께 계정을
 * 만들게 하는 부담보다 이쪽이 크다고 봤다.
 *
 * 사장님이 볼 것은 여전히 셋이다 — 우리 가게 쿠폰이 맞는가, 무엇을
 * 드리는가, 이미 쓴 것은 아닌가. 그래서 화면 하나에 큰 글씨로만 답한다.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import QRScanner from '@/components/QRScanner'
import { useAuth } from '@/contexts/AuthContext'
import { signIn } from '@/lib/auth'
import { submitOnEnter } from '@/lib/submitOnEnter'
import { parsePointCode } from '@/lib/coupons'
import { CAP_CLOSED_MESSAGE } from '@/lib/coverage'
import {
  fetchMyShops,
  redeemCoupon,
  redeemPoints,
  type RedeemOutcome,
  type Shop,
} from '@/lib/shops'

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  /** 포인트 코드를 받았다 — 금액은 사장님이 넣는다 */
  | { kind: 'amount'; code: string }
  /** points가 있으면 포인트 사용이다 — 결과 화면의 문구가 갈린다 */
  | { kind: 'done'; out: RedeemOutcome; points?: number }

function ShopVerifyInner() {
  const params = useSearchParams()
  const raw = params.get('c') ?? ''
  const { profile, loading: authLoading, applyProfile } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [shopLoading, setShopLoading] = useState(true)
  const [manual, setManual] = useState('')
  const [scan, setScan] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })
  /** 포인트로 깎을 금액 — 1p = 1원이라 그대로 포인트 수다 */
  const [amount, setAmount] = useState('')

  // 로그인 상자
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [busy, setBusy] = useState(false)

  /*
    주소에 가게를 박지 않고 계정으로 찾는다. 링크에 가게가 들어가면
    그 링크가 새는 순간 남의 가게 화면이 열린다.
  */
  useEffect(() => {
    if (!profile?.uid) {
      setShop(null)
      setShopLoading(false)
      return
    }
    let alive = true
    setShopLoading(true)
    void fetchMyShops(profile.uid)
      .then((list) => {
        if (alive) setShop(list[0] ?? null)
      })
      .catch(() => {
        if (alive) setShop(null)
      })
      .finally(() => {
        if (alive) setShopLoading(false)
      })
    return () => {
      alive = false
    }
  }, [profile?.uid])

  const verify = useCallback(
    async (code: string) => {
      if (!shop || !profile?.uid) return
      setScan(false)

      /*
        포인트 코드는 곧바로 태우지 않는다. 얼마를 쓸지가 이 자리에서
        정해지는 값이라 금액 칸을 먼저 띄운다 — 쿠폰처럼 액면이 정해져
        있었다면 이 단계가 없었을 것이다.
      */
      if (parsePointCode(code)) {
        setState({ kind: 'amount', code: code.trim().toUpperCase() })
        return
      }

      setState({ kind: 'checking' })
      const out = await redeemCoupon({
        code,
        shopId: shop.shopId,
        shopGroup: shop.group,
        byUid: profile.uid,
        via: 'staff',
        // 가게 기기는 자기 문서를 읽을 수 있다 — 충당률을 그 자리에서 찍고
        // 월 상한도 잰다. 참여자가 직접 찍는 주 경로는 둘 다 못 한다
        shop,
      })
      setState({ kind: 'done', out })
    },
    [shop, profile?.uid]
  )

  /** 사장님이 넣은 금액으로 포인트를 태운다 */
  const applyAmount = useCallback(
    async (code: string, amountWon: number) => {
      if (!shop || !profile?.uid) return
      setState({ kind: 'checking' })
      const out = await redeemPoints({
        code,
        amountWon,
        shop,
        byUid: profile.uid,
      })
      setState({ kind: 'done', out, points: amountWon })
    },
    [shop, profile?.uid]
  )

  /*
    QR 자동 확인은 가게 계정이 확인된 뒤에만 돈다.
    이 한 줄이 '참여자가 자기 폰에서 스스로 태우는' 구멍을 닫는다.
  */
  useEffect(() => {
    if (raw && shop && profile?.uid) void verify(raw)
  }, [raw, shop, profile?.uid, verify])

  /** 참여자 QR은 확인 주소를 담고 있다 — 코드만 뽑아 쓴다 */
  const onScan = useCallback(
    (data: string) => {
      const m = data.match(/[?&]c=([^&]+)/)
      void verify(m ? decodeURIComponent(m[1]) : data.trim())
    },
    [verify]
  )

  const doLogin = async () => {
    if (busy) return
    setBusy(true)
    setLoginErr('')
    try {
      applyProfile(await signIn(loginId.trim(), password))
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : '로그인하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen flex-col bg-cream-base px-5 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <p className="text-center font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          봉황 메모리즈 · 가게 확인
        </p>
        {children}
      </div>
    </div>
  )

  if (authLoading || (profile?.uid && shopLoading)) {
    return (
      <Frame>
        <p className="mt-16 text-center font-display text-[18px] text-ink-60">
          불러오는 중…
        </p>
      </Frame>
    )
  }

  // ── 로그인 ──────────────────────────────────────────────
  if (!profile?.uid) {
    return (
      <Frame>
        <h1 className="mt-2 text-center font-display text-[20px] text-ink">
          가게 로그인
        </h1>
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink-60">
          카운터에 붙여드린 아이디로 로그인해 주세요.
          <br />한 번 로그인하면 계속 유지됩니다.
        </p>
        <input
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="아이디"
          autoCapitalize="none"
          className="mt-5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[15px] text-ink"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={submitOnEnter(doLogin, Boolean(loginId.trim() && password))}
          placeholder="비밀번호"
          className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[15px] text-ink"
        />
        {loginErr && <p className="mt-2 text-[12px] text-rec">{loginErr}</p>}
        <button
          onClick={doLogin}
          disabled={busy || !loginId.trim() || !password}
          className="btn-teal mt-3 w-full text-center disabled:opacity-40"
        >
          {busy ? '확인 중…' : '로그인'}
        </button>
      </Frame>
    )
  }

  // ── 가게 계정이 아닌 사람 ────────────────────────────────
  if (!shop) {
    return (
      <Frame>
        <div className="mt-10 rounded-2xl border-2 border-rec bg-rec/10 px-5 py-10 text-center">
          <p className="text-[44px] leading-none" aria-hidden>
            🔒
          </p>
          <p className="mt-4 font-display text-[20px] text-rec">가게 계정이 아닙니다</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
            이 화면은 가게에서 쿠폰을 확인하는 자리입니다.
            <br />
            쿠폰을 쓰시려면 앱의 <b className="text-ink">나의 기록 → 쿠폰</b>에서
            <br />
            [가게에서 사용하기]로 카운터의 QR을 찍어주세요.
          </p>
        </div>
      </Frame>
    )
  }

  // ── 확인 ────────────────────────────────────────────────
  const out = state.kind === 'done' ? state.out : null
  const usedPoints = state.kind === 'done' ? state.points : undefined

  return (
    <Frame>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2">
        <span className="text-[13px] font-bold text-ink">{shop.name}</span>
        <Link
          href="/shop/history"
          className="font-mono-retro text-[11px] text-teal-dk underline underline-offset-2"
        >
          사용 내역
        </Link>
      </div>

      {scan && (
        <div className="mt-4 overflow-hidden rounded-2xl">
          <QRScanner onScanSuccess={onScan} onClose={() => setScan(false)} />
        </div>
      )}

      {state.kind === 'idle' && !scan && (
        <>
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-ink-60">
            손님 화면의 QR을 찍거나, 코드를 직접 입력하세요.
          </p>
          <button onClick={() => setScan(true)} className="btn-teal mt-4 w-full text-center">
            📷 손님 QR 찍기
          </button>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            onKeyDown={submitOnEnter(() => void verify(manual), Boolean(manual.trim()))}
            placeholder="BH1-CP1-XXXXXX-XXXX / PT1-…"
            autoCapitalize="characters"
            className="mt-4 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono-retro text-[15px] tracking-[0.08em] text-ink"
          />
          <button
            onClick={() => void verify(manual)}
            disabled={!manual.trim()}
            className="mt-2 w-full rounded-xl border border-line bg-paper py-3 text-[13px] font-bold text-ink disabled:opacity-40"
          >
            코드로 확인하기
          </button>
        </>
      )}

      {/*
        포인트 — 금액 넣기.

        손님 화면에는 이 칸이 없다. 사장님이 확인하지 않은 숫자가 그대로
        기록이 되면 안 되고, 실제 계산대에서도 "얼마 쓸까요"는 카운터에서
        정해지는 이야기다.
      */}
      {state.kind === 'amount' && (
        <>
          <div className="mt-4 rounded-xl border border-teal/50 bg-teal/5 px-3 py-2.5 text-center">
            <p className="font-mono-retro text-[10px] tracking-[0.15em] text-teal-dk">
              봉황 포인트
            </p>
            <p className="mt-1 font-mono-retro text-[12px] text-ink">{state.code}</p>
          </div>
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-ink-60">
            결제 금액에서 <b className="text-ink">깎아드릴 금액</b>을 넣어주세요.
            <br />
            손님 화면의 남은 포인트를 넘지 않게 해주세요.
          </p>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={submitOnEnter(
              () => void applyAmount(state.code, Number(amount)),
              Number(amount) > 0
            )}
            placeholder="0"
            className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-display text-[24px] text-ink"
          />
          <p className="mt-1 text-center font-mono-retro text-[11px] text-ink-60">
            {(Number(amount) || 0).toLocaleString()}원 · 1P = 1원
          </p>
          {/* 자주 쓰는 액수는 눌러서 — 계산대에서 숫자를 치는 시간이 아깝다 */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[1000, 2000, 3000, 5000].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="rounded-lg border border-line bg-paper py-2 font-mono-retro text-[12px] text-ink"
              >
                {v.toLocaleString()}
              </button>
            ))}
          </div>
          <button
            onClick={() => void applyAmount(state.code, Number(amount))}
            disabled={!(Number(amount) > 0)}
            className="btn-teal mt-4 w-full text-center disabled:opacity-40"
          >
            이 금액으로 사용 처리
          </button>
          <button
            onClick={() => {
              setAmount('')
              setState({ kind: 'idle' })
            }}
            className="mt-2 w-full rounded-xl border border-line bg-paper py-3 text-[13px] font-bold text-ink"
          >
            취소
          </button>
        </>
      )}

      {state.kind === 'checking' && (
        <p className="mt-16 text-center font-display text-[18px] text-ink-60">확인 중…</p>
      )}

      {/* 사용 처리 완료 — 사장님이 멀리서도 보게 크고 단순하게 */}
      {out?.kind === 'ok' && (
        <div className="mt-8 rounded-2xl border-2 border-teal bg-teal/10 px-5 py-10 text-center">
          <p className="text-[52px] leading-none" aria-hidden>
            ✓
          </p>
          <p className="mt-4 font-display text-[26px] text-teal-dk">사용 가능</p>
          <p className="mt-3 text-[16px] font-bold text-ink">{shop.name}</p>
          {usedPoints ? (
            <p className="mt-1 text-[19px] font-bold text-ink">
              {usedPoints.toLocaleString()}원 할인
            </p>
          ) : (
            <p className="mt-1 text-[17px] font-bold text-ink">{shop.benefit}</p>
          )}
          <p className="mt-4 font-mono-retro text-[11px] text-ink-60">
            방금 사용 처리했습니다 · 재사용 불가
          </p>
        </div>
      )}

      {out?.kind === 'used' && (
        <Bad mark="✕" title="이미 사용됨">
          {shop.name} · {shop.benefit}
          <br />
          사용 시각 {out.at}
        </Bad>
      )}

      {/*
        거절과 통신 문제를 가른다. 예전에는 모든 예외를 '오프라인'으로
        뭉갰는데, 그러면 규칙이 막은 것도 사장님께는 통신 문제로 보여
        신호를 찾아 밖으로 나가시게 된다.
      */}
      {out?.kind === 'denied' && (
        <Bad mark="?" title="확인할 수 없음">
          {out.reason}
        </Bad>
      )}

      {/*
        월 충당 상한에 닿았다.

        손님께 보여드리는 문구는 여기서도 같다 — 이 화면은 카운터에서
        손님 쪽으로 돌려 보여주는 자리라, 사장님께만 하는 말을 적으면
        그대로 손님이 읽는다. 얼마가 남았는지는 사용 내역 화면에서 본다.
      */}
      {out?.kind === 'capped' && (
        <div className="mt-8 rounded-2xl border-2 border-sunset-yellow bg-sunset-yellow/15 px-5 py-10 text-center">
          <p className="text-[44px] leading-none" aria-hidden>
            🗓️
          </p>
          <p className="mt-4 font-display text-[20px] text-ink">이번 달 혜택 마감</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
            {CAP_CLOSED_MESSAGE}
          </p>
        </div>
      )}

      {/*
        시험용 코드. 만에 하나 손님이 이 코드를 들고 왔을 때
        "드리면 안 되는 것"이 분명해야 한다.
      */}
      {out?.kind === 'test' && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-ink-60 bg-cream px-5 py-10 text-center">
          <p className="text-[44px] leading-none" aria-hidden>
            🧪
          </p>
          <p className="mt-4 font-display text-[20px] text-ink">시험용 코드입니다</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
            앱을 점검하며 만든 코드라 실제 쿠폰이 아닙니다.
            <br />
            <b className="text-ink">혜택을 드리지 않으셔도 됩니다.</b>
          </p>
        </div>
      )}

      {/*
        통신이 안 될 때. '사용 가능'이라고 말하지 않는다 —
        이미 쓴 쿠폰인지 알 수 없는 상태에서 통과시키면 중복 사용이 된다.
      */}
      {out?.kind === 'offline' && (
        <div className="mt-8 rounded-2xl border-2 border-sunset-yellow bg-sunset-yellow/15 px-5 py-10 text-center">
          <p className="text-[44px] leading-none" aria-hidden>
            📶
          </p>
          <p className="mt-4 font-display text-[20px] text-ink">지금은 확인할 수 없어요</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
            이미 쓴 쿠폰인지 확인이 안 됩니다.
            <br />
            통신이 되는 곳에서 다시 찍어 주세요.
          </p>
        </div>
      )}

      {state.kind === 'done' && (
        <button
          onClick={() => {
            setManual('')
            setAmount('')
            setState({ kind: 'idle' })
          }}
          className="mt-5 w-full rounded-xl border border-line bg-paper py-3 text-[13px] font-bold text-ink"
        >
          다음 손님 확인하기
        </button>
      )}
    </Frame>
  )
}

function Bad({
  mark,
  title,
  children,
}: {
  mark: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-8 rounded-2xl border-2 border-rec bg-rec/10 px-5 py-10 text-center">
      <p className="text-[52px] leading-none" aria-hidden>
        {mark}
      </p>
      <p className="mt-4 font-display text-[22px] text-rec">{title}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-60">{children}</p>
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
