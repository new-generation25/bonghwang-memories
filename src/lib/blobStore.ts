/**
 * IndexedDB blob 저장소 — 미션 사진과 B면 녹음(D12: 로컬 저장 기본).
 *
 * localStorage는 용량이 작고 문자열만 담을 수 있어 사진·음성에는 부적합하다.
 * 외부 라이브러리 없이 필요한 것만 얇게 감쌌다: put / get / delete / URL 헬퍼.
 */

const DB_NAME = 'bh88'
const STORE = 'blobs'
// v2: 스토어 없이 생성된 초기 DB를 만난 클라이언트도 업그레이드로 복구되도록
const VERSION = 2

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB를 사용할 수 없는 환경입니다'))
      return
    }
    const req = window.indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 열기 실패'))
  })
  return dbPromise
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('blob 저장 실패'))
  })
}

export async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('blob 읽기 실패'))
  })
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('blob 삭제 실패'))
  })
}

/**
 * blob을 object URL로 가져온다. 반환된 revoke를 반드시 호출해 누수를 막을 것
 * (React effect의 cleanup에서 호출하는 용도).
 */
export async function getBlobUrl(
  key: string
): Promise<{ url: string; revoke: () => void } | null> {
  const blob = await getBlob(key)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  return { url, revoke: () => URL.revokeObjectURL(url) }
}

/**
 * dataURL(base64) → Blob. fetch(data:)는 CSP connect-src에 막히므로 직접 디코드한다.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaAt = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, commaAt)
  const b64 = dataUrl.slice(commaAt + 1)
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** dataURL(base64) → IndexedDB 저장. 기존 MissionCamera의 출력 호환용 */
export async function putDataUrl(key: string, dataUrl: string): Promise<void> {
  await putBlob(key, dataUrlToBlob(dataUrl))
}
