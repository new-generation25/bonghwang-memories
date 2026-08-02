'use client'

/**
 * 관리자 데이터 조회·집계.
 *
 * 서버가 없으므로 집계는 클라이언트에서 한다. users 컬렉션을 한 번 읽어
 * 메모리에서 계산하는 방식이라 수백~수천 명까지는 충분하다. 그보다 커지면
 * Cloud Functions로 일별 집계 문서를 만들어야 한다(그때 이 파일만 바꾸면 된다).
 *
 * 권한은 이메일로 판정한다. admins 컬렉션을 따로 두면 최초 관리자를 넣는
 * 부트스트랩이 필요한데, 구글 로그인 토큰에 이메일이 들어 있어 규칙에서
 * 바로 비교할 수 있다.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  orderBy,
  setDoc,
  limit as fsLimit,
} from 'firebase/firestore'
import { auth, db, isFirebaseReady } from './firebase'
import { PointReason } from './points'
import { ADMIN_EMAILS, isAdminEmail } from './adminEmails'

/**
 * 이 이메일로 로그인한 사람만 관리자 화면을 볼 수 있다 (firestore.rules와 동일).
 *
 * 목록 자체는 `adminEmails.ts`에 있다 — 서버 라우트도 같은 값을 봐야 하는데
 * 이 파일은 `'use client'`라 거기서 import할 수 없기 때문이다. 여기서는
 * 기존 import 경로가 끊기지 않도록 다시 내보내기만 한다.
 */
export { ADMIN_EMAILS }

export function isAdminUser(): boolean {
  return isAdminEmail(auth?.currentUser?.email)
}

/**
 * 관리자 계정임을 사용자 문서에 남긴다.
 *
 * 권한 판정 자체는 토큰의 이메일로 하므로 이 필드가 없어도 로그인·진입은
 * 된다. 이 필드가 필요한 곳은 따로 있다 — 남이 보는 화면이다.
 *
 * 관리자는 순서를 건너뛰며 앱을 시험하므로 포인트가 실제 참여자보다 쉽게
 * 쌓인다. 그런데 랭킹은 참여자가 보는 화면이라, 거기서 관리자를 빼려면
 * "이 uid가 관리자냐"를 남의 기기에서도 알 수 있어야 한다. 토큰은 지금
 * 로그인한 사람에 대해서만 말해주므로 문서에 심어 둔다.
 *
 * 관리자 데이터를 지우지는 않는다 — 기록은 그대로 남기고 집계에서만 뺀다.
 *
 * 이 필드는 권한이 아니다. 규칙상 누구나 자기 문서에 쓸 수 있지만, 그래봐야
 * 자기를 랭킹에서 숨기는 것이 전부다. 관리자 권한은 토큰의 이메일로만
 * 판정하므로 이 값으로는 아무것도 열리지 않는다.
 */
export async function markAdminAccount(uid: string): Promise<void> {
  if (!isFirebaseReady() || !db || !isAdminUser()) return
  try {
    // uid를 함께 넣는다 — 문서가 아직 없으면 merge가 create가 되는데,
    // 규칙이 create에 uid == 문서 id를 요구한다.
    await setDoc(doc(db, 'users', uid), { uid, isAdmin: true }, { merge: true })
  } catch {
    // 실패해도 앱 흐름을 막지 않는다. 다음 로그인 때 다시 시도된다.
  }
}

// ---------------------------------------------------------------------------
// 원자료
// ---------------------------------------------------------------------------

export interface AdminUser {
  uid: string
  nickname: string
  provider: string
  totalPoints: number
  missionCount: number
  tracksCompleted: number
  bingoCells: number
  bingoLines: number
  couponCount: number
  phase: string
  paid: boolean
  startedAt: number | null
  finishedAt: number | null
  lastActiveAt: number | null
  createdAt: number | null
  /** 관리자 계정 — 시험 삼아 만든 기록이라 집계에서 뺀다 */
  isAdmin: boolean
}

const ms = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  const t = v as { toMillis?: () => number } | null
  return t?.toMillis?.() ?? null
}

