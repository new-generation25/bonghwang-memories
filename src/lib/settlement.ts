'use client'

/**
 * 정산 설정과 월 마감 — Firestore 쪽.
 *
 * 계산은 전부 coverage.ts에 있다. 여기는 읽고 쓰기만 한다 — 돈을 세는
 * 식이 Firebase와 얽히면 검증할 방법이 없어진다.
 *
 * **배치를 돌릴 서버를 두지 않기로 했다(2026-07-30 결정).**
 * 그래서 날마다 도는 일은 없다:
 *  · 포인트 만료 — `pointWallet()`이 읽을 때마다 판정한다. 지우는 배치가
 *    할 일을 호출마다 하는 셈이라 배치가 필요 없다
 *  · 월 정산 마감 — 관리자 화면의 버튼이 아래 `closeMonth()`를 부른다.
 *    가게가 다섯 곳인 지금 규모에서 사람이 한 달에 한 번 누르는 편이,
 *    Cloud Functions를 세우고 서비스 계정 키를 관리하는 것보다 싸다
 *  · 스냅샷 찍기 — 가게·관리자 화면이 열릴 때 `stampPending()`이 돈다
 *
 * 규모가 커져 이 방식이 버거워지면 갈아탈 자리는 이 파일 하나다.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db, isFirebaseReady } from './firebase'
import { applyPointConfig, restorePointConfig } from './points'
import {
  DEFAULT_SETTLEMENT,
  mergeSettlementConfig,
  settlementDueAt,
  type SettlementConfig,
  type SettlementRow,
} from './coverage'

// ---------------------------------------------------------------------------
// 설정값
// ---------------------------------------------------------------------------

/**
 * 참여자도 읽는 칸 — 배점·문턱·유효기간.
 *
 * 충당률·회비·상한은 여기 넣지 않는다. 그 값들은 참여자에게 보이면 안 되고,
 * 가게끼리도 서로의 것을 알면 안 된다(규칙이 `config/settlement`을 관리자에게만
 * 연다). 화면에 안 그리는 것으로는 부족하다 — 문서를 읽을 수 있으면 읽힌다.
 */
const PUBLIC_KEYS = [
  'minRedeemPoints',
  'pointExpiryMonths',
  'missionPoints',
  'linePoints',
  'completePoints',
] as const

/**
 * 앱이 켜질 때 한 번.
 *
 * 로컬에 남은 마지막 값을 먼저 얹고 서버를 본다. 골목에서 신호가 끊긴 채
 * 적립이 일어나는 앱이라, 못 읽었다고 코드 기본값으로 되돌아가면 같은
 * 미션이 기기마다 다른 점수를 준다.
 */
export async function loadPointConfig(): Promise<void> {
  restorePointConfig()
  if (!isFirebaseReady() || !db) return
  try {
    const snap = await getDoc(doc(db, 'config', 'points'))
    if (snap.exists()) applyPointConfig(snap.data())
  } catch {
    /* 못 읽으면 마지막으로 알던 값 그대로 */
  }
}

/**
 * 정산 설정 전문 — 관리자만 읽을 수 있다.
 *
 * 가게 기기는 이것을 못 읽지만 필요도 없다. 그 가게에 걸린 율·상한·회비는
 * 가게 문서에 값으로 들어 있고, 정산은 그 값으로만 한다.
 */
export async function fetchSettlementConfig(): Promise<SettlementConfig> {
  if (!isFirebaseReady() || !db) return DEFAULT_SETTLEMENT
  try {
    const [s, p] = await Promise.all([
      getDoc(doc(db, 'config', 'settlement')),
      getDoc(doc(db, 'config', 'points')),
    ])
    return mergeSettlementConfig({
      ...(s.exists() ? s.data() : {}),
      ...(p.exists() ? p.data() : {}),
    })
  } catch {
    return DEFAULT_SETTLEMENT
  }
}

/**
 * 설정 저장 — 관리자만.
 *
 * 두 문서로 갈라 쓴다. 한 문서에 몰아 두고 화면에서만 가리면, 그 문서를
 * 읽을 수 있는 사람에게는 아무것도 가려지지 않는다.
 *
 * **이미 굳은 스냅샷은 움직이지 않는다.** 여기서 율을 바꿔도 지난 사용
 * 기록의 분담액은 그대로다 — 바뀌는 것은 앞으로 찍힐 것들뿐이고, 가게
 * 문서의 율은 `setShopTier()`를 눌러야 따라 움직인다.
 */
