import { Mission } from './types'

export const mainMissions: Mission[] = [
  {
    missionId: 'main-1',
    isMainMission: true,
    title: '첫 번째 기억: 마을의 이야기가 흐르던 우물',
    type: 'QR',
    story: {
      intro: '이 편지를 쓰는 지금, 나의 기억은 하나둘 흐려져가고 있구나. 지금 내가 가지고 있는 기억은 어느 사이엔가 멈추어 버렸지만 너와 작은 손을 잡고 봉황동 골목길을 함께 거닐던 그 순간은 잊지 못할거야',
      outro: '아버지의 목소리가 그 시절의 정겨운 이야기를 들려주는구나.'
    },
    location: {
      lat: 35.229116,
      lng: 128.878596
    },
    points: 100,
    order: 1
  },
  {
    missionId: 'main-2',
    isMainMission: true,
    title: '두 번째 기억: 달콤한 우유 한 잔의 추억',
    type: 'PHOTO',
    story: {
      intro: '너를 보내고 난 후, 아빠는 줄곧 이 동네에 남아 매일 너와의 추억을 되새겼단다. 네가 떠난 후에도 발견한 특별한 것들이 있어. 우리가 함께 다니던 그 장소들에 숨어있던 이야기들과 네가 몰랐던 봉황동의 비밀들...',
      outro: '바나나맛 우유의 달콤함이 그때의 기억을 되살려주는구나.'
    },
    location: {
      lat: 35.228483,
      lng: 128.876678
    },
    quiz: {
      question: '아버지가 좋아했던 우유는?',
      answer: '바나나맛 우유',
      options: ['흰우유', '바나나맛 우유', '딸기맛 우유', '초콜릿 우유']
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
      intro: '아빠의 기억이 완전히 사라지기 전에, 너에게 보여주고 싶었던 것들이 있단다. 어른이 된 네 눈으로 다시 보면, 아빠가 왜 이곳을 떠나지 못했는지 알게 될 거야.',
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
      intro: '나의 기억의 마지막을 따라 다시 걸어보렴. 우리가 함께했던 소중한 순간들이 이곳에 남아있단다.',
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
      intro: '다시 돌아와줘서 고맙다, 사랑한다. 모든 기억을 따라 여기까지 왔구나. 진짜 보물은 숨겨져 있는 게 아니라, 함께 만드는 거란다.',
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