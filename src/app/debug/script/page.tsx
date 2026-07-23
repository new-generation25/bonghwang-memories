'use client'

/**
 * 대본 줄별 굽기 — 개발용.
 *
 * 대본을 통째로 붙여넣고 [줄로 나누기]를 누르면 엔터 기준으로 줄이 갈린다.
 * 그 뒤로는 줄마다 따로 굽고, 듣고, 저장한다. 한 줄이 마음에 안 들면 그
 * 줄만 다시 구우면 되고 나머지는 그대로 남는다.
 *
 * 왜 줄 단위인가:
 * 같은 설정으로 구워도 결과 길이가 매번 다르다(실측 4.375 / 4.432 / 4.830초).
 * 한 덩어리로 굽는 방식에서는 한 줄이 마음에 안 들어 다시 구우면 전체 길이가
 * 바뀌어 자막이 통째로 밀린다. 줄별로 나눠 실제 길이를 재면 자막 타임라인을
 * 그 값에서 다시 계산할 수 있다.
 *
 * 쉼표기 (0.3) · <|0.3s|>:
 * 문서에 있는 <|0.3s|> 문법을 API에 직접 던져 확인했다. ssfm-v21과
 * ssfm-v30, v30 네이티브 보이스, 공백 유무까지 바꿔가며 시험했지만
 * 5초 쉼을 요구해도 반영되지 않았다(기준 134KB → <|5s|> 124KB로 오히려
 * 줄기도 했다). 스튜디오의 '쉼 추가'는 편집기가 구간을 나눠 무음을
 * 끼우는 기능으로 보인다.
 *
 * 그래서 이 화면이 같은 일을 한다 — 표기 자리에서 문장을 끊어 따로 굽고
 * 사이에 정확히 그만큼의 무음을 넣는다. 모델이 어림잡는 것보다 정확하다.
 * 스튜디오에서 쓰던 <|0.3s|> 표기도 그대로 받는다.
 *
 * seed:
 * 같은 seed를 주면 편차가 크게 줄어든다. 다만 완전히 같지는 않다 —
 * seed 42로 5번 구웠더니 4.602초 셋, 5.227초 둘로 두 갈래였다.
 * 마음에 드는 것이 나오면 그 파일을 저장해 두는 편이 확실하다.
 *
 * 연기 지시(프롬프트):
 * 자유 텍스트 지시는 API가 422로 거절한다. emotion_type이 받는 값은
 * preset(감정+강도) · smart(글에서 자동 추론) · embedding(1024차원 벡터)뿐이라,
 * 줄별 연출은 줄마다 다른 감정·강도·속도·피치를 주는 방식으로 만든다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CUES, CueId, SPEAKER_NAMES } from '@/lib/cues'

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
  emotion: string
  intensity: number
  tempo: number
  pitch: number
}

const BASE: Tuning = { emotion: 'normal', intensity: 1, tempo: 1, pitch: 0 }

interface Row {
  /** 줄마다 고유 — 배열 순서가 바뀌어도 구운 결과가 따라다닌다 */
  id: number
  text: string
  /** null이면 기본 설정을 따른다 */
  override: Tuning | null
  buffer: AudioBuffer | null
  /** 쉼 없는 줄은 API가 준 mp3 그대로, 쉼이 있으면 이어붙인 WAV */
  file: { blob: Blob; ext: 'mp3' | 'wav' } | null
  state: 'idle' | 'busy' | 'done' | 'error'
  error?: string
}

/** 줄 사이 간격(초) — 붙여 들을 때 숨 쉴 자리 */
const GAP_SEC = 0.45

/**
 * 쉼 표기 — (0.3) 과 스튜디오식 <|0.3s|> 둘 다 받는다.
 * 스튜디오에서 쓰던 표기를 그대로 붙여넣어도 동작해야 한다.
 */
const PAUSE_RE = /\((\d+(?:\.\d+)?)\)|<\|(\d+(?:\.\d+)?)s\|>/g

