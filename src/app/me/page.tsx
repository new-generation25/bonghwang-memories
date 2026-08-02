'use client'

/**
 * 나의 기록 — 개인 화면.
 *
 * '소영의 친구들'은 다른 사람과 만나는 광장이고, 여기는 내 것만 모은다.
 * 포인트·적립 내역·쿠폰·투어 진행도가 섞여 있으면 광장이 대시보드처럼
 * 보여서 둘을 갈랐다.
 *
 * 로그인하지 않아도 볼 수 있다 — 투어는 등록 없이도 걸을 수 있고,
 * 그때 쌓인 포인트는 로컬에 남았다가 로그인 시 서버로 올라간다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import MyPoints from '@/components/MyPoints'
import AuthModal from '@/components/AuthModal'
import CouponCard from '@/components/CouponCard'
import JCard from '@/components/JCard'
import SettingsSheet from '@/components/SettingsSheet'
import SurveyLink from '@/components/SurveyLink'
import GachaSheet from '@/components/GachaSheet'
import { couponSpec } from '@/lib/coupons'
import { gachaSeed, prizesOf, type GachaPrize } from '@/lib/gacha'
import { useAuth } from '@/contexts/AuthContext'
import { useTourState } from '@/hooks/useTourState'
import { markGachaDrawn } from '@/lib/tourState'
import { awardDynamic } from '@/lib/points'
import { isAdminUser } from '@/lib/admin'
import { logEvent } from '@/lib/analytics'

export default function MyRecordPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const tour = useTourState()
  const [showAuth, setShowAuth] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [gachaOpen, setGachaOpen] = useState(false)

  /*
    쿠폰 코드의 사용자 부분.
    로그인 전에도 투어를 걸을 수 있으므로 uid가 없을 수 있다. 그때는
    기기에 남는 투어 시작 시각으로 대신한다 — 같은 기기에서는 같은 코드가
    나오고, 다른 참여자와 겹치지도 않는다.
  */
  const couponUid = profile?.uid ?? `local-${tour.startTime ?? 0}`

  /*
    지갑 한 자리.

    거점 쿠폰과 뽑기 쿠폰을 나란히 둔다 — 참여자에게는 '받은 쿠폰'이
    한 종류이고, 다른 것은 쓰는 곳뿐이다. 카드마다 그 곳이 적혀 있다.

    뽑기 쿠폰은 칸 번호를 발급 순번으로 쓴다. 같은 쿠폰이 두 칸에서
    나와도 코드가 갈려, 한 장을 써도 나머지가 살아 있다.

    판 배치가 계정마다 다르므로 시드가 같아야 같은 상품이 나온다 —
    쿠폰 코드가 쓰는 것과 같은 값이다(로그인 전에는 기기의 투어 시작 시각).
  */
  const seed = gachaSeed(profile?.uid, tour.startTime)
  const wallet = [
    ...tour.coupons.map((id) => ({ key: id, spec: couponSpec(id), serial: undefined as number | undefined })),
    ...tour.gachaDrawn.map((slot) => {
      const prize = prizesOf(seed, [slot])[0]
      return {
        key: `g${slot}`,
        spec: prize?.kind === 'coupon' && prize.couponId ? couponSpec(prize.couponId) : null,
        serial: slot,
      }
    }),
  ].filter((x) => x.spec)
  /** 뽑기로 받은 포인트 — 지갑이 아니라 적립 내역에 남는 것들 */
  const pointPrizes = prizesOf(seed, tour.gachaDrawn).filter((p) => p.kind === 'points')

  /*
    남은 뽑기 이용권 — 빙고 한 줄에 한 장.

    빙고판이 저장해둔 줄 수에서 연 칸 수를 뺀다. 줄 판정은 빙고판이 하고
    여기는 결과만 읽는다 — 같은 계산을 두 곳에서 하면 언젠가 갈라진다.
  */
  const drawsLeft = Math.max(0, tour.bingo.lines - tour.gachaDrawn.length)

  /**
   * 한 칸이 열렸다 — 기록하고 상품을 건넨다.
   *
   * 쿠폰이면 지갑에 들어간다. 지갑에 따로 담지 않고 gachaDrawn(칸 번호)에서
   * 파생시킨다 — tour.coupons는 id 집합이라 같은 쿠폰을 두 번 담지 못하는데,
   * 칸 번호는 겹치지 않아 두 장을 각각 셀 수 있다.
   * 포인트면 그 자리에서 적립한다 — 쓸 곳이 앱 안이라 지갑에 넣지 않는다.
   */
  const handleDrawn = (slot: number, prize: GachaPrize) => {
    markGachaDrawn(slot)
    logEvent('gacha_drawn', { id: prize.id, tier: prize.tier, slot })
    if (prize.kind === 'points' && prize.points) {
      // refId에 칸 번호를 넣는다 — 같은 상품을 두 번 뽑아도 각각 적립된다
      void awardDynamic(`slot-${slot}`, prize.points, 'gacha')
    } else if (prize.kind === 'coupon' && prize.couponId) {
      logEvent('coupon_granted', { by: 'gacha', id: prize.couponId, slot })
    }
  }

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">BONGHWANG MEMORIES · 나의 기록</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">나의 기록</h1>
            <div className="flex shrink-0 items-center gap-1.5">
              {/*
                관리자 문 — 관리자 계정으로 로그인했을 때만 선다.

                주소를 외워 치지 않고 들어갈 자리가 필요했다. 여기에 두는
                이유는 하단 탭의 '나의 기록'이 어느 화면에서든 한 번에 닿는
                유일한 자리이기 때문이다.

                화면을 가리는 것이 권한이 아니다 — 실제 방어는 관리자 화면
                자신과 firestore.rules다. 여기서 감추는 것은 참여자에게
                쓸모없는 문을 보이지 않게 하려는 것뿐이다.
              */}
              {!authLoading && profile && isAdminUser() && (
                <Link
                  href="/admin"
                  aria-label="관리자 화면 열기"
                  className="rounded-full bg-cream/20 px-2.5 py-1 font-mono-retro text-[10px] font-bold tracking-wider"
                >
                  ADMIN
                </Link>
              )}
              {!authLoading &&
                (profile ? (
                  <button
                    onClick={() => setShowSettings(true)}
                    aria-label="내 설정 열기"
                    className="flex shrink-0 items-center gap-1 rounded-full bg-cream/20 px-3 py-1 text-[11px] font-bold"
                  >
                    <span aria-hidden>⚙️</span>
                    {profile.nickname} 기록자
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAuth(true)}
                    className="shrink-0 rounded-full bg-cream/20 px-3 py-1 text-[11px] font-bold"
                  >
                    로그인
                  </button>
                ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-5">
        {/* 포인트 — 이 화면의 주인공 */}
        <MyPoints />

        {/*
          완주했는데 아직 설문에 안 답했으면 여기서 한 번 더 권한다.

          7/30 현장에서 세 팀이 완주했는데 응답이 0건이었다. 안내는 피날레에만
          있었고, 그 화면은 여운을 보는 자리라 한 번 지나가면 다시 만날 일이
          없다. 「나의 기록」은 걷고 나서 돌아오는 자리다 — 포인트 바로 아래에
          두면 200P가 눈에 보이는 채로 읽힌다.

          이미 답했으면 SurveyLink가 감사 문구로 바뀐다. 무시하는 법을
          배우게 만들지 않는다.
        */}
        {tour.phase === 'done' && <SurveyLink />}

        {/* 로그인 안내 — 기록이 이 기기에만 있다는 사실을 알린다 */}
        {!profile && !authLoading && (
          <div className="card-paper mb-5 p-4 text-center">
            <p className="text-[12px] leading-relaxed text-ink-60">
              지금 기록은 <b className="text-ink">이 기기에만</b> 저장돼 있어요.
              <br />
              로그인하면 계정에 안전하게 보관되고, 다른 기기에서도 이어집니다.
            </p>
            <button
              onClick={() => setShowAuth(true)}
              className="btn-teal mt-3 w-full py-2.5 text-[13px]"
            >
              ▶ 기록자로 로그인
            </button>
          </div>
        )}

        {/* J-카드 — 케이스 속지의 다섯 소원(F-1)이 곧 진행도다.
            같은 다섯 줄을 진행도 카드로 또 보여주면 화면이 두 번 말한다 —
            경과 시간·빙고 요약까지 J-카드가 흡수했다. */}
        <div className="mb-5">
          <JCard />
        </div>

        {/*
          뽑기 이용권 — 여기가 쓰는 자리다.

          받은 것(쿠폰·포인트) 바로 위에 둔다. 빙고판은 걷는 동안 보는
          화면이라 거기서 판을 열면, 판에서 나온 쿠폰을 보러 또 여기로
          와야 했다. 받는 곳과 여는 곳이 한자리여야 한 번에 끝난다.
        */}
        {drawsLeft > 0 && (
          <button
            onClick={() => setGachaOpen(true)}
            className="mb-5 flex w-full items-center gap-3 rounded-xl border-2 border-sunset-yellow bg-paper px-4 py-3 text-left active:scale-[0.99]"
          >
            {/* 이용권을 장수로 보여준다 — 쌓인 것이 눈에 보여야 쓰고 싶어진다 */}
            <span className="relative shrink-0" aria-hidden>
              <span className="text-[26px]">🎟</span>
              {drawsLeft > 1 && (
                <span className="absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rec px-1 font-mono-retro text-[10px] text-cream">
                  {drawsLeft}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-ink">
                뽑기 한판 {drawsLeft}장 있어요
              </span>
              <span className="block font-mono-retro text-[10.5px] text-ink-60">
                한 장을 내면 「추억의 뽑기왕」 판이 열려요
              </span>
            </span>
            <span className="shrink-0 font-mono-retro text-[11px] text-teal-dk">
              쓰기 ▶
            </span>
          </button>
        )}

        {/*
          뽑기로 받은 포인트. 쿠폰은 아래 지갑에 함께 들어가고, 포인트만
          여기 남는다 — 쓸 곳이 앱 안이라 가게에 내밀 물건이 아니다.
        */}
        {pointPrizes.length > 0 && (
          <div className="card-paper mb-5 p-4 shadow-lg">
            <h2 className="font-vintage text-sm font-black text-teal-dk">
              🎁 뽑기로 받은 포인트
            </h2>
            <ul className="mt-2 space-y-1.5">
              {pointPrizes.map((prize, i) => (
                <li key={`${prize.id}-${i}`} className="flex items-center gap-2.5">
                  <span className="text-[18px]" aria-hidden>
                    {prize.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                    {prize.name}
                  </span>
                  <span className="shrink-0 font-mono-retro text-[10px] text-ink-60">
                    적립됨
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 쿠폰 */}
        <div className="card-paper mb-5 p-4 shadow-lg">
          <h2 className="font-vintage text-sm font-black text-teal-dk">
            🎟 받은 쿠폰
          </h2>
          {wallet.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-60">
              아직 받은 쿠폰이 없어요 — 빙고 한 줄을 채우면 「뽑기 한판」이
              생기고, 판을 열면 쿠폰이 나옵니다.
            </p>
          ) : (
            /*
              쿠폰 코드만 늘어놓던 것을 실제로 쓸 수 있는 카드로 바꿨다.
              'cp1'이라는 글자를 가게에 보여줄 수는 없다 — 어느 가게에서
              무엇을 받는지, 그리고 찍을 QR이 있어야 쿠폰 구실을 한다.
            */
            <div className="mt-2">
              {wallet.map((item) => (
                <CouponCard
                  key={item.key}
                  spec={item.spec!}
                  uid={couponUid}
                  signedIn={Boolean(profile?.uid)}
                  fixedSerial={item.serial}
                />
              ))}
            </div>
          )}
        </div>

        {/*
          적립 내역은 맨 위 「봉황 포인트」 카드 안에 있다.

          여기 따로 두었던 목록은 **로컬 원장만** 읽어서, 기기를 바꾸거나
          캐시를 지운 사람에게는 위에서 2,400P가 보이는데 아래는 "없어요"로
          나왔다. 한 화면에서 두 값이 어긋나면 어느 쪽도 못 믿는다.
          MyPoints는 서버까지 읽고 사유별로 묶어 보여주므로 그쪽이 맞다.
        */}

        <button
          onClick={() => router.push('/community')}
          className="mt-5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13px] font-bold text-teal-dk"
        >
          👥 소영의 친구들 보러 가기
        </button>
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => setShowAuth(false)}
      />

      <SettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {gachaOpen && (
        <GachaSheet
          key={seed}
          seed={seed}
          drawn={tour.gachaDrawn}
          ticketsLeft={drawsLeft}
          onDrawn={handleDrawn}
          onClose={() => setGachaOpen(false)}
        />
      )}

      <Navigation />
    </div>
  )
}
