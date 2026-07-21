/**
 * 2막 빙고 셀 정의 (B01~B20).
 *
 * 콘텐츠 시트는 별도 전달 예정(§8) — 지금은 3개 셀만 소영의 큐(C6_x)가
 * 연결된 실콘텐츠이고 나머지는 자리 표시 콘텐츠다. 시트가 오면 이 파일만
 * 갈아끼우면 된다.
 *
 * 5×5 보드에서 대각선(0·6·12·18·24)은 1막 다섯 소원 자리이고,
 * 나머지 20칸에 B01~B20이 순서대로 놓인다.
 */

import type { ActionId } from './cues'

export interface BingoCell {
  id: string
  title: string
  emoji: string
  /** 소영의 큐가 연결된 셀은 완료 시 이 액션을 발화한다 */
  cueAction?: ActionId
}

export const BINGO_CELLS: BingoCell[] = [
  { id: 'bunsik', title: '분식점', emoji: '🍢', cueAction: 'bingo_cell_done:bunsik' },
  { id: 'b02', title: '가야 스탬프', emoji: '🏺' },
  { id: 'byeokhwa', title: '벽화골목', emoji: '🎨', cueAction: 'bingo_cell_done:byeokhwa' },
  { id: 'b04', title: '골목길 탐험', emoji: '🗺️' },
  { id: 'b05', title: '전통 찻집', emoji: '🍵' },
  { id: 'b06', title: '옛날 상점', emoji: '🏪' },
  { id: 'bonghwangdae', title: '봉황대', emoji: '⛰️', cueAction: 'bingo_cell_done:bonghwangdae' },
  { id: 'b08', title: '봉황 전설', emoji: '🐉' },
  { id: 'b09', title: '일몰 명소', emoji: '🌅' },
  { id: 'b10', title: '축제 흔적', emoji: '🎪' },
  { id: 'b11', title: '숨겨진 우물', emoji: '💧' },
  { id: 'b12', title: '오래된 나무', emoji: '🌳' },
  { id: 'b13', title: '전통 공예', emoji: '🎭' },
  { id: 'b14', title: '마을 이야기', emoji: '📚' },
  { id: 'b15', title: '추억의 장소', emoji: '💭' },
  { id: 'b16', title: '비밀 공간', emoji: '🔍' },
  { id: 'b17', title: '시간 여행', emoji: '⏰' },
  { id: 'b18', title: '골목 사진관', emoji: '📷' },
  { id: 'b19', title: '자연 보물', emoji: '🌿' },
  { id: 'b20', title: '마지막 골목', emoji: '✨' },
]

/** 대각선 — 1막 다섯 소원 자리 */
export const MAIN_DIAGONAL: Record<number, { track: number; title: string; emoji: string }> = {
  0: { track: 1, title: '봉황1935', emoji: '💧' },
  6: { track: 2, title: '미야상회', emoji: '🥛' },
  12: { track: 3, title: '능소화 고택', emoji: '🌺' },
  18: { track: 4, title: '카페 탱자', emoji: '📻' },
  24: { track: 5, title: '방하림', emoji: '🎪' },
}

/** 빙고 판정용 12줄 (행 5 + 열 5 + 대각 2) */
export const BINGO_LINES: number[][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
]

export interface BoardCell {
  position: number
  kind: 'main' | 'act2'
  id: string
  title: string
  emoji: string
  cueAction?: ActionId
  track?: number
}

/** 25칸 보드 구성 — 대각선 = 1막, 나머지 = B01~B20 순서대로 */
export function buildBoard(): BoardCell[] {
  const board: BoardCell[] = []
  let cellIndex = 0
  for (let i = 0; i < 25; i++) {
    const main = MAIN_DIAGONAL[i]
    if (main) {
      board.push({
        position: i,
        kind: 'main',
        id: `main-${main.track}`,
        title: main.title,
        emoji: main.emoji,
        track: main.track,
      })
    } else {
      const cell = BINGO_CELLS[cellIndex++]
      board.push({
        position: i,
        kind: 'act2',
        id: cell.id,
        title: cell.title,
        emoji: cell.emoji,
        cueAction: cell.cueAction,
      })
    }
  }
  return board
}

/** 완료 포지션 집합 → 완성 줄 수 */
export function countLines(donePositions: Set<number>): number {
  return BINGO_LINES.filter((line) => line.every((p) => donePositions.has(p)))
    .length
}
