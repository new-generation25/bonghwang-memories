/**
 * 보안 규칙 시험 — 에뮬레이터에서 진짜 규칙을 돌린다.
 *
 * 화면 시험(E2E)은 서버 쓰기 직전까지만 간다. 운영 데이터베이스에 시험
 * 기록을 남길 수 없기 때문인데, 그러면 정작 **규칙이 무엇을 통과시키는지**는
 * 아무도 확인하지 않은 채로 남는다. 규칙은 틀려도 화면이 멀쩡해서, 실제로
 * 손님이 카운터에 서기 전까지 아무도 모른다.
 *
 * 여기서 지키는 것은 넷이다.
 *  1. 가게 앞에 서 본 사람만 쓸 수 있다 (스티커 토큰)
 *  2. 자기 것만 쓸 수 있다 (양도 차단)
 *  3. 손님은 충당률을 보내지 못한다
 *  4. 한 번 굳은 스냅샷은 다시 못 바꾼다
 *
 *   npm run test:rules
 */

import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore'

let env

/** 가게 스티커에 박힌 값 — 이것을 아는 것이 '다녀왔다'의 증거다 */
const TOKEN = 'AW5NAYAY'
const OTHER_TOKEN = 'BC6MBZBZ'

const GUEST = 'guest-uid'
const FRIEND = 'friend-uid'
const STAFF = 'staff-uid'
const ADMIN = { sub: 'admin-uid', email: 'socialceos@gmail.com', email_verified: true }

/** 손님 태그 6자 — 규칙은 코드 조각과 필드가 맞는지만 본다 */
const TAG = 'K3M9QF'
const couponCode = (n = '237A') => `BH1-CP1-${TAG}-${n}`
const pointCode = (n = '237A') => `PT1-${TAG}-${n}`

/** 사용 기록의 필수 칸 — 규칙이 hasAll로 요구한다 */
function use(over = {}) {
  return {
    code: couponCode(),
    couponId: 'cp1',
    shopId: 'cp1',
    userTag: TAG,
    uid: GUEST,
    via: 'guest',
    byUid: GUEST,
    token: TOKEN,
    kind: 'coupon',
    amountWon: 1000,
    usedAt: serverTimestamp(),
    ...over,
  }
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'bonghwang-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      // firebase.json의 emulators.firestore와 같아야 한다
      host: '127.0.0.1',
      port: 8681,
    },
  })

  // 가게 문서는 규칙을 끄고 심는다 — 관리자만 쓸 수 있는 문서다
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'shops/cp1'), {
      shopId: 'cp1',
      name: '봉황1935',
      couponId: 'cp1',
      postToken: TOKEN,
      staffUids: [STAFF],
      active: true,
      contract: 'active',
      // 시범운영 — 전 등급 0%
      tier: 'free',
      coverageRate: 0,
      accepts: [],
      groupCoupons: [],
    })
    await setDoc(doc(db, 'shops/cp2'), {
      shopId: 'cp2',
      name: '미야상회',
      couponId: 'cp2',
      postToken: OTHER_TOKEN,
      staffUids: [],
      active: true,
      contract: 'active',
      tier: 'free',
      coverageRate: 0,
    })
  })
})

after(async () => {
  await env?.cleanup()
})

const asGuest = () => env.authenticatedContext(GUEST).firestore()
const asFriend = () => env.authenticatedContext(FRIEND).firestore()
const asStaff = () => env.authenticatedContext(STAFF).firestore()
const asAdmin = () => env.authenticatedContext(ADMIN.sub, ADMIN).firestore()

describe('쿠폰 사용 — 가게 앞에 서 본 사람만', () => {
  it('토큰이 맞으면 통과한다', async () => {
    const code = couponCode('2222')
    await assertSucceeds(
      setDoc(doc(asGuest(), 'couponUses', code), use({ code }))
    )
  })

  it('토큰이 틀리면 거절한다 — 가게에 가지 않고는 쓸 수 없다', async () => {
    const code = couponCode('2223')
    await assertFails(
      setDoc(doc(asGuest(), 'couponUses', code), use({ code, token: 'ZZZZZZZZ' }))
    )
  })

  it('cp1 쿠폰을 cp2에서 쓸 수 없다', async () => {
    const code = couponCode('2224')
    await assertFails(
      setDoc(
        doc(asGuest(), 'couponUses', code),
        use({ code, shopId: 'cp2', token: OTHER_TOKEN })
      )
    )
  })

  it('로그인하지 않으면 못 쓴다', async () => {
    const code = couponCode('2225')
    await assertFails(
      setDoc(doc(env.unauthenticatedContext().firestore(), 'couponUses', code), use({ code }))
    )
  })

  it('같은 코드를 두 번 쓸 수 없다', async () => {
    const code = couponCode('2226')
    await assertSucceeds(setDoc(doc(asGuest(), 'couponUses', code), use({ code })))
    // 두 번째는 update가 되어 규칙에서 떨어진다 — 트랜잭션이 필요 없는 이유
    await assertFails(setDoc(doc(asGuest(), 'couponUses', code), use({ code })))
  })
})

