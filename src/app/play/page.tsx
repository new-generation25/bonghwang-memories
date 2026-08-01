'use client'

/**
 * S10 — 카세트 플레이어 홈: 1막의 허브.
 *
 * 트랙 리스트(잠김/진행/완료) · 릴 게이지 · 잠긴 빙고 배지 · QR 스캔.
 * 거점 진입은 오직 QR(또는 4자리 수동 코드)로만 — GPS는 재생 트리거 금지(D9),
 * 100m 접근 시 안내 토스트만 띄운다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Cassette, { CASSETTE_SCALE } from '@/components/Cassette'
import JCard from '@/components/JCard'
import Navigation from '@/components/Navigation'
import QRGate from '@/components/QRGate'
import { useProximityNotice } from '@/hooks/useProximityNotice'
import { useTourState } from '@/hooks/useTourState'
import { dispatchQr } from '@/lib/cueEngine'
import { Station, TRACK_STATIONS, stationByTrack } from '@/lib/tracks'

/**
 * QR 표식 — 실물 QR을 축약한 모양.
 * 이모지(📷)는 카메라를 뜻해서 '사진 찍기'로 읽힐 수 있다. 거점에 붙은
 * 종이 QR과 같은 그림이어야 무엇을 찾아야 하는지 바로 안다.
 */
function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {/* 세 모서리의 찾기 표식 */}
      <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5z" />
      {/* 데이터 칸 몇 개 — 실물처럼 보이게 하는 최소한 */}
      <path d="M14 14h2v2h-2v-2zm4 0h3v2h-3v-2zm-4 4h2v3h-2v-3zm4 1h3v2h-3v-2z" />
    </svg>
  )
}

