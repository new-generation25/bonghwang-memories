'use client'

/**
 * S02 + S03 — 테이프 발견·재생 → 첫 통화 (D3: 쪽지 구조).
 *
 * 흐름: 발견 장면(카세트 플레이어 + 쪽지) → [▶ PLAY](user_tap)
 *      → B0_TAPE(아버지 목소리만) → 종료(show_call_button)
 *      → 발신 화면(벨소리) → B0_CALL → [동행 수락]
 *      → phase=act1 · startTime 기록 → /play
 *
 * 발신을 자동으로 할지는 AUTO_DIAL이 정한다 — 명세 D3는 '자동 발신 금지'이므로
 * 그 결정을 되돌리려면 이 값을 false로 두면 된다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cassette from '@/components/Cassette'
import CallScreen from '@/components/cue/CallScreen'
import CuePlayer from '@/components/cue/CuePlayer'
import DeckControls from '@/components/cue/DeckControls'
import { useCue, useCueEvents } from '@/hooks/useCue'
import { useTourHydrated, useTourState } from '@/hooks/useTourState'
import {
  CUES,
  S02_DISCOVERY_TEXT,
  NOTE_FRONT_LINES,
  NOTE_PHONE_LABEL,
} from '@/lib/cues'
import {
  dispatchTap,
  pauseCue,
  replayCue,
  resumeCue,
  skipCue,
  skipLine,
  stopCue,
} from '@/lib/cueEngine'
import { Ringback, startRingback } from '@/lib/ringback'
import { mutateTour } from '@/lib/tourState'

type Step = 'discovery' | 'tape' | 'dialing' | 'call'

/** 발신 연출 길이 — 신호음이 가는 시간 (벨 주기 3초에 맞춰 두 번 울린다) */
const DIAL_MS = 6200

/**
 * 테이프가 끝난 뒤 전화 걸기 안내가 올라오기까지의 여백(ms).
 *
 * 마지막 문장이 끝나자마자 화면이 바뀌면 툭 끊긴다. 테이프가 멈추고
 * 잠깐 정적이 흐른 뒤에 쪽지를 꺼내드는 호흡을 준다.
 */
const CALL_PROMPT_DELAY_MS = 1600

/** 아이폰 통화 아이콘 — 수화기 실루엣 */
function HandsetIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.37 2.3.57 3.5.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.57 3.5a1 1 0 0 1-.25 1l-2.22 2.3z" />
    </svg>
  )
}

/**
 * 쪽지에 적힌 번호 — 실물감을 위해 매 세션 다르게 만들되,
 * 뒤 2자리는 xx로 가린다(실제 번호로 오인해 거는 일이 없도록).
 */
function makePhoneNumber(): string {
  const mid = String(Math.floor(1000 + Math.random() * 9000))
  const tail = String(Math.floor(10 + Math.random() * 90))
  return `010-${mid}-${tail}xx`
}

