'use client'

/**
 * S21 — '나의 육십 초' 음성 메모 (M4, D12).
 *
 * ⚠️ 이건 아버지 테이프의 B면이 아니다. 앱 안에 남기는 별도 음성 메모다.
 * 카세트 플립 연출은 Track 5의 B면 편지(B5_LETTER) 전용으로 예약돼 있다(D12·§7).
 * 그래서 여기서는 카세트를 쓰지 않고 REC 메모 카드로 표현한다.
 *
 * 3택 (§7):
 *  [목소리로 남기기] — MediaRecorder ≤60초, 파형 시각화, 재녹음 무제한, 미리듣기
 *  [글로 남기기]     — 텍스트 입력
 *  [오늘의 마음만 담기] — 입력 없이 완료 (감정 강요 금지)
 *
 * 마이크 권한 거부 → 텍스트 입력으로 무중단 전환(안내 토스트 1회).
 * 저장은 IndexedDB 로컬 기본. "완주 테이프에 담아 보관할까요?" 체크
 * 동의 시에만 서버(Firebase Storage) 업로드. 셋 다 M4 완료 처리.
 */

import { useEffect, useRef, useState } from 'react'
import { submitOnCtrlEnter } from '@/lib/submitOnEnter'
import { putBlob } from '@/lib/blobStore'
import { dispatchAction } from '@/lib/cueEngine'
import { logEvent } from '@/lib/analytics'
import { auth, storage } from '@/lib/firebase'
import { BsideEntry, mutateTour } from '@/lib/tourState'

const MAX_SEC = 60

type Mode = 'choose' | 'voice' | 'text'

