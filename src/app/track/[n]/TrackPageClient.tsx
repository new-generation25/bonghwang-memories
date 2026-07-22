'use client'

/**
 * S20 — 거점 미션 화면 (Track 1~5 공통 상태기계).
 *
 * 진입은 /play의 QR 게이트에서 dispatchQr로 도착 큐가 시작된 뒤 이뤄진다.
 * 이 화면은 큐 엔진의 상태를 구독하며, "방금 끝난 큐"에 따라
 * 미션 카드·[다음으로 출발]·복귀 버튼을 순서대로 보여준다.
 *
 * 새로고침 등으로 재생 상태가 사라졌으면 tourState.lastCueCompleted로
 * 마지막 큐부터 재개를 제안한다(§10). 다시듣기는 무제한이며(D9)
 * 지시자 실행은 모두 멱등이라 재실행이 안전하다.
 */

import { useRouter } from 'next/navigation'
import CuePlayer from '@/components/cue/CuePlayer'
import CountInput from '@/components/mission/CountInput'
import PhotoStep from '@/components/mission/PhotoStep'
import RecorderBside from '@/components/mission/RecorderBside'
import UnlockGate from '@/components/mission/UnlockGate'
import { useCue } from '@/hooks/useCue'
import { useTourState } from '@/hooks/useTourState'
import { CUES, CueId, FragmentId } from '@/lib/cues'
import { dispatchQr, dispatchTap, playCue, unlockAudio } from '@/lib/cueEngine'
import { stationByTrack } from '@/lib/tracks'
import { mutateTour } from '@/lib/tourState'

const NEUNGSOHWA_OVERLAY = '/images/neungsohwa-overlay.png'

/** 큐 종료 → 이어지는 상호작용 */
type Interaction =
  | { kind: 'count' }
  | { kind: 'photo'; track: number; actionId: 'M1_photo_done' | 'M2_photo_done'; label: string; prompt: string }
  | { kind: 'arphoto' }
  | { kind: 'posterphoto' }
  | { kind: 'record' }
  | { kind: 'unlock' }
  | { kind: 'resume' }
  | { kind: 'ask' }
  | { kind: 'return' }
  | { kind: 'bingo' }

const INTERACTIONS: Partial<Record<CueId, Interaction>> = {
  // TRACK 1 — 봉황1935 : B1_A(개수→사장님) → B1_S(사진) → B1_B(완료)
  B1_A: { kind: 'count' },
  B1_S: {
    kind: 'photo',
    track: 1,
    actionId: 'M1_photo_done',
    label: 'MISSION 1 · 기록',
    prompt: '풍선초 앞에서 사진 한 장 — 오늘 우리의 첫 번째 기록이에요.',
  },
  B1_B: { kind: 'return' },
  // TRACK 2 — 미야상회 : 도착 번들이 곧 미션 안내
  B2_A: {
    kind: 'photo',
    track: 2,
    actionId: 'M2_photo_done',
    label: 'MISSION 2 · 바나나우유',
    prompt: '바나나우유를 손에 들고, 무슨 맛인지 사진으로 보여주세요.',
  },
  B2_B: { kind: 'return' },
  // TRACK 3 — 능소화 고택
  B3_A: { kind: 'arphoto' },
  B3_B: { kind: 'return' },
  // TRACK 4 — 카페 탱자 : B4_A(이어서 재생) → 라디오 → B4_B(메모) → B4_C(완료)
  B4_A: { kind: 'resume' },
  B4_B: { kind: 'record' },
  B4_C: { kind: 'return' },
  // TRACK 5 — 방하림 : 포스터 → B5_T1(여쭤보기) → 증언 → B5_T3(B면 잠금해제)
  B5_A: { kind: 'posterphoto' },
  B5_T1: { kind: 'ask' },
  B5_T3: { kind: 'unlock' },
  B6_0: { kind: 'bingo' },
}

