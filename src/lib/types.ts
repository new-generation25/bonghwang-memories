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

// Naver Map types — Map.tsx가 실제로 쓰는 API 표면만 선언한 얇은 심(shim)
export interface NaverMapWindow {
  naver: {
    maps: {
      Map: new (element: HTMLElement, options: NaverMapOptions) => NaverMap
      LatLng: new (lat: number, lng: number) => NaverLatLng
      Point: new (x: number, y: number) => NaverPoint
      Marker: new (options: NaverMarkerOptions) => NaverMarker
      InfoWindow: new (options: {
        content: string
        maxWidth?: number
        backgroundColor?: string
        borderColor?: string
        borderWidth?: number
        anchorSize?: unknown
        pixelOffset?: unknown
      }) => NaverInfoWindow
      Circle?: new (options: Record<string, unknown>) => { setMap: (m: NaverMap | null) => void }
      Event: {
        addListener: (
          target: NaverMarker | NaverMap,
          event: string,
          handler: () => void
        ) => void
      }
      MapTypeControlStyle: Record<string, unknown>
      ZoomControlStyle: Record<string, unknown>
      Position: Record<string, unknown>
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
  zoomControlOptions?: Record<string, unknown>
  mapTypeControl?: boolean
  mapTypeControlOptions?: Record<string, unknown>
  scaleControl?: boolean
  logoControl?: boolean
  mapDataControl?: boolean
}

export interface NaverLatLng {
  lat: () => number
  lng: () => number
}

export interface NaverPoint {
  x: number
  y: number
}

export interface NaverMarkerOptions {
  position: NaverLatLng
  map: NaverMap
  title?: string
  icon?: {
    content: string
    anchor?: NaverPoint
  }
}

export interface NaverMarker {
  setMap: (map: NaverMap | null) => void
}

export interface NaverInfoWindow {
  open: (map: NaverMap, marker: NaverMarker) => void
  close: () => void
  getMap: () => NaverMap | null
}

export interface NaverMap {
  setCenter: (latlng: NaverLatLng) => void
  setZoom: (zoom: number) => void
  getZoom: () => number
  panTo: (latlng: NaverLatLng) => void
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