export async function fetchUsers(): Promise<AdminUser[]> {
  if (!isFirebaseReady() || !db) return []
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => {
    const v = d.data()
    return {
      uid: d.id,
      nickname: v.nickname ?? '이름 없음',
      provider: v.provider ?? '-',
      totalPoints: v.totalPoints ?? v.totalScore ?? 0,
      missionCount: v.missionCount ?? 0,
      tracksCompleted: v.tracksCompleted ?? 0,
      bingoCells: v.bingoCells ?? 0,
      bingoLines: v.bingoLines ?? 0,
      couponCount: v.couponCount ?? 0,
      phase: v.phase ?? 'landing',
      paid: Boolean(v.paid),
      startedAt: ms(v.startedAt),
      finishedAt: ms(v.finishedAt),
      lastActiveAt: ms(v.lastActiveAt),
      createdAt: ms(v.createdAt),
      isAdmin: Boolean(v.isAdmin),
    }
  })
}

// ---------------------------------------------------------------------------
// 관리자 데이터 걸러내기
// ---------------------------------------------------------------------------

/**
 * 관리자 계정의 기록을 집계에서 뺀다.
 *
 * 지우지 않는다 — 관리자도 참여자와 똑같이 기록을 남기고, 여기서 보는
 * 동안만 빠진다. 콘트롤 패널에서 '포함해서 보기'를 누르면 그대로 나온다.
 *
 * 거르는 기준은 uid다. 네 갈래 원자료가 모두 uid를 달고 있어서(포인트는
 * 문서 경로에서, 설문·게시글은 필드에서) 스키마를 바꾸지 않고 걸러진다.
 *
 * 기본값을 '제외'로 둔 이유는 실수의 방향이다. 포함이 기본이면 누를 때까지
 * 숫자가 틀린 채로 보이고, 그걸 사업자에게 보여주게 된다.
 */
export function adminUids(users: AdminUser[]): Set<string> {
  return new Set(users.filter((u) => u.isAdmin).map((u) => u.uid))
}

export interface AdminDataset {
  users: AdminUser[]
  points: AdminPointEntry[]
  responses: AdminSurveyResponse[]
  posts: AdminPost[]
}

export function excludeAdmins(data: AdminDataset): AdminDataset {
  const skip = adminUids(data.users)
  if (skip.size === 0) return data
  return {
    users: data.users.filter((u) => !skip.has(u.uid)),
    points: data.points.filter((p) => !skip.has(p.uid)),
    responses: data.responses.filter((r) => !skip.has(r.uid)),
    posts: data.posts.filter((p) => !skip.has(p.authorUid)),
  }
}

export interface AdminSurveyResponse {
  uid: string
  surveyId: string
  answers: Record<string, string | number>
  createdAt: number | null
}

export async function fetchSurveyResponses(): Promise<AdminSurveyResponse[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(collectionGroup(db, 'surveyResponses'))
    return snap.docs.map((d) => {
      const v = d.data()
      return {
        uid: v.uid ?? '',
        surveyId: v.surveyId ?? d.id,
        answers: v.answers ?? {},
        createdAt: ms(v.createdAt),
      }
    })
  } catch {
    // collectionGroup 색인이 없으면 실패한다 — 화면은 빈 상태로 둔다
    return []
  }
}

export interface AdminPost {
  id: string
  authorUid: string
  authorNickname: string
  missionTitle: string
  comment: string
  likes: number
  commentCount: number
  imageUrl: string
  createdAt: number | null
}

export async function fetchPosts(max = 200): Promise<AdminPost[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'posts'), orderBy('createdAt', 'desc'), fsLimit(max))
    )
    return snap.docs.map((d) => {
      const v = d.data()
      return {
        id: d.id,
        authorUid: v.authorUid ?? '',
        authorNickname: v.authorNickname ?? '이름 없음',
        missionTitle: v.missionTitle ?? '',
        comment: v.comment ?? '',
        likes: v.likes ?? 0,
        commentCount: v.commentCount ?? 0,
        imageUrl: v.imageUrl ?? '',
        createdAt: ms(v.createdAt),
      }
    })
  } catch {
    return []
  }
}

export interface AdminPointEntry {
  uid: string
  refId: string
  reason: PointReason
  points: number
  createdAt: number | null
}

export async function fetchAllPoints(): Promise<AdminPointEntry[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(collectionGroup(db, 'points'))
    return snap.docs.map((d) => {
      const v = d.data()
      // 경로: users/{uid}/points/{refId}
      const uid = d.ref.parent.parent?.id ?? ''
      return {
        uid,
        refId: v.refId ?? d.id,
        reason: (v.reason ?? 'bonusMission') as PointReason,
        points: v.points ?? 0,
        createdAt: ms(v.createdAt),
      }
    })
  } catch {
    return []
  }
}

