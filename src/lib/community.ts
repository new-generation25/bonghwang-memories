import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, isFirebaseReady } from './firebase'

/**
 * 커뮤니티 — 사진 후기 게시글, 좋아요, 댓글.
 *
 * Firestore 구조:
 *   posts/{postId}                 게시글
 *   posts/{postId}/comments/{id}   댓글 (하위 컬렉션)
 * 사진은 Storage의 posts/{uid}/{timestamp}-{filename} 에 저장한다.
 */

export interface CommunityPost {
  id: string
  authorUid: string
  authorNickname: string
  missionTitle: string
  comment: string
  imageUrl: string
  imagePath: string
  likes: number
  likedBy: string[]
  commentCount: number
  createdAt: Date | null
  edited: boolean
}

export interface PostComment {
  id: string
  authorUid: string
  authorNickname: string
  text: string
  createdAt: Date | null
}

/** 업로드 허용 한도 — 모바일 사진 원본을 감안한 값 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export class CommunityUnavailableError extends Error {
  constructor() {
    super('커뮤니티 기능이 아직 설정되지 않았습니다. (Firebase 환경 변수 필요)')
    this.name = 'CommunityUnavailableError'
  }
}

function requireDb() {
  if (!isFirebaseReady() || !db) throw new CommunityUnavailableError()
  return db
}

const toDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : null

export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'JPG · PNG · WEBP 형식만 올릴 수 있습니다.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return '사진 용량은 5MB 이하여야 합니다.'
  }
  return null
}

/** 사진 업로드 후 { url, path } 반환. path는 나중에 삭제할 때 필요하다 */
async function uploadImage(uid: string, file: File): Promise<{ url: string; path: string }> {
  if (!storage) throw new CommunityUnavailableError()

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `posts/${uid}/${Date.now()}-${safeName}`
  const storageRef = ref(storage, path)

  try {
    await uploadBytes(storageRef, file)
  } catch (err) {
    /*
      SDK 오류 코드를 그대로 보여주면 사용자는 무엇을 해야 할지 모른다.
      특히 'storage/unknown'은 버킷이 아직 만들어지지 않았을 때 나온다 —
      요청이 응답조차 받지 못해(status 0) SDK가 분류하지 못하는 경우다.
      운영자가 고칠 일이므로 사용자에게는 사진 없이 올릴 길을 알려준다.
    */
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'storage/unauthorized') {
      throw new Error('사진을 올릴 권한이 없어요. 다시 로그인해 주세요.')
    }
    throw new Error(
      '사진 저장소에 연결하지 못했어요. 사진을 빼고 글만 먼저 남겨주세요.'
    )
  }

  const url = await getDownloadURL(storageRef)

  return { url, path }
}

/** 게시글 목록 — 최신순 */
export async function fetchPosts(max = 50): Promise<CommunityPost[]> {
  const d = requireDb()

  const snap = await getDocs(
    query(collection(d, 'posts'), orderBy('createdAt', 'desc'), limit(max))
  )

  return snap.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      authorUid: data.authorUid ?? '',
      authorNickname: data.authorNickname ?? '익명의 기록자',
      missionTitle: data.missionTitle ?? '',
      comment: data.comment ?? '',
      imageUrl: data.imageUrl ?? '',
      imagePath: data.imagePath ?? '',
      likes: data.likes ?? 0,
      likedBy: data.likedBy ?? [],
      commentCount: data.commentCount ?? 0,
      createdAt: toDate(data.createdAt),
      edited: data.edited ?? false,
    }
  })
}

/** 게시글 작성 — 사진은 선택 */
export async function createPost(params: {
  uid: string
  nickname: string
  missionTitle: string
  comment: string
  file?: File | null
}): Promise<string> {
  const d = requireDb()
  const { uid, nickname, missionTitle, comment, file } = params

  let imageUrl = ''
  let imagePath = ''

  if (file) {
    const uploaded = await uploadImage(uid, file)
    imageUrl = uploaded.url
    imagePath = uploaded.path
  }

  const created = await addDoc(collection(d, 'posts'), {
    authorUid: uid,
    authorNickname: nickname,
    missionTitle,
    comment,
    imageUrl,
    imagePath,
    likes: 0,
    likedBy: [],
    commentCount: 0,
    edited: false,
    createdAt: serverTimestamp(),
  })

  return created.id
}

/** 본인 글 수정 — 본문만 고친다 */
export async function updatePost(postId: string, uid: string, comment: string): Promise<void> {
  const d = requireDb()
  const postRef = doc(d, 'posts', postId)
  const snap = await getDoc(postRef)

  if (!snap.exists()) throw new Error('이미 삭제된 글입니다.')
  if (snap.data().authorUid !== uid) throw new Error('본인 글만 수정할 수 있습니다.')

  await updateDoc(postRef, { comment, edited: true })
}

/** 본인 글 삭제 — 댓글과 업로드한 사진도 함께 정리한다 */
export async function deletePost(postId: string, uid: string): Promise<void> {
  const d = requireDb()
  const postRef = doc(d, 'posts', postId)
  const snap = await getDoc(postRef)

  if (!snap.exists()) return
  const data = snap.data()
  if (data.authorUid !== uid) throw new Error('본인 글만 삭제할 수 있습니다.')

  // 하위 댓글 먼저 제거 — 남겨두면 접근 불가능한 고아 문서가 된다
  const comments = await getDocs(collection(d, 'posts', postId, 'comments'))
  await Promise.all(comments.docs.map((c) => deleteDoc(c.ref)))

  if (data.imagePath && storage) {
    try {
      await deleteObject(ref(storage, data.imagePath))
    } catch {
      // 사진이 이미 없어도 글 삭제는 계속 진행한다
    }
  }

  await deleteDoc(postRef)
}

/** 좋아요 토글 — 누른 적 있으면 취소 */
export async function toggleLike(
  postId: string,
  uid: string,
  alreadyLiked: boolean
): Promise<void> {
  const d = requireDb()
  const postRef = doc(d, 'posts', postId)

  await updateDoc(postRef, {
    likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid),
    likes: increment(alreadyLiked ? -1 : 1),
  })
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const d = requireDb()

  const snap = await getDocs(
    query(collection(d, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'))
  )

  return snap.docs.map((c) => {
    const data = c.data()
    return {
      id: c.id,
      authorUid: data.authorUid ?? '',
      authorNickname: data.authorNickname ?? '익명의 기록자',
      text: data.text ?? '',
      createdAt: toDate(data.createdAt),
    }
  })
}

export async function addComment(
  postId: string,
  uid: string,
  nickname: string,
  text: string
): Promise<void> {
  const d = requireDb()

  await addDoc(collection(d, 'posts', postId, 'comments'), {
    authorUid: uid,
    authorNickname: nickname,
    text,
    createdAt: serverTimestamp(),
  })

  await updateDoc(doc(d, 'posts', postId), { commentCount: increment(1) })
}

export async function deleteComment(
  postId: string,
  commentId: string,
  uid: string
): Promise<void> {
  const d = requireDb()
  const commentRef = doc(d, 'posts', postId, 'comments', commentId)
  const snap = await getDoc(commentRef)

  if (!snap.exists()) return
  if (snap.data().authorUid !== uid) throw new Error('본인 댓글만 삭제할 수 있습니다.')

  await deleteDoc(commentRef)
  await updateDoc(doc(d, 'posts', postId), { commentCount: increment(-1) })
}
