'use client'

/**
 * 가게용 쿠폰 확인 화면.
 *
 * 참여자 화면의 QR을 가게 휴대폰 카메라로 찍으면 이 주소가 열린다.
 * 사장님이 볼 것은 딱 셋이다 — 우리 가게 쿠폰이 맞는가, 무엇을 드리는가,
 * 이미 쓴 것은 아닌가. 그래서 화면 하나에 큰 글씨로만 답한다.
 *
 * 한 번만 쓰게 하는 방법:
 * 쓴 코드를 Firestore(couponUses/{코드})에 남긴다. 이미 있으면 거절한다.
 * 코드 자체의 체크값은 오타를 잡는 용도일 뿐 위조를 막지 못한다 —
 * 서버 비밀 없이 클라이언트에서 만드는 값이기 때문이다. 실제 방어는
 * 이 사용 기록이다.
 *
 * 로그인은 요구하지 않는다. 사장님에게 계정을 만들게 하면 현장에서
 * 쓰이지 않는다. 대신 쓸 수 있는 일이 '한 번 사용 처리'뿐이라 피해가 작다.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { parseCouponCode, type ParsedCoupon } from '@/lib/coupons'

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; coupon: ParsedCoupon }
  | { kind: 'used'; coupon: ParsedCoupon; at: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'offline'; coupon: ParsedCoupon }
  /** 슈퍼관리자가 시험 삼아 받은 코드 — 사용 처리하지 않는다 */
  | { kind: 'test'; coupon: ParsedCoupon }

