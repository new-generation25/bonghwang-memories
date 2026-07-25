'use client'

/**
 * S01 — 오디오 프리로드 게이트 (D8).
 *
 * 결제 직후 전 큐 오디오를 미리 받아 오프라인 재생을 보장한다.
 * 아직 준비되지 않은 파일(404)은 건너뛴다 — 준비된 파일이 하나도 없으면
 * "자막 모드" 안내 후 통과시킨다. 앱 흐름을 막는 것은 다운로드 중일 때뿐이다.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cassette, { CASSETTE_SCALE } from '@/components/Cassette'
import { ALL_CUE_IDS, CUES } from '@/lib/cues'
import { mutateTour } from '@/lib/tourState'
import { useTourHydrated, useTourState } from '@/hooks/useTourState'
import { logEvent } from '@/lib/analytics'

const EXTENSIONS = ['m4a', 'mp3'] as const

/**
 * 여기까지만 받으면 시작할 수 있다 — 인트로 두 개.
 *
 * 전에는 26개 10.4MB를 다 받아야 문이 열렸다. 골목에 서서 그걸 기다리는
 * 동안 할 일이 없고, 신호가 약하면 몇 분이 걸린다. 정작 그때 필요한 건
 * 테이프와 첫 통화뿐이다(1.7MB).
 *
 * 나머지는 뒤에서 계속 받는다. 첫 거점까지 걸어가는 몇 분이면 대개
 * 끝나고, 혹시 못 받았어도 재생할 때 그 파일만 받으면 된다.
 */
const INTRO_AUDIO = ['b0_tape', 'b0_call', 'intro-soyoung']

/** 큐 전체의 오디오 이름 — 인트로가 앞에 오도록 정렬한다 */
function audioNames(): string[] {
  const names = new Set<string>()
  for (const id of ALL_CUE_IDS) {
    const cue = CUES[id]
    names.add(cue.audioFile)
    for (const alias of cue.audioAliases ?? []) names.add(alias)
  }
  const all = Array.from(names)
  const rest = all.filter((n) => !INTRO_AUDIO.includes(n))
  return [...INTRO_AUDIO.filter((n) => names.has(n)), ...rest]
}

/**
 * 한 이름의 오디오를 받는다.
 *
 * m4a를 먼저 찾고 없으면 mp3를 쓴다. 예전에는 둘 다 HEAD로 물어보고
 * 다시 GET을 했는데, m4a가 하나도 없는 지금은 그 절반이 404를 맞는
 * 헛걸음이었다. 바로 받아보고 안 되면 다음 확장자로 넘어간다.
 */
async function fetchAudio(name: string): Promise<boolean> {
  for (const ext of EXTENSIONS) {
    try {
      const res = await fetch(`/audio/${name}.${ext}`)
      if (res.ok) {
        await res.blob()
        return true
      }
    } catch {
      // 이 확장자는 없거나 네트워크 오류 — 다음으로
    }
  }
  return false
}

export default function DownloadPage() {
  const router = useRouter()
  const tour = useTourState()
  const [checked, setChecked] = useState(0)
  const [total, setTotal] = useState(0)
  const [found, setFound] = useState(0)
  const [done, setDone] = useState(false)
  const started = useRef(false)

  // 결제 없이 직접 진입하면 랜딩으로 — hydration 전의 초기 상태로 판단하지 않는다
  const hydrated = useTourHydrated()
  useEffect(() => {
    if (hydrated && !tour.paid) router.replace('/')
  }, [hydrated, tour.paid, router])

  useEffect(() => {
    // StrictMode 이중 마운트 가드 — cleanup으로 루프를 죽이면
    // 두 번째 마운트가 ref 가드에 막혀 아무도 재개하지 못한다.
    // 한 번 시작한 루프는 끝까지 달리게 둔다(언마운트 후 setState는 무해).
    if (started.current || !tour.paid) return
    started.current = true

    const names = audioNames()
    setTotal(INTRO_AUDIO.length)

    ;(async () => {
      /*
        인트로 몫만 기다린다.

        문이 열리는 조건이 '전부 받기'였을 때는 골목에 서서 10MB를
        기다려야 했다. 정작 그때 필요한 건 테이프와 첫 통화뿐이다.
      */
      let foundCount = 0
      let checkedCount = 0
      const intro = names.filter((n) => INTRO_AUDIO.includes(n))
      for (const name of intro) {
        if (await fetchAudio(name)) {
          foundCount++
          setFound(foundCount)
        }
        checkedCount++
        setChecked(checkedCount)
      }
      mutateTour({ audioCacheReady: true })
      logEvent('cache_done')
      setDone(true)

      const rest = names.filter((n) => !INTRO_AUDIO.includes(n))

      /*
        나머지는 뒤에서 받되, 받는 일은 한 쪽만 맡는다.

        페이지와 서비스워커에게 같은 목록을 함께 주었더니 8.7MB를 두 번
        내려받았다. 그 둘이 화면 이동에 필요한 요청과 회선을 다투는 바람에
        페이지 넘어가는 것이 눈에 띄게 굼떠졌다.

        워커가 있으면 워커에게 맡긴다 — 화면이 바뀌어도 살아 있어서 더
        맞는 자리다. 워커가 없을 때(개발 중이나 미지원 브라우저)만 페이지가
        직접 받는다.
      */
      const sw = navigator.serviceWorker?.controller
      if (sw) {
        sw.postMessage({ type: 'PRECACHE_AUDIO', names: rest })
        return
      }
      for (const name of rest) {
        await fetchAudio(name)
        setFound((v) => v + 1)
      }
    })()
  }, [tour.paid])

  const progress = total > 0 ? Math.round((checked / total) * 100) : 0

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-base px-6">
      <Cassette
        title="아버지의 믹스테이프"
        headLeft="LOCAL MEMORIES"
        headRight="LOADING"
        side="A"
        progress={progress}
        spin={done ? 'none' : 'right'}
        scale={CASSETTE_SCALE}
      />

      <div className="mt-6 w-full max-w-[320px]">
        <div className="tape-prog" aria-hidden>
          <i style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-center font-mono-retro text-[12px] tracking-wider text-ink-60">
          {done
            ? found > 0
              ? '이야기를 시작할 수 있어요'
              : '오디오 준비 중 — 자막 모드로 진행합니다'
            : `골목의 소리를 담는 중… ${progress}%`}
        </p>
        {/*
          다 받으면 설명을 거둔다. 준비가 끝난 마당에 무엇을 더 받는지는
          참여자가 알 일이 아니다 — 남은 것은 뒤에서 알아서 받는다.
        */}
        {!done && (
          <p className="mt-1 text-center text-[11px] text-ink-60">
            골목에서 신호가 끊겨도 들을 수 있도록 미리 담아둡니다
          </p>
        )}

        {done && (
          <button
            onClick={() => router.push('/intro')}
            className="btn-teal mt-6 w-full text-[15px]"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            테이프 발견하러 가기 ▶
          </button>
        )}
      </div>

      <div className="stripe-band fixed bottom-0 left-0 right-0" />
    </div>
  )
}