export async function saveSettlementConfig(cfg: SettlementConfig): Promise<void> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')
  const merged = mergeSettlementConfig(cfg)

  const publicPart: Record<string, number> = {}
  for (const k of PUBLIC_KEYS) publicPart[k] = merged[k]

  const privatePart = { ...merged } as Partial<SettlementConfig>
  for (const k of PUBLIC_KEYS) delete privatePart[k]

  await Promise.all([
    setDoc(doc(db, 'config', 'points'), publicPart, { merge: true }),
    setDoc(doc(db, 'config', 'settlement'), privatePart, { merge: true }),
  ])
  applyPointConfig(publicPart)
}

// ---------------------------------------------------------------------------
// 월 마감
// ---------------------------------------------------------------------------

export interface SettlementDoc {
  id: string
  shopId: string
  name: string
  month: string
  tier: string
  feeWon: number
  /** 청구한 충당액 — 상한을 넘은 몫은 빠져 있다 */
  coveredWon: number
  /** 스냅샷 합계 */
  shopWon: number
  opsWon: number
  amountWon: number
  count: number
  scans: number
  inflowWon: number
  /** 이의 제기 마감 */
  dueAt: number
  closedAt: number | null
}

const settlementId = (shopId: string, month: string) => `${shopId}_${month}`

/**
 * 그 달을 굳힌다.
 *
 * 이미 마감된 달은 다시 쓰지 않는다. 마감의 뜻이 "이 뒤로는 안 움직인다"인데
 * 버튼을 두 번 눌러 숫자가 바뀌면 가게에 보낸 청구서와 화면이 달라진다.
 * 정말 고쳐야 하면 그 문서를 지우고 다시 마감한다 — 지우는 것은 관리자만
 * 할 수 있고, 지웠다는 사실이 남는다.
 *
 * @returns 새로 굳힌 가게 수와 이미 마감돼 건너뛴 가게 수
 */
export async function closeMonth(
  rows: SettlementRow[],
  month: string
): Promise<{ closed: number; skipped: number }> {
  if (!db) throw new Error('서버에 닿지 못했습니다.')

  let closed = 0
  let skipped = 0
  for (const r of rows) {
    const id = settlementId(r.shopId, month)
    const ref = doc(db, 'settlements', id)
    if ((await getDoc(ref)).exists()) {
      skipped++
      continue
    }
    await setDoc(ref, {
      id,
      shopId: r.shopId,
      name: r.name,
      month,
      tier: r.tier,
      feeWon: r.feeWon,
      coveredWon: r.coveredWon,
      shopWon: r.shopWon,
      opsWon: r.opsWon,
      amountWon: r.amountWon,
      count: r.count,
      scans: r.scans,
      inflowWon: r.inflowWon,
      billedWon: r.billedWon,
      dueAt: settlementDueAt(month),
      closedAt: serverTimestamp(),
    })
    closed++
  }
  return { closed, skipped }
}

const toDoc = (v: Record<string, unknown>): SettlementDoc => ({
  id: String(v.id ?? ''),
  shopId: String(v.shopId ?? ''),
  name: String(v.name ?? ''),
  month: String(v.month ?? ''),
  tier: String(v.tier ?? 'new'),
  feeWon: Number(v.feeWon) || 0,
  coveredWon: Number(v.coveredWon) || 0,
  shopWon: Number(v.shopWon) || 0,
  opsWon: Number(v.opsWon) || 0,
  amountWon: Number(v.amountWon) || 0,
  count: Number(v.count) || 0,
  scans: Number(v.scans) || 0,
  inflowWon: Number(v.inflowWon) || 0,
  dueAt: Number(v.dueAt) || 0,
  closedAt: (v.closedAt as { toMillis?: () => number })?.toMillis?.() ?? null,
})

/** 어느 달이 이미 마감됐는지 — 관리자 화면이 버튼을 잠그는 데 쓴다 */
export async function fetchClosedMonth(month: string): Promise<SettlementDoc[]> {
  if (!isFirebaseReady() || !db) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'settlements'), where('month', '==', month))
    )
    return snap.docs.map((d) => toDoc(d.data()))
  } catch {
    return []
  }
}

/** 이 가게의 지난 청구서 — 사장님 화면이 "지난 달에 얼마였나"를 답한다 */
export async function fetchShopSettlements(shopId: string): Promise<SettlementDoc[]> {
  if (!isFirebaseReady() || !db || !shopId) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'settlements'), where('shopId', '==', shopId))
    )
    return snap.docs.map((d) => toDoc(d.data())).sort((a, b) => b.month.localeCompare(a.month))
  } catch {
    return []
  }
}
