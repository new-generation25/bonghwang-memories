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

// Naver Map types
export interface NaverMapWindow {
  naver: {
    maps: {
      Map: new (element: HTMLElement, options: NaverMapOptions) => NaverMap
      LatLng: new (lat: number, lng: number) => NaverLatLng
      Marker: new (options: NaverMarkerOptions) => NaverMarker
      Event: {
        addListener: (target: NaverMarker | NaverMap, event: string, handler: () => void) => void
      }
    }
  }
  naverMapLoaded?: boolean
  naverMapLoadError?: boolean
  naverMapLoading?: boolean
  loadNaverMapAPI?: () => void
}

export interface NaverMapOptions {
  center: NaverLatLng
  zoom: number
  zoomControl?: boolean
  mapTypeControl?: boolean
}

export interface NaverLatLng {
  lat: () => number
  lng: () => number
}

export interface NaverMarkerOptions {
  position: NaverLatLng
  map: NaverMap
  title?: string
  icon?: {
    content: string
  }
}

export interface NaverMarker {
  setMap: (map: NaverMap | null) => void
}

export interface NaverMap {
  setCenter: (latlng: NaverLatLng) => void
  setZoom: (zoom: number) => void
}

// Treasure types
export interface Treasure {
  id: string
  name: string
  description: string
  imageUrl: string
  unlocked: boolean
}

// Ranking types
export interface Ranking {
  rank: number
  userId: string
  nickname: string
  score: number
  completedMissions: number
}