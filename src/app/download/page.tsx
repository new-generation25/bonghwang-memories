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
import Cassette from '@/components/Cassette'
import { ALL_CUE_IDS, CUES } from '@/lib/cues'
import { mutateTour } from '@/lib/tourState'
import { useTourHydrated, useTourState } from '@/hooks/useTourState'

const EXTENSIONS = ['m4a', 'mp3'] as const

/** 큐 전체의 후보 오디오 URL 목록 */
function candidateUrls(): string[] {
  const names = new Set<string>()
  for (const id of ALL_CUE_IDS) {
    const cue = CUES[id]
    names.add(cue.audioFile)
    for (const alias of cue.audioAliases ?? []) names.add(alias)
  }
  const urls: string[] = []
  names.forEach((name) => {
    for (const ext of EXTENSIONS) urls.push(`/audio/${name}.${ext}`)
  })
  return urls
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

    const urls = candidateUrls()
    setTotal(urls.length)

    ;(async () => {
      let foundCount = 0
      let checkedCount = 0
      // 존재 확인 후 실제 GET으로 받아 SW 캐시에 태운다
      for (const url of urls) {
        try {
          const head = await fetch(url, { method: 'HEAD' })
          if (head.ok) {
            await fetch(url).then((r) => r.blob())
            foundCount++
            setFound(foundCount)
          }
        } catch {
          // 네트워크 오류 — 해당 파일만 건너뛴다
        }
        checkedCount++
        setChecked(checkedCount)
      }
      mutateTour({ audioCacheReady: true })
      setDone(true)
    })()
  }, [tour.paid])

  const progress = total > 0 ? Math.round((checked / total) * 100) : 0

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-base px-6">
      <Cassette
        title="아버지의 타임캡슐"
        headLeft="BONGHWANG 1988"
        headRight="LOADING"
        side="A"
        progress={progress}
        spin={done ? 'none' : 'right'}
        scale={0.85}
      />

      <div className="mt-6 w-full max-w-[320px]">
        <div className="tape-prog" aria-hidden>
          <i style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-center font-mono-retro text-[12px] tracking-wider text-ink-60">
          {done
            ? found > 0
              ? `음성 ${found}개 준비 완료`
              : '오디오 준비 중 — 자막 모드로 진행합니다'
            : `골목의 소리를 담는 중… ${progress}%`}
        </p>
        <p className="mt-1 text-center text-[11px] text-ink-60">
          골목에서 신호가 끊겨도 들을 수 있도록 미리 담아둡니다
        </p>

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
