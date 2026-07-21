'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { subMissions } from '@/lib/missions'
import Navigation from '@/components/Navigation'

export default function TreasurePage() {
  const [completedMainMissions, setCompletedMainMissions] = useState(0)
  const [completedSubMissions, setCompletedSubMissions] = useState<string[]>([])
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [bingoLines, setBingoLines] = useState(0)
  const router = useRouter()

  // Load progress from localStorage
  useEffect(() => {
    const mainMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
    const mainCount = mainMissions.filter((id: string) => id.startsWith('main-')).length
    setCompletedMainMissions(mainCount)
    // 테스트 모드에서는 항상 잠금 해제
    setIsUnlocked(true) // mainCount >= 5 대신 항상 true

    const subMissions = JSON.parse(localStorage.getItem('completedSubMissions') || '[]')
    setCompletedSubMissions(subMissions)
    
    // Calculate bingo lines
    calculateBingoLines(subMissions)
  }, [])

  // Calculate completed bingo lines
  const calculateBingoLines = (completed: string[]) => {
    // Mock bingo calculation - in real app, you'd have proper bingo logic
    const lines = Math.floor(completed.length / 5)
    setBingoLines(lines)
  }

  // Generate 5x5 bingo board with main mission mapping
  const generateBingoBoard = () => {
    const board = []
    
    // Main mission mapping to treasure items (diagonal line: 0,0 -> 1,1 -> 2,2 -> 3,3 -> 4,4)
    // 다섯 소원 = EP.1 5거점 (대각선 배치)
    const mainMissionMapping = {
      0: { id: 'main-1', title: '봉황1935', emoji: '💧', type: 'QR', isMainMission: true }, // ① 엄마와의 러브스토리
      6: { id: 'main-2', title: '미야상회', emoji: '🥛', type: 'PHOTO', isMainMission: true }, // ② 목욕탕 대신 바나나우유
      12: { id: 'main-3', title: '능소화 고택', emoji: '🌺', type: 'PHOTO', isMainMission: true }, // ③ 예쁜 사진 찍어주기
      18: { id: 'main-4', title: '카페 탱자', emoji: '📻', type: 'QUIZ', isMainMission: true }, // ④ 좋아하는 음악 함께 듣기
      24: { id: 'main-5', title: '방하림', emoji: '🎪', type: 'GPS', isMainMission: true }, // ⑤ 가족오락관 같이 나가기
    }
    
    // Regular treasure items for other positions
    const treasures = [
      { id: 'treasure-1', title: '전통 찻집', emoji: '🍵', type: 'PHOTO' },
      { id: 'treasure-2', title: '가야 스탬프', emoji: '🏺', type: 'QR' },
      { id: 'treasure-3', title: '고양이 벽화', emoji: '🐱', type: 'PHOTO' },
      { id: 'treasure-4', title: '골목길 탐험', emoji: '🗺️', type: 'GPS' },
      { id: 'treasure-5', title: '할머니 인터뷰', emoji: '👵', type: 'QUIZ' },
      { id: 'treasure-6', title: '옛날 상점', emoji: '🏪', type: 'PHOTO' },
      { id: 'treasure-7', title: '전통 음식점', emoji: '🍲', type: 'GPS' },
      { id: 'treasure-8', title: '봉황 전설', emoji: '🐉', type: 'QUIZ' },
      { id: 'treasure-9', title: '일몰 명소', emoji: '🌅', type: 'PHOTO' },
      { id: 'treasure-10', title: '축제 흔적', emoji: '🎪', type: 'GPS' },
      { id: 'treasure-11', title: '숨겨진 보석', emoji: '💍', type: 'QR' },
      { id: 'treasure-12', title: '오래된 나무', emoji: '🌳', type: 'PHOTO' },
      { id: 'treasure-13', title: '전통 공예품', emoji: '🎭', type: 'QR' },
      { id: 'treasure-14', title: '마을 이야기', emoji: '📚', type: 'QUIZ' },
      { id: 'treasure-15', title: '추억의 장소', emoji: '💭', type: 'GPS' },
      { id: 'treasure-16', title: '비밀 공간', emoji: '🔍', type: 'PHOTO' },
      { id: 'treasure-17', title: '시간 여행', emoji: '⏰', type: 'QR' },
      { id: 'treasure-18', title: '문화 유산', emoji: '🏛️', type: 'QUIZ' },
      { id: 'treasure-19', title: '자연 보물', emoji: '🌿', type: 'GPS' },
      { id: 'treasure-20', title: '마법의 순간', emoji: '✨', type: 'PHOTO' },
    ]

    let treasureIndex = 0
    
    for (let i = 0; i < 25; i++) {
      let treasureItem
      
      // Check if this position is mapped to a main mission
      if (mainMissionMapping[i]) {
        treasureItem = mainMissionMapping[i]
        // Check if main mission is completed
        const isCompleted = completedMainMissions >= (Object.keys(mainMissionMapping).indexOf(i.toString()) + 1)
        treasureItem.isCompleted = isCompleted
      } else {
        // Use regular treasure item
        treasureItem = treasures[treasureIndex % treasures.length]
        treasureIndex++
        // Check if sub mission is completed
        treasureItem.isCompleted = completedSubMissions.includes(treasureItem.id)
      }
      
      board.push({
        ...treasureItem,
        row: Math.floor(i / 5),
        col: i % 5,
        position: i
      })
    }

    return board
  }

  const bingoBoard = generateBingoBoard()

  interface TreasureCell {
    id: string
    title: string
    isCompleted: boolean
    isMainMission: boolean
  }

  const handleTreasureClick = (treasure: TreasureCell) => {
    if (treasure.isCompleted) {
      // Show completed treasure info
      alert(`이미 완료한 보물입니다: ${treasure.title}`)
      return
    }

    // Check if it's a main mission
    if (treasure.isMainMission) {
      // Navigate to main mission
      router.push(`/mission/${treasure.id}`)
    } else {
      // Navigate to sub mission (treasure hunt)
      router.push(`/mission/${treasure.id}`)
    }
  }

  // 테스트 모드에서는 잠금 화면을 보여주지 않음
  // if (!isUnlocked) {
  //   return (
  //     <div className="min-h-screen bg-cream-base pb-32">
  //       {/* Header */}
  //       <div className="bg-cream border-b-2 border-line shadow-lg">
  //         <div className="max-w-md mx-auto px-4 py-4 text-center">
  //           <h1 className="font-vintage text-xl text-teal-dk">
  //             🔒 숨겨진 보물들
  //           </h1>
  //         </div>
  //       </div>

  //       {/* Locked content */}
  //       <div className="max-w-md mx-auto px-4 py-12 text-center">
  //         <div className="bg-cream border-2 border-line rounded-lg p-8 shadow-lg">
  //           <div className="text-6xl mb-6">🔐</div>
            
  //           <h2 className="font-vintage text-2xl text-teal-dk mb-4">
  //             보물 지도가 잠겨있습니다
  //           </h2>
            
  //           <p className="font-handwriting text-lg text-ink mb-6 leading-relaxed">
  //             "아버지의 기억을 모두 모으면<br/>
  //             숨겨진 보물 지도가 나타납니다."
  //           </p>
            
  //           <div className="bg-cream p-4 rounded-lg mb-6">
  //             <p className="text-ink-60 font-handwriting">
  //               진행률: {completedMainMissions}/5
  //             </p>
  //             <div className="w-full bg-cream-dp rounded-full h-3 mt-2">
  //               <div 
  //                 className="bg-sunset h-3 rounded-full transition-all duration-500"
  //                 style={{ width: `${(completedMainMissions / 5) * 100}%` }}
  //               />
  //             </div>
  //           </div>
            
  //           <button
  //             onClick={() => router.push('/exploration')}
  //             className="vintage-button py-3 px-6 text-lg font-bold"
  //           >
  //             탐험 계속하기
  //           </button>
  //         </div>
  //       </div>

  //       <Navigation completedMainMissions={completedMainMissions} />
  //     </div>
  //   )
  // }

  const progressPct = Math.round((completedSubMissions.length / 25) * 100)

  return (
    <div className="min-h-screen bg-cream-base pb-32">
      {/* 앱바 — 티얼 구조색 */}
      <header className="appbar px-4 pt-3 pb-3">
        <div className="max-w-md mx-auto">
          <span className="appbar-badge">SIDE A · 봉황동 25 트랙</span>
          <h1 className="appbar-title mt-1 text-[19px]">트랙 리스트</h1>
        </div>
      </header>

      {/* 트랙바 — 수집 진행률 */}
      <div className="trackbar px-4 py-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between font-mono-retro text-[10px] text-sunset">
            <span>
              TRACK {completedSubMissions.length} / 25 · 빙고 {bingoLines}줄
            </span>
            <span className="rec-dot">REC</span>
          </div>
          <div className="tape-prog mt-2">
            <div className="reel spin">
              <span className="hub" />
            </div>
            <div className="bar">
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <div className="reel">
              <span className="hub" />
            </div>
          </div>
        </div>
      </div>

      {/* Bingo board */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="card-paper mb-6 p-3 shadow-lg">
          <div className="grid grid-cols-5 gap-1.5">
            {bingoBoard.map((treasure, index) => {
              // 메인 미션 = 다음 목표 트랙이면 옐로로 유도
              const isNext = !treasure.isCompleted && treasure.isMainMission
              return (
                <button
                  key={index}
                  onClick={() => handleTreasureClick(treasure)}
                  className={`bingo-cell flex flex-col items-center justify-center p-1 ${
                    treasure.isCompleted ? 'completed' : isNext ? 'next' : ''
                  }`}
                >
                  {treasure.isCompleted ? (
                    <>
                      <span className="text-base font-black">✓</span>
                      <span className="mt-0.5 font-mono-retro text-[7px] opacity-90">
                        REC
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">{treasure.emoji}</span>
                      <span className="mt-0.5 text-center text-[8px] font-bold leading-tight">
                        {treasure.title.split(' ')[0]}
                      </span>
                    </>
                  )}

                  {/* 트랙 번호 — 좌상단 */}
                  <span
                    className={`absolute left-0.5 top-0.5 font-mono-retro text-[6px] ${
                      treasure.isCompleted ? 'text-cream/70' : 'text-ink-60/70'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 범례 */}
        <div className="card-paper mb-6 p-4 shadow-lg">
          <h3 className="mb-3 font-vintage text-base font-black text-teal-dk">
            트랙 범례
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['📸', '사진 촬영'],
              ['🧩', '퀴즈'],
              ['📍', '위치 인증'],
              ['📱', 'QR 스캔'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span>{icon}</span>
                <span className="text-ink-60">{label}</span>
              </div>
            ))}
          </div>

          {/* 상태 색 규칙 */}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[10px] text-ink-60">
            <span className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded-sm bg-teal" /> 기록됨
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded-sm bg-sunset" /> 다음 트랙
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded-sm border border-line bg-paper" /> 미녹음
            </span>
          </div>

          <div className="story-card mt-3 px-3 py-2">
            <p className="text-[11px] text-ink-60">
              가로·세로·대각선으로 5개를 연속 녹음하면 빙고! 보너스 점수를 획득합니다.
            </p>
          </div>
        </div>

        {/* 현황 */}
        <div className="card-paper p-4 shadow-lg">
          <h3 className="mb-3 text-center font-vintage text-base font-black text-teal-dk">
            녹음 현황
          </h3>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { value: completedSubMissions.length, label: '기록한 트랙' },
              { value: bingoLines, label: '완성한 빙고' },
              {
                value: completedSubMissions.length * 30 + bingoLines * 50,
                label: '누적 점수',
              },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-black text-teal-dk">{stat.value}</div>
                <div className="text-[10px] text-ink-60">{stat.label}</div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center font-pen text-[17px] leading-snug text-ink">
            &ldquo;오늘의 골목은, 이제 우리의 이야기입니다&rdquo;
          </p>
        </div>
      </div>

      <Navigation completedMainMissions={completedMainMissions} />
    </div>
  )
}