import { Mission } from './types'

export const mainMissions: Mission[] = [
  {
    missionId: 'main-1',
    isMainMission: true,
    title: '첫 번째 기억: 달콤한 우유 한 잔의 추억',
    type: 'PHOTO',
    story: {
      intro: '세상의 때를 함께 씻어내던 그곳, 목욕 후 마셨던 시원한 우유 한 잔의 달콤함을 기억하니? 그 우유는 유난히 노란색이었지.',
      outro: '바나나맛 우유의 달콤함이 그때의 기억을 되살려주는구나.'
    },
    location: {
      lat: 35.229116,
      lng: 128.878596
    },
    quiz: {
      question: '아버지가 좋아했던 우유는?',
      answer: '바나나맛 우유',
      options: ['흰우유', '바나나맛 우유', '딸기맛 우유', '초콜릿 우유']
    },
    points: 100,
    order: 1
  },
  {
    missionId: 'main-2',
    isMainMission: true,
    title: '두 번째 기억: 마을의 이야기가 흐르던 우물',
    type: 'QR',
    story: {
      intro: '마을의 모든 소식이 모이던 곳. 그곳에서 길어 올린 건 차가운 물만이 아니었단다. 귀 기울이면 지금도 그 시절의 소리가 들릴지 몰라.',
      outro: '아버지의 목소리가 그 시절의 정겨운 이야기를 들려주는구나.'
    },
    location: {
      lat: 35.228483,
      lng: 128.876678
    },
    points: 100,
    order: 2
  },
  {
    missionId: 'main-3',
    isMainMission: true,
    title: '세 번째 기억: 낡은 LP판의 선율',
    type: 'QUIZ',
    story: {
      intro: '네가 태어나던 해, 아빠는 이곳에서 네 엄마에게 줄 LP판을 샀단다. 먼지가 쌓인 선율 속에도 우리의 시간이 담겨있지.',
      outro: '조용필의 LP판이 회전하며 그 시절의 선율을 들려주는구나.'
    },
    location: {
      lat: 35.229192,
      lng: 128.879290
    },
    quiz: {
      question: '1988년에 가장 유행했던 가수는?',
      answer: '조용필',
      options: ['조용필', '이문세', '변진섭', '신승훈']
    },
    points: 100,
    order: 3
  },
  {
    missionId: 'main-4',
    isMainMission: true,
    title: '네 번째 기억: 아빠의 첫 사진',
    type: 'PHOTO',
    story: {
      intro: '이 필름 카메라를 처음 샀던 날, 아빠는 이 골목에서 사진사가 되었단다. 저 벽화 앞에서 네 엄마의 가장 예쁜 모습을 담았지.',
      outro: '촬영된 사진이 흑백에서 컬러로 변하며 폴라로이드 사진처럼 인화되는구나.'
    },
    location: {
      lat: 35.229361,
      lng: 128.879839
    },
    guidePhotoUrl: '/images/guide-photo-4.jpg',
    points: 100,
    order: 4
  },
  {
    missionId: 'main-5',
    isMainMission: true,
    title: '마지막 기억: 우리의 유산',
    type: 'GPS',
    story: {
      intro: '모든 기억을 따라 여기까지 왔구나. 진짜 보물은 숨겨져 있는 게 아니라, 함께 만드는 거란다. 저 아래 우리가 함께한 시간을 보렴.',
      outro: '아버지의 목소리로 에필로그가 재생되며, 사용자가 미션 중 찍었던 사진들로 구성된 슬라이드 쇼가 나타난다.'
    },
    location: {
      lat: 35.229729,
      lng: 128.880246
    },
    points: 100,
    order: 5
  }
]

export const subMissions: Mission[] = [
  {
    missionId: 'sub-1',
    isMainMission: false,
    title: '봉황동에서 가장 오래된 이발소 간판 찾기',
    type: 'PHOTO',
    story: {
      intro: '세월의 흔적이 묻어있는 오래된 간판을 찾아보세요.',
      outro: '역사의 흔적을 발견했습니다!'
    },
    location: {
      lat: 35.2275,
      lng: 128.6805
    },
    points: 30
  },
  {
    missionId: 'sub-2',
    isMainMission: false,
    title: '봉황 1935의 비밀',
    type: 'QUIZ',
    story: {
      intro: '이 건물의 과거를 알고 계시나요?',
      outro: '정미소였던 그 시절의 이야기를 발견했습니다!'
    },
    location: {
      lat: 35.2280,
      lng: 128.6810
    },
    quiz: {
      question: '\'봉황 1935\'는 원래 어떤 건물이었을까요?',
      answer: '정미소',
      options: ['정미소', '방앗간', '대장간', '술집']
    },
    points: 30
  }
]