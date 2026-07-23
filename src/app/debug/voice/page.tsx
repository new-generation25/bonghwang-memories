'use client'

/**
 * 아버지 목소리 후보 듣기 · 미세조정 — 개발용.
 *
 * 왼쪽은 미리 구워둔 샘플(즉시 재생, 과금 없음), 오른쪽은 감정·강도·속도·
 * 피치를 바꿔 그 자리에서 다시 굽는 조정판이다. 굽기는 서버(/api/debug/tts)를
 * 거친다 — API 키를 브라우저에 실을 수 없기 때문이다.
 *
 * 한 배우가 젊은 아버지(1988년 녹음)와 늙은 아버지(B면 편지)를 모두
 * 소화해야 하므로 두 나이를 가로로 붙여 이어 듣게 했다. 젊은 쪽만 보고
 * 고르면 B5_LETTER에서 다른 사람이 된다.
 *
 * 미리 구운 음원은 public/audio/_raw/father/ 에 있고 gitignore 대상이다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface Candidate {
  no: number
  voiceId: string
}

const CANDIDATES: Candidate[] = [
  { no: 1, voiceId: 'tc_68257f68bc6e3c161ab5078d' },
  { no: 2, voiceId: 'tc_660e46188b5f4761eb8e36d6' },
  { no: 3, voiceId: 'tc_6583e016e1060e8bebe9a695' },
  { no: 4, voiceId: 'tc_657139d23be20e08b0e92bae' },
  { no: 5, voiceId: 'tc_6539f9a955c3de938ae20ed9' },
  { no: 6, voiceId: 'tc_645b3ef82c2f52f412ede389' },
  { no: 7, voiceId: 'tc_62ce545fb130717df10ea37a' },
]

type Age = 'young' | 'old'

const LINE: Record<Age, string> = {
  young:
    '…잘 돌아가나, 이거. 어험. 소영아. 아빠다. 곧 나온다더라. 이름은 정해놨다. 강소영. 아빠가 지었다. 이런 거 왜 하나 싶다마는. 아빠가 원래 말주변이 없다.',
  old: '소영아. 이 테이프 뒷면… 네가 찾았구나. 다섯 가지 소원, 다 이뤘니? 아빠는 요즘 자꾸 잊어버린다. 그래서 잊어버리기 전에, 여기다 해둔다. 미안하다. 사랑한다는 말, 너무 늦게 한다.',
}

/**
 * 감정 이름 → 한글 라벨.
 *
 * 어떤 감정을 쓸 수 있는지는 보이스마다 다르므로 목록 자체는 API가 준다
 * (/api/debug/voices). 여기 없는 이름이 와도 원문 그대로 보여준다.
 */
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

/**
 * 나이별 출발점. 늙은 아버지는 느리고 낮게, 젊은 아버지는 기본값에서 시작한다 —
 * 매번 슬라이더를 처음부터 맞추지 않아도 되도록.
 */
const PRESET: Record<Age, Tuning> = {
  young: { emotion: 'normal', intensity: 1, tempo: 1, pitch: 0 },
  // 후보들이 공통으로 지원하는 감정은 normal/happy/sad/angry뿐이라
  // 늙은 아버지의 회한은 sad에 속도·피치를 낮춰서 만든다
  old: { emotion: 'sad', intensity: 1.1, tempo: 0.88, pitch: -2 },
}

function sampleSrc(c: Candidate, age: Age): string {
  const n = String(c.no).padStart(2, '0')
  return `/audio/_raw/father/v${n}_${age}_${c.voiceId}.mp3`
}

/** 슬라이더 한 줄 */
function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  hint: string
}) {
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold text-ink">{label}</span>
        <span className="font-mono-retro text-[11px] text-teal">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
      <p className="mt-0.5 text-[10.5px] leading-snug text-ink-60">{hint}</p>
    </div>
  )
}