export interface AdminEvent {
  uid: string
  name: string
  props: Record<string, unknown>
  /** 발생 시각(epoch ms) — 배치가 늦게 올라와도 이 값이 원래 시각이다 */
  at: number
}

/**
 * 계측 이벤트 전량 — 배치 문서(users/{uid}/events/{batchId})를 펼쳐 돌려준다.
 *
 * 정렬 없이 읽는다: orderBy를 걸면 컬렉션 그룹 색인이 필요한데, 어차피
 * 문서 안 events[]의 at으로 다시 세워야 해서 서버 정렬이 의미가 없다.
 * 판매 전 스키마 검증 단계라 전량이 부담되지 않는다 — 커지면 여기서 자른다.
 */
export async function fetchEvents(): Promise<AdminEvent[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(collectionGroup(db, 'events'))
    const out: AdminEvent[] = []
    for (const d of snap.docs) {
      // 경로: users/{uid}/events/{batchId}
      const uid = d.ref.parent.parent?.id ?? ''
      const list = d.data().events
      if (!Array.isArray(list)) continue
      for (const e of list) {
        out.push({
          uid,
          name: String(e?.name ?? ''),
          props: (e?.props ?? {}) as Record<string, unknown>,
          at: Number(e?.at) || 0,
        })
      }
    }
    return out.sort((a, b) => b.at - a.at)
  } catch {
    return []
  }
}

export interface AdminCouponUse {
  code: string
  couponId: string
  /** 어느 가게에서 썼나. 옛 기록에는 없다 — 정산에서 빠진다 */
  shopId: string
  /** guest = 손님이 가게 스티커를 직접 찍음 / staff = 사장님이 대신 처리 */
  via: 'guest' | 'staff'
  usedAt: number | null
  /** 쿠폰인가 포인트인가 — 가게에서는 같은 값으로 쓰이지만 세는 칸은 다르다 */
  kind: 'coupon' | 'points'
  /** 할인 액면(원) */
  amountWon: number
  /**
   * **사용 시점에 값으로 굳은** 충당률(%). `-1`이면 아직 안 찍힌 기록이다.
   *
   * 0과 -1을 갈라야 한다. 0은 신규 가게의 정당한 값이라, 같은 값으로 두면
   * 다 찍힌 신규 가게가 영원히 '대기'로 보인다.
   */
  coverageRate: number
  shopWon: number
  opsWon: number
}

/**
 * 쿠폰 사용 기록 전량.
 *
 * usedAt 한 축으로만 정렬하므로 복합 색인이 필요 없다(가게 화면은
 * shopId로 걸러오느라 색인이 하나 든다). 관리자만 목록을 열 수 있다.
 */
export async function fetchCouponUses(max = 1000): Promise<AdminCouponUse[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'couponUses'), orderBy('usedAt', 'desc'), fsLimit(max))
    )
    return snap.docs.map((d) => {
      const v = d.data()
      const num = (x: unknown, fallback: number) =>
        typeof x === 'number' && Number.isFinite(x) ? x : fallback
      return {
        code: v.code ?? d.id,
        couponId: v.couponId ?? '',
        shopId: v.shopId ?? '',
        via: v.via === 'guest' ? 'guest' : 'staff',
        usedAt: ms(v.usedAt),
        kind: v.kind === 'points' ? 'points' : 'coupon',
        amountWon: num(v.amountWon, 0),
        coverageRate: num(v.coverageRate, -1),
        shopWon: num(v.shopWon, 0),
        opsWon: num(v.opsWon, 0),
      }
    })
  } catch {
    return []
  }
}

// 집계는 adminStats.ts에 있다 — Firebase 의존이 없어 따로 검증할 수 있다
export {
  TICKET_PRICE,
  startOfDay,
  periodStats,
  funnel,
  cellPopularity,
  hourlyStarts,
  averageDurationMin,
  surveySummary,
  issuedFaceValue,
  eventBreakdown,
} from './adminStats'
export type { PeriodStats, EventBreakdownRow } from './adminStats'

// 충당률 정산도 순수 계산이라 같은 이유로 갈라져 있다(coverage.ts)
export {
  CONTRACT_LABEL,
  DEFAULT_SETTLEMENT,
  TIER_LABEL,
  capStatus,
  coverageReport,
  monthKey,
  settleMonth,
  settlementDueAt,
} from './coverage'
export type {
  CapStatus,
  ContractState,
  CoverageReport,
  MerchantTier,
  SettlementConfig,
  SettlementMerchant,
  SettlementRow,
} from './coverage'