export default function TrackPageClient({ n }: { n: number }) {
  const router = useRouter()
  const cueState = useCue()
  const tour = useTourState()
  const station = stationByTrack(n)

  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-base">
        <p className="text-ink">존재하지 않는 트랙입니다.</p>
      </div>
    )
  }

  // 방금 끝난 큐 (재생 중이면 아직 상호작용 없음)
  const endedCue =
    cueState.cueId && cueState.ended && !cueState.pendingAutoChain
      ? cueState.cueId
      : null

  /**
   * 개발 전용 — 이 거점 QR을 스캔한 것으로 바로 입장한다.
   * 순서 강제(QRGate) 때문에 트랙 직링크로는 볼 수 없는 화면을
   * 테스트할 수 있도록, 선행 트랙을 완료 상태로 채운 뒤 도착 큐를 시작한다.
   * 프로덕션 빌드에는 렌더되지 않는다.
   */
  const devEnter = () => {
    const prevTracks = Array.from({ length: n - 1 }, (_, i) => i + 1)
    const prevFrags = prevTracks
      .filter((t) => t <= 4)
      .map((t) => `frag_${t}` as FragmentId)
    mutateTour((prev) => ({
      paid: true,
      audioCacheReady: true,
      phase: 'act1',
      tracksCompleted: prevTracks,
      fragments: prevFrags,
      speechMode: n >= 2 ? 'casual' : prev.speechMode,
      startTime: prev.startTime ?? Date.now(),
    }))
    unlockAudio()
    dispatchQr(station.id)
  }

  // §10 재개 — 엔진이 비어 있으면 마지막 완료 큐를 기준으로 복원
  const resumable =
    !cueState.cueId &&
    tour.lastCueCompleted &&
    (CUES[tour.lastCueCompleted].track === n ||
      (n === 5 && CUES[tour.lastCueCompleted].track === 6))
      ? tour.lastCueCompleted
      : null

  const activeCue = endedCue ?? resumable
  const interaction = activeCue ? INTERACTIONS[activeCue] : undefined

  const renderInteraction = () => {
    if (!interaction) return null
    switch (interaction.kind) {
      case 'count':
        return <CountInput />
      case 'photo':
        return (
          <PhotoStep
            track={interaction.track}
            actionId={interaction.actionId}
            missionLabel={interaction.label}
            prompt={interaction.prompt}
          />
        )
      case 'arphoto':
        // D11 — 정적 능소화 프레임 폴백이 기본 경로 (WebAR 연결 지점)
        return (
          <PhotoStep
            track={3}
            actionId="M3_photo_done"
            missionLabel="MISSION 3 · 능소화"
            prompt="화면을 담장에 비추면 능소화가 다시 핍니다. 활짝 핀 꽃 앞에서 찍어주세요."
            overlaySrc={NEUNGSOHWA_OVERLAY}
          />
        )
      case 'posterphoto':
        return (
          <PhotoStep
            track={5}
            actionId="M5a_done"
            missionLabel="MISSION 5 · 포스터"
            prompt="주변에 붙어 있는 포스터를 찾아 사진으로 보내주세요."
          />
        )
      case 'record':
        return <RecorderBside />
      case 'unlock':
        return <UnlockGate />
      case 'resume':
        // Track 4 — 정지해둔 자리(소원 끝)에서 라디오를 이어 재생 (D9 사용자 탭)
        return (
          <button
            onClick={() => {
              unlockAudio()
              dispatchTap('RESUME')
            }}
            className="btn-shell mt-4 w-full py-3 text-[15px]"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            ▶ 이어서 재생 — 정지해둔 자리부터
          </button>
        )
      case 'ask':
        // Track 5 — 가게 주인에게 여쭤보기 (증언 반전)
        return (
          <button
            onClick={() => {
              unlockAudio()
              dispatchTap('ASK')
            }}
            className="btn-teal mt-4 w-full text-[15px]"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            🗣️ 가게 주인에게 여쭤보기
          </button>
        )
      case 'return':
        return (
          <button
            onClick={() => router.push('/play')}
            className="btn-teal mt-4 w-full text-[15px]"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            📼 플레이어로 돌아가기
          </button>
        )
      case 'bingo':
        return (
          <button
            onClick={() => router.push('/treasure')}
            className="btn-teal mt-4 w-full text-[15px]"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            🎴 골목 빙고 펼치기 ▶
          </button>
        )
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream-base px-4 pb-16 pt-5">
      <header className="mx-auto w-full max-w-[380px]">
        <p className="font-mono-retro text-[10.5px] tracking-[0.25em] text-teal">
          TRACK {n} / 5 · {station.name}
        </p>
        <h1 className="mt-0.5 font-display text-[18px] leading-snug text-ink">
          {station.wish}
        </h1>
      </header>

      <div className="mx-auto mt-4 w-full max-w-[380px]">
        {cueState.cueId ? (
          <CuePlayer />
        ) : resumable ? (
          <div className="rounded-2xl border border-line bg-paper p-5 text-center">
            <p className="text-[13px] text-ink-60">
              통화가 잠시 끊겼어요. 마지막 안내부터 다시 들을 수 있어요.
            </p>
            <button
              onClick={() => {
                unlockAudio()
                void playCue(resumable)
              }}
              className="btn-teal mt-3 w-full text-[14px]"
            >
              ⏪ 마지막 안내 다시 듣기
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-paper p-5 text-center">
            <p className="text-[13px] leading-relaxed text-ink-60">
              이 거점은 아직 입장 전이에요.
              <br />
              플레이어에서 거점 QR을 스캔해 입장해주세요.
            </p>
            <button
              onClick={() => router.push('/play')}
              className="btn-teal mt-3 w-full text-[14px]"
            >
              📼 플레이어로 가기
            </button>
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={devEnter}
                className="mt-2 w-full rounded-xl border border-dashed border-rec py-2.5 text-[12.5px] font-bold text-rec"
              >
                🧪 테스트 입장 — 이전 트랙 완료 처리 후 이 거점 QR 스캔
              </button>
            )}
          </div>
        )}

        {renderInteraction()}
      </div>

      <div className="stripe-band fixed bottom-0 left-0 right-0" />
    </div>
  )
}
