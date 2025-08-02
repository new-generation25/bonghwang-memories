import { initializeApp, getApps } from 'firebase/app'
// import { getFirestore } from 'firebase/firestore' // Firestore 비활성화
// import { getAuth } from 'firebase/auth' // Authentication 비활성화
import { getStorage } from 'firebase/storage'

// Firebase 설정이 완전한지 확인하는 함수
const isFirebaseConfigComplete = () => {
  return (
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

// Firebase 설정이 완전한 경우에만 초기화
let app: any = null
let db: any = null // Firestore 비활성화
let auth: any = null // Authentication 비활성화
let storage: any = null

if (isFirebaseConfigComplete()) {
  try {
    // Initialize Firebase
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

    // Initialize Firebase services (Authentication, Firestore 제외)
    // db = getFirestore(app) // Firestore 비활성화
    // auth = getAuth(app) // Authentication 비활성화
    storage = getStorage(app)
    
    console.log('✅ Firebase가 성공적으로 초기화되었습니다. (Authentication, Firestore 비활성화)')
  } catch (error) {
    console.warn('⚠️ Firebase 초기화 중 오류가 발생했습니다:', error)
  }
} else {
  console.warn('⚠️ Firebase 환경 변수가 설정되지 않아 Firebase가 비활성화되었습니다.')
  console.log('필요한 환경 변수:')
  console.log('- NEXT_PUBLIC_FIREBASE_API_KEY')
  console.log('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
  console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  console.log('- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
  console.log('- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')
  console.log('- NEXT_PUBLIC_FIREBASE_APP_ID')
}

export { db, auth, storage }
export default app