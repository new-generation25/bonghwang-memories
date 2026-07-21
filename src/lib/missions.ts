/**
 * 구(舊) 미션 데이터 — EP.1 개편 후 축소판.
 *
 * 1막(다섯 소원)의 대본·진행은 cues.ts + tracks.ts가 정본이다.
 * 여기 mainMissions는 지도 마커(Map.tsx)와 구 라우트 호환을 위한
 * 파생 데이터일 뿐이며, 대사는 담지 않는다.
 * subMissions는 2막 빙고 셀 러너(/mission/[id])가 쓰는 자유 미션이다.
 */

import { Mission } from './types'
import { TRACK_STATIONS } from './tracks'

/** 지도 마커용 — tracks.ts에서 파생 (좌표·이름의 정본은 tracks.ts) */
export const mainMissions: Mission[] = TRACK_STATIONS.map((station) => ({
  missionId: `main-${station.track}`,
  isMainMission: true,
  title: `${station.wish} — ${station.name}`,
  type: 'QR', // 거점 진입은 전부 QR (D4)
  story: { intro: '', outro: '' },
  location: station.location ?? { lat: 0, lng: 0 },
  points: 100,
  order: station.track,
}))

/** 2막 빙고 자유 미션 — 셀 러너용 */
export const subMissions: Mission[] = [
  {
    missionId: 'sub-1',
    isMainMission: false,
    title: '소영이 매일 들르던 분식집',
    type: 'PHOTO',
    story: {
      intro: '여기 떡볶이 진짜 맛있어. 나 학교 끝나면 매일 왔어. 아직도 하시네, 신기하다.',
      outro: '맛있지? 다음에 오면 나랑 같이 먹자.',
    },
    location: { lat: 35.22905, lng: 128.87801 },
    points: 30,
  },
  {
    missionId: 'sub-2',
    isMainMission: false,
    title: '소영이 뛰어놀던 골목의 벽화',
    type: 'QUIZ',
    story: {
      intro: '이 골목에서 나 자전거 처음 배웠어. 여기서 넘어져서 무릎 다 까졌지.',
      outro: '맞아, 그 벽화야. 그때 그 골목이 아직 그대로라니.',
    },
    location: { lat: 35.22934, lng: 128.87952 },
    quiz: {
      question: '소영이 이 골목에서 처음 배운 것은?',
      answer: '자전거',
      options: ['줄넘기', '자전거', '인라인', '공기놀이'],
    },
    points: 30,
  },
]
