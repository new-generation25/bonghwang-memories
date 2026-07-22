'use client'

/**
 * 완주 설문.
 *
 * 문항을 코드가 아니라 Firestore(surveys/{id})에 둔다 — 배포 없이 문항을
 * 바꿀 수 있어야 현장에서 반응을 보고 손볼 수 있다. 문서가 없으면
 * DEFAULT_SURVEY로 되돌아가므로, 콘솔에 아무것도 안 넣어도 동작한다.
 *
 * 응답은 users/{uid}/surveyResponses/{surveyId}에 남는다. 문서 ID가
 * surveyId라 한 사람이 같은 설문에 두 번 답할 수 없고, 포인트도 한 번만 간다.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseReady } from './firebase'
import { award } from './points'

export type QuestionType = 'rating' | 'choice' | 'text'

export interface SurveyQuestion {
  id: string
  type: QuestionType
  label: string
  /** choice 전용 */
  options?: string[]
  /** rating 전용 — 기본 5점 */
  max?: number
  required?: boolean
}

export interface Survey {
  id: string
  title: string
  intro: string
  questions: SurveyQuestion[]
}

export type SurveyAnswers = Record<string, string | number>

/** 콘솔에 문서를 만들지 않아도 동작하도록 하는 기본 설문 */
export const DEFAULT_SURVEY: Survey = {
  id: 'ep1-finish',
  title: '오늘의 걸음, 어떠셨나요?',
  intro:
    '다음 이야기를 더 좋게 만드는 데 씁니다. 1분이면 끝나고, 마치면 포인트를 드려요.',
  questions: [
    {
      id: 'nps',
      type: 'rating',
      label: '이 투어를 주변에 추천하고 싶으신가요?',
      max: 5,
      required: true,
    },
    {
      id: 'favorite',
      type: 'choice',
      label: '가장 기억에 남는 순간은 어디였나요?',
      options: [
        '골목에서 테이프를 발견한 순간',
        '봉황1935 사장님의 이야기',
        '능소화가 다시 핀 순간',
        '라디오 사연을 들은 순간',
        'B면에 숨겨진 아버지의 편지',
        '골목 빙고를 돌아다닌 시간',
      ],
      required: true,
    },
    {
      id: 'difficulty',
      type: 'choice',
      label: '길 찾기와 진행은 어땠나요?',
      options: ['쉬웠다', '적당했다', '조금 헤맸다', '많이 헤맸다'],
      required: true,
    },
    {
      id: 'shop',
      type: 'text',
      label: '들렀던 가게 중 좋았던 곳이 있다면 알려주세요 (선택)',
    },
    {
      id: 'free',
      type: 'text',
      label: '더 하고 싶은 말이 있다면 남겨주세요 (선택)',
    },
  ],
}

export async function fetchSurvey(surveyId = DEFAULT_SURVEY.id): Promise<Survey> {
  if (!isFirebaseReady() || !db) return DEFAULT_SURVEY
  try {
    const snap = await getDoc(doc(db, 'surveys', surveyId))
    if (!snap.exists()) return DEFAULT_SURVEY
    const v = snap.data() as Partial<Survey>
    if (!Array.isArray(v.questions) || v.questions.length === 0) return DEFAULT_SURVEY
    return {
      id: surveyId,
      title: v.title ?? DEFAULT_SURVEY.title,
      intro: v.intro ?? DEFAULT_SURVEY.intro,
      questions: v.questions,
    }
  } catch {
    return DEFAULT_SURVEY
  }
}

/** 이미 응답했는지 — 피날레에서 설문 카드를 띄울지 판단한다 */
export async function hasResponded(uid: string, surveyId: string): Promise<boolean> {
  if (!isFirebaseReady() || !db) return false
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'surveyResponses', surveyId))
    return snap.exists()
  } catch {
    return false
  }
}

/**
 * 응답 저장 + 포인트 적립.
 * 이미 답했으면 아무것도 하지 않고 false를 돌려준다(포인트 중복 방지).
 */
export async function submitSurvey(
  uid: string,
  surveyId: string,
  answers: SurveyAnswers
): Promise<boolean> {
  if (!isFirebaseReady() || !db) return false
  if (await hasResponded(uid, surveyId)) return false

  await setDoc(doc(db, 'users', uid, 'surveyResponses', surveyId), {
    uid,
    surveyId,
    answers,
    createdAt: serverTimestamp(),
  })
  await award(`survey-${surveyId}`, 'survey')
  return true
}
