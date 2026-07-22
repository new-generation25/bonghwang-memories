'use client'

/**
 * 소영의 친구들 — 소영을 도운 기록자들의 광장.
 *
 * 여정 공유(사진·B면 메시지) + 미션 포인트 랭킹 + 일시한정 보너스 미션.
 * Firebase 미설정이어도 죽지 않는다: 안내 카드 + 로컬 점수만 표시.
 */

import { useState, useEffect, useCallback } from 'react'
import Navigation from '@/components/Navigation'
import AuthModal from '@/components/AuthModal'
import PostComposer from '@/components/PostComposer'
import PostCard from '@/components/PostCard'
import { fetchPosts, CommunityPost } from '@/lib/community'
import { useAuth } from '@/contexts/AuthContext'
import { activeBonusMissions } from '@/lib/bonusMissions'
import { RankingEntry, fetchRankings, findMyRank } from '@/lib/rankings'
import { getLocalScore } from '@/lib/score'

export default function FriendsPage() {
  const { profile, loading: authLoading, available } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [rankings, setRankings] = useState<RankingEntry[]>([])
  const [myScore, setMyScore] = useState(0)

  const bonuses = activeBonusMissions()

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
    setMyScore(getLocalScore())
    if (available) {
      fetchRankings()
        .then(setRankings)
        .catch(() => setRankings([]))
    }
  }, [available])

  const myRank = findMyRank(rankings, profile?.uid ?? null)

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      {/* 앱바 — 티얼 구조색 */}
      <header className="appbar px-4 pb-3 pt-3">
        <div className="mx-auto max-w-md">
          <span className="appbar-badge">BONGHWANG 1988 · 함께 걸은 사람들</span>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="appbar-title text-[19px]">소영의 친구들</h1>
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

      <div className="mx-auto max-w-md px-4 py-5">
        {/* 일시한정 보너스 미션 */}
        {bonuses.length > 0 && (
          <div className="mb-5 space-y-2">
            {bonuses.map((bonus) => (
              <div
                key={bonus.id}
                className="card-paper flex items-center gap-3 border-sunset-yellow p-3"
              >
                <span className="text-[26px]">{bonus.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                    {bonus.title}
                    <span className="rounded bg-rec px-1.5 py-0.5 font-mono-retro text-[9px] text-cream">
                      한정
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink-60">
                    {bonus.description}
                  </p>
                </div>
                <span className="shrink-0 font-display text-[15px] text-teal">
                  +{bonus.points}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 랭킹 — 명예의 전당 */}
        <div className="card-paper mb-5 overflow-hidden shadow-lg">
          <div className="stripe-rule" />
          <div className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-vintage text-sm font-black text-teal-dk">
                🏆 기록자 랭킹
              </h2>
              <span className="font-mono-retro text-[10px] text-ink-60">
                내 점수 {myScore.toLocaleString()}점
                {myRank ? ` · ${myRank}위` : ''}
              </span>
            </div>

            {rankings.length === 0 ? (
              <p className="mt-3 text-center text-[12px] text-ink-60">
                {available
                  ? '아직 순위가 없어요 — 첫 기록자가 되어보세요'
                  : '온라인 랭킹은 연결 후 표시됩니다'}
              </p>
            ) : (
              <ol className="mt-3 space-y-1">
                {rankings.slice(0, 10).map((entry, i) => {
                  const isMe = profile?.uid === entry.userId
                  return (
                    <li
                      key={entry.userId}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                        isMe ? 'bg-sunset-yellow/20' : ''
                      }`}
                    >
                      <span
                        className={`w-6 text-center font-mono-retro text-[12px] ${
                          i < 3 ? 'text-rec' : 'text-ink-60'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {entry.nickname}
                        {isMe && ' (나)'}
                      </span>
                      <span className="font-mono-retro text-[12px] text-teal">
                        {entry.totalScore.toLocaleString()}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

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
                로그인하면 오늘의 여정을 친구들과 나눌 수 있어요
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

      <Navigation />
    </div>
  )
}
