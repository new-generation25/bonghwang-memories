'use client'

/**
 * 큐 QA 하니스 (개발용) — 전 큐 목록·개별 재생·트리거 발화·상태 확인.
 *
 * 프로덕션 네비게이션에는 노출되지 않는다. URL 직접 진입 전용.
 * `?e2e=1`을 붙이면 10배속으로 돈다(스킵 게이트 검증용).
 */

import { useMemo, useState } from 'react'
import CuePlayer from '@/components/cue/CuePlayer'
import { useCue, useCueEvents } from '@/hooks/useCue'
import { useTourState } from '@/hooks/useTourState'
import {
  ALL_CUE_IDS,
  CUES,
  CueId,
  validateCueGraph,
} from '@/lib/cues'
import {
  dispatchAction,
  dispatchQr,
  dispatchTap,
  playCue,
  stopCue,
  unlockAudio,
} from '@/lib/cueEngine'
import { resetTour } from '@/lib/tourState'
import { STATIONS } from '@/lib/tracks'

const TRACK_LABELS: Record<number, string> = {
  0: 'INTRO',
  1: 'TRACK 1 — 봉황1935',
  2: 'TRACK 2 — 미야상회',
  3: 'TRACK 3 — 능소화 고택',
  4: 'TRACK 4 — 카페 탱자',
  5: 'TRACK 5 — 방하림',
  6: 'ACT 2 — 빙고',
  7: 'FINALE',
}

export default function CueDebugPage() {
  const cueState = useCue()
  const tour = useTourState()
  const [events, setEvents] = useState<string[]>([])

  useCueEvents((event) => {
    setEvents((prev) =>
      [`${event.cueId} → ${event.directive}`, ...prev].slice(0, 12)
    )
  })

  const graphErrors = useMemo(() => validateCueGraph(), [])

  const grouped = useMemo(() => {
    const byTrack = new Map<number, CueId[]>()
    for (const id of ALL_CUE_IDS) {
      const t = CUES[id].track
      byTrack.set(t, [...(byTrack.get(t) ?? []), id])
    }
    return Array.from(byTrack.entries()).sort((a, b) => a[0] - b[0])
  }, [])

  return (
    <main className="min-h-screen bg-bg-base px-4 py-6 pb-24">
      <h1 className="font-display text-[22px] text-ink">🎛 큐 QA 하니스</h1>
      <p className="font-mono-retro text-[11px] text-ink60">
        개발 전용 · ?e2e=1 = 10배속
      </p>

      {graphErrors.length > 0 && (
        <div className="mt-3 rounded-lg border border-rec bg-rec/10 p-3 text-[13px] text-rec">
          <b>큐 그래프 오류 {graphErrors.length}건</b>
          <ul className="mt-1 list-disc pl-5">
            {graphErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 현재 플레이어 */}
      <section className="sticky top-2 z-10 mt-4">
        <CuePlayer />
        {cueState.cueId && (
          <button
            type="button"
            onClick={stopCue}
            className="mt-1 text-[12px] text-ink60 underline"
          >
            ■ 정지
          </button>
        )}
      </section>

      {/* 투어 상태 요약 */}
      <section className="mt-4 rounded-xl border border-line bg-paper p-3 font-mono-retro text-[11.5px] text-ink">
        <div className="flex items-center justify-between">
          <b>tourState</b>
          <button
            type="button"
            onClick={() => resetTour()}
            className="rounded border border-line px-2 py-0.5 text-[11px]"
          >
            초기화
          </button>
        </div>
        <p className="mt-1">
          phase={tour.phase} · track={tour.currentTrack} · 말투=
          {tour.speechMode} · 조각={tour.fragments.length}/4 · 완료=[
          {tour.tracksCompleted.join(',')}] · 쿠폰={tour.coupons.length} · 빙고=
          {tour.bingo.unlocked ? '개방' : '잠김'}
        </p>
      </section>

      {/* 트리거 발화 버튼 */}
      <section className="mt-4 rounded-xl border border-line bg-paper p-3">
        <b className="text-[13px] text-ink">트리거 발화</b>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <DebugBtn onClick={() => dispatchTap('PLAY')}>tap:PLAY</DebugBtn>
          <DebugBtn onClick={() => dispatchTap('CALL')}>tap:CALL</DebugBtn>
          <DebugBtn onClick={() => dispatchTap('LISTEN')}>tap:LISTEN</DebugBtn>
          <DebugBtn onClick={() => dispatchTap('RESUME')}>tap:RESUME</DebugBtn>
          <DebugBtn onClick={() => dispatchTap('ASK')}>tap:ASK</DebugBtn>
          <DebugBtn onClick={() => dispatchTap('BSIDE')}>tap:BSIDE</DebugBtn>
          <DebugBtn onClick={() => dispatchTap('FINISH')}>tap:FINISH</DebugBtn>
          {Object.values(STATIONS)
            .filter((s) => s.arrivalCue)
            .map((s) => (
              <DebugBtn key={s.id} onClick={() => dispatchQr(s.id)}>
                qr:{s.id}
              </DebugBtn>
            ))}
          <DebugBtn onClick={() => dispatchAction('M1_count_ok')}>M1_count_ok</DebugBtn>
          <DebugBtn onClick={() => dispatchAction('M1_photo_done')}>M1_photo</DebugBtn>
          <DebugBtn onClick={() => dispatchAction('M2_photo_done')}>M2_photo</DebugBtn>
          <DebugBtn onClick={() => dispatchAction('M3_photo_done')}>M3_photo</DebugBtn>
          <DebugBtn onClick={() => dispatchAction('M4_done')}>M4_done</DebugBtn>
          <DebugBtn onClick={() => dispatchAction('M5a_done')}>M5a_done</DebugBtn>
          <DebugBtn onClick={() => dispatchAction('unlock_done')}>unlock</DebugBtn>
        </div>
      </section>

      {/* 이벤트 로그 */}
      <section className="mt-4 rounded-xl border border-line bg-paper p-3">
        <b className="text-[13px] text-ink">UI 이벤트 (최근 12)</b>
        <ul className="mt-1 font-mono-retro text-[11px] text-ink60">
          {events.length === 0 && <li>—</li>}
          {events.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </section>

      {/* 전체 큐 목록 */}
      {grouped.map(([track, ids]) => (
        <section key={track} className="mt-5">
          <h2 className="font-mono-retro text-[12px] tracking-widest text-teal">
            {TRACK_LABELS[track]}
          </h2>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5">
            {ids.map((id: CueId) => {
              const cue = CUES[id]
              const active = cueState.cueId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    unlockAudio()
                    void playCue(id)
                  }}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] ${
                    active
                      ? 'border-teal bg-teal/10 text-ink'
                      : 'border-line bg-paper text-ink'
                  }`}
                >
                  <span>
                    <b className="font-mono-retro">{id}</b>{' '}
                    <span className="text-ink60">
                      {cue.channel} · {cue.speaker} ·{' '}
                      {cue.trigger.type}:{String(cue.trigger.ref)}
                    </span>
                  </span>
                  <span className="font-mono-retro text-[11px] text-ink60">
                    {cue.durationSec}s
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}

function DebugBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-line bg-cream px-2 py-1 font-mono-retro text-[11px] text-ink"
    >
      {children}
    </button>
  )
}