export default function RecorderBside() {
  const [mode, setMode] = useState<Mode>('choose')
  const [micDeniedToast, setMicDeniedToast] = useState(false)

  // 음성 상태
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // 텍스트 상태
  const [text, setText] = useState('')

  // 공통
  const [uploadConsent, setUploadConsent] = useState(false)
  const [saving, setSaving] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void audioCtxRef.current?.close().catch(() => {})
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** AnalyserNode 파형을 캔버스에 그린다 */
  const drawWave = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const data = new Uint8Array(analyser.frequencyBinCount)

    const loop = () => {
      analyser.getByteTimeDomainData(data)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#D93A2B'
      ctx.lineWidth = 2
      ctx.beginPath()
      const slice = canvas.width / data.length
      for (let i = 0; i < data.length; i++) {
        const y = (data[i] / 255) * canvas.height
        if (i === 0) ctx.moveTo(0, y)
        else ctx.lineTo(i * slice, y)
      }
      ctx.stroke()
      setElapsed((Date.now() - startedAtRef.current) / 1000)
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        setRecordedBlob(blob)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        cancelAnimationFrame(rafRef.current)
        stream.getTracks().forEach((t) => t.stop())
        void audioCtx.close().catch(() => {})
        setRecording(false)
      }

      setRecordedBlob(null)
      setElapsed(0)
      startedAtRef.current = Date.now()
      setRecording(true)
      setMode('voice')
      recorder.start()
      drawWave(analyser)

      // 60초 상한 (D12)
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, MAX_SEC * 1000)
    } catch {
      // 마이크 거부 → 텍스트 입력으로 무중단 전환 (토스트 1회)
      setMicDeniedToast(true)
      setMode('text')
      setTimeout(() => setMicDeniedToast(false), 4000)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  /** 완료 공통 처리 — 로컬 저장(기본) + 동의 시 업로드 + M4_done */
  const complete = async (entry: BsideEntry, blob?: Blob) => {
    if (saving) return
    setSaving(true)
    try {
      if (blob && entry.idbKey) {
        await putBlob(entry.idbKey, blob)
      }
      // 서버 업로드는 명시 동의 시에만 (D12).
      // 경로 첫 칸이 uid여야 storage.rules가 소유권을 판정할 수 있고,
      // 같은 밀리초에 녹음한 두 사람이 서로를 덮어쓰는 일도 막힌다.
      const uid = auth?.currentUser?.uid
      if (uploadConsent && blob && storage && uid) {
        try {
          const { ref, uploadBytes } = await import('firebase/storage')
          const ext = (blob.type.split('/')[1] ?? 'webm').split(';')[0]
          const path = `bside/${uid}/${Date.now()}-memo.${ext}`
          await uploadBytes(ref(storage, path), blob)
          entry = { ...entry, uploaded: true }
        } catch {
          // 업로드 실패는 로컬 저장만으로 진행 — 원본은 IndexedDB에 있다
        }
      }
      mutateTour({ bsideEntry: entry })
    } catch {
      mutateTour({ bsideEntry: entry })
    }
    logEvent('memo_type', { type: entry.type })
    if (entry.uploaded) logEvent('upload_consent')
    dispatchAction('M4_done')
  }

  const consentCheckbox = (
    <label className="mt-3 flex items-start gap-2 text-[12px] text-ink-60">
      <input
        type="checkbox"
        checked={uploadConsent}
        onChange={(e) => setUploadConsent(e.target.checked)}
        className="mt-0.5"
      />
      완주 테이프에 담아 보관할까요? (서버에 저장 — 동의하지 않아도 내 기기에는 남아요)
    </label>
  )

  return (
    <div
      className="mt-4 rounded-2xl border border-rec/50 bg-paper p-5 shadow-sm"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      {/* 음성 메모 카드 — 카세트 플립이 아니다(D12). REC 표시 + 남은 시간 */}
      <div style={{ animation: 'fadeIn 0.8s ease-in-out' }}>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 shrink-0 rounded-full bg-rec${
              recording ? ' rec-dot' : ''
            }`}
            aria-hidden
          />
          <p className="font-mono-retro text-[10px] tracking-widest text-rec">
            MEMO · 나의 육십 초
          </p>
          <span className="ml-auto font-mono-retro text-[11px] text-ink-60">
            {recording
              ? `${Math.floor(elapsed)} / ${MAX_SEC}s`
              : `최대 ${MAX_SEC}초`}
          </span>
        </div>
        <div className="tape-prog mt-2" aria-hidden>
          <i
            style={{
              width: `${recording ? Math.min(100, (elapsed / MAX_SEC) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {micDeniedToast && (
        <p className="mt-2 rounded-lg bg-shell/90 px-3 py-2 text-center text-[12px] text-cream">
          마이크를 사용할 수 없어 글로 남기기로 전환했어요
        </p>
      )}

      {mode === 'choose' && (
        // 세 선택지를 함께 고정한다 — '오늘의 마음만 담기'는 감정을 강요하지 않기
        // 위한 탈출구인데, 흐름 배치에서는 가장 아래라 제일 닿기 어려웠다.
        <div className="cta-band mt-4 space-y-2">
          <p className="text-center text-[13px] text-ink">
            마음에 떠오르는 사람에게, 한 트랙 남겨주세요
          </p>
          <button
            onClick={startRecording}
            className="w-full rounded-xl bg-rec py-3.5 font-display text-[15px] text-cream"
          >
            🎙 목소리로 남기기
          </button>
          <button
            onClick={() => setMode('text')}
            className="w-full rounded-xl border border-line bg-cream py-3.5 text-[14px] text-ink"
          >
            ✍️ 글로 남기기
          </button>
          <button
            onClick={() => complete({ type: 'heart_only', uploaded: false })}
            className="w-full rounded-xl border border-line bg-cream py-3.5 text-[14px] text-ink"
          >
            💛 오늘의 마음만 담기
          </button>
        </div>
      )}

      {mode === 'voice' && (
        <div className="mt-4">
          <canvas
            ref={canvasRef}
            width={320}
            height={64}
            className="w-full rounded-lg bg-shell/5"
          />
          <p className="mt-1 text-center font-mono-retro text-[11px] text-ink-60">
            {recording
              ? `● REC ${Math.floor(elapsed)}s / ${MAX_SEC}s`
              : recordedBlob
                ? '녹음 완료 — 들어보고 마음에 들면 담아주세요'
                : '준비되면 녹음을 시작하세요'}
          </p>

          {recording ? (
            <button
              onClick={stopRecording}
              className="mt-3 w-full rounded-xl bg-shell py-3.5 font-display text-[15px] text-cream"
            >
              ■ 녹음 끝내기
            </button>
          ) : recordedBlob ? (
            <div className="mt-3">
              {previewUrl && (
                <audio controls src={previewUrl} className="w-full" />
              )}
              {consentCheckbox}
              <div className="cta-band mt-3 flex gap-2">
                <button
                  onClick={startRecording}
                  className="flex-1 rounded-xl border border-line bg-cream py-3 text-[13px] text-ink"
                >
                  다시 녹음
                </button>
                <button
                  onClick={() =>
                    complete(
                      {
                        type: 'voice',
                        idbKey: 'bside-voice',
                        uploaded: false,
                      },
                      recordedBlob
                    )
                  }
                  disabled={saving}
                  className="flex-1 rounded-xl bg-teal py-3 font-display text-[14px] text-cream disabled:opacity-60"
                >
                  {saving ? '담는 중…' : '이 마음 담기 ▶'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {mode === 'text' && (
        <div className="mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={submitOnCtrlEnter(
              () => complete({ type: 'text', text: text.trim(), uploaded: false }),
              text.trim().length > 0 && !saving
            )}
            rows={5}
            placeholder="전하고 싶은 말을 적어주세요… (Ctrl+Enter로 완료)"
            className="w-full rounded-xl border border-line bg-cream px-4 py-3 font-pen text-[18px] leading-relaxed text-ink outline-none focus:border-teal"
          />
          {consentCheckbox}
          <div className="cta-band mt-3">
            <button
              onClick={() =>
                complete({ type: 'text', text: text.trim(), uploaded: false })
              }
              disabled={text.trim().length === 0 || saving}
              className={`w-full rounded-xl py-3.5 font-display text-[15px] ${
                text.trim().length > 0 && !saving
                  ? 'bg-teal text-cream'
                  : 'cursor-not-allowed bg-line text-ink-60'
              }`}
            >
              {saving ? '담는 중…' : '이 마음 담기 ▶'}
            </button>
          </div>
          <button
            onClick={() => setMode('choose')}
            className="mt-2 w-full text-[12px] text-ink-60 underline"
          >
            ← 다른 방법으로
          </button>
        </div>
      )}
    </div>
  )
}
