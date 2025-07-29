'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

interface Post {
  id: string
  authorName: string
  missionTitle: string
  imageUrl: string
  comment: string
  likes: number
  likedBy: string[]
  createdAt: Date
  rotation: number
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<'memories' | 'ranking'>('memories')
  const [posts, setPosts] = useState<Post[]>([])
  const [rankings, setRankings] = useState<any[]>([])
  const [completedMainMissions, setCompletedMainMissions] = useState(0)
  const [myRank, setMyRank] = useState({ rank: 0, score: 0, percentage: 0 })
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const router = useRouter()

  // Load data on component mount
  useEffect(() => {
    loadCommunityData()
    loadRankingData()
    
    const mainMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
    const mainCount = mainMissions.filter((id: string) => id.startsWith('main-')).length
    setCompletedMainMissions(mainCount)
  }, [])

  const loadCommunityData = () => {
    // Mock community posts data
    const mockPosts: Post[] = [
      {
        id: '1',
        authorName: '민수아빠',
        missionTitle: '첫 번째 기억: 달콤한 우유 한 잔의 추억',
        imageUrl: '/api/placeholder/200/150',
        comment: '아이와 함께 찾은 추억의 장소! 바나나맛 우유의 달콤함이 그대로 느껴지네요 🥛',
        likes: 12,
        likedBy: [],
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        rotation: -2
      },
      {
        id: '2',
        authorName: '봉황동토박이',
        missionTitle: '세 번째 기억: 낡은 LP판의 선율',
        imageUrl: '/api/placeholder/200/150',
        comment: '조용필의 "돌아와요 부산항에"가 흘러나오던 그 시절... 정말 감동적이었어요 🎵',
        likes: 8,
        likedBy: [],
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        rotation: 3
      },
      {
        id: '3',
        authorName: '역사탐험가',
        missionTitle: '네 번째 기억: 아빠의 첫 사진',
        imageUrl: '/api/placeholder/200/150',
        comment: '벽화마을에서 가족사진 찍기! 아이들이 너무 좋아했어요 📸',
        likes: 15,
        likedBy: [],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        rotation: 1
      },
      {
        id: '4',
        authorName: '추억여행자',
        missionTitle: '두 번째 기억: 마을의 이야기가 흐르던 우물',
        imageUrl: '/api/placeholder/200/150',
        comment: '할머니가 들려주신 옛날 이야기가 생각나는 곳이네요 🏺',
        likes: 6,
        likedBy: [],
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        rotation: -1
      }
    ]
    setPosts(mockPosts)
  }

  const loadRankingData = () => {
    // Mock ranking data
    const mockRankings = [
      { rank: 1, name: '봉황동마스터', score: 1250, badge: '👑' },
      { rank: 2, name: '메모리헌터', score: 1180, badge: '🥈' },
      { rank: 3, name: '문화탐험가', score: 1050, badge: '🥉' },
      { rank: 4, name: '역사학자', score: 920, badge: '🏆' },
      { rank: 5, name: '가족여행러', score: 850, badge: '⭐' },
      { rank: 6, name: '추억수집가', score: 780, badge: '💎' },
      { rank: 7, name: '봉황동러버', score: 720, badge: '🎯' },
      { rank: 8, name: '스토리텔러', score: 650, badge: '📚' },
      { rank: 9, name: '미션완주자', score: 580, badge: '🎮' },
      { rank: 10, name: '탐험대장', score: 520, badge: '🗺️' }
    ]
    setRankings(mockRankings)

    // Set my rank (mock data)
    const myScore = parseInt(localStorage.getItem('totalScore') || '0')
    const myRankData = {
      rank: 42,
      score: myScore,
      percentage: 25
    }
    setMyRank(myRankData)
  }

