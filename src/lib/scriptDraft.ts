/**
 * 대본 개정 초안을 서버에 둔다.
 *
 * 처음에는 `docs/SCRIPT_v2.md` 파일만 고쳤는데 두 가지가 걸렸다:
 *
 *  · 개발 서버를 다시 켜면 고치던 것이 사라진다. 화면의 상태일 뿐이라
 *    저장을 누르기 전에 다시 컴파일되면 그대로 날아간다
 *  · 운영에서는 아예 못 연다. 파일을 다루는 길(`/api/debug/*`)이 개발에서만
 *    열리기 때문이다. 대사 다듬기는 자리를 가리지 않는데 자리를 가렸다
 *
 * 그래서 초안을 `config/scriptDraft` 문서에 둔다. 어느 기기에서 열어도 같은
 * 판이고, 서버를 껐다 켜도 남는다. **관리자만 읽고 쓴다** — 아직 안 나간
 * 이야기가 새면 안 된다(firestore.rules).
 *
 * 파일과의 관계: 확정되면 이 글을 `docs/SCRIPT.md`로 내려 적고 굽는다.
 * 그 내려적기는 저장소가 있는 자리에서 하는 일이라 여기서 하지 않는다.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, isFirebaseReady } from './firebase'

const REF = ['config', 'scriptDraft'] as const

export interface ScriptDraft {
  text: string
  /** 마지막으로 저장한 사람 — 두 자리에서 고칠 때 누가 덮었는지 본다 */
  savedBy: string
  savedAt: number | null
}

export async function loadDraft(): Promise<ScriptDraft | null> {
  if (!isFirebaseReady() || !db) return null
  const snap = await getDoc(doc(db, ...REF))
  if (!snap.exists()) return null
  const d = snap.data() as { text?: string; savedBy?: string; savedAt?: { toMillis?: () => number } }
  if (typeof d.text !== 'string') return null
  return {
    text: d.text,
    savedBy: d.savedBy ?? '',
    savedAt: d.savedAt?.toMillis?.() ?? null,
  }
}

export async function saveDraft(text: string, savedBy: string): Promise<void> {
  if (!isFirebaseReady() || !db) throw new Error('서버에 연결되어 있지 않습니다.')
  /*
    빈 글로 덮어쓰는 것은 막는다. 화면이 잘못 돌아 빈 문자열이 올라오면
    초안이 통째로 날아가고, 되돌릴 길이 없다.
  */
  if (text.trim().length < 200) throw new Error('내용이 너무 짧습니다. 저장하지 않았습니다.')

  await setDoc(doc(db, ...REF), { text, savedBy, savedAt: serverTimestamp() })
}