/** 쉼 표기를 기준으로 문장과 무음을 번갈아 늘어놓는다 */
function splitPauses(text: string): Array<{ say: string } | { silence: number }> {
  const out: Array<{ say: string } | { silence: number }> = []
  let last = 0
  // exec 루프 — matchAll 이터레이터는 이 프로젝트의 tsconfig target에서 못 돈다
  const re = new RegExp(PAUSE_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim()
    if (before) out.push({ say: before })
    // m[1]은 (0.3) 형식, m[2]는 <|0.3s|> 형식
    out.push({ silence: Number(m[1] ?? m[2]) })
    last = m.index + m[0].length
  }
  const tail = text.slice(last).trim()
  if (tail) out.push({ say: tail })
  return out
}

/**
 * 조각 앞뒤의 무음을 깎는다.
 *
 * 쉼 표기로 문장을 끊으면 조각마다 제 나름의 앞뒤 여백이 붙어 나온다.
 * 그대로 이으면 2초를 요구했는데 3초가 쉬는 꼴이 된다(실측). 경계의
 * 무음을 깎아내야 표기한 값이 그대로 쉬는 시간이 된다.
 */
function trimEdges(buf: AudioBuffer, ac: AudioContext): AudioBuffer {
  const d = buf.getChannelData(0)
  let peak = 0
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]))
  const floor = Math.max(peak * 0.02, 0.002)

  let a = 0
  while (a < d.length && Math.abs(d[a]) < floor) a++
  let b = d.length
  while (b > a && Math.abs(d[b - 1]) < floor) b--
  if (b <= a) return buf

  // 말이 뚝 잘리지 않게 앞뒤로 20ms는 남긴다
  const pad = Math.floor(buf.sampleRate * 0.02)
  a = Math.max(0, a - pad)
  b = Math.min(d.length, b + pad)

  const out = ac.createBuffer(1, b - a, buf.sampleRate)
  out.getChannelData(0).set(d.subarray(a, b))
  return out
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  return `${m}:${(sec - m * 60).toFixed(1).padStart(4, '0')}`
}

/** 파일명에 쓸 수 있게 다듬는다 — 섞이지 않도록 설정값을 이름에 박는다 */
function safe(s: string): string {
  return s.replace(/[^\w.-]+/g, '').slice(0, 24)
}

function toWav(buf: AudioBuffer): Blob {
  const rate = buf.sampleRate
  const data = buf.getChannelData(0)
  const len = data.length * 2
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
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]))
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([ab], { type: 'audio/wav' })
}

/**
 * 개발 폴더에 바로 저장한다.
 *
 * 브라우저 내려받기를 쓰면 저장 대화상자가 떠서 사람이 눌러야 한다.
 * 한 줄 고칠 때마다 그러면 작업이 안 된다. 서버가 파일로 떨구고
 * 저장된 경로만 돌려받는다. 위치는 public/audio/_raw/bake/ 로,
 * gitignore 대상이라 작업물이 저장소에 섞이지 않는다.
 */
