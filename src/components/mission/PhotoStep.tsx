'use client'

/**
 * 사진 미션 공통 단계 — M1(인증샷)·M2(바나나우유)·M3(AR 폴백)·M5a(포스터).
 *
 * 기존 MissionCamera를 재사용한다(모바일 실카메라 · PC 목 촬영).
 * 촬영본은 IndexedDB(blobStore)에 로컬 저장 후 tourState.photos에 기록하고,
 * 지정된 액션을 큐 엔진에 발화한다. M3는 능소화 오버레이가 사진에 합성되며
 * ar_fallback_used를 기록한다(D11 — 정적 프레임 폴백이 기본 경로).
 */

import { useState } from 'react'
import MissionCamera from '@/components/MissionCamera'
import type { ActionId } from '@/lib/cues'
import { putDataUrl } from '@/lib/blobStore'
import { dispatchAction } from '@/lib/cueEngine'
import { mutateTour } from '@/lib/tourState'

interface PhotoStepProps {
  track: number
  actionId: ActionId
  missionLabel: string
  prompt: string
  /** M3 — AR 폴백 오버레이 이미지 */
  overlaySrc?: string
}

export default function PhotoStep({
  track,
  actionId,
  missionLabel,
  prompt,
  overlaySrc,
}: PhotoStepProps) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleCapture = async (imageData: string) => {
    setCameraOpen(false)
    setPreview(imageData)
  }

  const handleConfirm = async () => {
    if (!preview || saving) return
    setSaving(true)
    const idbKey = `photo-t${track}-${Date.now()}`
    try {
      await putDataUrl(idbKey, preview)
      mutateTour((prev) => ({
        photos: [...prev.photos, { track, idbKey, takenAt: Date.now() }],
        ...(overlaySrc ? { arFallbackUsed: true } : {}),
      }))
    } catch {
      // 저장 실패해도 진행은 막지 않는다 — 사진은 앨범 연출용
    }
    dispatchAction(actionId)
  }

  return (
    <div
      className="mt-4 rounded-2xl border border-sunset-yellow bg-paper p-5 shadow-sm"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <p className="font-mono-retro text-[10px] tracking-widest text-rec">
        {missionLabel}
      </p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink">{prompt}</p>

      {preview ? (
        <div className="mt-3">
          <div className="polaroid mx-auto max-w-[260px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="촬영한 사진" className="w-full" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setPreview(null)
                setCameraOpen(true)
              }}
              className="flex-1 rounded-xl border border-line bg-cream py-3 text-[13px] text-ink"
            >
              다시 찍기
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 rounded-xl bg-teal py-3 font-display text-[14px] text-cream disabled:opacity-60"
            >
              {saving ? '보내는 중…' : '소영에게 보내기 ▶'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCameraOpen(true)}
          className="mt-3 w-full rounded-xl bg-shell py-3.5 font-display text-[15px] text-cream"
        >
          📷 사진 찍기
        </button>
      )}

      {cameraOpen && (
        <MissionCamera
          onCapture={handleCapture}
          onClose={() => setCameraOpen(false)}
          overlaySrc={overlaySrc}
        />
      )}
    </div>
  )
}