describe('양도 차단 — 캡처를 받은 친구는 쓸 수 없다', () => {
  it('남의 uid를 적어 만들 수 없다', async () => {
    const code = couponCode('2231')
    // 친구가 캡처한 코드를 그대로 내밀어도, uid는 자기 것일 수밖에 없다
    await assertFails(
      setDoc(doc(asFriend(), 'couponUses', code), use({ code, uid: GUEST, byUid: GUEST }))
    )
  })

  it('자기 uid로 바꿔도 byUid가 어긋나면 거절한다', async () => {
    const code = couponCode('2232')
    await assertFails(
      setDoc(doc(asFriend(), 'couponUses', code), use({ code, uid: FRIEND, byUid: GUEST }))
    )
  })
})

describe('충당률 — 손님은 보내지 못한다', () => {
  it('스냅샷 칸을 들고 오면 거절한다', async () => {
    const code = couponCode('2241')
    await assertFails(
      setDoc(
        doc(asGuest(), 'couponUses', code),
        use({ code, coverageRate: 0, shopWon: 0, opsWon: 1000 })
      )
    )
  })

  it('가게 계정이 나중에 채운다', async () => {
    const code = couponCode('2242')
    await assertSucceeds(setDoc(doc(asGuest(), 'couponUses', code), use({ code })))
    await assertSucceeds(
      updateDoc(doc(asStaff(), 'couponUses', code), {
        coverageRate: 0,
        shopWon: 0,
        opsWon: 1000,
        stampedAt: serverTimestamp(),
      })
    )
  })

  it('가게 문서와 다른 값은 채울 수 없다', async () => {
    const code = couponCode('2243')
    await assertSucceeds(setDoc(doc(asGuest(), 'couponUses', code), use({ code })))
    await assertFails(
      updateDoc(doc(asStaff(), 'couponUses', code), {
        coverageRate: 60,
        shopWon: 600,
        opsWon: 400,
        stampedAt: serverTimestamp(),
      })
    )
  })

  it('이미 채워진 기록은 다시 못 바꾼다 — 그것이 스냅샷의 뜻이다', async () => {
    const code = couponCode('2244')
    await assertSucceeds(setDoc(doc(asGuest(), 'couponUses', code), use({ code })))
    await assertSucceeds(
      updateDoc(doc(asStaff(), 'couponUses', code), {
        coverageRate: 0,
        shopWon: 0,
        opsWon: 1000,
        stampedAt: serverTimestamp(),
      })
    )
    await assertFails(
      updateDoc(doc(asStaff(), 'couponUses', code), {
        coverageRate: 0,
        shopWon: 0,
        opsWon: 1000,
        stampedAt: serverTimestamp(),
      })
    )
  })

  it('남의 가게 기록은 채울 수 없다', async () => {
    const code = couponCode('2245')
    await assertSucceeds(setDoc(doc(asGuest(), 'couponUses', code), use({ code })))
    await assertFails(
      updateDoc(doc(asFriend(), 'couponUses', code), {
        coverageRate: 0,
        shopWon: 0,
        opsWon: 1000,
        stampedAt: serverTimestamp(),
      })
    )
  })
})

