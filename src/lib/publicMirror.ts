/**
 * 밖에 내놓아도 되는 것만 따로 둔다.
 *
 * `users` 문서는 읽기가 공개였다. 닉네임을 랭킹에 띄우고, 가입할 때
 * 이름이 겹치는지 봐야 해서다. 그런데 같은 문서에 로그인 아이디·결제
 * 여부·어디까지 갔는지가 함께 들어 있어서, 프로젝트 ID와 API 키만 알면
 * (둘 다 앱 JS에 박혀 있다) Firestore REST로 **참여자 전원의 진행 상황이
 * 통째로** 읽혔다.
 *
 * 필드 단위로 읽기를 막는 방법은 Firestore에 없다. 그래서 공개해야 하는
 * 두 가지만 밖에 내놓고 `users`는 본인·관리자만 읽게 닫는다.
 *
 *   rankings/{uid}    닉네임 + 포인트          랭킹판이 읽는다
 *   nicknames/{key}   그 이름을 누가 쓰는가    가입 전 중복 확인이 읽는다
 *
 * 서버(API 라우트)로 감싸는 길도 있었지만 택하지 않았다 — firebase-admin을
 * 쓰는 라우트가 운영에서 500이라 원인을 모르는 채로 가입과 랭킹을 거기
 * 얹으면, 그것이 무너질 때 앱이 함께 무너진다.
 */

import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * 닉네임 비교 기준. 문서 ID로도 쓴다.
 *
 * 규칙은 `auth.ts`가 쓰던 것 그대로다(trim + 소문자). 여기서 공백까지
 * 지우고 싶었지만 그러면 지금 갈라져 있는 이름들이 갑자기 겹친다.
 *
 * Firestore 문서 ID로 못 쓰는 글자(`/`)만 걷어낸다.
 */
export function toNicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase().replace(/\//g, '_')
}

/**
 * 그 이름을 이미 누가 쓰고 있는가.
 *
 * 가입 전에도 물어야 하므로 로그인 없이 읽힌다. 알려주는 것은 '쓰이는가'
 * 하나뿐이다 — 문서에는 uid만 있고 그 uid로는 users를 못 읽는다.
 */
export async function isNicknameTaken(
  nickname: string,
  /** 본인 것은 중복으로 치지 않는다(닉네임 변경) */
  exceptUid?: string
): Promise<boolean> {
  if (!db) return false
  const key = toNicknameKey(nickname)
  if (!key) return false
  const snap = await getDoc(doc(db, 'nicknames', key))
  if (!snap.exists()) return false
  return (snap.data() as { uid?: string }).uid !== exceptUid
}

/**
 * 이름을 맡아 둔다.
 *
 * 문서 ID가 곧 이름이라 **먼저 만든 쪽이 이긴다** — 규칙이 create만
 * 허용하므로 이미 있는 이름에 쓰면 거부된다. 예전에는 '확인하고 만드는'
 * 두 걸음 사이에 남이 끼어들 수 있었다.
 */
export async function claimNickname(uid: string, nickname: string): Promise<void> {
  if (!db) return
  const key = toNicknameKey(nickname)
  if (!key) return
  await setDoc(doc(db, 'nicknames', key), { uid, at: serverTimestamp() })
}

/** 쓰던 이름을 놓는다. 없는 것을 놓으려 해도 조용히 지나간다 */
export async function releaseNickname(nickname: string): Promise<void> {
  if (!db) return
  const key = toNicknameKey(nickname)
  if (!key) return
  try {
    await deleteDoc(doc(db, 'nicknames', key))
  } catch {
    // 남의 것이면 규칙이 막는다 — 그게 맞고, 여기서 할 일은 없다
  }
}

/**
 * 랭킹판에 비치는 몫.
 *
 * `users`를 닫았으므로 랭킹은 이 문서만 본다. 담는 것은 닉네임과 포인트뿐이고,
 * isAdmin은 참여자 목록에서 관리자를 빼는 데만 쓴다.
 */
export async function syncRanking(
  uid: string,
  fields: { nickname?: string; totalPoints?: number; addPoints?: number; isAdmin?: boolean }
): Promise<void> {
  if (!db) return
  const patch: Record<string, unknown> = { uid, at: serverTimestamp() }
  if (fields.nickname !== undefined) patch.nickname = fields.nickname
  if (fields.totalPoints !== undefined) patch.totalPoints = fields.totalPoints
  if (fields.addPoints !== undefined) patch.totalPoints = increment(fields.addPoints)
  if (fields.isAdmin !== undefined) patch.isAdmin = fields.isAdmin
  await setDoc(doc(db, 'rankings', uid), patch, { merge: true })
}