export default function PlayerHomePage() {
  const tour = useTourState()
  const router = useRouter()
  const [showScanner, setShowScanner] = useState(false)

  const completedCount = tour.tracksCompleted.length
  const progress = (completedCount / 5) * 100

  /*
    QR 게이트는 **다섯 거점을 모두** 받는다.

    순서를 강제하지 않는다 — 어느 거점 QR을 찍어도 그 미션이 열린다.
    골목에서는 발길이 순서를 앞지르기도 한다.

    한동안 '아직 안 끝낸 거점'만 받았다. 그러면 다 이룬 뒤에는 어느 QR도
    받지 않아, 눈앞의 종이를 찍어도 아무 일이 일어나지 않는다. 다녀온
    거점은 도착 큐 대신 다시듣기로 간다(handleStationEnter).
  */

  // 접근 안내(GPS 토스트)용 권장 다음 거점 — 이야기의 순서는 여전히 이쪽이다
  const nextTrack =
    completedCount >= 5 ? null : Math.max(0, ...tour.tracksCompleted) + 1
  const nextStation = nextTrack ? stationByTrack(nextTrack) : null

  const { notice, dismiss } = useProximityNotice(nextStation)

  const handleStationEnter = (station: Station) => {
    setShowScanner(false)
    /*
      화면 전환을 먼저 건다.

      순서가 반대일 때는 소영의 첫 문장이 아직 플레이어 화면 위에서
      들렸다. 한때 소리 쪽을 반 박자 미뤄 맞추려 했는데, 그 사이 iOS의
      제스처 문맥이 끊겨 아이폰에서는 목소리가 통째로 나오지 않았다.

      router.push를 먼저 부르면 라우팅이 시작되고, 그 다음 dispatchQr이
      오디오 파일을 찾는 동안(수백 밀리초) 화면이 그려진다. 소리는 여전히
      사용자 조작 안에서 시작되므로 iOS도 막지 않는다.
    */
    router.push(`/track/${station.track}`)
    /*
      이미 끝낸 거점이면 도착 큐를 다시 틀지 않는다.

      다시 틀면 끝낸 미션이 또 떠서, 다시 듣기가 아니라 되돌리기가 된다.
      그 화면은 다녀온 거점에 대해 대목별 다시듣기를 내준다.
    */
    if (!tour.tracksCompleted.includes(station.track)) dispatchQr(station.id)
  }

  // pb-32 — 하단 탭바(84px)와 안전영역을 덮는 여백. 탭바를 쓰는 화면 공통값
  return (
    <div className="flex min-h-screen flex-col bg-cream-base pb-32">
      {/* 앱바 — 티얼 구조색. 탭바를 쓰는 화면은 모두 같은 머리를 쓴다 */}
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">SIDE A · 아버지의 믹스테이프</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">다섯 가지 소원</h1>
            <span className="shrink-0 rounded-full bg-cream/20 px-3 py-1 font-mono-retro text-[11px] font-bold">
              {completedCount} / 5
            </span>
          </div>
        </div>
      </header>

      {/* 카세트 히어로 — 릴 게이지 = 트랙 진행률 */}
      <div className="mt-3 flex justify-center">
        <Cassette
          title="아버지의 믹스테이프"
          headLeft="LOCAL MEMORIES"
          headRight={completedCount >= 5 ? 'SIDE A ✓' : 'SIDE A'}
          side={completedCount >= 5 ? 'done' : 'A'}
          progress={progress}
          spin="both"
          scale={CASSETTE_SCALE}
        />
      </div>

      {/*
        트랙 리스트는 J-카드로 통합했다(F-1). 같은 다섯 소원을 목록과
        카드가 두 번 보여주고 있었다.

        QR 버튼도 하나로 합쳤다 — 스캔값(BH88:T*)이 어느 거점인지 스스로
        말하므로, 버튼이 소원마다 붙어 '어느 QR인지'를 설명할 필요가 없다.
        어느 거점 QR을 찍어도 그 소원의 미션이 열린다. 순서는 소영의
        대사와 지도가 안내할 뿐, 코드가 강제하지 않는다.

        빙고 진입 카드는 예전에 뺐다 — 하단 탭의 '빙고'가 같은 일을 한다.
        슈퍼관리자의 임의 거점 입장은 조작 패널(SuperAdminBar)의 이동이 맡는다.
      */}
      <div className="mx-auto mt-4 w-full max-w-[380px] px-4">
        <JCard />

        {/*
          다섯을 다 이룬 뒤에도 이 버튼을 남긴다.

          예전에는 숨겼다 — 더 이룰 소원이 없으니 찍을 QR도 없다고 봤다.
          지금은 다르다. 다녀온 거점으로 돌아가 이야기를 다시 들을 수 있고
          (D9), 지도에서도 들어갈 수 있다. 그런데 골목에 서 있는 사람에게
          가장 가까운 입구는 **눈앞의 QR**이다. 그것을 쓰려고 지도를 거치게
          하면 한 단계를 더 걷게 만드는 셈이다.

          하는 일이 달라졌으니 이름도 바꾼다.
        */}
        {(
          <div className="cta-band mt-4">
            <button
              onClick={() => setShowScanner(true)}
              aria-label="거점 QR 스캔"
              /*
                실물 QR처럼 검정. 티얼은 이 앱의 구조색이라 앱바·탭·버튼이
                이미 쓰고 있어서, 여기까지 초록이면 '누르는 곳'이 아니라
                '또 하나의 장식'으로 묻힌다. 검정 QR은 거점에 붙은 실물과
                같은 그림이라 무엇을 찾아야 하는지도 같이 알려준다.
              */
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-shell py-3.5 text-cream active:scale-[0.99]"
            >
              <QrIcon />
              <span className="font-display text-[15px]">
                {completedCount < 5
                  ? '거점 QR 찍고 소원 이루기'
                  : '거점 QR 찍고 다시 듣기'}
              </span>
            </button>
          </div>
        )}

        <button
          onClick={() => router.push('/exploration')}
          className="mt-5 w-full rounded-xl border border-line bg-paper py-3 text-[13px] text-ink"
        >
          🗺 길 안내 지도 보기
        </button>

        {/*
          거점 사이를 걷는 화면이 여기다(F-6). 출발 전 안내는 /download에서
          한 번 다 읽었으므로 여기서는 한 줄만 — 되풀이하면 읽지 않는다.
        */}
        {completedCount < 5 && (
          <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-60">
            걸을 땐 화면을 주머니에. 소영의 목소리는 계속 들려요.
          </p>
        )}
      </div>

      {/* GPS 접근 알림 — 재생 트리거 아님 (D9) */}
      {notice && (
        <div className="fixed left-1/2 top-6 z-50 w-[90%] max-w-[360px] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-teal bg-paper px-4 py-3 shadow-lg">
            <span className="text-[20px]">📍</span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-ink">{notice.stationName}</p>
              <p className="text-[12px] text-ink-60">{notice.message}</p>
            </div>
            <button onClick={dismiss} className="text-[13px] text-ink-60">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 다녀온 거점도 받는다 — 그쪽은 도착 큐 대신 다시듣기로 간다 */}
      {showScanner && (
        <QRGate
          allowedStations={TRACK_STATIONS.map((s) => s.id)}
          onSuccess={handleStationEnter}
          onClose={() => setShowScanner(false)}
        />
      )}

      <Navigation />
    </div>
  )
}
