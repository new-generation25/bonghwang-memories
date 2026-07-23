'use client'

/**
 * 대본 줄별 굽기 — 개발용.
 *
 * 큐 하나를 골라 자막 줄마다 따로 굽는다. 한 줄만 마음에 안 들면 그 줄만
 * 다시 구우면 된다 — 전체를 다시 굽지 않아도 되고, 다시 굽는다고 나머지가
 * 달라지지도 않는다.
 *
 * 왜 줄 단위인가:
 * 같은 설정으로 구워도 결과 길이가 매번 다르다(실측 4.375 / 4.432 / 4.830초).
 * 한 덩어리로 굽는 방식에서는 한 줄이 마음에 안 들어 다시 구우면 전체 길이가
 * 바뀌어 자막이 통째로 밀린다. 줄별로 나눠 실제 길이를 재면, 자막 타임라인을
 * 그 값에서 다시 계산할 수 있다 — 이 화면이 그 표를 만들어 준다.
 *
 * 연기 지시(프롬프트)에 대하여:
 * Typecast SSFM은 자유 텍스트 지시를 받지 않는다. emotion_type이 받는 값은
 * preset(감정+강도) · smart(글에서 자동 추론) · embedding(1024차원 벡터)뿐이고,
 * 벡터는 참조 음성에서 뽑는 것이라 손으로 쓸 수 없다. 그래서 '줄별 프롬프트'는
 * 줄마다 다른 감정·강도·속도·피치를 주는 형태로 만든다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CUES, CueId, SPEAKER_NAMES } from '@/lib/cues'

/** 후보 보이스 — /debug/voice에서 고른 것과 같은 목록 */
const CANDIDATES = [
  'tc_68257f68bc6e3c161ab5078d',
  'tc_660e46188b5f4761eb8e36d6',
  'tc_6583e016e1060e8bebe9a695',
  'tc_657139d23be20e08b0e92bae',
  'tc_6539f9a955c3de938ae20ed9',
  'tc_645b3ef82c2f52f412ede389',
  'tc_62ce545fb130717df10ea37a',
]

const EMOTION_LABEL: Record<string, string> = {
  normal: '보통',
  happy: '기쁨',
  sad: '슬픔',
  angry: '분노',
  whisper: '속삭임',
  toneup: '톤업',
  tonemid: '톤중간',
  tonedown: '톤다운',
}

interface VoiceMeta {
  voiceId: string
  name: string
  model: string
  emotions: string[]
}

interface Tuning {
  /** 'smart'면 글에서 감정을 자동으로 잡는다 — 프리셋 대신 쓴다 */
  emotion: string
  intensity: number
  tempo: number
  pitch: number
}

const BASE: Tuning = { emotion: 'normal', intensity: 1, tempo: 1, pitch: 0 }

interface Row {
  /** 대본 원문 줄 번호 — 다시 구워도 자리는 그대로다 */
  index: number
  speaker: string
  text: string
  /** null이면 기본 설정을 따른다 */
  override: Tuning | null
  buffer: AudioBuffer | null
  /** 내려받기용 원본 mp3 */
  mp3: ArrayBuffer | null
  state: 'idle' | 'busy' | 'done' | 'error'
  error?: string
}

/** 줄 사이 간격(초) — 붙여 들을 때 숨 쉴 자리 */
const GAP_SEC = 0.45

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

/** AudioBuffer들을 이어 붙여 WAV(16bit 모노)로 만든다 */
function concatToWav(buffers: AudioBuffer[], gapSec: number): Blob {
  const rate = buffers[0].sampleRate
  const gap = Math.floor(rate * gapSec)
  const total =
    buffers.reduce((n, b) => n + b.length, 0) + gap * (buffers.length - 1)

  const out = new Float32Array(total)
  let at = 0
  buffers.forEach((b, i) => {
    out.set(b.getChannelData(0), at)
    at += b.length
    if (i < buffers.length - 1) at += gap
  })

  const len = total * 2
  const ab = new ArrayBuffer(44 + len)
  const dv = new DataView(ab)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  dv.setUint32(4, 36 + len, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true)
  dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true)
  dv.setUint32(28, rate * 2, true)
  dv.setUint16(32, 2, true)
  dv.setUint16(34, 16, true)
  str(36, 'data')
  dv.setUint32(40, len, true)
  for (let i = 0; i < total; i++) {
    const s = Math.max(-1, Math.min(1, out[i]))
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([ab], { type: 'audio/wav' })
}

