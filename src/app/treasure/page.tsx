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
    const mainMissionMapping = {
      0: { id: 'main-1', title: '마을의 우물', emoji: '🏺', type: 'QR', isMainMission: true }, // 첫 번째 기억
      6: { id: 'main-2', title: '오래된 목욕탕', emoji: '🛁', type: 'PHOTO', isMainMission: true }, // 두 번째 기억  
      12: { id: 'main-3', title: '보물 LP판', emoji: '💿', type: 'QUIZ', isMainMission: true }, // 세 번째 기억
      18: { id: 'main-4', title: '봉황동 벽화', emoji: '🎨', type: 'PHOTO', isMainMission: true }, // 네 번째 기억
      24: { id: 'main-5', title: '김수로왕릉', emoji: '👑', type: 'GPS', isMainMission: true }, // 마지막 기억
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

  const handleTreasureClick = (treasure: any) => {
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
  //     <div className="min-h-screen bg-vintage-paper pb-32">
  //       {/* Header */}
  //       <div className="bg-vintage-cream border-b-2 border-sepia-300 shadow-lg">
  //         <div className="max-w-md mx-auto px-4 py-4 text-center">
  //           <h1 className="font-vintage text-xl text-vintage-brown">
  //             🔒 숨겨진 보물들
  //           </h1>
  //         </div>
  //       </div>

  //       {/* Locked content */}
  //       <div className="max-w-md mx-auto px-4 py-12 text-center">
  //         <div className="bg-vintage-cream border-2 border-sepia-400 rounded-lg p-8 shadow-lg">
  //           <div className="text-6xl mb-6">🔐</div>
            
  //           <h2 className="font-vintage text-2xl text-vintage-brown mb-4">
  //             보물 지도가 잠겨있습니다
  //           </h2>
            
  //           <p className="font-handwriting text-lg text-sepia-700 mb-6 leading-relaxed">
  //             "아버지의 기억을 모두 모으면<br/>
  //             숨겨진 보물 지도가 나타납니다."
  //           </p>
            
  //           <div className="bg-sepia-100 p-4 rounded-lg mb-6">
  //             <p className="text-sepia-600 font-handwriting">
  //               진행률: {completedMainMissions}/5
  //             </p>
  //             <div className="w-full bg-sepia-200 rounded-full h-3 mt-2">
  //               <div 
  //                 className="bg-vintage-gold h-3 rounded-full transition-all duration-500"
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

  return (
    <div className="min-h-screen bg-vintage-paper pb-32">
      {/* Header */}
      <div className="bg-vintage-cream border-b-2 border-sepia-300 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="font-vintage text-xl text-vintage-brown text-center mb-2">
            💎 봉황동에 숨겨진 25개의 보물
          </h1>
          
          {/* Progress */}
          <div className="flex items-center justify-center space-x-4 text-sm">
            <span className="text-sepia-600">
              진행률: {completedSubMissions.length}/25
            </span>
            <span className="text-vintage-gold">
              빙고: {bingoLines}줄
            </span>
          </div>
        </div>
      </div>

      {/* Bingo board */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-vintage-cream rounded-lg p-4 shadow-lg mb-6">
          <div className="grid grid-cols-5 gap-2">
            {bingoBoard.map((treasure, index) => (
              <button
                key={index}
                onClick={() => handleTreasureClick(treasure)}
                className={`bingo-cell ${treasure.isCompleted ? 'completed' : ''} 
                          p-2 transition-all duration-300 hover:scale-105 flex flex-col justify-center items-center`}
              >
                <div className="text-xl">{treasure.emoji}</div>
                <div className="text-xs font-handwriting leading-tight text-center mt-1">
                  {treasure.title.split(' ')[0]}
                </div>
                
                {treasure.isCompleted && (
                  <div className="absolute inset-0 flex items-center justify-center 
                                bg-vintage-gold/80 rounded-lg">
                    <div className="bg-white rounded-full p-1">
                      <span className="text-vintage-gold font-bold text-sm">✓</span>
                    </div>
                  </div>
                )}
                
                {treasure.type === 'SPECIAL' && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 
                                rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">★</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg p-4 shadow-lg mb-6">
          <h3 className="font-handwriting text-lg text-vintage-brown mb-3">
            보물 지도 설명
          </h3>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span>📸</span>
              <span className="text-sepia-600">사진 촬영</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🧩</span>
              <span className="text-sepia-600">퀴즈</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>📍</span>
              <span className="text-sepia-600">위치 인증</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>📱</span>
              <span className="text-sepia-600">QR 스캔</span>
            </div>
          </div>
          
          <div className="mt-3 p-2 bg-vintage-gold/20 rounded border border-vintage-gold">
            <p className="text-xs font-handwriting text-vintage-brown">
              💡 가로, 세로, 대각선으로 5개를 연속으로 완료하면 빙고! 보너스 점수를 획득합니다.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-vintage-cream rounded-lg p-4 shadow-lg">
          <h3 className="font-handwriting text-lg text-vintage-brown mb-3 text-center">
            보물 탐험 현황
          </h3>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-vintage-gold">
                {completedSubMissions.length}
              </div>
              <div className="text-xs text-sepia-600 font-handwriting">
                발견한 보물
              </div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-sepia-700">
                {bingoLines}
              </div>
              <div className="text-xs text-sepia-600 font-handwriting">
                완성한 빙고
              </div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-green-600">
                {completedSubMissions.length * 30 + bingoLines * 50}
              </div>
              <div className="text-xs text-sepia-600 font-handwriting">
                보물 점수
              </div>
            </div>
          </div>
        </div>
      </div>

      <Navigation completedMainMissions={completedMainMissions} />
    </div>
  )
}