describe('포인트 — 쿠폰과 같은 길', () => {
  const pointUse = (over = {}) =>
    use({
      code: pointCode(),
      couponId: 'pt',
      kind: 'points',
      amountWon: 3000,
      ...over,
    })

  it('토큰이 맞으면 통과한다', async () => {
    const code = pointCode('3332')
    await assertSucceeds(
      setDoc(doc(asGuest(), 'couponUses', code), pointUse({ code }))
    )
  })

  it('어느 가게에서나 쓸 수 있다 — 쿠폰과 달리 가게가 정해져 있지 않다', async () => {
    const code = pointCode('3333')
    await assertSucceeds(
      setDoc(
        doc(asGuest(), 'couponUses', code),
        pointUse({ code, shopId: 'cp2', token: OTHER_TOKEN })
      )
    )
  })

  it('금액이 0이면 거절한다', async () => {
    const code = pointCode('3334')
    await assertFails(
      setDoc(doc(asGuest(), 'couponUses', code), pointUse({ code, amountWon: 0 }))
    )
  })

  it('자릿수를 잘못 넣은 금액은 거절한다', async () => {
    const code = pointCode('3335')
    await assertFails(
      setDoc(doc(asGuest(), 'couponUses', code), pointUse({ code, amountWon: 3000000 }))
    )
  })

  it('스냅샷 칸을 들고 오면 거절한다', async () => {
    const code = pointCode('3336')
    await assertFails(
      setDoc(
        doc(asGuest(), 'couponUses', code),
        pointUse({ code, coverageRate: 0, shopWon: 0, opsWon: 3000 })
      )
    )
  })
})

describe('사용 기록 읽기', () => {
  it('코드를 알면 자기 것을 확인할 수 있다', async () => {
    const code = couponCode('4444')
    await assertSucceeds(setDoc(doc(asGuest(), 'couponUses', code), use({ code })))
    await assertSucceeds(getDoc(doc(asGuest(), 'couponUses', code)))
  })

  it('가게는 자기 가게 목록만 읽는다', async () => {
    await assertSucceeds(
      getDocs(query(collection(asStaff(), 'couponUses'), where('shopId', '==', 'cp1')))
    )
    await assertFails(
      getDocs(query(collection(asStaff(), 'couponUses'), where('shopId', '==', 'cp2')))
    )
  })

  it('손님은 목록을 읽지 못한다 — 남의 매출이 보이면 안 된다', async () => {
    await assertFails(
      getDocs(query(collection(asGuest(), 'couponUses'), where('shopId', '==', 'cp1')))
    )
  })

  it('손님은 가게 문서를 읽지 못한다 — 읽히면 스티커 토큰이 샌다', async () => {
    await assertFails(getDoc(doc(asGuest(), 'shops/cp1')))
  })
})

describe('포인트 원장', () => {
  it('적립이 통과한다', async () => {
    await assertSucceeds(
      setDoc(doc(asGuest(), 'users', GUEST, 'points', 'mission-1'), {
        refId: 'mission-1',
        reason: 'mainMission',
        points: 100,
        createdAt: serverTimestamp(),
      })
    )
  })

  it('뽑기 1등(1,000P)도 통과한다 — 예전 상한 500에 걸리던 것', async () => {
    await assertSucceeds(
      setDoc(doc(asGuest(), 'users', GUEST, 'points', 'gacha-1'), {
        refId: 'gacha-1',
        reason: 'gacha',
        points: 1000,
        createdAt: serverTimestamp(),
      })
    )
  })

  it('차감(음수)이 통과한다', async () => {
    await assertSucceeds(
      setDoc(doc(asGuest(), 'users', GUEST, 'points', 'redeem-1'), {
        refId: 'redeem-1',
        reason: 'redeem',
        points: -3000,
        createdAt: serverTimestamp(),
      })
    )
  })

  it('사유 없이 음수를 넣을 수 없다', async () => {
    await assertFails(
      setDoc(doc(asGuest(), 'users', GUEST, 'points', 'bad-1'), {
        refId: 'bad-1',
        reason: 'mainMission',
        points: -3000,
        createdAt: serverTimestamp(),
      })
    )
  })

  it('남의 원장에는 쓸 수 없다', async () => {
    await assertFails(
      setDoc(doc(asFriend(), 'users', GUEST, 'points', 'steal-1'), {
        refId: 'steal-1',
        reason: 'mainMission',
        points: 100,
        createdAt: serverTimestamp(),
      })
    )
  })
})

describe('설정값', () => {
  it('배점은 누구나 읽는다 — 로그인 전에도 같은 점수여야 한다', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'config/points')))
  })

  it('충당률 설정은 관리자만 읽는다 — 새면 가게끼리 계약 조건을 알게 된다', async () => {
    await assertFails(getDoc(doc(asGuest(), 'config/settlement')))
    await assertSucceeds(getDoc(doc(asAdmin(), 'config/settlement')))
  })

  it('손님은 설정을 바꿀 수 없다', async () => {
    await assertFails(setDoc(doc(asGuest(), 'config/points'), { missionPoints: 99999 }))
  })
})
