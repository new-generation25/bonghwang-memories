/**
 * 등장인물 프로필 그림.
 *
 * 통화 화면과 테이프 재생 화면에서 지금 말하는 사람의 얼굴을 띄운다.
 * 목소리만 있는 90분짜리 이야기라, 얼굴이 한 번 붙으면 이후 목소리에도
 * 그 얼굴이 따라붙는다 — 인물이 사람으로 남는다.
 *
 * 그림은 scripts/make-cast-avatars.mjs가 512×512 정사각으로 맞춰 둔다.
 * 원본은 인물 위치가 제각각이라 그대로 쓰면 누구는 이마가, 누구는 턱이
 * 잘린다. 자르기 기준은 그 스크립트의 FOCUS에 있다.
 *
 * 없는 인물은 null을 돌려주고 화면이 기존 글자 배지로 되돌아간다 —
 * 라디오(dj_father)처럼 얼굴이 없는 화자가 그렇다.
 */

import { Cue, Speaker } from './cues'

const BASE = '/images/cast'

/**
 * 화자 → 그림.
 *
 * 아버지는 1988년(젊은)과 현재(노년)가 같은 사람이라 한 장을 함께 쓴다.
 * 노년 그림이 따로 생기면 voiceAge로 갈라 주면 된다.
 */
const PORTRAIT: Partial<Record<Speaker, string>> = {
  father: `${BASE}/father.png`,
  soyoung: `${BASE}/soyoung.png`,
  shopkeeper1: `${BASE}/shopkeeper1.png`, // 봉황1935 사장님
  shopkeeper2: `${BASE}/shopkeeper2.png`, // 방하림 사장님
  // father_soyoung(둘이 함께)은 아버지 얼굴로 대표한다
  father_soyoung: `${BASE}/father.png`,
  // dj_father(라디오)는 목소리만 나오는 화자다 — 얼굴을 붙이지 않는다
}

/** 그림이 없을 때 쓰는 한 글자 배지 */
const INITIAL: Record<Speaker, string> = {
  father: '아',
  soyoung: '소',
  shopkeeper1: '봉',
  shopkeeper2: '방',
  dj_father: '📻',
  father_soyoung: '아',
}

export function portraitFor(cue: Pick<Cue, 'speaker'>): string | null {
  return PORTRAIT[cue.speaker] ?? null
}

export function initialFor(cue: Pick<Cue, 'speaker'>): string {
  return INITIAL[cue.speaker] ?? '📞'
}
