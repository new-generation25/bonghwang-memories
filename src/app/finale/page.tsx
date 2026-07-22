'use client'

/**
 * S40 — 피날레: 우리의 테이프 · 기록자 인증 · EP.2 CTA.
 *
 * 도착 시 C7_0(소영의 작별)이 재생 중이다(빙고의 [투어 마치기]에서 발화).
 * C7_1(아버지 라이브 육성)은 feature flag(epilogueLiveVoice) 켜진 경우에만.
 * 앨범: 미션 사진(IndexedDB) + B면 엔트리. 저장은 canvas 합성 PNG 다운로드.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cassette, { CASSETTE_SCALE } from '@/components/Cassette'
import CuePlayer from '@/components/cue/CuePlayer'
import SurveyCard from '@/components/SurveyCard'
import MyPoints from '@/components/MyPoints'
import { ep2Discount, localPointTotal, POINTS_EVENT } from '@/lib/points'
import { useCue } from '@/hooks/useCue'
import { useTourState } from '@/hooks/useTourState'
import { getBlobUrl } from '@/lib/blobStore'
import { S40_TEXT } from '@/lib/cues'
import { TRACK_STATIONS } from '@/lib/tracks'
import { formatElapsed, mutateTour } from '@/lib/tourState'
import { logEvent } from '@/lib/analytics'

export default function FinalePage() {
  const tour = useTourState()
  const cueState = useCue()
  const router = useRouter()
  const [photoUrls, setPhotoUrls] = useState<{ track: number; url: string }[]>([])
  const [bsideVoiceUrl, setBsideVoiceUrl] = useState<string | null>(null)
  const [points, setPoints] = useState(0)
  const ep2 = ep2Discount(points)

  // 설문에 응답하면 그 자리에서 200P가 붙는다 — 할인 문구도 같이 올라가야 한다
  useEffect(() => {
    const sync = () => setPoints(localPointTotal())
    sync()
    window.addEventListener(POINTS_EVENT, sync)
    return () => window.removeEventListener(POINTS_EVENT, sync)
  }, [])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // 완주 기록
  useEffect(() => {
    if (tour.phase === 'act2') mutateTour({ phase: 'done' })
  }, [tour.phase])

  // 앨범 사진 로드 (IndexedDB → object URL)
  useEffect(() => {
    const revokes: (() => void)[] = []
    ;(async () => {
      const loaded: { track: number; url: string }[] = []
      for (const photo of tour.photos) {
        try {
          const res = await getBlobUrl(photo.idbKey)
          if (res) {
            loaded.push({ track: photo.track, url: res.url })
            revokes.push(res.revoke)
          }
        } catch {
          /* 사진 하나 없다고 앨범을 포기하지 않는다 */
        }
      }
      setPhotoUrls(loaded)

      if (tour.bsideEntry?.type === 'voice' && tour.bsideEntry.idbKey) {
        try {
          const res = await getBlobUrl(tour.bsideEntry.idbKey)
          if (res) {
            setBsideVoiceUrl(res.url)
            revokes.push(res.revoke)
          }
        } catch {
          /* noop */
        }
      }
    })()
    return () => revokes.forEach((fn) => fn())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 시리얼 — 시작 시각 기반 (실서비스 전환 시 Firestore 카운터로 교체 지점).
  // startTime이 없으면(=hydration 전 초기 렌더 포함) Date.now()를 쓰지 않는다 —
  // 서버/클라이언트 값이 달라 hydration 불일치를 만든다.
  const serial = useMemo(() => {
    if (!tour.startTime) return '——'
    return tour.startTime.toString(36).toUpperCase().slice(-6)
  }, [tour.startTime])

  const dateStr = useMemo(() => {
    if (!tour.startTime) return '—'
    const d = new Date(tour.startTime)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }, [tour.startTime])

  const elapsed = formatElapsed(tour.startTime)
  const bingoCount = tour.bingo.cellsDone.length

  /** 우리의 테이프 저장 — 간단한 인증서 PNG 합성 */
  const handleSave = async () => {
    logEvent('finale_saved')
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 720
    canvas.height = 960
    // 배경
    ctx.fillStyle = '#F3EAD3'
    ctx.fillRect(0, 0, 720, 960)
    // 스트라이프
    const stripe = ['#F2B33D', '#E8722C', '#2E8A80']
    stripe.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.fillRect(0, 8 * i, 720, 8)
    })
    ctx.fillStyle = '#262422'
    ctx.font = 'bold 40px "Black Han Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('봉황1988 · 아버지의 타임캡슐', 360, 110)
    ctx.font = '24px "Noto Sans KR", sans-serif'
    ctx.fillText(S40_TEXT.title(serial), 360, 170)
    ctx.fillText(S40_TEXT.journey(dateStr, 1), 360, 210)
    ctx.fillText(S40_TEXT.stats(elapsed, bingoCount), 360, 250)
    // 사진 몽타주 (최대 4장)
    const imgs = photoUrls.slice(0, 4)
    await Promise.all(
      imgs.map(
        (p, i) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => {
              const x = 60 + (i % 2) * 310
              const y = 300 + Math.floor(i / 2) * 250
              ctx.drawImage(img, x, y, 290, 230)
              resolve()
            }
            img.onerror = () => resolve()
            img.src = p.url
          })
      )
    )
    ctx.fillStyle = '#262422'
    ctx.font = '26px "Nanum Pen Script", cursive'
    ctx.fillText(S40_TEXT.closing, 360, 880)

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `bonghwang1988-tape-${serial}.png`
    a.click()
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream-base px-4 pb-16 pt-6">
      <p className="text-center font-mono-retro text-[11px] tracking-[0.25em] text-teal">
        EP.1 · FINALE
      </p>

      <div className="mx-auto mt-3 w-full max-w-[380px]">
        {/* C7_0 / C7_1 */}
        {/* 큐 ID는 B7_0·B7_1 — 'C7'은 v1 시절 접두사라 영영 거짓이었다 */}
        {cueState.cueId?.startsWith('B7') && (
          <div className="mb-4">
            <CuePlayer />
          </div>
        )}

        {/* 완성된 테이프 */}
        <div className="flex justify-center">
          <Cassette
            title="아버지의 타임캡슐"
            headLeft="A면 소원 · B면 편지"
            headRight="DONE"
            side="done"
            progress={100}
            spin="none"
            scale={CASSETTE_SCALE}
          />
        </div>

        {/* S40 텍스트 — 명세 원문 */}
        <div className="card-paper mt-4 p-5 text-center shadow-lg">
          <p className="text-[13.5px] font-bold leading-relaxed text-ink">
            {S40_TEXT.title(serial)}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-60">
            {S40_TEXT.journey(dateStr, 1)}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-60">
            {S40_TEXT.stats(elapsed, bingoCount)}
          </p>
          <p className="mt-3 font-pen text-[20px] text-ink">{S40_TEXT.closing}</p>
        </div>

        {/* 소원 체크 5 */}
        <div className="card-paper mt-4 p-4 shadow-lg">
          {TRACK_STATIONS.map((station) => {
            // 4+1 유보(§6 B5_F) — 다섯 번째 소원은 다음 주, 부녀가 직접 이룬다
            const reserved = station.track === 5
            const done = !reserved && tour.tracksCompleted.includes(station.track)
            return (
              <div key={station.id} className="mt-1.5 flex items-center gap-2 first:mt-0">
                <span
                  className={`flex h-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    reserved
                      ? 'w-auto bg-sunset-yellow px-2 font-mono-retro text-[10px] text-ink'
                      : done
                        ? 'w-5 bg-teal text-cream'
                        : 'w-5 bg-line text-ink-60'
                  }`}
                >
                  {reserved ? '다음 주' : '✓'}
                </span>
                <span className="text-[13px] text-ink">{station.wish}</span>
              </div>
            )
          })}
        </div>

        {/* 오늘 모은 포인트 — 설문 바로 위. 설문 200P가 눈에 보여야 응답한다 */}
        <MyPoints />

        {/* 완주 설문 — 기억이 선명할 때 받는다 */}
        <SurveyCard />

        {/* 우리의 테이프 앨범 */}
        {(photoUrls.length > 0 || tour.bsideEntry) && (
          <div className="card-paper mt-4 p-4 shadow-lg">
            <h3 className="font-display text-[15px] text-ink">📼 우리의 테이프</h3>
            {photoUrls.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {photoUrls.map((p, i) => (
                  <div key={i} className="polaroid !p-1.5 !pb-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`트랙 ${p.track} 기록`} className="w-full" />
                    <p className="mt-0.5 text-center font-mono-retro text-[9px] text-ink-60">
                      TRACK {p.track}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {tour.bsideEntry?.type === 'text' && tour.bsideEntry.text && (
              <p className="mt-3 rounded-lg bg-cream px-3 py-2 font-pen text-[18px] leading-relaxed text-ink">
                &ldquo;{tour.bsideEntry.text}&rdquo;
              </p>
            )}
            {bsideVoiceUrl && (
              <audio controls src={bsideVoiceUrl} className="mt-3 w-full" />
            )}
            {tour.bsideEntry?.type === 'heart_only' && (
              <p className="mt-3 text-center text-[13px] text-ink-60">
                💛 오늘의 마음을 남겨두었습니다
              </p>
            )}
          </div>
        )}

        {/* 액션 */}
        <button onClick={handleSave} className="btn-teal mt-5 w-full text-[15px]">
          {S40_TEXT.saveButton}
        </button>
        <button
          onClick={() => {
            logEvent('ep2_reserved')
            window.alert('EP.2 예약은 곧 열립니다. 조금만 기다려주세요!')
          }}
          className="mt-2 w-full rounded-xl border border-line bg-paper py-3 text-[13.5px] text-ink"
        >
          {S40_TEXT.ep2Button}
          <span className="block text-[11px] text-ink-60">
            {ep2.discount > 0
              ? `오늘 모은 ${points.toLocaleString()}P로 ${ep2.discount.toLocaleString()}원 할인`
              : S40_TEXT.ep2Note}
          </span>
        </button>
        <button
          onClick={() => router.push('/community')}
          className="mt-2 w-full rounded-xl border border-line bg-paper py-3 text-[13.5px] text-ink"
        >
          👥 소영의 친구들에게 오늘을 공유하기
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <div className="stripe-band fixed bottom-0 left-0 right-0" />
    </div>
  )
}