  const handleLike = (postId: string) => {
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? { ...post, likes: post.likes + 1 }
          : post
      )
    )
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return '방금 전'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`
    return `${Math.floor(diffInSeconds / 86400)}일 전`
  }

  const handlePostClick = (post: Post) => {
    setSelectedPost(post)
  }

  const handleClosePostModal = () => {
    setSelectedPost(null)
  }

  return (
    <div className="min-h-screen bg-vintage-paper pb-32">
      {/* Header */}
      <div className="bg-vintage-cream border-b-2 border-sepia-300 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="font-vintage text-xl text-vintage-brown text-center mb-4">
            👥 커뮤니티
          </h1>
          
          {/* Tab navigation */}
          <div className="flex bg-sepia-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('memories')}
              className={`flex-1 py-2 px-4 rounded-md font-handwriting text-base transition-all duration-200 ${
                activeTab === 'memories'
                  ? 'bg-vintage-brown text-white shadow-md'
                  : 'text-sepia-700 hover:bg-sepia-200'
              }`}
            >
              📸 우리들의 추억
            </button>
            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex-1 py-2 px-4 rounded-md font-handwriting text-base transition-all duration-200 ${
                activeTab === 'ranking'
                  ? 'bg-vintage-brown text-white shadow-md'
                  : 'text-sepia-700 hover:bg-sepia-200'
              }`}
            >
              🏆 명예의 전당
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {activeTab === 'memories' ? (
          <div>
            {/* Post instruction */}
            <div className="bg-vintage-cream rounded-lg p-4 mb-6 border-2 border-sepia-300">
              <h3 className="font-handwriting text-lg text-vintage-brown mb-2">
                📝 방명록 작성하기
              </h3>
              <p className="font-handwriting text-base text-sepia-700 mb-3">
                미션을 완료하면 자동으로 추억이 공유됩니다!
              </p>
              <button
                onClick={() => router.push('/exploration')}
                className="w-full py-2 bg-sepia-200 text-sepia-700 rounded-lg 
                         hover:bg-sepia-300 transition-colors duration-200 font-handwriting"
              >
                🗺️ 미션하러 가기
              </button>
            </div>

            {/* Posts grid */}
            <div className="space-y-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => handlePostClick(post)}
                  className="polaroid bg-white p-4 shadow-lg cursor-pointer 
                           hover:shadow-xl transition-all duration-300 hover:scale-105"
                  style={{ transform: `rotate(${post.rotation}deg)` }}
                >
                  {/* Photo */}
                  <div className="w-full h-40 bg-sepia-200 rounded mb-3 flex items-center justify-center">
                    <div className="text-sepia-500 text-center">
                      <div className="text-4xl mb-2">📸</div>
                      <div className="text-sm font-handwriting">미션 사진</div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-handwriting text-base font-bold text-vintage-brown">
                        {post.authorName}
                      </span>
                      <span className="text-xs text-sepia-500 font-handwriting">
                        {formatTimeAgo(post.createdAt)}
                      </span>
                    </div>
                    
                    <div className="text-xs bg-sepia-100 px-2 py-1 rounded text-sepia-600 font-handwriting">
                      {post.missionTitle.split(':')[0]}
                    </div>
                    
                    <p className="font-handwriting text-sm text-sepia-700 line-clamp-2">
                      {post.comment}
                    </p>
                    
                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLike(post.id)
                        }}
                        className="flex items-center space-x-1 text-red-500 hover:text-red-600 
                                 transition-colors duration-200"
                      >
                        <span>❤️</span>
                        <span className="text-sm font-handwriting">{post.likes}</span>
                      </button>
                      
                      <div className="text-xs text-sepia-500 font-handwriting">
                        💬 댓글 {Math.floor(Math.random() * 5)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* My rank */}
            <div className="bg-vintage-cream rounded-lg p-4 mb-6 border-2 border-vintage-gold">
              <h3 className="font-handwriting text-lg text-vintage-brown mb-3 text-center">
                📊 나의 순위
              </h3>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-vintage-gold mb-2">
                  #{myRank.rank}
                </div>
                <div className="font-handwriting text-base text-sepia-700 mb-2">
                  점수: {myRank.score}점
                </div>
                <div className="text-sm text-sepia-600 font-handwriting">
                  상위 {myRank.percentage}%
                </div>
              </div>
            </div>

            {/* Top 10 ranking */}
            <div className="bg-vintage-cream rounded-lg p-4 border-2 border-sepia-300">
              <h3 className="font-handwriting text-lg text-vintage-brown mb-4 text-center">
                🏆 TOP 10 랭킹
              </h3>
              
              <div className="space-y-3">
                {rankings.map((player) => (
                  <div
                    key={player.rank}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.rank <= 3
                        ? 'bg-gradient-to-r from-vintage-gold/20 to-vintage-gold/10 border border-vintage-gold'
                        : 'bg-white border border-sepia-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        player.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        player.rank === 2 ? 'bg-gray-300 text-gray-700' :
                        player.rank === 3 ? 'bg-orange-400 text-orange-900' :
                        'bg-sepia-200 text-sepia-700'
                      }`}>
                        {player.rank}
                      </div>
                      
                      <div>
                        <div className="font-handwriting text-base font-bold text-sepia-800">
                          {player.badge} {player.name}
                        </div>
                      </div>
                    </div>
                    
                    <div className="font-handwriting text-base font-bold text-vintage-gold">
                      {player.score.toLocaleString()}점
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking info */}
            <div className="mt-6 bg-blue-50 border border-blue-300 rounded-lg p-4">
              <h4 className="font-handwriting text-base text-blue-800 mb-2">
                💡 점수 획득 방법
              </h4>
              <div className="text-sm text-blue-700 font-handwriting space-y-1">
                <div>• 메인 미션 완료: 100점</div>
                <div>• 서브 미션 완료: 30점</div>
                <div>• 빙고 달성: 50점/줄</div>
                <div>• 방명록 작성: 10점</div>
                <div>• 좋아요 받기: 1점</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Post detail modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vintage-cream border-2 border-sepia-400 rounded-lg shadow-2xl max-w-sm w-full max-h-90vh overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-sepia-300">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-vintage-brown rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {selectedPost.authorName[0]}
                  </span>
                </div>
                <div>
                  <div className="font-handwriting text-base font-bold text-vintage-brown">
                    {selectedPost.authorName}
                  </div>
                  <div className="text-xs text-sepia-600 font-handwriting">
                    {formatTimeAgo(selectedPost.createdAt)}
                  </div>
                </div>
              </div>
              <button
                onClick={handleClosePostModal}
                className="w-8 h-8 rounded-full bg-sepia-200 hover:bg-sepia-300 
                         flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-sepia-700 font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Photo */}
              <div className="w-full h-48 bg-sepia-200 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-sepia-500 text-center">
                  <div className="text-6xl mb-2">📸</div>
                  <div className="text-sm font-handwriting">미션 완료 사진</div>
                </div>
              </div>

              {/* Mission info */}
              <div className="bg-sepia-100 rounded-lg p-3 mb-4">
                <div className="text-sm text-sepia-600 font-handwriting mb-1">미션:</div>
                <div className="font-handwriting text-base text-vintage-brown font-bold">
                  {selectedPost.missionTitle}
                </div>
              </div>

              {/* Comment */}
              <div className="mb-4">
                <p className="font-handwriting text-base text-sepia-700 leading-relaxed">
                  {selectedPost.comment}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-sepia-200">
                <button
                  onClick={() => handleLike(selectedPost.id)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg 
                           bg-red-50 hover:bg-red-100 transition-colors duration-200"
                >
                  <span>❤️</span>
                  <span className="font-handwriting text-base text-red-600">
                    좋아요 {selectedPost.likes}
                  </span>
                </button>

                <button className="flex items-center space-x-2 px-4 py-2 rounded-lg 
                                bg-blue-50 hover:bg-blue-100 transition-colors duration-200">
                  <span>💬</span>
                  <span className="font-handwriting text-base text-blue-600">
                    댓글 쓰기
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Navigation completedMainMissions={completedMainMissions} />
    </div>
  )
}