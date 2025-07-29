// User types
export interface User {
  uid: string
  nickname: string
  email: string
  provider: 'google' | 'anonymous'
  score: number
  completedMissions: string[]
  createdAt: Date
}

// Mission types
export interface Mission {
  missionId: string
  isMainMission: boolean
  title: string
  type: 'GPS' | 'QR' | 'PHOTO' | 'QUIZ' | 'AR'
  story: {
    intro: string
    outro: string
  }
  location: {
    lat: number
    lng: number
  }
  quiz?: {
    question: string
    answer: string
    options?: string[]
  }
  guidePhotoUrl?: string
  points: number
  order?: number
}

// Post types for community
export interface Post {
  postId: string
  authorUid: string
  authorNickname: string
  missionId: string
  imageUrl: string
  comment: string
  likes: number
  likedBy: string[]
  createdAt: Date
}

// Game state types
export interface GameState {
  currentMission?: string
  completedMissions: string[]
  totalScore: number
  isMainMissionsComplete: boolean
  unlockedTreasure: boolean
}

// Location types
export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}