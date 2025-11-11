import { db } from './firebase'
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment,
  serverTimestamp,
  arrayUnion,
  Timestamp
} from 'firebase/firestore'

export interface UserData {
  userId: string
  nickname: string
  completedMissions: string[]
  totalScore: number
  createdAt: Timestamp | null
  lastUpdated: Timestamp | null
}

// Firebase가 사용 가능한지 확인
const isFirebaseAvailable = () => {
  return db !== null
}

// 사용자 데이터 생성/업데이트
export async function createOrUpdateUser(userId: string, nickname: string): Promise<void> {
  try {
    if (!isFirebaseAvailable() || !db) {
      console.warn('⚠️ Firebase가 사용 불가능하여 localStorage를 사용합니다.')
      // localStorage에 사용자 정보 저장
      localStorage.setItem('userId', userId)
      localStorage.setItem('nickname', nickname)
      return
    }

    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      // 새 사용자 생성
      await setDoc(userRef, {
        userId,
        nickname,
        completedMissions: [],
        totalScore: 0,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      })
    } else {
      // 기존 사용자 닉네임 업데이트
      await updateDoc(userRef, {
        nickname,
        lastUpdated: serverTimestamp()
      })
    }
  } catch (error) {
    console.error('Error creating/updating user:', error)
    // Firebase 실패 시 localStorage 사용
    localStorage.setItem('userId', userId)
    localStorage.setItem('nickname', nickname)
  }
}

// 사용자 데이터 조회
export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    if (!isFirebaseAvailable() || !db) {
      console.warn('⚠️ Firebase가 사용 불가능하여 localStorage를 사용합니다.')
      // localStorage에서 사용자 데이터 조회
      const nickname = localStorage.getItem('nickname') || ''
      const completedMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
      const totalScore = parseInt(localStorage.getItem('totalScore') || '0')
      
      return {
        userId,
        nickname,
        completedMissions,
        totalScore,
        createdAt: null,
        lastUpdated: null
      }
    }

    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (userSnap.exists()) {
      return userSnap.data() as UserData
    }
    return null
  } catch (error) {
    console.error('Error getting user data:', error)
    // Firebase 실패 시 localStorage 사용
    const nickname = localStorage.getItem('nickname') || ''
    const completedMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
    const totalScore = parseInt(localStorage.getItem('totalScore') || '0')
    
    return {
      userId,
      nickname,
      completedMissions,
      totalScore,
      createdAt: null,
      lastUpdated: null
    }
  }
}

// 미션 완료 처리
export async function completeMission(userId: string, missionId: string, points: number): Promise<void> {
  try {
    if (!isFirebaseAvailable() || !db) {
      console.warn('⚠️ Firebase가 사용 불가능하여 localStorage를 사용합니다.')
      // localStorage에 미션 완료 정보 저장
      const completedMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
      if (!completedMissions.includes(missionId)) {
        completedMissions.push(missionId)
        localStorage.setItem('completedMissions', JSON.stringify(completedMissions))
      }
      
      const totalScore = parseInt(localStorage.getItem('totalScore') || '0') + points
      localStorage.setItem('totalScore', totalScore.toString())
      return
    }

    const userRef = doc(db, 'users', userId)
    
    await updateDoc(userRef, {
      completedMissions: arrayUnion(missionId),
      totalScore: increment(points),
      lastUpdated: serverTimestamp()
    })
  } catch (error) {
    console.error('Error completing mission:', error)
    // Firebase 실패 시 localStorage 사용
    const completedMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
    if (!completedMissions.includes(missionId)) {
      completedMissions.push(missionId)
      localStorage.setItem('completedMissions', JSON.stringify(completedMissions))
    }
    
    const totalScore = parseInt(localStorage.getItem('totalScore') || '0') + points
    localStorage.setItem('totalScore', totalScore.toString())
  }
}

// localStorage에서 Firebase로 마이그레이션
export async function migrateFromLocalStorage(userId: string): Promise<void> {
  try {
    if (!isFirebaseAvailable() || !db) {
      console.warn('⚠️ Firebase가 사용 불가능하여 마이그레이션을 건너뜁니다.')
      return
    }

    const completedMissions = JSON.parse(localStorage.getItem('completedMissions') || '[]')
    const totalScore = parseInt(localStorage.getItem('totalScore') || '0')
    
    if (completedMissions.length > 0 || totalScore > 0) {
      const userRef = doc(db, 'users', userId)
      
      await updateDoc(userRef, {
        completedMissions,
        totalScore,
        lastUpdated: serverTimestamp()
      })
      
      console.log('Migration completed:', { completedMissions, totalScore })
    }
  } catch (error) {
    console.error('Error migrating from localStorage:', error)
  }
}

// Firebase에서 localStorage로 동기화
export async function syncToLocalStorage(userId: string): Promise<void> {
  try {
    if (!isFirebaseAvailable()) {
      console.warn('⚠️ Firebase가 사용 불가능하여 동기화를 건너뜁니다.')
      return
    }

    const userData = await getUserData(userId)
    
    if (userData) {
      localStorage.setItem('completedMissions', JSON.stringify(userData.completedMissions))
      localStorage.setItem('totalScore', userData.totalScore.toString())
    }
  } catch (error) {
    console.error('Error syncing to localStorage:', error)
  }
}