export default function IntroPage() {
  const router = useRouter()
  const tour = useTourState()
  const cueState = useCue()
  const [step, setStep] = useState<Step>('discovery')
  const [callButtonVisible, setCallButtonVisible] = useState(false)
  // 서버 렌더 결과와 어긋나지 않도록 마운트 후에 번호를 만든다
  const [phoneNumber, setPhoneNumber] = useState('010-••••-••xx')
  const [dots, setDots] = useState('')
  const dialTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringRef = useRef<Ringback | null>(null)

  useEffect(() => {
    setPhoneNumber(makePhoneNumber())
  }, [])

  // 발신 중 점 애니메이션
  useEffect(() => {
    if (step !== 'dialing') return
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : `${d}.`))
    }, 450)
    return () => clearInterval(id)
  }, [step])

  useEffect(() => () => {
    if (dialTimer.current) clearTimeout(dialTimer.current)
    if (promptTimer.current) clearTimeout(promptTimer.current)
    ringRef.current?.stop()
  }, [])

  // 결제 없이 직접 진입하면 랜딩으로 — hydration 전의 초기 상태로 판단하지 않는다
  const hydrated = useTourHydrated()
  useEffect(() => {
    if (hydrated && !tour.paid) router.replace('/')
  }, [hydrated, tour.paid, router])

  /**
   * B0_TAPE 종료 → 잠깐의 정적 뒤 '전화 걸기' 안내가 아래에서 올라온다.
   *
   * 자동으로 걸지 않는다(D3) — 참여자가 직접 버튼을 눌러야 통화가 시작된다.
   * 테이프가 끝나자마자 화면이 바뀌면 툭 끊기는 느낌이라 여백을 둔다.
   */
  useCueEvents(
    useCallback((event) => {
      if (event.directive !== 'show_call_button') return
      promptTimer.current = setTimeout(
        () => setCallButtonVisible(true),
        CALL_PROMPT_DELAY_MS
      )
    }, [])
  )

  const handlePlay = () => {
    setStep('tape')
    dispatchTap('PLAY')
  }

  /** 발신 — 벨소리를 울리며 신호가 가는 연출을 거친 뒤 통화 큐를 시작한다 */
  const startDialing = () => {
    setStep('dialing')
    setCallButtonVisible(false)
    ringRef.current?.stop()
    ringRef.current = startRingback()
    dialTimer.current = setTimeout(() => {
      ringRef.current?.stop()
      ringRef.current = null
      setStep('call')
      dispatchTap('CALL')
    }, DIAL_MS)
  }

  const handleCancelDial = () => {
    if (dialTimer.current) clearTimeout(dialTimer.current)
    ringRef.current?.stop()
    ringRef.current = null
    setStep('tape')
    // 취소하면 다시 걸 수 있도록 안내를 되살린다
    setCallButtonVisible(true)
  }

  const handleAccept = () => {
    stopCue()
    mutateTour({
      phase: 'act1',
      startTime: tour.startTime ?? Date.now(),
    })
    router.push('/play')
  }

  const callEnded =
    step === 'call' && cueState.cueId === 'B0_CALL' && cueState.ended

  return (
    <div className="flex min-h-screen flex-col bg-cream-base px-4 py-8">
      <p className="text-center font-mono-retro text-[11px] tracking-[0.25em] text-teal">
        EP.1 아버지의 믹스테이프
      </p>

      {step === 'discovery' && (
        <div
          className="mx-auto mt-8 w-full max-w-[360px]"
          style={{ animation: 'fadeIn 0.8s ease-in-out' }}
        >
          {/* S02 발견 장면 — 텍스트 대신 실물 연출 (명세 원문 첫 줄만 캡션으로) */}
          <p className="text-center text-[12px] leading-relaxed text-ink-60">
            {S02_DISCOVERY_TEXT[0]}
          </p>

          {/* 카세트 플레이어 — 실물 휴대용 데크.
              창으로 테이프가 일부만 보이고, 조작 버튼은 하단에 붙는다.
              플레이어에는 글자를 넣지 않는다. 유일한 글자는 소영의 메모다. */}
          <div className="player-shell mt-3">
            <div className="deck-top">
              <div className="deck-grille" aria-hidden />
              <div className="deck-door">
                {/* 창은 라벨 높이만큼만 뚫려 있다. 나머지는 도어가 가린다 —
                    테이프가 안에 들어가 있고 일부만 보이는 실물 그대로다. */}
                <div className="deck-window">
                {/* 라벨 윗머리를 창 위로 3px 밀어올린다 — 라벨이 창을
                    가득 채워야 몸체의 검은 부분이 드러나지 않는다 */}
                <div className="shrink-0" style={{ marginTop: -14 }}>
                  <Cassette
                    title="소영에게 — 1988. 9. 17."
                    headLeft=""
                    headRight=""
                    side="A"
                    progress={12}
                    spin="none"
                    scale={0.68}
                  />
                </div>
                </div>
              </div>
            </div>

            {/* 조작부 — EJECT 노브 · 카운터 · 진행 방향 */}
            <div className="deck-meta">
              <span className="deck-knob" aria-hidden />
              {/* 네 자리 카운터에 1988 — 실물 데크의 테이프 카운터 자리에
                  이야기의 연도가 새겨져 있는 셈이다 */}
              <span className="deck-counter" aria-hidden>
                <i>1</i>
                <i>9</i>
                <i>8</i>
                <i>8</i>
              </span>
              <span className="deck-label">A ▸</span>
            </div>

            {/* "눌러주세요." — 소영이 PLAY 키 위에 붙여둔 손글씨 메모 */}
            <div className="relative w-full">
              <span className="key-sticker" style={{ left: '30%', right: 'auto' }}>
                눌러주세요.
              </span>
              <DeckControls
                keys={[
                  { kind: 'rew' },
                  { kind: 'play', onClick: handlePlay, ariaLabel: '재생 — 눌러주세요' },
                  { kind: 'ff' },
                  { kind: 'stop' },
                  { kind: 'rec' },
                ]}
              />
            </div>
          </div>

          {/* 쪽지 앞면 (D3) — 마스킹테이프로 붙어 있는 실물 느낌 */}
          <div
            className="note-paper mt-6 rounded-sm border px-5 py-4 shadow-sm"
            style={{ transform: 'rotate(-1.2deg)' }}
          >
            {/* 줄은 대본이 잡는다 — 손글씨라 아무 데서나 접히면 안 된다.
                마지막 줄(서명)만 오른쪽으로 보낸다. */}
            {/* break-keep — 세 번째 줄은 폭을 넘겨 한 번 더 접히는데,
                기본 규칙으로는 '있/습니다'처럼 낱말 가운데가 갈라진다 */}
            <p className="font-pen text-[19px] leading-relaxed text-ink break-keep">
              {NOTE_FRONT_LINES.map((line, i) => (
                <span
                  key={line}
                  className={`block${
                    i === NOTE_FRONT_LINES.length - 1 ? ' mt-1 text-right' : ''
                  }`}
                >
                  {line}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {step === 'tape' && (
        <div className="mx-auto mt-6 w-full max-w-[380px]">
          <CuePlayer />

        </div>
      )}

      {/*
        전화 걸기 안내 — 테이프가 끝나고 잠깐의 정적 뒤 아래에서 올라온다.
        자동으로 걸지 않는다(D3): 쪽지 뒷면의 번호를 보고 참여자가 직접 누른다.
      */}
      {callButtonVisible && step === 'tape' && (
        <div className="call-prompt">
          <div
            className="call-prompt-sheet"
            style={{ animation: 'slideUp 0.45s ease-out' }}
          >
            <p className="text-center text-[12px] leading-relaxed text-ink-60">
              테이프가 멈췄습니다.
              <br />
              쪽지를 뒤집어 보세요.
            </p>

            {/* 쪽지 뒷면 (D3) — 전화번호. 뒤 2자리는 가린다 */}
            <div
              className="note-paper mt-4 rounded-sm border px-5 py-4 text-center shadow-sm"
              style={{ transform: 'rotate(0.8deg)' }}
            >
              <p className="font-pen text-[16px] text-ink-60">
                부탁이 있습니다. — 딸 소영
              </p>
              <p className="mt-1 font-mono-retro text-[20px] tracking-[0.15em] text-ink underline decoration-dotted underline-offset-4">
                {phoneNumber}
              </p>
            </div>

            {/* 아이폰식 통화 버튼 */}
            <div className="mt-5 flex flex-col items-center">
              <div className="relative">
                <span className="call-fab-pulse" aria-hidden />
                <span className="call-fab-pulse" aria-hidden />
                <button
                  onClick={startDialing}
                  className="call-fab relative"
                  aria-label={NOTE_PHONE_LABEL}
                >
                  <HandsetIcon />
                </button>
              </div>
              <p className="mt-2 font-mono-retro text-[11px] tracking-[0.18em] text-ink-60">
                {NOTE_PHONE_LABEL}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 발신 중 — 실제로 거는 듯한 전체 화면 */}
      {step === 'dialing' && (
        <div className="call-screen">
          <div className="call-screen-head">
            <p className="call-screen-number">{phoneNumber}</p>
            <h2 className="call-screen-name">소영</h2>
            <p className="call-screen-status">발신 중{dots}</p>
            <div className="call-avatar mt-6">
              <span>소</span>
              <span className="call-avatar-ring" aria-hidden />
            </div>
          </div>

          <div className="call-screen-body items-center justify-center">
            <p className="text-center font-mono-retro text-[12px] tracking-[0.18em] text-cream/45">
              신호가 가고 있습니다
            </p>
          </div>

          <div className="call-screen-foot flex justify-center">
            <button
              onClick={handleCancelDial}
              className="call-fab end"
              aria-label="발신 취소"
            >
              <HandsetIcon />
            </button>
          </div>
        </div>
      )}

      {/* 통화 중 — 전체 화면 통화 인터페이스 */}
      {step === 'call' && cueState.cueId && (
        <CallScreen
          cue={CUES[cueState.cueId]}
          playing={cueState.playing}
          elapsed={cueState.elapsed}
          subtitleIndex={cueState.subtitleIndex}
          ended={callEnded}
          audioAvailable={cueState.audioAvailable}
          phoneNumber={phoneNumber}
          onReplay={replayCue}
          onPause={pauseCue}
          onResume={resumeCue}
          onSkip={callEnded ? undefined : skipLine}
          onAdvance={handleAccept}
          advanceLabel="동행 시작"
          // 통화 끊기 — 15초가 지나야 열린다(D9). skipCue가 그 조건을 지킨다
          skippable={cueState.skippable}
          onEndCall={skipCue}
        />
      )}

      <div className="stripe-band fixed bottom-0 left-0 right-0" />
    </div>
  )
}
