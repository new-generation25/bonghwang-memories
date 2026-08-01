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

/**
 * 예비 칸 — 판에 늘 놓이지는 않는다.
 *
 * 판은 스무 칸인데 후보를 스물다섯으로 둔다. 남는 다섯이 있어야 **오늘 문을
 * 닫은 가게의 칸을 대신 채울 수 있다**. 예비가 없으면 휴무 칸을 내리는 순간
 * 빈자리가 생기고, 그 줄은 아무도 채우지 못한다.
 *
 * 현장 모니터링에서 나온 보너스 거점 후보들이다(협의 전이라 이름만 세운다).
 */
export const SPARE_CELLS: BingoCell[] = [
  { id: 'aninjeongmiso', title: '안인정미소', emoji: '🌾' },
  { id: 'gayadaejanggan', title: '가야대장간', emoji: '🔨' },
  { id: 'naengjangseogo', title: '냉장서고', emoji: '📖' },
  { id: 'galnamu', title: '갈나무사진관', emoji: '📸' },
  { id: 'gongwonbanjeom', title: '공원반점', emoji: '🥢' },
]

/** 후보 전부 — 판에 놓일 수 있는 칸의 모집단 */
export const ALL_CELLS: BingoCell[] = [...BINGO_CELLS, ...SPARE_CELLS]

/** 판에 놓이는 2막 칸 수 — 25칸에서 대각선 다섯을 뺀 값 */
export const ACT2_SLOTS = 20

const cellById = new Map(ALL_CELLS.map((c) => [c.id, c]))

/** 아무것도 정해지지 않았을 때의 배치 — 지금까지와 같은 순서다 */
export function defaultLayout(): string[] {
  return BINGO_CELLS.map((c) => c.id)
}

/**
 * 판을 다시 깐다.
 *
 * **이미 연 칸은 그 자리에 그대로 둔다.** 채운 것이 움직이면 줄이 통째로
 * 흐트러지고, 그건 다시 까는 게 아니라 되돌리는 것이다.
 *
 * 닫힌 가게의 칸은 빼고 예비에서 채운다 — 다만 **이미 연 칸이면 빼지 않는다.**
 * 이미 한 일을 판에서 지우면 진행도가 거꾸로 간다.
 *
 * `rnd`를 받는 것은 시험 때문이다. 같은 값을 주면 같은 판이 나온다.
 */
export function reshuffleLayout(
  layout: string[],
  doneIds: string[],
  unavailableIds: string[] = [],
  rnd: () => number = Math.random
): string[] {
  const done = new Set(doneIds)
  const blocked = new Set(unavailableIds.filter((id) => !done.has(id)))

  // 채운 칸은 자리를 지킨다
  const kept = layout.map((id) => (done.has(id) ? id : null))

  // 남은 자리에 넣을 후보 — 이미 놓인 것과 막힌 것을 뺀다
  const pool = ALL_CELLS.map((c) => c.id).filter((id) => !done.has(id) && !blocked.has(id))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  let at = 0
  return kept.map((id) => id ?? pool[at++] ?? '')
    .filter((id) => id !== '')
}

/** 배치 → 판. 배치가 없으면 기본 순서로 본다 */
export function boardFromLayout(layout?: string[]): BoardCell[] {
  const ids = layout?.length === ACT2_SLOTS ? layout : defaultLayout()
  return buildBoardWith(ids)
}

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

/** 25칸 보드 구성 — 대각선 = 1막, 나머지에 주어진 배치를 순서대로 놓는다 */
function buildBoardWith(ids: string[]): BoardCell[] {
  const board: BoardCell[] = []
  let at = 0
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
      continue
    }
    const cell = cellById.get(ids[at++])
    if (!cell) continue
    board.push({
      position: i,
      kind: 'act2',
      id: cell.id,
      title: cell.title,
      emoji: cell.emoji,
      cueAction: cell.cueAction,
    })
  }
  return board
}

/** 기본 배치의 판 — 배치를 따로 들고 있지 않은 자리에서 쓴다 */
export function buildBoard(): BoardCell[] {
  return buildBoardWith(defaultLayout())
}

/** 완료 포지션 집합 → 완성 줄 수 */
export function countLines(donePositions: Set<number>): number {
  return BINGO_LINES.filter((line) => line.every((p) => donePositions.has(p)))
    .length
}

/**
 * 판에 놓인 2막 칸 수 — 진행도의 분모다.
 *
 * 후보가 스물다섯으로 늘었어도 **판은 늘 스무 칸**이다. 모집단을 분모로
 * 쓰면 '13 / 25'처럼 영영 못 채우는 숫자가 된다.
 */
export const ACT2_TOTAL = ACT2_SLOTS

/**
 * 채운 2막 칸 수.
 *
 * 배열 길이로 세지 않는다 — **지금 판에 있는 칸만** 센다. cellsDone는
 * 기기에 쌓이고 tourSync가 서버 기록과 합집합으로 병합하므로, 판에서 빠진
 * 칸의 id가 남아 있을 수 있다(B01~B20은 콘텐츠 시트가 오면 갈아끼울 자리다).
 * 그대로 세면 '23 / 20'처럼 분모를 넘고 진행 바가 100%를 넘어 삐져나온다.
 *
 * 세는 곳이 여럿이라 여기 한 번만 둔다 — 빙고판과 J-카드가 각자 세다가
 * 한쪽만 틀렸다.
 */
export function countAct2Done(cellsDone: string[], layout?: string[]): number {
  /*
    판이 사람마다 달라졌다(자리 바꾸기·휴무 제외). 그래서 지금 그 사람의
    배치를 기준으로 센다. 배치를 모르는 자리에서는 기본 배치로 본다.
  */
  const ids = new Set(layout?.length === ACT2_SLOTS ? layout : defaultLayout())
  return cellsDone.filter((id) => ids.has(id)).length
}
