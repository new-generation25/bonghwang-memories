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

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import CuePlayer from '@/components/cue/CuePlayer'
import PlacePhoto from '@/components/cue/PlacePhoto'
import CountInput from '@/components/mission/CountInput'
import ListenStep from '@/components/mission/ListenStep'
import PhotoStep from '@/components/mission/PhotoStep'
import SpeechAsk from '@/components/cue/SpeechAsk'
import QuizInput from '@/components/mission/QuizInput'
import RecorderBside from '@/components/mission/RecorderBside'
import JCardGate from '@/components/mission/JCardGate'
import { useCue } from '@/hooks/useCue'
import { useTourState } from '@/hooks/useTourState'
import { logEvent } from '@/lib/analytics'
import { CUES, CueId } from '@/lib/cues'
import { dispatchQr, dispatchTap, playCue, unlockAudio } from '@/lib/cueEngine'
import { stationByTrack, TRACK_STATIONS } from '@/lib/tracks'
import { mutateTour } from '@/lib/tourState'

const NEUNGSOHWA_OVERLAY = '/images/neungsohwa-overlay.png'

/** 큐 종료 → 이어지는 상호작용 */
type Interaction =
  | { kind: 'count' }
  | { kind: 'listen'; label: string; prompt: string; button: string }
  | { kind: 'photo'; track: number; actionId: 'M1_photo_done' | 'M2_photo_done'; label: string; prompt: string }
  | { kind: 'arphoto' }
  | { kind: 'posterphoto' }
  | { kind: 'quiz' }
  | { kind: 'record' }
  | { kind: 'unlock' }
  | { kind: 'resume' }
  | { kind: 'ask' }
  | { kind: 'return' }
  | { kind: 'bingo' }

