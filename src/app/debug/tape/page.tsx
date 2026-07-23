'use client'

/**
 * 녹음한 카세트 키음 자르기 — 개발용.
 *
 * 직접 녹음한 원본에서 클릭을 자동으로 찾아 조각으로 듣고 고른다.
 * ffmpeg 없이 브라우저에서 디코딩·검출·재생·내려받기까지 끝낸다.
 *
 * 검출 방식: 짧은 창(5ms)의 에너지를 재서 문턱을 넘는 지점을 온셋으로 본다.
 * 하나의 '딸깍'은 두 음이 40ms 안팎으로 붙어 있으므로, 최소 간격을 그보다
 * 길게(250ms) 잡아 두 음을 한 덩어리로 묶는다.
 *
 * 고른 조각은 WAV로 내려받아 public/audio/sfx/에 넣으면 된다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const SOURCE = '/audio/_raw/tape-source.mp3'

/** 잘라낼 조각 길이 — 클릭 두 음이 다 들어가고도 남는 길이 */
const CLIP_SEC = 0.35
/** 온셋 앞을 조금 남긴다 — 시작이 잘리면 '딱'이 뭉툭해진다 */
const PRE_ROLL_SEC = 0.02

interface Clip {
  index: number
  /** 원본에서의 시작 시각(초) */
  at: number
  /** 조각 안의 최대 진폭 */
  peak: number
  buffer: AudioBuffer
}

/** 모노 다운믹스 */
function toMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0)
  const a = buf.getChannelData(0)
  const b = buf.getChannelData(1)
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2
  return out
}

/**
 * 온셋 검출 — 에너지가 문턱을 넘는 순간을 클릭 시작으로 본다.
 * 문턱은 전체 최대 진폭에 비례해 잡는다(녹음 레벨이 달라도 동작하도록).
 */
function findOnsets(
  data: Float32Array,
  sampleRate: number,
  opts: { ratio: number; minGapSec: number }
): number[] {
  const win = Math.floor(sampleRate * 0.005)
  let globalPeak = 0
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i])
    if (v > globalPeak) globalPeak = v
  }
  const threshold = globalPeak * opts.ratio
  const minGap = Math.floor(sampleRate * opts.minGapSec)

  const onsets: number[] = []
  let last = -minGap
  for (let i = 0; i < data.length; i += win) {
    let peak = 0
    for (let j = i; j < Math.min(i + win, data.length); j++) {
      const v = Math.abs(data[j])
      if (v > peak) peak = v
    }
    if (peak >= threshold && i - last >= minGap) {
      onsets.push(i)
      last = i
    }
  }
  return onsets
}

/** AudioBuffer → WAV(16bit PCM) Blob */
function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels
  const len = buf.length * ch * 2
  const ab = new ArrayBuffer(44 + len)
  const view = new DataView(ab)
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  view.setUint32(4, 36 + len, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, ch, true)
  view.setUint32(24, buf.sampleRate, true)
  view.setUint32(28, buf.sampleRate * ch * 2, true)
  view.setUint16(32, ch * 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, len, true)

  let off = 44
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, buf.getChannelData(c)[i]))
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      off += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

