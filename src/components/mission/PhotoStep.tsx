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
import { useRevealOnChange } from '@/hooks/useRevealOnChange'
import { savePhotoToDevice } from '@/lib/savePhoto'
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
  const confirmRef = useRevealOnChange<HTMLDivElement>(preview, Boolean(preview))
  const [saving, setSaving] = useState(false)
  /** 폰에 저장했는지 — 눌렀는지 알려줘야 또 누르지 않는다 */
  const [saved, setSaved] = useState(false)

  /** 방향 센서가 붙어 찍혔으면 AR, 아니면 정적 프레임 폴백(D11) */
  const [arActive, setArActive] = useState(false)

  const handleCapture = async (
    imageData: string,
    meta?: { arActive: boolean }
  ) => {
    setCameraOpen(false)
    setArActive(Boolean(meta?.arActive))
    setPreview(imageData)
  }

  const handleConfirm = async () => {
    if (!preview || saving) return
    setSaving(true)

    /*
      보내기 전에 폰에 남긴다.

      버튼을 둘로 두었더니 '저장'은 곁다리로 보여 대부분 그냥 지나쳤다.
      그러면 여행이 끝난 뒤 폰에 사진이 한 장도 없다 — 앱 데이터를 지우면
      통째로 사라지는데 그걸 알 방법이 없다.

      공유 시트는 사용자 조작 안에서만 열린다. setSaving 다음 줄에서
      바로 불러야 그 문맥이 남는다 — await를 먼저 하면 시트가 막힌다.

      시트를 닫아도(저장하지 않아도) 미션은 그대로 진행한다. 저장은
      권하는 것이지 관문이 아니다.
    */
    if (!saved) {
      const r = await savePhotoToDevice(preview, track)
      if (r === 'shared' || r === 'downloaded') setSaved(true)
    }

    const idbKey = `photo-t${track}-${Date.now()}`
    try {
      await putDataUrl(idbKey, preview)
      mutateTour((prev) => ({
        photos: [...prev.photos, { track, idbKey, takenAt: Date.now() }],
        ...(overlaySrc && !arActive ? { arFallbackUsed: true } : {}),
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
        /* 문자로 사진 보내는 화면과 같은 구조 — 첨부 썸네일이 입력창 위에
           얹히고, 오른쪽 원형 버튼으로 보낸다. 익숙한 동작이라 설명이 필요 없다. */
        <div className="mt-3">
          <div className="rounded-2xl border border-line bg-cream p-2.5">
            {/*
              오른쪽에 붙인다. 문자로 사진을 보낼 때 내가 붙인 첨부가
              오른쪽에 서는 것과 같다 — '내가 넣은 것'이라는 표시다.
            */}
            <div className="relative ml-auto w-[92px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="촬영한 사진"
                className="aspect-square w-full rounded-xl object-cover"
              />
              <button
                onClick={() => {
                  setPreview(null)
                  setCameraOpen(true)
                }}
                aria-label="사진 지우고 다시 찍기"
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-shell text-[13px] font-bold text-cream shadow"
              >
                ×
              </button>
            </div>

            <div ref={confirmRef} className="cta-band mt-2.5 flex items-end gap-2">
              <div className="min-h-[42px] flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-[13px] text-ink-60">
                사진 1장
              </div>
              <button
                onClick={handleConfirm}
                disabled={saving}
                aria-label="소영에게 사진 보내기"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-teal text-cream shadow-sm transition-transform active:scale-95 disabled:opacity-60"
              >
                {saving ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path
                      d="M3.4 20.4 21 12 3.4 3.6 3.4 10.2 15.5 12 3.4 13.8z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/*
            누르면 무슨 일이 일어나는지 미리 말한다. 공유 시트는 카톡·인스타가
            나열된 창이라, 예고 없이 뜨면 소영과 무관한 화면이 왜 나왔는지
            모른다. 한 줄 적어두면 그 창이 저장하는 자리임을 안다.
          */}
          <p className="mt-1.5 text-center text-[11px] leading-relaxed text-ink-60">
            소영에게 보내고, 내 폰에도 저장합니다
          </p>
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
