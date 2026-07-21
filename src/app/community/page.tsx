'use client'

import { useState, useEffect, useCallback } from 'react'
import Navigation from '@/components/Navigation'
import AuthModal from '@/components/AuthModal'
import PostComposer from '@/components/PostComposer'
import PostCard from '@/components/PostCard'
import { fetchPosts, CommunityPost } from '@/lib/community'
import { useAuth } from '@/contexts/AuthContext'

export default function CommunityPage() {
  const { profile, loading: authLoading, available } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [completedMainMissions, setCompletedMainMissions] = useState(0)

  const loadPosts = useCallback(async () => {
    if (!available) {
      setLoading(false)
      return
    }
    try {
      setPosts(await fetchPosts())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [available])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  useEffect(() => {
    const missions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
    setCompletedMainMissions(missions.filter((id: string) => id.startsWith('main-')).length)
  }, [])

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      {/* 앱바 — 티얼 구조색 */}
      <header className="appbar px-4 pt-3 pb-3">
        <div className="max-w-md mx-auto">
          <span className="appbar-badge">BONGHWANG MEMORIES · 기록자들</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">우리의 기록</h1>
            {!authLoading &&
              (profile ? (
                <span className="shrink-0 pb-1 text-[11px] font-bold">
                  {profile.nickname} 기록자
                </span>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="shrink-0 rounded-full bg-cream/20 px-3 py-1 text-[11px] font-bold"
                >
                  로그인
                </button>
              ))}
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-5">
        {/* Firebase 미설정 안내 — 기능이 조용히 죽은 것처럼 보이지 않도록 */}
        {!available && (
          <div className="card-paper mb-5 border-rec p-4">
            <div className="font-mono-retro text-[9px] text-rec">SETUP REQUIRED</div>
            <h2 className="mt-1 font-vintage text-sm font-black text-teal-dk">
              커뮤니티가 아직 연결되지 않았습니다
            </h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-60">
              계정과 게시글을 저장할 Firebase 설정이 필요합니다. 프로젝트 루트에{' '}
              <code className="rounded bg-cream px-1 font-mono-retro text-[10px]">
                .env.local
              </code>{' '}
              파일을 만들고 6개의 환경 변수를 채우면 로그인·사진 업로드·댓글이 바로 동작합니다.
            </p>
          </div>
        )}

        {/* 작성 영역 — 로그인 상태에 따라 분기 */}
        {available &&
          (profile ? (
            <PostComposer onPosted={loadPosts} />
          ) : (
            <div className="card-paper mb-5 p-4 text-center">
              <p className="text-[12px] text-ink-60">
                로그인하면 사진과 후기를 남길 수 있어요
              </p>
              <button
                onClick={() => setShowAuth(true)}
                className="btn-teal mt-3 w-full py-2.5 text-[13px]"
              >
                ▶ 기록자로 로그인
              </button>
            </div>
          ))}

        {/* 목록 */}
        {loading ? (
          <div className="py-10 text-center">
            <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-teal border-t-transparent" />
            <p className="mt-3 text-[11px] text-ink-60">기록을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="card-paper p-4 text-center">
            <p className="text-[12px] font-bold text-rec">{error}</p>
            <button onClick={loadPosts} className="btn-outline mt-3 px-4 py-2 text-[12px]">
              다시 시도
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="card-paper p-8 text-center">
            <div className="text-3xl">📼</div>
            <p className="mt-3 font-pen text-[19px] text-ink">아직 녹음된 기록이 없습니다</p>
            <p className="mt-1 text-[11px] text-ink-60">첫 번째 기록자가 되어보세요</p>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onChanged={loadPosts}
                onRequireLogin={() => setShowAuth(true)}
              />
            ))}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          setShowAuth(false)
          loadPosts()
        }}
      />

      <Navigation completedMainMissions={completedMainMissions} />
    </div>
  )
}