export default function VoiceLabPage() {
  /*
    재생은 <audio>가 아니라 Web Audio로 한다.
    구운 결과는 메모리에만 있어서 blob: URL로 넘겨야 하는데, 일부 브라우저
    (Claude 앱 내장 Electron 등)의 <audio>가 blob:·data: 소스를 거부한다
    — NotSupportedError가 나고 소리가 안 난다. 파일 자체는 멀쩡해서
    decodeAudioData로는 잘 열린다. 그래서 디코딩해서 직접 울린다.
    미리 구운 샘플도 같은 길로 보내 재생·정지 처리를 한 곳에 모은다.
  */
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  /** 한 번 디코딩한 것은 들고 있는다 — 다시 듣기가 즉시 나야 비교가 된다 */
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map())
  const urlRef = useRef<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  // 조정판 상태
  const [voiceId, setVoiceId] = useState(CANDIDATES[0].voiceId)
  const [age, setAge] = useState<Age>('young')
  const [tuning, setTuning] = useState<Tuning>(PRESET.young)
  const [text, setText] = useState(LINE.young)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  /** 방금 구운 것이 어떤 설정이었는지 — 슬라이더를 만지작거리면 금세 잊는다 */
  const [lastLabel, setLastLabel] = useState<string | null>(null)
  const [metas, setMetas] = useState<Record<string, VoiceMeta>>({})

  // 보이스별 지원 감정·모델을 받아온다 — 하드코딩하면 보이스를 바꿀 때마다 틀린다
  useEffect(() => {
    const ids = CANDIDATES.map((c) => c.voiceId).join(',')
    fetch(`/api/debug/voices?ids=${ids}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { voices?: VoiceMeta[] } | null) => {
        if (!j?.voices) return
        setMetas(Object.fromEntries(j.voices.map((v) => [v.voiceId, v])))
      })
      .catch(() => {
        /* 못 받아도 굽기는 된다 — 기본 감정으로 진행 */
      })
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

  /** 재생 중인 것을 멈춘다 — 겹쳐 나면 비교가 안 된다 */
  const stop = useCallback(() => {
    if (sourceRef.current) {
      // onended가 다시 setPlaying(null)을 부르지 않도록 먼저 끊는다
      sourceRef.current.onended = null
      try {
        sourceRef.current.stop()
      } catch {
        /* 이미 끝났으면 무시 */
      }
      sourceRef.current = null
    }
    setPlaying(null)
  }, [])

  useEffect(
    () => () => {
      sourceRef.current?.stop()
      void ctxRef.current?.close()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    []
  )

  const playBuffer = (buf: AudioBuffer, key: string) => {
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

  /** URL에서 받아 디코딩한 뒤 울린다. 두 번째부터는 캐시에서 바로 나간다 */
  const playFromUrl = async (url: string, key: string) => {
    const cached = cacheRef.current.get(key)
    if (cached) {
      playBuffer(cached, key)
      return
    }
    setError(null)
    try {
      const ac = audioContext()
      const ab = await (await fetch(url)).arrayBuffer()
      const buf = await ac.decodeAudioData(ab)
      cacheRef.current.set(key, buf)
      playBuffer(buf, key)
    } catch (e) {
      setError(e instanceof Error ? e.message : '재생 실패')
      setPlaying(null)
    }
  }

  const playSample = (c: Candidate, a: Age) => {
    const key = `${c.no}-${a}`
    if (playing === key) {
      stop()
      return
    }
    void playFromUrl(sampleSrc(c, a), key)
  }

  /** 나이를 바꾸면 대사와 출발 설정도 함께 바뀐다 */
  const switchAge = (next: Age) => {
    setAge(next)
    setText(LINE[next])
    setTuning(PRESET[next])
  }

  const synth = async () => {
    setBusy(true)
    setError(null)
    stop()
    try {
      const res = await fetch('/api/debug/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId,
          text,
          model: metas[voiceId]?.model,
          ...tuning,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const ab = await res.arrayBuffer()

      // 재생용 — 디코딩해서 Web Audio로 울린다
      const ac = audioContext()
      const buf = await ac.decodeAudioData(ab.slice(0))
      cacheRef.current.set('tuned', buf)

      // 내려받기용 — 이쪽은 blob: URL로 충분하다(디코딩을 거치지 않는다)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(new Blob([ab], { type: 'audio/mpeg' }))
      urlRef.current = url
      setLastUrl(url)
      setLastLabel(
        `${current ? `${current.no}번` : ''} · ${age === 'young' ? '젊은' : '늙은'} · ` +
          `${EMOTION_LABEL[tuning.emotion] ?? tuning.emotion} ` +
          `${tuning.intensity.toFixed(1)} · ${tuning.tempo.toFixed(2)}× · ` +
          `${tuning.pitch > 0 ? '+' : ''}${tuning.pitch} · ${buf.duration.toFixed(1)}초`
      )

      playBuffer(buf, 'tuned')
    } catch (e) {
      setError(e instanceof Error ? e.message : '합성 실패')
    } finally {
      setBusy(false)
    }
  }

  const current = CANDIDATES.find((c) => c.voiceId === voiceId)
  const meta = metas[voiceId]
  const emotions = meta?.emotions ?? ['normal']

  /**
   * 보이스를 바꿨는데 지금 감정을 그 보이스가 지원하지 않으면 422가 난다.
   * 조용히 normal로 되돌린다 — 굽기 버튼을 눌러야 알게 되면 늦다.
   */
  useEffect(() => {
    if (!meta) return
    if (!meta.emotions.includes(tuning.emotion)) {
      setTuning((t) => ({ ...t, emotion: 'normal' }))
    }
  }, [meta, tuning.emotion])

  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[460px]">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          VOICE LAB · 개발용
        </p>
        <h1 className="mt-1 font-display text-[22px] text-ink">
          아버지 목소리 고르기
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          위쪽은 미리 구워둔 후보 7명, 아래쪽은{' '}
          <b className="text-ink">감정·속도·피치를 바꿔 다시 굽는</b> 조정판입니다.
          한 사람이 젊은 아버지와 늙은 아버지를 다 소화해야 하니 가로로 이어서
          들어보세요.
        </p>

        {/* ── 후보 목록 ─────────────────────────── */}
        <h2 className="mt-6 font-display text-[15px] text-ink">
          후보 듣기
          <span className="ml-2 font-mono-retro text-[10px] font-normal text-ink-60">
            미리 구움 · 과금 없음
          </span>
        </h2>

        <div className="mt-3 space-y-2.5">
          {CANDIDATES.map((c) => (
            <div
              key={c.voiceId}
              className={`rounded-xl border px-4 py-3 ${
                voiceId === c.voiceId
                  ? 'border-teal bg-teal/8'
                  : 'border-line bg-paper'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-ink">
                  {c.no}번
                  {metas[c.voiceId] && (
                    <span className="ml-1.5 text-[12px] font-normal text-ink-60">
                      {metas[c.voiceId].name}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setVoiceId(c.voiceId)}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                    voiceId === c.voiceId
                      ? 'bg-teal text-cream'
                      : 'border border-line text-teal-dk'
                  }`}
                >
                  {voiceId === c.voiceId ? '조정 중' : '조정판으로'}
                </button>
              </div>
              <p className="mt-0.5 truncate font-mono-retro text-[9.5px] text-ink-60">
                {c.voiceId}
              </p>
              <div className="mt-2 flex gap-2">
                {(['young', 'old'] as Age[]).map((a) => {
                  const on = playing === `${c.no}-${a}`
                  return (
                    <button
                      key={a}
                      onClick={() => playSample(c, a)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-[12.5px] font-bold transition-colors ${
                        on
                          ? 'border-teal bg-teal text-cream'
                          : 'border-line bg-cream-base text-teal-dk'
                      }`}
                    >
                      {on ? '■ ' : '▶ '}
                      {a === 'young' ? '젊은 아버지' : '늙은 아버지'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── 미세조정 ─────────────────────────── */}
        <h2 className="mt-8 font-display text-[15px] text-ink">
          미세조정
          <span className="ml-2 font-mono-retro text-[10px] font-normal text-ink-60">
            누를 때마다 API 호출 · 과금
          </span>
        </h2>

        {/*
          비결정적이라는 사실은 반드시 알려야 한다. 자막은 오디오 타임라인에
          맞춰 넘어가므로, 마음에 안 든다고 한 줄만 다시 구우면 그 줄의 길이가
          달라져 뒤가 전부 밀린다. 실측: 같은 설정으로 3번 구웠더니
          4.375 / 4.432 / 4.830초로 10% 넘게 벌어졌다.
        */}
        <div className="mt-2 rounded-xl border border-retro-orange/40 bg-sunset-yellow/12 px-4 py-3">
          <p className="text-[11.5px] leading-relaxed text-ink">
            <b>같은 설정이라도 구울 때마다 결과가 다릅니다.</b> 같은 값으로 세 번
            구워보니 길이가 4.38 · 4.43 · 4.83초로 벌어졌습니다(10% 이상).
            <br />
            <span className="text-ink-60">
              그래서 마음에 드는 것이 나오면 <b className="text-ink">그 파일을
              보관</b>하세요. 나중에 같은 설정으로 다시 굽는다고 같은 소리가
              나오지 않습니다. 대사 한 줄만 다시 구우면 길이가 달라져 자막이
              밀립니다.
            </span>
          </p>
        </div>

        <div className="card-paper mt-3 p-4">
          <p className="text-[12.5px] font-bold text-ink">
            {current ? `${current.no}번` : ''}
            {meta ? ` · ${meta.name}` : ''}
          </p>
          <p className="font-mono-retro text-[10px] text-ink-60">
            {voiceId}
            {meta ? ` · ${meta.model}` : ''}
          </p>

          {/* 나이 — 대사와 출발 설정이 함께 바뀐다 */}
          <div className="mt-3 flex gap-2">
            {(['young', 'old'] as Age[]).map((a) => (
              <button
                key={a}
                onClick={() => switchAge(a)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-bold ${
                  age === a
                    ? 'border-teal bg-teal text-cream'
                    : 'border-line bg-cream-base text-teal-dk'
                }`}
              >
                {a === 'young' ? '젊은 아버지' : '늙은 아버지'}
              </button>
            ))}
          </div>

          {/* 감정 프리셋 */}
          <div className="mt-4">
            <span className="text-[12px] font-bold text-ink">감정</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {emotions.map((id) => (
                <button
                  key={id}
                  onClick={() => setTuning((t) => ({ ...t, emotion: id }))}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    tuning.emotion === id
                      ? 'bg-teal text-cream'
                      : 'border border-line bg-cream-base text-teal-dk'
                  }`}
                >
                  {EMOTION_LABEL[id] ?? id}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-ink-60">
              이 보이스가 지원하는 감정만 나옵니다 — 보이스마다 다릅니다.
              회한 같은 결은 <b className="text-ink">슬픔 + 느린 속도 + 낮은
              피치</b>로 만듭니다.
            </p>
          </div>

          <Slider
            label="감정 강도"
            value={tuning.intensity}
            min={0}
            max={2}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={(v) => setTuning((t) => ({ ...t, intensity: v }))}
            hint="0에 가까울수록 밋밋하고, 2에 가까울수록 과장된다. 아버지 대사는 1 안팎이 자연스럽다."
          />
          <Slider
            label="말 속도"
            value={tuning.tempo}
            min={0.5}
            max={2}
            step={0.02}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => setTuning((t) => ({ ...t, tempo: v }))}
            hint="늙은 아버지는 0.85~0.92가 나이를 만든다. 너무 낮추면 늘어져 들린다."
          />
          <Slider
            label="피치"
            value={tuning.pitch}
            min={-12}
            max={12}
            step={1}
            format={(v) => (v > 0 ? `+${v}` : String(v))}
            onChange={(v) => setTuning((t) => ({ ...t, pitch: v }))}
            hint="음을 통째로 올리고 내린다. -3을 넘기면 사람 목소리가 아닌 티가 난다."
          />

          {/* 대사 — 직접 고쳐서 다른 문장도 시험할 수 있다 */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-bold text-ink">대사</span>
              <span className="font-mono-retro text-[10px] text-ink-60">
                {text.length}자 / 600
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-line bg-cream-base px-3 py-2 text-[12.5px] leading-relaxed text-ink"
            />
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink-60">
              괄호 안 연기 지시는 읽지 않고 버립니다 — (쓸쓸하게) 같은 지문을
              그대로 둬도 됩니다.
            </p>
          </div>

          <button
            onClick={synth}
            disabled={busy || !text.trim()}
            className="btn-teal mt-4 w-full text-center disabled:opacity-50"
          >
            {busy ? '굽는 중…' : '🔊 이 설정으로 굽기 — 다 구우면 바로 들립니다'}
          </button>

          {error && (
            <p className="mt-2 rounded-lg bg-rec/10 px-3 py-2 text-[11.5px] leading-snug text-rec">
              {error}
            </p>
          )}

          {/*
            구운 결과 — 어떤 설정이었는지 함께 적는다. 슬라이더를 계속
            만지작거리다 보면 방금 들은 것이 어떤 값이었는지 잊는다.
          */}
          {lastUrl && !busy && (
            <div className="mt-3 rounded-lg border border-teal/40 bg-teal/8 px-3 py-2.5">
              <p className="font-mono-retro text-[10px] leading-snug text-teal-dk">
                구운 것 — {lastLabel}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    if (playing === 'tuned') {
                      stop()
                      return
                    }
                    const buf = cacheRef.current.get('tuned')
                    if (buf) playBuffer(buf, 'tuned')
                  }}
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-[12px] font-bold text-teal-dk"
                >
                  {playing === 'tuned' ? '■ 멈추기' : '▶ 다시 듣기'}
                </button>
                <a
                  href={lastUrl}
                  download={`father_${voiceId}_${age}_${tuning.emotion}.mp3`}
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-center text-[12px] font-bold text-teal-dk"
                >
                  ⤓ 내려받기
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="card-paper mt-6 p-4">
          <p className="text-[12px] leading-relaxed text-ink-60">
            고르실 때 기준 — 젊은 쪽은{' '}
            <b className="text-ink">쑥스러워하는 무뚝뚝함</b>(&lsquo;이런 거 왜
            하나 싶다마는&rsquo;), 늙은 쪽은{' '}
            <b className="text-ink">느리고 미안해하는 결</b>(&lsquo;너무 늦게
            한다&rsquo;)이 살아야 합니다.
            <br />
            번호와 설정값을 알려주시면 그대로 전체 대사를 굽겠습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
