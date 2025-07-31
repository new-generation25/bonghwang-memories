import { db } from './firebase'
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore'

export interface UserData {
  userId: string
  nickname: string
  completedMissions: string[]
  totalScore: number
  createdAt: any
  lastUpdated: any
}

// 사용자 데이터 생성/업데이트
export async function createOrUpdateUser(userId: string, nickname: string): Promise<void> {
  try {
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
    throw error
  }
}

// 사용자 데이터 조회
export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (userSnap.exists()) {
      return userSnap.data() as UserData
    }
    return null
  } catch (error) {
    console.error('Error getting user data:', error)
    return null
  }
}

// 미션 완료 처리
export async function completeMission(userId: string, missionId: string, points: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId)
    
    await updateDoc(userRef, {
      completedMissions: arrayUnion(missionId),
      totalScore: increment(points),
      lastUpdated: serverTimestamp()
    })
  } catch (error) {
    console.error('Error completing mission:', error)
    throw error
  }
}

// localStorage에서 Firebase로 마이그레이션
export async function migrateFromLocalStorage(userId: string): Promise<void> {
  try {
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
    const userData = await getUserData(userId)
    
    if (userData) {
      localStorage.setItem('completedMissions', JSON.stringify(userData.completedMissions))
      localStorage.setItem('totalScore', userData.totalScore.toString())
    }
  } catch (error) {
    console.error('Error syncing to localStorage:', error)
  }
}