function ShopVerifyInner() {
  const params = useSearchParams()
  const raw = params.get('c') ?? ''
  const [manual, setManual] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  const verify = useCallback(async (code: string) => {
    const parsed = parseCouponCode(code)
    if (!parsed) {
      setState({ kind: 'invalid', reason: '이 앱의 쿠폰 코드가 아닙니다.' })
      return
    }

    // 시험용 코드는 여기서 멈춘다. 사용 기록을 만들지 않으므로 몇 번을
    // 찍어도 코드가 소진되지 않는다 — 실제 쿠폰은 한 번 찍으면 끝이라
    // 이 갈림이 없으면 확인 흐름을 시험할 때마다 쿠폰 하나를 태운다.
    if (parsed.isTest) {
      setState({ kind: 'test', coupon: parsed })
      return
    }

    setState({ kind: 'checking' })

    if (!db) {
      // 서버에 못 닿으면 사용 여부를 알 수 없다. 임의로 통과시키지 않는다
      setState({ kind: 'offline', coupon: parsed })
      return
    }

    const key = code.trim().toUpperCase()
    try {
      const ref = doc(db, 'couponUses', key)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const at = snap.data()?.usedAt
        setState({
          kind: 'used',
          coupon: parsed,
          at:
            at && typeof at.toDate === 'function'
              ? at.toDate().toLocaleString('ko-KR')
              : '기록 있음',
        })
        return
      }
      await setDoc(ref, {
        couponId: parsed.couponId,
        shop: parsed.spec.shop,
        userTag: parsed.userTag,
        usedAt: serverTimestamp(),
      })
      setState({ kind: 'ok', coupon: parsed })
    } catch {
      setState({ kind: 'offline', coupon: parsed })
    }
  }, [])

  useEffect(() => {
    if (raw) void verify(raw)
  }, [raw, verify])

  return (
    <div className="flex min-h-screen flex-col bg-cream-base px-5 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <p className="text-center font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          봉황 메모리즈 · 가게 확인
        </p>

        {state.kind === 'idle' && (
          <>
            <h1 className="mt-2 text-center font-display text-[20px] text-ink">
              쿠폰 코드 확인
            </h1>
            <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink-60">
              손님 화면의 QR을 카메라로 찍으면 자동으로 확인됩니다.
              <br />
              QR이 안 읽히면 코드를 직접 입력하세요.
            </p>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value.toUpperCase())}
              placeholder="BH1-CP1-XXXXXX-XXXX"
              autoCapitalize="characters"
              className="mt-5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono-retro text-[15px] tracking-[0.08em] text-ink"
            />
            <button
              onClick={() => void verify(manual)}
              disabled={!manual.trim()}
              className="btn-teal mt-3 w-full text-center disabled:opacity-40"
            >
              확인하기
            </button>
          </>
        )}

        {state.kind === 'checking' && (
          <p className="mt-16 text-center font-display text-[18px] text-ink-60">
            확인 중…
          </p>
        )}

        {/* 사용 처리 완료 — 사장님이 멀리서도 보게 크고 단순하게 */}
        {state.kind === 'ok' && (
          <div className="mt-10 rounded-2xl border-2 border-teal bg-teal/10 px-5 py-10 text-center">
            <p className="text-[52px] leading-none" aria-hidden>
              ✓
            </p>
            <p className="mt-4 font-display text-[26px] text-teal-dk">사용 가능</p>
            <p className="mt-3 text-[16px] font-bold text-ink">
              {state.coupon.spec.shop}
            </p>
            <p className="mt-1 text-[17px] font-bold text-ink">
              {state.coupon.spec.benefit}
            </p>
            <p className="mt-4 font-mono-retro text-[11px] text-ink-60">
              방금 사용 처리했습니다 · 재사용 불가
            </p>
          </div>
        )}

        {state.kind === 'used' && (
          <div className="mt-10 rounded-2xl border-2 border-rec bg-rec/10 px-5 py-10 text-center">
            <p className="text-[52px] leading-none" aria-hidden>
              ✕
            </p>
            <p className="mt-4 font-display text-[26px] text-rec">이미 사용됨</p>
            <p className="mt-3 text-[15px] text-ink">
              {state.coupon.spec.shop} · {state.coupon.spec.benefit}
            </p>
            <p className="mt-4 font-mono-retro text-[11px] text-ink-60">
              사용 시각 {state.at}
            </p>
          </div>
        )}

        {state.kind === 'invalid' && (
          <div className="mt-10 rounded-2xl border-2 border-rec bg-rec/10 px-5 py-10 text-center">
            <p className="text-[52px] leading-none" aria-hidden>
              ?
            </p>
            <p className="mt-4 font-display text-[22px] text-rec">확인할 수 없음</p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
              {state.reason}
              <br />
              코드를 다시 확인해 주세요.
            </p>
          </div>
        )}

        {/*
          통신이 안 될 때. '사용 가능'이라고 말하지 않는다 —
          이미 쓴 쿠폰인지 알 수 없는 상태에서 통과시키면 중복 사용이 된다.
        */}
        {state.kind === 'offline' && (
          <div className="mt-10 rounded-2xl border-2 border-sunset-yellow bg-sunset-yellow/15 px-5 py-10 text-center">
            <p className="text-[44px] leading-none" aria-hidden>
              📶
            </p>
            <p className="mt-4 font-display text-[20px] text-ink">
              지금은 확인할 수 없어요
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
              형식은 맞는 쿠폰입니다 — {state.coupon.spec.shop} ·{' '}
              {state.coupon.spec.benefit}
              <br />
              다만 이미 쓴 쿠폰인지 확인이 안 됩니다. 통신이 되는 곳에서 다시
              찍어 주세요.
            </p>
          </div>
        )}

        {/*
          시험용 코드. 사장님이 볼 일은 없지만, 만에 하나 손님이 이 코드를
          들고 왔을 때 "드리면 안 되는 것"이 분명해야 한다.
        */}
        {state.kind === 'test' && (
          <div className="mt-10 rounded-2xl border-2 border-dashed border-ink-60 bg-cream px-5 py-10 text-center">
            <p className="text-[44px] leading-none" aria-hidden>
              🧪
            </p>
            <p className="mt-4 font-display text-[20px] text-ink">
              시험용 코드입니다
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-60">
              앱을 점검하며 만든 코드라 실제 쿠폰이 아닙니다.
              <br />
              {state.coupon.spec.shop} · {state.coupon.spec.benefit}
              <br />
              <b className="text-ink">혜택을 드리지 않으셔도 됩니다.</b>
            </p>
          </div>
        )}

        {state.kind !== 'idle' && (
          <button
            onClick={() => {
              setManual('')
              setState({ kind: 'idle' })
            }}
            className="mt-5 w-full rounded-xl border border-line bg-paper py-3 text-[13px] font-bold text-ink"
          >
            다음 손님 확인하기
          </button>
        )}
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