export default function TapeCutterPage() {
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBuffer | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [status, setStatus] = useState('원본을 불러오는 중…')
  const [playing, setPlaying] = useState<number | null>(null)
  const [sensitivity, setSensitivity] = useState(0.35)

  const ctx = () => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      ctxRef.current = new Ctor()
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }

  /** 원본에서 조각 5개를 다시 뽑는다 */
  const slice = useCallback(
    (ratio: number) => {
      const buf = sourceRef.current
      if (!buf) return
      const ac = ctx()
      const mono = toMono(buf)
      const onsets = findOnsets(mono, buf.sampleRate, {
        ratio,
        minGapSec: 0.25,
      })

      if (onsets.length === 0) {
        setClips([])
        setStatus('클릭을 찾지 못했어요 — 감도를 낮춰보세요.')
        return
      }

      // 소리가 큰 것부터 5개. 원본 순서대로 보여줘야 헷갈리지 않으니 다시 정렬한다
      const scored = onsets.map((start) => {
        const end = Math.min(start + Math.floor(buf.sampleRate * CLIP_SEC), mono.length)
        let peak = 0
        for (let i = start; i < end; i++) {
          const v = Math.abs(mono[i])
          if (v > peak) peak = v
        }
        return { start, peak }
      })
      const picked = [...scored]
        .sort((a, b) => b.peak - a.peak)
        .slice(0, 5)
        .sort((a, b) => a.start - b.start)

      const made: Clip[] = picked.map((p, i) => {
        const pre = Math.floor(buf.sampleRate * PRE_ROLL_SEC)
        const start = Math.max(0, p.start - pre)
        const length = Math.min(
          Math.floor(buf.sampleRate * CLIP_SEC),
          buf.length - start
        )
        const out = ac.createBuffer(buf.numberOfChannels, length, buf.sampleRate)
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const src = buf.getChannelData(c)
          const dst = out.getChannelData(c)
          for (let j = 0; j < length; j++) {
            // 끝을 살짝 페이드 — 뚝 끊기면 '툭' 하는 잡음이 붙는다
            const tail = length - j
            const fade = tail < 400 ? tail / 400 : 1
            dst[j] = src[start + j] * fade
          }
        }
        return { index: i + 1, at: start / buf.sampleRate, peak: p.peak, buffer: out }
      })

      setClips(made)
      setStatus(
        `클릭 ${onsets.length}개를 찾아 그중 소리가 큰 5개를 잘랐어요.`
      )
    },
    []
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(SOURCE)
        if (!res.ok) throw new Error(`원본을 찾을 수 없습니다 (${res.status})`)
        const ab = await res.arrayBuffer()
        const ac = ctx()
        const buf = await ac.decodeAudioData(ab)
        if (!alive) return
        sourceRef.current = buf
        setStatus(
          `원본 ${buf.duration.toFixed(1)}초 · ${buf.sampleRate}Hz — 클릭을 찾는 중…`
        )
        slice(0.35)
      } catch (e) {
        if (alive) setStatus(e instanceof Error ? e.message : '불러오기 실패')
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const play = (clip: Clip) => {
    const ac = ctx()
    const src = ac.createBufferSource()
    src.buffer = clip.buffer
    src.connect(ac.destination)
    src.start()
    setPlaying(clip.index)
    src.onended = () => setPlaying((p) => (p === clip.index ? null : p))
  }

  const download = (clip: Clip) => {
    const url = URL.createObjectURL(toWav(clip.buffer))
    const a = document.createElement('a')
    a.href = url
    a.download = `tape-click-${clip.index}.wav`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[420px]">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          TAPE CUTTER · 개발용
        </p>
        <h1 className="mt-1 font-display text-[22px] text-ink">
          녹음한 키음 고르기
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          직접 녹음하신 파일에서 클릭을 찾아 5개로 잘랐습니다. 눌러 들어보고
          가장 좋은 번호를 알려주세요 — 그 소리를 앱 데크 키에 넣겠습니다.
        </p>

        <p className="mt-3 rounded-lg bg-cream-dp px-3 py-2 font-mono-retro text-[11px] text-ink-60">
          {status}
        </p>

        {/* 감도 — 클릭이 덜 잡히거나 너무 많이 잡힐 때 */}
        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 text-[11.5px] text-ink-60">검출 감도</span>
          <input
            type="range"
            min={0.1}
            max={0.7}
            step={0.05}
            value={sensitivity}
            onChange={(e) => {
              const v = Number(e.target.value)
              setSensitivity(v)
              slice(v)
            }}
            className="flex-1"
          />
          <span className="w-8 shrink-0 text-right font-mono-retro text-[11px] text-teal">
            {sensitivity.toFixed(2)}
          </span>
        </div>

        <div className="mt-5 space-y-2.5">
          {clips.map((clip) => (
            <div
              key={clip.index}
              className={`rounded-xl border px-4 py-3 ${
                playing === clip.index
                  ? 'border-teal bg-teal/10'
                  : 'border-line bg-paper'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => play(clip)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-shell text-[16px] text-cream"
                  aria-label={`${clip.index}번 듣기`}
                >
                  ▶
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink">
                    {clip.index}번
                  </p>
                  <p className="mt-0.5 font-mono-retro text-[10.5px] text-ink-60">
                    원본 {clip.at.toFixed(2)}초 · 세기 {clip.peak.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => download(clip)}
                  className="shrink-0 rounded-lg border border-line px-3 py-2 text-[11.5px] font-bold text-teal-dk"
                >
                  내려받기
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card-paper mt-6 p-4">
          <p className="text-[12px] leading-relaxed text-ink-60">
            클릭이 덜 잡히면 감도를 <b className="text-ink">왼쪽</b>으로(문턱을
            낮춤), 잡음까지 잡히면 <b className="text-ink">오른쪽</b>으로
            옮기세요. 조각은 {CLIP_SEC}초씩 잘리고 끝에 짧은 페이드를 넣어
            뚝 끊기는 잡음을 없앴습니다.
          </p>
        </div>

        <a
          href="/debug/sfx"
          className="mt-5 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-center text-[13px] font-bold text-teal-dk"
        >
          🔊 합성음과 비교하기
        </a>
      </div>
    </div>
  )
}