export default function ScriptBakePage() {
  // 재생은 Web Audio로 한다 — 이 환경의 <audio>는 blob: 소스를 거부한다
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  const cueIds = useMemo(
    () => (Object.keys(CUES) as CueId[]).filter((id) => CUES[id].subtitleLines.length),
    []
  )

  const [cueId, setCueId] = useState<CueId>(cueIds[0])
  const [voiceId, setVoiceId] = useState(CANDIDATES[0])
  const [base, setBase] = useState<Tuning>(BASE)
  const [rows, setRows] = useState<Row[]>([])
  const [metas, setMetas] = useState<Record<string, VoiceMeta>>({})
  const [playing, setPlaying] = useState<number | 'all' | null>(null)
  const [bakingAll, setBakingAll] = useState(false)

  const cue = CUES[cueId]
  const meta = metas[voiceId]
  const emotions = meta?.emotions ?? ['normal']

  useEffect(() => {
    fetch(`/api/debug/voices?ids=${CANDIDATES.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { voices?: VoiceMeta[] } | null) => {
        if (j?.voices) {
          setMetas(Object.fromEntries(j.voices.map((v) => [v.voiceId, v])))
        }
      })
      .catch(() => {})
  }, [])

  /** 큐를 바꾸면 줄을 새로 깐다 — 구운 것은 버린다 */
  useEffect(() => {
    setRows(
      CUES[cueId].subtitleLines.map((l, i) => ({
        index: i,
        speaker: l.speaker ?? SPEAKER_NAMES[CUES[cueId].speaker],
        text: l.text,
        override: null,
        buffer: null,
        mp3: null,
        state: 'idle' as const,
      }))
    )
  }, [cueId])

  const audioContext = (): AudioContext => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      ctxRef.current = new Ctor()
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.onended = null
      try {
        sourceRef.current.stop()
      } catch {
        /* 이미 끝남 */
      }
      sourceRef.current = null
    }
    setPlaying(null)
  }, [])

  useEffect(
    () => () => {
      sourceRef.current?.stop()
      void ctxRef.current?.close()
    },
    []
  )

  const playBuffer = (buf: AudioBuffer, key: number | 'all') => {
    stop()
    const ac = audioContext()
    const src = ac.createBufferSource()
    src.buffer = buf
    src.connect(ac.destination)
    src.onended = () => setPlaying((p) => (p === key ? null : p))
    src.start()
    sourceRef.current = src
    setPlaying(key)
  }

  /** 한 줄 굽기 */
  const bakeRow = async (index: number) => {
    const row = rows[index]
    if (!row?.text.trim()) return
    const t = row.override ?? base

    setRows((rs) =>
      rs.map((r) => (r.index === index ? { ...r, state: 'busy', error: undefined } : r))
    )

    try {
      const res = await fetch('/api/debug/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId,
          text: row.text,
          model: meta?.model,
          emotion: t.emotion,
          intensity: t.intensity,
          tempo: t.tempo,
          pitch: t.pitch,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const mp3 = await res.arrayBuffer()
      const buf = await audioContext().decodeAudioData(mp3.slice(0))
      setRows((rs) =>
        rs.map((r) =>
          r.index === index ? { ...r, buffer: buf, mp3, state: 'done' } : r
        )
      )
    } catch (e) {
      setRows((rs) =>
        rs.map((r) =>
          r.index === index
            ? {
                ...r,
                state: 'error',
                error: e instanceof Error ? e.message : '실패',
              }
            : r
        )
      )
    }
  }

  /** 아직 안 구운 줄만 굽는다 — 이미 마음에 든 줄을 날리지 않는다 */
  const bakeMissing = async () => {
    setBakingAll(true)
    for (const r of rows) {
      if (r.state !== 'done') await bakeRow(r.index)
    }
    setBakingAll(false)
  }

  const done = rows.filter((r) => r.state === 'done' && r.buffer)
  const allDone = rows.length > 0 && done.length === rows.length

  /** 줄 길이에서 자막 타임라인을 다시 계산한다 */
  const timeline = useMemo(() => {
    let at = 0
    return rows.map((r) => {
      const start = at
      const dur = r.buffer?.duration ?? 0
      at += dur + GAP_SEC
      return { index: r.index, start, dur }
    })
  }, [rows])

  const totalSec = allDone ? timeline[timeline.length - 1].start + timeline[timeline.length - 1].dur : 0

  const playAll = () => {
    if (playing === 'all') {
      stop()
      return
    }
    if (!allDone) return
    const ac = audioContext()
    const rate = done[0].buffer!.sampleRate
    const gap = Math.floor(rate * GAP_SEC)
    const total =
      done.reduce((n, r) => n + r.buffer!.length, 0) + gap * (done.length - 1)
    const merged = ac.createBuffer(1, total, rate)
    const out = merged.getChannelData(0)
    let at = 0
    done.forEach((r, i) => {
      out.set(r.buffer!.getChannelData(0), at)
      at += r.buffer!.length
      if (i < done.length - 1) at += gap
    })
    playBuffer(merged, 'all')
  }

  const downloadAll = () => {
    const blob = concatToWav(
      done.map((r) => r.buffer!),
      GAP_SEC
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${cue.audioFile}.wav`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const setRowText = (index: number, text: string) =>
    setRows((rs) => rs.map((r) => (r.index === index ? { ...r, text } : r)))

  const toggleOverride = (index: number) =>
    setRows((rs) =>
      rs.map((r) =>
        r.index === index
          ? { ...r, override: r.override ? null : { ...base } }
          : r
      )
    )

  const setOverride = (index: number, patch: Partial<Tuning>) =>
    setRows((rs) =>
      rs.map((r) =>
        r.index === index && r.override
          ? { ...r, override: { ...r.override, ...patch } }
          : r
      )
    )

  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[560px]">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          SCRIPT BAKE · 개발용
        </p>
        <h1 className="mt-1 font-display text-[22px] text-ink">대본 줄별 굽기</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          자막 줄마다 따로 굽습니다. 한 줄이 마음에 안 들면{' '}
          <b className="text-ink">그 줄만 다시</b> 구우면 되고, 나머지는 그대로
          남습니다. 줄마다 다른 감정·속도·피치를 줄 수도 있습니다.
        </p>

        {/* 연기 지시에 대한 사실 — 기대와 다르므로 먼저 밝힌다 */}
        <div className="mt-3 rounded-xl border border-retro-orange/40 bg-sunset-yellow/12 px-4 py-3">
          <p className="text-[11.5px] leading-relaxed text-ink">
            <b>자유 텍스트 연기 지시는 API가 받지 않습니다.</b>
            <span className="text-ink-60">
              {' '}
              &lsquo;쓸쓸하게 느리게&rsquo; 같은 문장을 보내면 422로 거절합니다.
              쓸 수 있는 것은 감정 프리셋 · 강도 · 속도 · 피치, 그리고{' '}
              <b className="text-ink">자동(smart)</b> — 글의 내용에서 감정을
              스스로 잡는 방식입니다. 줄별 연출은 이 값들을 줄마다 다르게 주는
              방식으로 합니다.
            </span>
          </p>
        </div>

        {/* ── 대상 ─────────────────────── */}
        <div className="card-paper mt-5 p-4">
          <label className="block text-[12px] font-bold text-ink">큐</label>
          <select
            value={cueId}
            onChange={(e) => setCueId(e.target.value as CueId)}
            className="mt-1 w-full rounded-lg border border-line bg-cream-base px-3 py-2 text-[12.5px] text-ink"
          >
            {cueIds.map((id) => (
              <option key={id} value={id}>
                {id} · {SPEAKER_NAMES[CUES[id].speaker]}
                {CUES[id].voiceAge ? ` (${CUES[id].voiceAge})` : ''} ·{' '}
                {CUES[id].subtitleLines.length}줄
              </option>
            ))}
          </select>
          <p className="mt-1 font-mono-retro text-[10px] text-ink-60">
            파일명 {cue.audioFile} · 명세 길이 {cue.durationSec}초
          </p>

          <label className="mt-3 block text-[12px] font-bold text-ink">보이스</label>
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-cream-base px-3 py-2 text-[12.5px] text-ink"
          >
            {CANDIDATES.map((id, i) => (
              <option key={id} value={id}>
                {i + 1}번 · {metas[id]?.name ?? id}
              </option>
            ))}
          </select>

          {/* 기본 설정 — 재정의하지 않은 줄이 따른다 */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[12px] font-bold text-ink">
              기본 설정
              <span className="ml-1.5 font-normal text-[10.5px] text-ink-60">
                따로 지정하지 않은 줄이 씁니다
              </span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {['smart', ...emotions].map((id) => (
                <button
                  key={id}
                  onClick={() => setBase((b) => ({ ...b, emotion: id }))}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    base.emotion === id
                      ? 'bg-teal text-cream'
                      : 'border border-line bg-cream-base text-teal-dk'
                  }`}
                >
                  {id === 'smart' ? '자동' : (EMOTION_LABEL[id] ?? id)}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ['강도', 'intensity', 0, 2, 0.1],
                  ['속도', 'tempo', 0.5, 2, 0.02],
                  ['피치', 'pitch', -12, 12, 1],
                ] as const
              ).map(([label, key, min, max, step]) => (
                <label key={key} className="block">
                  <span className="text-[10.5px] text-ink-60">
                    {label} {base[key]}
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={base[key]}
                    onChange={(e) =>
                      setBase((b) => ({ ...b, [key]: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── 줄 ─────────────────────── */}
        <div className="mt-5 flex items-center justify-between">
          <h2 className="font-display text-[15px] text-ink">
            줄 {done.length} / {rows.length}
          </h2>
          <button
            onClick={bakeMissing}
            disabled={bakingAll || allDone}
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[11.5px] font-bold text-teal-dk disabled:opacity-40"
          >
            {bakingAll ? '굽는 중…' : '안 구운 줄 전부 굽기'}
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {rows.map((r) => {
            const t = r.override ?? base
            const tl = timeline[r.index]
            return (
              <div
                key={r.index}
                className={`rounded-xl border px-3.5 py-3 ${
                  r.state === 'done'
                    ? 'border-teal/40 bg-teal/8'
                    : r.state === 'error'
                      ? 'border-rec/50 bg-rec/8'
                      : 'border-line bg-paper'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-retro text-[10px] text-ink-60">
                    {String(r.index + 1).padStart(2, '0')} · {r.speaker}
                    {r.state === 'done' && ` · ${r.buffer!.duration.toFixed(2)}초`}
                    {r.state === 'done' && ` · ${fmt(tl.start)}부터`}
                  </span>
                  <button
                    onClick={() => toggleOverride(r.index)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.override
                        ? 'bg-teal text-cream'
                        : 'border border-line text-teal-dk'
                    }`}
                  >
                    {r.override ? '이 줄만 따로' : '기본 설정'}
                  </button>
                </div>

                <textarea
                  value={r.text}
                  onChange={(e) => setRowText(r.index, e.target.value)}
                  rows={2}
                  className="mt-1.5 w-full resize-y rounded-lg border border-line bg-cream-base px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink"
                />

                {/* 줄별 재정의 — 켠 줄에만 보인다 */}
                {r.override && (
                  <div className="mt-2 rounded-lg border border-line bg-cream-base px-2.5 py-2">
                    <div className="flex flex-wrap gap-1">
                      {['smart', ...emotions].map((id) => (
                        <button
                          key={id}
                          onClick={() => setOverride(r.index, { emotion: id })}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            t.emotion === id
                              ? 'bg-teal text-cream'
                              : 'border border-line text-teal-dk'
                          }`}
                        >
                          {id === 'smart' ? '자동' : (EMOTION_LABEL[id] ?? id)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {(
                        [
                          ['강도', 'intensity', 0, 2, 0.1],
                          ['속도', 'tempo', 0.5, 2, 0.02],
                          ['피치', 'pitch', -12, 12, 1],
                        ] as const
                      ).map(([label, key, min, max, step]) => (
                        <label key={key} className="block">
                          <span className="text-[10px] text-ink-60">
                            {label} {t[key]}
                          </span>
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={t[key]}
                            onChange={(e) =>
                              setOverride(r.index, {
                                [key]: Number(e.target.value),
                              } as Partial<Tuning>)
                            }
                            className="w-full"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {r.error && (
                  <p className="mt-1.5 text-[10.5px] leading-snug text-rec">
                    {r.error}
                  </p>
                )}

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void bakeRow(r.index)}
                    disabled={r.state === 'busy'}
                    className="flex-1 rounded-lg border border-line bg-cream-base px-2 py-1.5 text-[11.5px] font-bold text-teal-dk disabled:opacity-40"
                  >
                    {r.state === 'busy'
                      ? '굽는 중…'
                      : r.state === 'done'
                        ? '↻ 이 줄만 다시'
                        : '🔊 굽기'}
                  </button>
                  {r.buffer && (
                    <button
                      onClick={() =>
                        playing === r.index ? stop() : playBuffer(r.buffer!, r.index)
                      }
                      className="flex-1 rounded-lg border border-line bg-cream-base px-2 py-1.5 text-[11.5px] font-bold text-teal-dk"
                    >
                      {playing === r.index ? '■ 멈추기' : '▶ 듣기'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── 결과 ─────────────────────── */}
        {allDone && (
          <div className="card-paper mt-5 p-4">
            <p className="text-[12.5px] font-bold text-ink">
              전체 {fmt(totalSec)} ({totalSec.toFixed(1)}초)
              <span className="ml-1.5 font-normal text-[11px] text-ink-60">
                명세 {cue.durationSec}초
              </span>
            </p>

            <div className="mt-2 flex gap-2">
              <button
                onClick={playAll}
                className="flex-1 rounded-lg border border-line bg-cream-base px-3 py-2 text-[12px] font-bold text-teal-dk"
              >
                {playing === 'all' ? '■ 멈추기' : '▶ 이어서 듣기'}
              </button>
              <button
                onClick={downloadAll}
                className="flex-1 rounded-lg border border-line bg-cream-base px-3 py-2 text-[12px] font-bold text-teal-dk"
              >
                ⤓ {cue.audioFile}.wav
              </button>
            </div>

            {/* 자막 타임라인 — 실제 길이에서 뽑은 값이라 그대로 쓸 수 있다 */}
            <p className="mt-4 text-[12px] font-bold text-ink">자막 시작 시각</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink-60">
              줄 사이 {GAP_SEC}초를 넣은 기준입니다. 큐의 durationSec은{' '}
              <b className="text-ink">{Math.ceil(totalSec)}</b>으로 두면 맞습니다.
            </p>
            <div className="mt-1.5 overflow-x-auto">
              <table className="w-full text-[11px] text-ink">
                <thead>
                  <tr className="text-ink-60">
                    <th className="py-1 text-left font-normal">줄</th>
                    <th className="py-1 text-right font-normal">시작</th>
                    <th className="py-1 text-right font-normal">길이</th>
                    <th className="py-1 text-left font-normal">　내용</th>
                  </tr>
                </thead>
                <tbody className="font-mono-retro">
                  {timeline.map((t) => (
                    <tr key={t.index} className="border-t border-line/60">
                      <td className="py-1">{String(t.index + 1).padStart(2, '0')}</td>
                      <td className="py-1 text-right">{t.start.toFixed(2)}</td>
                      <td className="py-1 text-right">{t.dur.toFixed(2)}</td>
                      <td className="max-w-[220px] truncate py-1 pl-2 font-sans">
                        {rows[t.index].text}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <a
          href="/debug/voice"
          className="mt-5 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-center text-[13px] font-bold text-teal-dk"
        >
          ← 목소리 고르기로
        </a>
      </div>
    </div>
  )
}
