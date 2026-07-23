import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getAuth, Auth } from 'firebase/auth'
import { getStorage, FirebaseStorage } from 'firebase/storage'

// Firebase 설정이 완전한지 확인하는 함수
const isFirebaseConfigComplete = () => {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  )
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null
let storage: FirebaseStorage | null = null

if (isFirebaseConfigComplete()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

    db = getFirestore(app)
    auth = getAuth(app)
    storage = getStorage(app)
    /*
      업로드 재시도 상한 — 기본값은 2분이다.
      버킷이 없거나 네트워크가 막히면 SDK가 조용히 2분을 재시도하는 동안
      화면은 '기록 중…'에 멈춰 있고 사용자는 무엇이 잘못됐는지 알 수 없다.
      15초면 일시적인 끊김은 넘기면서 진짜 실패는 바로 드러난다.
    */
    storage.maxUploadRetryTime = 15000
    storage.maxOperationRetryTime = 15000

    console.log('✅ Firebase 초기화 완료 (Auth · Firestore · Storage)')
  } catch (error) {
    console.warn('⚠️ Firebase 초기화 중 오류가 발생했습니다:', error)
    app = null
    db = null
    auth = null
    storage = null
  }
} else {
  console.warn(
    '⚠️ Firebase 환경 변수가 없어 비활성화되었습니다. 계정·커뮤니티 기능은 동작하지 않습니다.'
  )
  console.log('필요한 환경 변수 (.env.local):')
  console.log('- NEXT_PUBLIC_FIREBASE_API_KEY')
  console.log('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
  console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  console.log('- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
  console.log('- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')
  console.log('- NEXT_PUBLIC_FIREBASE_APP_ID')
}

/** Firebase가 실제로 쓸 수 있는 상태인지 — UI에서 안내 문구 분기에 사용 */
export const isFirebaseReady = () => db !== null && auth !== null

export { db, auth, storage }
export default app
