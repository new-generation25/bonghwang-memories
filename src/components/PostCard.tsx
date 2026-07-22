'use client'

import { useState } from 'react'
import {
  CommunityPost,
  PostComment,
  toggleLike,
  updatePost,
  deletePost,
  fetchComments,
  addComment,
  deleteComment,
} from '@/lib/community'
import { useAuth } from '@/contexts/AuthContext'
import { submitOnCtrlEnter } from '@/lib/submitOnEnter'

interface PostCardProps {
  post: CommunityPost
  onChanged: () => void
  onRequireLogin: () => void
}

function formatTimeAgo(date: Date | null): string {
  if (!date) return '방금 전'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return '방금 전'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`
  return `${Math.floor(seconds / 86400)}일 전`
}

export default function PostCard({ post, onChanged, onRequireLogin }: PostCardProps) {
  const { profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.comment)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isMine = profile?.uid === post.authorUid
  const liked = profile ? post.likedBy.includes(profile.uid) : false

  const handleLike = async () => {
    if (!profile) return onRequireLogin()
    try {
      await toggleLike(post.id, profile.uid, liked)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  const handleSaveEdit = async () => {
    if (!profile || !draft.trim()) return
    setBusy(true)
    try {
      await updatePost(post.id, profile.uid, draft.trim())
      setEditing(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!profile) return
    if (!confirm('이 기록을 삭제할까요? 사진과 댓글도 함께 지워집니다.')) return

    setBusy(true)
    try {
      await deletePost(post.id, profile.uid)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      setBusy(false)
    }
  }

  const loadComments = async () => {
    try {
      setComments(await fetchComments(post.id))
    } catch {
      setError('댓글을 불러오지 못했습니다.')
    }
  }

  const handleToggleComments = async () => {
    const next = !showComments
    setShowComments(next)
    if (next) await loadComments()
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return onRequireLogin()
    if (!commentText.trim()) return

    setBusy(true)
    try {
      await addComment(post.id, profile.uid, profile.nickname, commentText.trim())
      setCommentText('')
      await loadComments()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 등록에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!profile) return
    try {
      await deleteComment(post.id, commentId, profile.uid)
      await loadComments()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 삭제에 실패했습니다.')
    }
  }

  return (
    <article className="card-paper overflow-hidden shadow-lg">
      {/* 헤더 — 기록자와 트랙 */}
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="font-mono-retro text-[9px] text-rec">
            {post.missionTitle || 'OUR RECORD'}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-black text-teal-dk">
            {post.authorNickname}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-ink-60">{formatTimeAgo(post.createdAt)}</div>
          {post.edited && <div className="text-[9px] text-ink-60">수정됨</div>}
        </div>
      </div>

      {/* 사진 */}
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt={`${post.authorNickname}님이 올린 기록 사진`}
          className="max-h-80 w-full object-cover"
        />
      )}

      {/* 본문 */}
      <div className="px-4 py-3">
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={submitOnCtrlEnter(handleSaveEdit, !busy)}
              rows={3}
              placeholder="Ctrl+Enter로 저장"
              className="w-full resize-none rounded-lg border border-line bg-cream px-3 py-2 text-[12px] outline-none focus:border-teal"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={busy}
                className="btn-teal flex-1 py-2 text-[12px] disabled:opacity-60"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setDraft(post.comment)
                }}
                className="btn-outline flex-1 py-2 text-[12px]"
              >
                취소
              </button>
            </div>
          </>
        ) : (
          <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink">
            {post.comment}
          </p>
        )}

        {error && (
          <p className="mt-2 rounded-lg bg-rec/10 px-3 py-2 text-[11px] font-bold text-rec">
            {error}
          </p>
        )}

        {/* 액션 */}
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-[12px] font-bold transition-colors ${
              liked ? 'text-rec' : 'text-ink-60 hover:text-rec'
            }`}
          >
            <span>{liked ? '♥' : '♡'}</span>
            <span>{post.likes}</span>
          </button>

          <button
            onClick={handleToggleComments}
            className="flex items-center gap-1.5 text-[12px] font-bold text-ink-60 hover:text-teal-dk"
          >
            <span>💬</span>
            <span>{post.commentCount}</span>
          </button>

          {isMine && !editing && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] font-bold text-teal-dk underline"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="text-[11px] font-bold text-rec underline disabled:opacity-60"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        {/* 댓글 */}
        {showComments && (
          <div className="mt-3 border-t border-line pt-3">
            {comments.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-ink-60">
                첫 댓글을 남겨보세요
              </p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-cream px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-black text-teal-dk">
                        {c.authorNickname}
                      </span>
                      <span className="shrink-0 text-[9px] text-ink-60">
                        {formatTimeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-ink">{c.text}</p>
                    {profile?.uid === c.authorUid && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="mt-1 text-[10px] text-rec underline"
                      >
                        삭제
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddComment} className="mt-2 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={profile ? '댓글 남기기' : '로그인 후 댓글을 남길 수 있어요'}
                className="flex-1 rounded-lg border border-line bg-cream px-3 py-2 text-[12px] outline-none focus:border-teal"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-teal shrink-0 px-4 py-2 text-[12px] disabled:opacity-60"
              >
                등록
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  )
}