async function saveToRepo(blob: Blob, name: string): Promise<string> {
  const res = await fetch(`/api/debug/save?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    body: blob,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
  return `${j.saved} (${j.kb}KB)`
}

let nextId = 1

export default function ScriptBakePage() {
  // 재생은 Web Audio로 한다 — 이 환경의 <audio>는 blob: 소스를 거부한다
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  const cueIds = useMemo(
    () => (Object.keys(CUES) as CueId[]).filter((id) => CUES[id].subtitleLines.length),
    []
  )

  const [prefix, setPrefix] = useState('b0_tape')
  const [block, setBlock] = useState(
    CUES.B0_TAPE.subtitleLines.map((l) => l.text).join('\n')
  )
  const [voiceId, setVoiceId] = useState(CANDIDATES[0])
  const [base, setBase] = useState<Tuning>(BASE)
  const [rows, setRows] = useState<Row[]>([])
  const [metas, setMetas] = useState<Record<string, VoiceMeta>>({})
  const [playing, setPlaying] = useState<number | 'all' | null>(null)
  const [bakingAll, setBakingAll] = useState(false)
  /** 빈 칸이면 안 보낸다 — 그때는 매번 새로 뽑는다 */
  const [seed, setSeed] = useState('')
  /** 마지막 저장 결과 — 어디에 떨어졌는지 보여준다 */
  const [saved, setSaved] = useState<string | null>(null)

  const save = async (blob: Blob, name: string) => {
    try {
      setSaved(`저장 중… ${name}`)
      setSaved(`✅ ${await saveToRepo(blob, name)}`)
    } catch (e) {
      setSaved(`❌ ${e instanceof Error ? e.message : '저장 실패'}`)
    }
  }

  const meta = metas[voiceId]
  const emotions = meta?.emotions ?? ['normal']

  useEffect(() => {
    fetch(`/api/debug/voices?ids=${CANDIDATES.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { voices?: VoiceMeta[] } | null) => {
        if (j?.voices) setMetas(Object.fromEntries(j.voices.map((v) => [v.voiceId, v])))
      })
      .catch(() => {})
  }, [])

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

  /** 통 대본 → 줄. 빈 줄은 버린다 */
  const splitBlock = () => {
    stop()
    setRows(
      block
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({
          id: nextId++,
          text,
          override: null,
          buffer: null,
          file: null,
          state: 'idle' as const,
        }))
    )
  }

  /** 큐를 골라 대본 칸을 채운다 — 줄 나누기는 따로 눌러야 한다 */
  const loadCue = (id: CueId) => {
    setPrefix(CUES[id].audioFile)
    setBlock(CUES[id].subtitleLines.map((l) => l.text).join('\n'))
  }

  const patch = (id: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))

  /** 한 조각 굽기 — 쉼 표기 사이의 문장 하나 */
  const bakeSegment = async (
    text: string,
    t: Tuning,
    ctx?: { prev?: string; next?: string }
  ): Promise<ArrayBuffer> => {
    const res = await fetch('/api/debug/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voiceId,
        text,
        model: meta?.model,
        emotion: t.emotion,
        intensity: t.intensity,
        tempo: t.tempo,
        pitch: t.pitch,
        seed: seed.trim() === '' ? undefined : Number(seed),
        // 앞뒤 줄을 알려준다 — 따로 구운 줄의 억양이 끊기지 않도록
        previousText: ctx?.prev,
        nextText: ctx?.next,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(j.error ?? `HTTP ${res.status}`)
    }
    return res.arrayBuffer()
  }

  /** 한 줄 굽기 — 쉼이 있으면 조각으로 나눠 굽고 무음을 끼워 잇는다 */
  const bakeRow = async (id: number) => {
    const at = rows.findIndex((r) => r.id === id)
    const row = rows[at]
    if (!row?.text.trim()) return
    const t = row.override ?? base
    // 앞뒤 줄의 말 — 쉼 표기는 떼고 넘긴다
    const bare = (s?: string) => s?.replace(PAUSE_RE, ' ').replace(/\s+/g, ' ').trim()
    const ctx = { prev: bare(rows[at - 1]?.text), next: bare(rows[at + 1]?.text) }
    patch(id, { state: 'busy', error: undefined })

    try {
      const parts = splitPauses(row.text)
      const ac = audioContext()

      // 쉼이 없으면 API가 준 mp3를 그대로 보관한다 — 손대지 않은 원본이 낫다
      const onlySay = parts.length === 1 && 'say' in parts[0]
      if (onlySay) {
        const mp3 = await bakeSegment((parts[0] as { say: string }).say, t, ctx)
        const buf = await ac.decodeAudioData(mp3.slice(0))
        patch(id, {
          buffer: buf,
          file: { blob: new Blob([mp3], { type: 'audio/mpeg' }), ext: 'mp3' },
          state: 'done',
        })
        return
      }

      // 조각끼리도 앞뒤를 알려준다 — 쉼으로 끊긴 반쪽이 따로 노는 것을 막는다
      const says = parts.filter((p): p is { say: string } => 'say' in p).map((p) => p.say)
      let sayNo = 0
      const decoded: Array<{ buf: AudioBuffer } | { silence: number }> = []
      for (const p of parts) {
        if ('silence' in p) {
          decoded.push({ silence: p.silence })
        } else {
          const mp3 = await bakeSegment(p.say, t, {
            prev: says[sayNo - 1] ?? ctx.prev,
            next: says[sayNo + 1] ?? ctx.next,
          })
          sayNo++
          // 경계 무음을 깎아야 표기한 값이 그대로 쉬는 시간이 된다
          decoded.push({ buf: trimEdges(await ac.decodeAudioData(mp3.slice(0)), ac) })
        }
      }

      const first = decoded.find((d) => 'buf' in d) as { buf: AudioBuffer } | undefined
      if (!first) throw new Error('읽을 문장이 없습니다.')
      const rate = first.buf.sampleRate
      const total = decoded.reduce(
        (n, d) => n + ('buf' in d ? d.buf.length : Math.floor(rate * d.silence)),
        0
      )
      const merged = ac.createBuffer(1, total, rate)
      const out = merged.getChannelData(0)
      let at = 0
      for (const d of decoded) {
        if ('buf' in d) {
          out.set(d.buf.getChannelData(0), at)
          at += d.buf.length
        } else {
          at += Math.floor(rate * d.silence) // 무음은 0으로 두면 된다
        }
      }
      patch(id, {
        buffer: merged,
        file: { blob: toWav(merged), ext: 'wav' },
        state: 'done',
      })
    } catch (e) {
      patch(id, { state: 'error', error: e instanceof Error ? e.message : '실패' })
    }
  }

  /** 아직 안 구운 줄만 — 이미 마음에 든 줄을 날리지 않는다 */
  const bakeMissing = async () => {
    setBakingAll(true)
    for (const r of rows) {
      if (r.state !== 'done') await bakeRow(r.id)
    }
    setBakingAll(false)
  }

  /**
   * 저장 이름 — 어떤 줄을 어떤 설정으로 구운 것인지 이름만 봐도 알게 한다.
   * 여러 번 다시 구워 내려받아도 섞이지 않도록 시각을 뒤에 붙인다.
   */
  const fileName = (r: Row, no: number): string => {
    const t = r.override ?? base
    const v = safe(meta?.name ?? voiceId)
    const stamp = new Date()
      .toTimeString()
      .slice(0, 8)
      .replace(/:/g, '')
    return (
      `${safe(prefix)}_${String(no).padStart(2, '0')}_${v}_${t.emotion}` +
      `_i${t.intensity.toFixed(1)}_t${t.tempo.toFixed(2)}_p${t.pitch}` +
      `_${stamp}.${r.file!.ext}`
    )
  }

  const done = rows.filter((r) => r.state === 'done' && r.buffer)
  const allDone = rows.length > 0 && done.length === rows.length

  const timeline = useMemo(() => {
    let at = 0
    return rows.map((r) => {
      const start = at
      const dur = r.buffer?.duration ?? 0
      at += dur + GAP_SEC
      return { id: r.id, start, dur }
    })
  }, [rows])

  const totalSec = allDone
    ? timeline[timeline.length - 1].start + timeline[timeline.length - 1].dur
    : 0

  const mergedAll = (): AudioBuffer => {
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
    return merged
  }

  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[560px]">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          SCRIPT BAKE · 개발용
        </p>
        <h1 className="mt-1 font-display text-[22px] text-ink">대본 줄별 굽기</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          대본을 통째로 붙여넣고 <b className="text-ink">줄로 나누기</b>를 누르면
          엔터 기준으로 갈립니다. 그 뒤로는 줄마다 따로 굽고, 듣고, 저장합니다.
          한 줄만 다시 구워도 나머지는 그대로 남습니다.
        </p>

        {/* ── 대본 입력 ─────────────────────── */}
        <div className="card-paper mt-5 p-4">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[12px] font-bold text-ink">대본</label>
            <select
              onChange={(e) => e.target.value && loadCue(e.target.value as CueId)}
              defaultValue=""
              className="max-w-[58%] rounded-lg border border-line bg-cream-base px-2 py-1 text-[11px] text-ink"
            >
              <option value="">큐에서 불러오기…</option>
              {cueIds.map((id) => (
                <option key={id} value={id}>
                  {id} · {SPEAKER_NAMES[CUES[id].speaker]} ·{' '}
                  {CUES[id].subtitleLines.length}줄
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            rows={8}
            placeholder={'한 줄에 한 대사.\n엔터로 구분합니다.\n중간에 (0.3)을 넣으면 그만큼 쉽니다.'}
            className="mt-1.5 w-full resize-y rounded-lg border border-line bg-cream-base px-3 py-2 text-[12.5px] leading-relaxed text-ink"
          />

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[10.5px] leading-snug text-ink-60">
              쉼은 <b className="text-ink">(0.3)</b> 또는{' '}
              <b className="text-ink">&lt;|0.3s|&gt;</b> — 그 자리에서 문장을
              끊어 따로 굽고 정확히 그만큼 무음을 넣습니다.
            </p>
            <button
              onClick={splitBlock}
              className="shrink-0 rounded-lg bg-teal px-3 py-1.5 text-[11.5px] font-bold text-cream"
            >
              줄로 나누기
            </button>
          </div>

          {/* 저장 이름 앞머리 — 파일이 섞이지 않게 하는 첫 칸 */}
          <label className="mt-3 block text-[12px] font-bold text-ink">
            저장 이름 앞머리
          </label>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-cream-base px-3 py-2 font-mono-retro text-[12px] text-ink"
          />

          <label className="mt-3 block text-[12px] font-bold text-ink">
            seed
            <span className="ml-1.5 text-[10.5px] font-normal text-ink-60">
              비우면 매번 새로 뽑습니다
            </span>
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))}
              placeholder="예: 42"
              inputMode="numeric"
              className="flex-1 rounded-lg border border-line bg-cream-base px-3 py-2 font-mono-retro text-[12px] text-ink"
            />
            <button
              onClick={() => setSeed(String(Math.floor(Math.random() * 100000)))}
              className="shrink-0 rounded-lg border border-line bg-cream-base px-3 py-2 text-[11.5px] font-bold text-teal-dk"
            >
              🎲 뽑기
            </button>
          </div>
          <p className="mt-0.5 text-[10.5px] leading-snug text-ink-60">
            같은 seed면 편차가 크게 줄지만 <b className="text-ink">완전히 같지는
            않습니다</b> — seed 42로 5번 구웠더니 4.602초 셋, 5.227초 둘이었습니다.
            마음에 드는 것이 나오면 저장해 두세요.
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

          {/* 기본 설정 */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[12px] font-bold text-ink">
              기본 설정
              <span className="ml-1.5 text-[10.5px] font-normal text-ink-60">
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
        {rows.length > 0 && (
          <>
            <div className="mt-5 flex items-center justify-between">
              <h2 className="font-display text-[15px] text-ink">
                줄 {done.length} / {rows.length}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={bakeMissing}
                  disabled={bakingAll || allDone}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[11.5px] font-bold text-teal-dk disabled:opacity-40"
                >
                  {bakingAll ? '굽는 중…' : '안 구운 줄 전부'}
                </button>
                {done.length > 0 && (
                  <button
                    onClick={async () => {
                      for (const r of done) {
                        await save(
                          r.file!.blob,
                          fileName(r, rows.findIndex((x) => x.id === r.id) + 1)
                        )
                      }
                      setSaved(`✅ ${done.length}줄 저장 — public/audio/_raw/bake/`)
                    }}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[11.5px] font-bold text-teal-dk"
                  >
                    ⤓ 전부 저장
                  </button>
                )}
              </div>
            </div>

            {/* 저장 결과 — 대화상자 없이 어디에 떨어졌는지 알려준다 */}
            {saved && (
              <p className="mt-2 rounded-lg border border-line bg-paper px-3 py-2 font-mono-retro text-[10.5px] leading-snug text-ink-60">
                {saved}
              </p>
            )}

            <div className="mt-2 space-y-2">
              {rows.map((r, no) => {
                const t = r.override ?? base
                const tl = timeline[no]
                const pauses = splitPauses(r.text)
                  .filter((p): p is { silence: number } => 'silence' in p)
                  .map((p) => p.silence)
                return (
                  <div
                    key={r.id}
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
                        {String(no + 1).padStart(2, '0')}
                        {r.state === 'done' &&
                          ` · ${r.buffer!.duration.toFixed(2)}초 · ${fmt(tl.start)}부터`}
                        {pauses.length > 0 && ` · 쉼 ${pauses.join('/')}s`}
                      </span>
                      <button
                        onClick={() =>
                          patch(r.id, { override: r.override ? null : { ...base } })
                        }
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
                      onChange={(e) => patch(r.id, { text: e.target.value })}
                      rows={2}
                      className="mt-1.5 w-full resize-y rounded-lg border border-line bg-cream-base px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink"
                    />

                    {r.override && (
                      <div className="mt-2 rounded-lg border border-line bg-cream-base px-2.5 py-2">
                        <div className="flex flex-wrap gap-1">
                          {['smart', ...emotions].map((id) => (
                            <button
                              key={id}
                              onClick={() =>
                                patch(r.id, {
                                  override: { ...r.override!, emotion: id },
                                })
                              }
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
                                  patch(r.id, {
                                    override: {
                                      ...r.override!,
                                      [key]: Number(e.target.value),
                                    },
                                  })
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

                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => void bakeRow(r.id)}
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
                        <>
                          <button
                            onClick={() =>
                              playing === r.id ? stop() : playBuffer(r.buffer!, r.id)
                            }
                            className="flex-1 rounded-lg border border-line bg-cream-base px-2 py-1.5 text-[11.5px] font-bold text-teal-dk"
                          >
                            {playing === r.id ? '■ 멈추기' : '▶ 듣기'}
                          </button>
                          <button
                            onClick={() => void save(r.file!.blob, fileName(r, no + 1))}
                            title={fileName(r, no + 1)}
                            className="shrink-0 rounded-lg border border-line bg-cream-base px-2.5 py-1.5 text-[11.5px] font-bold text-teal-dk"
                          >
                            ⤓ 저장
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── 결과 ─────────────────────── */}
        {allDone && (
          <div className="card-paper mt-5 p-4">
            <p className="text-[12.5px] font-bold text-ink">
              전체 {fmt(totalSec)} ({totalSec.toFixed(1)}초)
            </p>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() =>
                  playing === 'all' ? stop() : playBuffer(mergedAll(), 'all')
                }
                className="flex-1 rounded-lg border border-line bg-cream-base px-3 py-2 text-[12px] font-bold text-teal-dk"
              >
                {playing === 'all' ? '■ 멈추기' : '▶ 이어서 듣기'}
              </button>
              <button
                onClick={() =>
                  void save(toWav(mergedAll()), `${safe(prefix)}_full.wav`)
                }
                className="flex-1 rounded-lg border border-line bg-cream-base px-3 py-2 text-[12px] font-bold text-teal-dk"
              >
                ⤓ {safe(prefix)}_full.wav
              </button>
            </div>

            <p className="mt-4 text-[12px] font-bold text-ink">자막 시작 시각</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink-60">
              줄 사이 {GAP_SEC}초 기준입니다. 큐의 durationSec은{' '}
              <b className="text-ink">{Math.ceil(totalSec)}</b>으로 두면 맞습니다.
            </p>
            <div className="mt-1.5 overflow-x-auto">
              <table className="w-full text-[11px] text-ink">
                <thead>
                  <tr className="text-ink-60">
                    <th className="py-1 text-left font-normal">줄</th>
                    <th className="py-1 text-right font-normal">시작</th>
                    <th className="py-1 text-right font-normal">길이</th>
                    <th className="py-1 pl-2 text-left font-normal">내용</th>
                  </tr>
                </thead>
                <tbody className="font-mono-retro">
                  {timeline.map((t, i) => (
                    <tr key={t.id} className="border-t border-line/60">
                      <td className="py-1">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-1 text-right">{t.start.toFixed(2)}</td>
                      <td className="py-1 text-right">{t.dur.toFixed(2)}</td>
                      <td className="max-w-[220px] truncate py-1 pl-2 font-sans">
                        {rows[i].text}
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
