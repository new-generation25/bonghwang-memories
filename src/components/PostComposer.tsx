'use client'

import { useState, useRef, useEffect } from 'react'
import { createPost, validateImage } from '@/lib/community'
import { useAuth } from '@/contexts/AuthContext'
import { useTourState } from '@/hooks/useTourState'
import { getBlob } from '@/lib/blobStore'
import { submitOnCtrlEnter } from '@/lib/submitOnEnter'

interface PostComposerProps {
  onPosted: () => void
}

/**
 * 사진 업로드 사용 가능 여부.
 *
 * Cloud Storage는 Blaze(종량제) 요금제에서만 쓸 수 있는데 현재 프로젝트는 Spark다.
 * 이 상태로 사진을 첨부하면 업로드 단계에서 실패하면서 작성 중이던 글까지 날아가므로
 * 첨부 자체를 막아둔다. Storage를 활성화하면 이 값만 true로 바꾸면 된다.
 */
const PHOTO_UPLOAD_ENABLED = false

/** 후기 작성 — 사진 1장 + 본문. 사진은 선택 사항이다. */
export default function PostComposer({ onPosted }: PostComposerProps) {
  const { profile } = useAuth()
  const tour = useTourState()
  const [missionTitle, setMissionTitle] = useState('')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [journeyOpen, setJourneyOpen] = useState(false)
  const [journeyThumbs, setJourneyThumbs] = useState<
    { idbKey: string; track: number; url: string }[]
  >([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // 여정 사진 썸네일 로드 (IndexedDB) — 패널을 열 때 한 번만
  useEffect(() => {
    if (!journeyOpen || journeyThumbs.length > 0 || tour.photos.length === 0) return
    let disposed = false
    const urls: string[] = []
    ;(async () => {
      const loaded: { idbKey: string; track: number; url: string }[] = []
      for (const photo of tour.photos) {
        try {
          const blob = await getBlob(photo.idbKey)
          if (blob) {
            const url = URL.createObjectURL(blob)
            urls.push(url)
            loaded.push({ idbKey: photo.idbKey, track: photo.track, url })
          }
        } catch {
          /* 손상된 사진은 건너뛴다 */
        }
      }
      if (!disposed) setJourneyThumbs(loaded)
    })()
    return () => {
      disposed = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyOpen])

  /** 여정 사진을 첨부 파일로 변환 */
  const attachJourneyPhoto = async (idbKey: string, track: number) => {
    try {
      const blob = await getBlob(idbKey)
      if (!blob) return
      const picked = new File([blob], `track-${track}.jpg`, {
        type: blob.type || 'image/jpeg',
      })
      setError('')
      setFile(picked)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(picked))
      if (!missionTitle) setMissionTitle(`TRACK ${track} · 오늘의 기록`)
      setJourneyOpen(false)
    } catch {
      setError('여정 사진을 불러오지 못했어요.')
    }
  }

  /** B면 메시지를 본문에 붙여넣기 — 공유는 사용자의 명시적 선택(D12) */
  const attachBsideText = () => {
    if (tour.bsideEntry?.type !== 'text' || !tour.bsideEntry.text) return
    setComment((prev) =>
      prev
        ? `${prev}\n\n📼 B면에 남긴 말 — "${tour.bsideEntry?.text}"`
        : `📼 B면에 남긴 말 — "${tour.bsideEntry?.text}"`
    )
    setJourneyOpen(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return

    const imageError = validateImage(picked)
    if (imageError) {
      setError(imageError)
      return
    }

    setError('')
    setFile(picked)
    // 이전 미리보기 URL을 해제하지 않으면 메모리에 계속 남는다
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(picked))
  }

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    if (!comment.trim()) {
      setError('후기를 입력해주세요.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await createPost({
        uid: profile.uid,
        nickname: profile.nickname,
        missionTitle: missionTitle.trim() || '봉황동 골목에서',
        comment: comment.trim(),
        file,
      })

      setComment('')
      setMissionTitle('')
      clearImage()
      onPosted()
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="card-paper mb-6 overflow-hidden shadow-lg"
    >
      <div className="stripe-band" />

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono-retro text-[9px] text-rec">REC ●</span>
          <h3 className="font-vintage text-sm font-black text-teal-dk">오늘의 기록 남기기</h3>
        </div>

        <input
          type="text"
          value={missionTitle}
          onChange={(e) => setMissionTitle(e.target.value)}
          placeholder="어느 트랙이었나요? (예: TRACK 08 · 서부커피)"
          className="mb-2 w-full rounded-lg border border-line bg-cream px-3 py-2 text-[12px] outline-none focus:border-teal"
        />

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={submitOnCtrlEnter(() => formRef.current?.requestSubmit())}
          placeholder="함께한 사람, 골목에서 발견한 것, 기억하고 싶은 순간을 적어주세요 (Ctrl+Enter로 올리기)"
          rows={3}
          className="w-full resize-none rounded-lg border border-line bg-cream px-3 py-2 text-[12px] leading-relaxed outline-none focus:border-teal"
        />

        {/* 사진 미리보기 */}
        {previewUrl && (
          <div className="relative mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="첨부한 사진 미리보기"
              className="max-h-56 w-full rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute right-2 top-2 rounded-full bg-shell/80 px-2.5 py-1 text-[10px] font-bold text-cream"
            >
              사진 빼기
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && (
          <p className="mt-2 rounded-lg bg-rec/10 px-3 py-2 text-[11px] font-bold text-rec">
            {error}
          </p>
        )}

        {/* 여정에서 가져오기 — 투어 산출물 공유 */}
        {(tour.photos.length > 0 || tour.bsideEntry?.type === 'text') && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setJourneyOpen((v) => !v)}
              className="w-full rounded-lg border border-teal/40 bg-teal/5 py-2 text-[12px] font-bold text-teal-dk"
            >
              📼 오늘의 여정에서 가져오기 {journeyOpen ? '▲' : '▼'}
            </button>

            {journeyOpen && (
              <div className="mt-2 rounded-lg border border-line bg-cream p-3">
                {tour.bsideEntry?.type === 'text' && tour.bsideEntry.text && (
                  <button
                    type="button"
                    onClick={attachBsideText}
                    className="mb-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-left"
                  >
                    <span className="font-mono-retro text-[9px] text-rec">SIDE B</span>
                    <p className="truncate font-pen text-[16px] text-ink">
                      &ldquo;{tour.bsideEntry.text}&rdquo;
                    </p>
                    <span className="text-[10px] text-ink-60">본문에 붙여넣기</span>
                  </button>
                )}

                {tour.photos.length > 0 &&
                  (PHOTO_UPLOAD_ENABLED ? (
                    <div className="grid grid-cols-3 gap-2">
                      {journeyThumbs.map((thumb) => (
                        <button
                          key={thumb.idbKey}
                          type="button"
                          onClick={() => attachJourneyPhoto(thumb.idbKey, thumb.track)}
                          className="overflow-hidden rounded-lg border border-line"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumb.url}
                            alt={`트랙 ${thumb.track} 사진`}
                            className="h-16 w-full object-cover"
                          />
                          <span className="block bg-paper py-0.5 text-center font-mono-retro text-[8px] text-ink-60">
                            T{thumb.track}
                          </span>
                        </button>
                      ))}
                      {journeyThumbs.length === 0 && (
                        <p className="col-span-3 py-2 text-center text-[11px] text-ink-60">
                          사진을 불러오는 중…
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-[11px] text-ink-60">
                      여정 사진 공유는 사진 업로드가 열리면 함께 열려요
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {PHOTO_UPLOAD_ENABLED ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-outline flex-1 py-2.5 text-[12px]"
            >
              📸 사진 첨부
            </button>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-2 py-2.5 text-center text-[11px] text-ink-60">
              📸 사진은 준비 중이에요
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-rec flex-1 py-2.5 text-[12px] disabled:opacity-60"
          >
            {busy ? '기록 중...' : '● 기록하기'}
          </button>
        </div>
      </div>
    </form>
  )
}