const INTERACTIONS: Partial<Record<CueId, Interaction>> = {
  // TRACK 1 — 봉황1935 : B1_A(개수) → B1_OK(듣기 안내) → B1_S(사진) → B1_B(완료)
  B1_A: { kind: 'count' },
  B1_OK: {
    kind: 'listen',
    label: 'MISSION 1 · 이야기',
    prompt: '가게 안으로 들어가, 사장님께 그 시절 이야기를 청해보세요.',
    button: '👵 사장님의 이야기 듣기 ▶',
  },
  B1_S: {
    kind: 'photo',
    track: 1,
    actionId: 'M1_photo_done',
    label: 'MISSION 1 · 기록',
    prompt: '풍선초 앞에서 사진 한 장 — 오늘 우리의 첫 번째 기록이에요.',
  },
  /*
    B1_B는 말 놓기 물음으로 끝난다. 아직 대답하지 않았으면 그 위에
    SpeechAsk 창이 덮으므로 이 버튼은 보이지 않는다 — 다시듣기로 이
    번들을 또 들었을 때(이미 대답한 사람) 길이 막히지 않게 두는 것이다.
  */
  B1_B: { kind: 'return' },
  B1_YES: { kind: 'return' },
  B1_NO: { kind: 'return' },
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
  // 라디오를 들은 뒤 — 곡 제목 한 문제 → '나의 육십 초'
  B4_B: { kind: 'quiz' },
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
  /** 트랙 4 — 곡 제목을 맞혔는지. 맞히면 그 자리에 '나의 육십 초'가 들어온다 */
  const [quizDone, setQuizDone] = useState(false)

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
    mutateTour((prev) => ({
      paid: true,
      audioCacheReady: true,
      phase: 'act1',
      tracksCompleted: prevTracks,
      speechMode: n >= 2 ? 'casual' : prev.speechMode,
      startTime: prev.startTime ?? Date.now(),
    }))
    unlockAudio()
    if (station) dispatchQr(station.id)
  }

  /*
    말 놓기 — B1_B가 물음으로 끝나면 창이 올라온다.

    예전에는 한 번들 한가운데서 재생을 멈추고 물었다. 그러면 대답이
    무엇이든 뒤에 이어 구워둔 "…고마워. 이제 말 놓을게."가 나온다 —
    거절한 사람에게 고맙다고 답하는 꼴이라 물음이 시늉이 됐다.
    지금은 대답이 다음 번들을 고른다(B1_YES / B1_NO).

    한 번만 묻는다 — 다시듣기로 이 번들을 또 들어도 이미 답한 사람에게
    같은 것을 되묻지 않는다.
  */
  const askSpeech =
    endedCue === 'B1_B' && !tour.speechConsent && !cueState.playing

  /**
   * 대답이 곧 다음 번들의 트리거다(D9 — 사용자 탭으로만 재생이 시작된다).
   * 창을 누른 그 제스처 안에서 불러야 iOS가 소리를 막지 않는다.
   */
  const answerSpeech = (consent: 'yes' | 'no') => {
    mutateTour({ speechConsent: consent })
    unlockAudio()
    dispatchTap(consent === 'yes' ? 'SPEECH_YES' : 'SPEECH_NO')
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

  /*
    다녀온 거점의 다시듣기 목록 (D9 — 다시듣기는 무제한이다).

    §10의 재개는 **마지막으로 끝낸 큐**만 되살린다. 그래서 거점 셋을 지나고
    나서 거점 하나로 돌아오면 재개할 것이 없고, 화면이 "아직 입장 전이에요"로
    떨어졌다 — 다녀온 곳인데 안 가본 곳처럼 말하고, 이야기를 다시 들을 길도
    없었다. 현장 모니터링에서 "새로고침하면 재청취 경로가 없다"고 나온 자리다.

    첫 줄을 그대로 이름표로 쓴다. 큐에는 사람이 읽을 제목이 없고, 참여자가
    기억하는 것은 번호가 아니라 소영이 한 말이기 때문이다.
  */
  const revisitList = (Object.keys(CUES) as CueId[])
    .filter((id) => CUES[id].track === n && CUES[id].subtitleLines.length)
    .map((id) => ({
      id,
      label: CUES[id].subtitleLines[0].text.replace(/<br>/g, ' ').slice(0, 34),
    }))

  const revisit =
    !cueState.cueId && !resumable && tour.tracksCompleted.includes(n)
      ? revisitList
      : []

  /*
    이 거점의 이야기를 **끝까지 들었는가.**

    `lastCueCompleted`는 정상 종료에서만 세워진다(cueEngine.finishCue).
    그러니 그 큐가 next 없이 끝나는 큐라면 끊긴 것이 아니라 다 들은 것이다.
    그런데 위의 재개 분기가 그것까지 집어삼켜 "통화가 잠시 끊겼어요"라고
    말했다 — 멀쩡히 끝난 이야기를 사고로 만들고, 앞으로 갈 길은 안 알려준다.

    한동안 드러나지 않았던 것은 큐들이 대개 미션을 열거나(ui) 다음 큐로
    이어져서다. B1_WALK이 next도 미션도 없이 끝나는 첫 큐라 여기서 나왔다.
  */
  const finishedHere =
    !interaction &&
    /*
      **소리가 끝난 자리도 여기다.** 예전에는 `!cueState.cueId`를 달아서
      엔진이 빈 경우(새로고침·재진입)에만 이 패널이 떴다. 그런데 큐가
      끝나도 `cueId`는 그대로 서 있으므로(finishCue는 ended만 세운다),
      **정작 다 듣고 난 그 순간에는 뜨지 않았다.**

      그 자리에서 무슨 일이 벌어지냐면 — 데크의 PLAY·FF·STOP이 전부
      `onClick` 없이 그려진다(CuePlayer의 ended 분기). 눌리는 키는
      다시듣기 하나뿐이고, 어디로 가야 하는지 말해주는 것은 아무것도 없다.
      「점빵이 하나 있어」에서 멈춰 보이던 것이 이것이다.
    */
    (!cueState.cueId || (cueState.ended && !cueState.pendingAutoChain)) &&
    tour.tracksCompleted.includes(n) &&
    Boolean(tour.lastCueCompleted) &&
    CUES[tour.lastCueCompleted as CueId].track === n &&
    CUES[tour.lastCueCompleted as CueId].next === null

  /*
    다음은 어디인가. 이야기의 차례를 따르되 강제하지는 않는다 —
    /play의 접근 안내가 쓰는 것과 같은 셈법이다(마지막으로 이룬 소원 + 1).
  */
  const nextStation =
    finishedHere && tour.tracksCompleted.length < TRACK_STATIONS.length
      ? stationByTrack(Math.max(0, ...tour.tracksCompleted) + 1)
      : null

  /*
    끊긴 이야기는 **글로 알리지 않고 그냥 다시 튼다.**

    새로고침이나 QR 재진입으로 엔진이 비면 "통화가 잠시 끊겼어요"라는 안내와
    버튼이 떴다. 참여자는 이야기를 들으러 온 것이지 사고 보고를 읽으러 온
    것이 아니다 — 원래 듣던 자리에서 소리가 이어지는 것이 원안이다.

    D9(시간 기반 자동재생 금지)에 걸리지 않는다. 여기서 트는 것은 **이미
    들었던 큐**이고, 시간이나 위치가 아니라 참여자가 이 화면에 다시 들어온
    행동이 방아쇠다. 이야기를 앞으로 밀지 않는다.

    막히면 그때만 손을 빌린다. 브라우저는 탭 없이 시작된 소리를 막는데,
    그 경우 playCue가 `playing: false`로 세워두고 CuePlayer가 「탭해서 계속」을
    내놓는다(cueEngine.ts:512) — 글 대신 플레이어가 뜨는 것이라 원안에 가깝다.

    한 번만 시도한다. 다 듣고 나면 다시 `resumable`이 서므로, 막지 않으면
    끝날 때마다 저 혼자 되감아 튼다.
  */
  const autoResumed = useRef<CueId | null>(null)
  useEffect(() => {
    if (!resumable || interaction || finishedHere) return
    if (autoResumed.current === resumable) return
    autoResumed.current = resumable
    unlockAudio()
    void playCue(resumable)
  }, [resumable, interaction, finishedHere])

  /*
    미션 화면 진입 계측(F-7) — 랭킹 부문1이 여기부터 mission_correct까지를
    잰다(이동 시간 제외). 손 쓰는 미션만 센다: return/bingo는 미션이 아니고,
    resume은 라디오 이어 듣기, unlock은 B면 관문이다.
  */
  const missionKind = interaction?.kind
  useEffect(() => {
    if (
      !missionKind ||
      missionKind === 'return' ||
      missionKind === 'bingo' ||
      missionKind === 'resume' ||
      missionKind === 'unlock'
    ) {
      return
    }
    logEvent('mission_enter', { track: n, kind: missionKind })
  }, [missionKind, n])

  // 2막 전환 — 소영의 대사가 끝나면 빙고 단독 화면으로 넘긴다.
  // 예전에는 트랙 5 화면 아래에 빙고 버튼만 덧붙어서, 끝난 트랙 내용과
  // 새 막의 진입이 한 화면에 겹쳐 보였다. replace로 넘겨 뒤로가기가
  // 그 어중간한 상태로 돌아오지 않게 한다.
  useEffect(() => {
    if (interaction?.kind !== 'bingo') return
    const t = window.setTimeout(() => router.replace('/treasure'), 900)
    return () => window.clearTimeout(t)
  }, [interaction?.kind, router])

  // 훅 호출 뒤에 검사한다 — 훅은 렌더마다 같은 순서로 불려야 한다
  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-base">
        <p className="text-ink">존재하지 않는 트랙입니다.</p>
      </div>
    )
  }

  /**
   * 재생이 끝난 뒤 데크의 PLAY 키가 맡을 일.
   *
   * 이야기를 이어 여는 동작은 카세트 키가 맡는 게 맞다 — 화면 아래에
   * 같은 뜻의 띠 버튼을 또 두면 둘 중 무엇을 눌러야 하는지 헷갈린다.
   * 가게 주인에게 여쭤보기처럼 '재생'이 아닌 행동은 띠로 남겨둔다.
   */
  const deckAction =
    interaction?.kind === 'resume'
      ? {
          label: '이어서 재생',
          onClick: () => {
            unlockAudio()
            dispatchTap('RESUME')
          },
        }
      : undefined

  const renderInteraction = () => {
    if (!interaction) return null
    switch (interaction.kind) {
      case 'count':
        return <CountInput />
      case 'listen':
        return (
          <ListenStep
            label={interaction.label}
            prompt={interaction.prompt}
            button={interaction.button}
          />
        )
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
      case 'quiz':
        /*
          라디오를 듣고 곡 제목을 맞힌 뒤 '나의 육십 초'로 이어진다.
          퀴즈가 관문이 아니라 한 박자라, 맞히면 같은 자리에서 메모가
          그대로 열린다 — 화면을 갈아끼우면 흐름이 끊긴다.
        */
        return quizDone ? (
          <RecorderBside />
        ) : (
          <QuizInput onDone={() => setQuizDone(true)} />
        )
      case 'record':
        return <RecorderBside />
      case 'unlock':
        return <JCardGate />
      case 'resume':
        /*
          Track 4 — 정지해둔 자리에서 라디오를 이어 재생 (D9 사용자 탭).
          여기서는 아무것도 그리지 않는다. 바로 위 카세트 패널의 PLAY 키가
          그 일을 한다(deckAction) — 패널 아래에 또 '▶ 재생' 띠를 두면
          어느 쪽을 눌러야 하는지 헷갈린다.
        */
        return null
      case 'ask':
        // Track 5 — 가게 주인에게 여쭤보기 (증언 반전)
        return (
          <div className="cta-band mt-4" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <button
              onClick={() => {
                unlockAudio()
                dispatchTap('ASK')
              }}
              className="btn-teal w-full text-[15px]"
            >
              🗣️ 가게 주인에게 여쭤보기
            </button>
          </div>
        )
      case 'return':
        return (
          <div className="cta-band mt-4" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <button
              onClick={() => router.push('/play')}
              className="btn-teal w-full text-[15px]"
            >
              📼 플레이어로 돌아가기
            </button>
          </div>
        )
      case 'bingo':
        return (
          <div className="cta-band mt-4" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <button
              onClick={() => router.replace('/treasure')}
              className="btn-teal w-full text-[15px]"
            >
              🎴 골목 빙고 펼치기 ▶
            </button>
          </div>
        )
    }
  }

  /** 한 번만 만들어 둔다 — 그릴 것이 있는지 판단하는 데도 같은 값을 쓴다 */
  const interactionNode = renderInteraction()

  return (
    /* pb-28 — 화면 아래에 못박은 데크(.deck-dock)에 내용이 가리지 않을 만큼 */
    <div className="flex min-h-screen flex-col bg-cream-base px-4 pb-28 pt-5">
      {/*
        헤더 — 이 화면의 유일한 출구다.

        거점 화면에만 하단 탭바가 없다(몰입을 위해 뺐다). 홈 화면에서 띄운
        PWA에는 브라우저 뒤로가기조차 없어서, 이 버튼을 지우면 참여자가
        여기 갇힌다. 다음 거점을 못 찾아 지도를 보거나, 방금 받은 쿠폰을
        가게에 보여줘야 할 때 나가야 한다.

        미션을 건너뛰는 길은 아니다 — 나가도 진행은 그대로고, 다음 거점에
        들어가려면 여전히 QR이 필요하다. 그래서 이름을 '목록'에서
        '플레이어'로 바꿨다. '목록'은 미션을 골라 들어가는 곳처럼 읽혔다.
      */}
      <header className="mx-auto flex w-full max-w-[380px] items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono-retro text-[10.5px] tracking-[0.25em] text-teal">
            {n} / 5 · {station.name}
          </p>
          <h1 className="mt-0.5 font-display text-[18px] leading-snug text-ink">
            {station.wish}
          </h1>
        </div>
        <button
          onClick={() => router.push('/play')}
          className="-mr-1 shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold text-ink-60"
          aria-label="플레이어로 돌아가기"
        >
          📼 플레이어
        </button>
      </header>

      {/*
        프레임은 다섯 거점이 모두 같다 — 화자 · 거점 그림 · 자막 · 데크.
        크기도 미션 유무와 무관하게 고정이다.

        예전에는 이야기만 흐르는 동안 화면 높이를 다 쓰고, 미션이 뜨면
        다른 배치로 갈아탔다. 화면은 꽉 찼지만 더빙이 끝나는 순간 그림이
        작아지고 프레임이 바뀌어서 거점마다 다른 화면처럼 보였다.
      */}
      <div className="mx-auto mt-4 w-full max-w-[380px]">
        {/*
          **다 들은 자리를 플레이어보다 먼저 본다.**

          순서가 뒤였을 때는 `cueState.cueId`가 늘 먼저 걸려서, 소리가
          끝나도 눌리지 않는 데크만 남았다. 다 들은 것은 재생 상태가 아니라
          **다음 걸음이 필요한 상태**다 — 그러니 그쪽을 먼저 묻는다.
        */}
        {finishedHere ? (
          /*
            다 들었다. 사고가 아니라 이야기가 끝난 것이므로 다음 걸음을 준다.
            여기서 길을 안 알려주면 화면에 남는 것이 '다시 듣기'뿐이라,
            이야기는 끝났는데 갈 데가 없어 멈춘 것처럼 보인다.
          */
          <div className="rounded-2xl border border-line bg-paper p-5">
            {nextStation ? (
              <>
                <p className="text-center font-mono-retro text-[10px] tracking-[0.2em] text-teal">
                  다음 거점
                </p>
                <p className="mt-2 text-center font-display text-[20px] text-ink">
                  {nextStation.name}
                </p>
                <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-60">
                  걸어가서 입구의 <b className="text-ink">QR</b>을 찍으면
                  <br />
                  소영이 이어서 이야기해 줄 거예요.
                </p>
              </>
            ) : (
              <p className="text-center text-[13px] leading-relaxed text-ink-60">
                이 거점의 이야기는 여기까지예요.
                <br />
                플레이어에서 다음 거점을 골라주세요.
              </p>
            )}
            <button
              onClick={() => router.push('/play')}
              className="btn-teal mt-4 w-full text-[14px]"
            >
              📼 플레이어로 가기
            </button>
            <button
              onClick={() => router.push('/exploration')}
              className="mt-2 w-full rounded-xl border border-line bg-cream-base py-2.5 text-[13px] text-ink"
            >
              🗺 길 안내 지도 보기
            </button>

            {/* 방금 들은 이야기를 다시 (D9 — 다시듣기는 무제한) */}
            <div className="mt-4 border-t border-dashed border-line pt-3">
              <p className="text-center font-mono-retro text-[10px] tracking-wider text-ink-60">
                다시 듣기
              </p>
              <div className="mt-2 space-y-1.5">
                {revisitList.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      unlockAudio()
                      void playCue(r.id)
                    }}
                    className="w-full rounded-xl border border-line bg-cream-base px-3 py-2.5 text-left text-[12.5px] leading-snug text-ink"
                  >
                    <span className="mr-1.5 text-teal">▶</span>
                    {r.label}…
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : cueState.cueId ? (
          <CuePlayer
            /*
              늘 켠다. 예전에는 미션이 뜨면 껐는데, 그 순간 프레임이 통째로
              다른 배치로 갈아타면서 거점 그림이 갑자기 작아졌다. 이제 상자
              높이가 내용에 맞춰지므로 미션이 그 아래로 이어진다.
            */
            fill
            /* 미션이 덮고 있는 동안에는 데크를 치운다 — 막 뒤에 깔려
               보이기만 하고 눌리지 않는 물건이 된다 */
            deckHidden={Boolean(interactionNode)}
            center={
              <PlacePhoto name={station.name} photo={station.photo} track={n} />
            }
            endedAction={deckAction}
          />
        ) : resumable ? (
          /*
            위의 자동 재개가 소리를 트는 사이에만 스치는 화면이다(한 틱).
            소리가 시작되면 cueId가 서서 플레이어로 넘어간다.

            그래도 버튼을 남긴다 — 음원을 못 찾는 등으로 재개가 물러나면
            여기가 마지막 길이다. 사고를 알리는 말투는 쓰지 않는다.
          */
          <div className="rounded-2xl border border-line bg-paper p-5 text-center">
            <p className="text-[13px] text-ink-60">듣던 곳부터 이어집니다…</p>
            <button
              onClick={() => {
                unlockAudio()
                void playCue(resumable)
              }}
              className="btn-teal mt-3 w-full text-[14px]"
            >
              ▶ 이어 듣기
            </button>
          </div>
        ) : revisit.length ? (
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-center text-[13px] leading-relaxed text-ink-60">
              여기는 이미 다녀왔어요.
              <br />
              다시 듣고 싶은 대목을 골라주세요.
            </p>
            <div className="mt-3 space-y-1.5">
              {revisit.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    unlockAudio()
                    void playCue(r.id)
                  }}
                  className="w-full rounded-xl border border-line bg-cream-base px-3 py-2.5 text-left text-[12.5px] leading-snug text-ink"
                >
                  <span className="mr-1.5 text-teal">▶</span>
                  {r.label}…
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push('/play')}
              className="mt-3 w-full text-center font-mono-retro text-[10.5px] text-ink-60 underline"
            >
              플레이어로 돌아가기
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

      </div>

      {/*
        미션은 이야기 화면 위로 덮는다.

        아래에 이어 붙이면 자막·데크가 쌓인 만큼 미션이 접힌 화면 밖으로
        밀려서, 정작 할 일을 보려고 스크롤을 내려야 했다. 스크롤로 끌어오는
        보정을 넣어도 화면이 한 번 출렁인다.

        덮으면 위치가 늘 같다 — 아래에서 올라와 엄지가 닿는 자리에 선다.
        뒤의 거점 그림은 어두워진 채로 남는다. 사진을 찍거나 세는 동안
        '여기가 어디였는지'를 계속 보고 있어야 하기 때문이다.

        바탕을 눌러도 닫히지 않는다. 미션은 건너뛰는 것이 아니라 해야
        다음으로 넘어가는 것이라, 실수로 닫히면 되돌릴 길이 없다.
      */}
      {/*
        그릴 것이 있을 때만 덮는다.

        resume·bingo 단계는 화면에 아무것도 그리지 않는다 — 그 일은 데크의
        PLAY 키가 맡거나(deckAction) 잠시 뒤 빙고 화면으로 넘어간다. 그런데
        interaction이 있다는 것만 보고 막을 깔았더니, 보이지 않는 전체화면
        막이 데크를 포함한 모든 탭을 삼켜 화면이 멈춘 것처럼 됐다.
      */}
      {/* 말 놓기 — 미션보다 위에 뜬다. 지금 답해야 이야기가 이어진다 */}
      {askSpeech && <SpeechAsk onAnswer={answerSpeech} />}

      {interactionNode && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-shell/55 px-4 pb-4">
          <div
            className="max-h-[82vh] w-full max-w-[380px] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {interactionNode}
          </div>
        </div>
      )}

      <div className="stripe-band fixed bottom-0 left-0 right-0" />
    </div>
  )
}
