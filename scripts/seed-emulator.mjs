/**
 * 에뮬레이터에 시험용 가게와 계정을 심는다.
 *
 * 실물로 한 바퀴 돌아보려면 가게 문서와 스티커 토큰, 그리고 손님 계정이
 * 있어야 한다. 운영에서는 그것을 관리자 화면에서 하지만, 시험은 매번
 * 같은 상태에서 시작해야 하므로 여기서 심는다.
 *
 * 에뮬레이터는 규칙을 REST 경로에서 우회할 수 있다(`Authorization: Bearer owner`).
 * 그래서 서비스 계정 키가 없어도 관리자만 쓸 수 있는 문서를 세울 수 있다 —
 * 운영에서는 절대 통하지 않는 길이고, 그래서 시험에만 쓴다.
 *
 *   npm run seed:emulator      (에뮬레이터가 떠 있어야 한다)
 */

const PROJECT = process.env.EMU_PROJECT || 'bonghwang-memories'
const FS = `http://127.0.0.1:8681/v1/projects/${PROJECT}/databases/(default)/documents`
const AUTH = `http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1`

/** 스티커에 인쇄된 값 — shop-qr/의 것과 달라도 시험에서는 상관없다 */
const SHOPS = [
  { shopId: 'cp1', name: '봉황1935', token: 'AW5NAYAY' },
  { shopId: 'cp2', name: '미야상회', token: 'BC6MBZBZ' },
  { shopId: 'cp3', name: '능소화 고택', token: 'CD7PC2C2' },
  { shopId: 'cp4', name: '카페 탱자', token: 'DE8QD3D3' },
  { shopId: 'cp5', name: '방하림', token: 'EF9RE4E4' },
]

/** Firestore REST의 값 표기 — 타입을 손으로 적어야 한다 */
const S = (v) => ({ stringValue: v })
const N = (v) => ({ integerValue: String(v) })
const B = (v) => ({ booleanValue: v })
const T = (ms) => ({ timestampValue: new Date(ms).toISOString() })
const A = (arr) => ({ arrayValue: { values: arr } })

async function put(path, fields) {
  const res = await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`${path} — ${res.status} ${await res.text()}`)
}

async function signUp(email, password) {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const body = await res.json()
  // 이미 있으면 로그인해서 uid를 받아온다 — 다시 돌려도 같은 상태가 되게
  if (!res.ok) {
    const inRes = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
    const inBody = await inRes.json()
    if (!inRes.ok) throw new Error(`${email} — ${JSON.stringify(body)}`)
    return inBody.localId
  }
  return body.localId
}

try {
  await fetch(`${FS}/config/points`, { headers: { Authorization: 'Bearer owner' } })
} catch {
  console.error(
    '\n에뮬레이터에 닿지 못했습니다. 먼저 띄우세요:\n' +
      '  npx firebase emulators:start --only firestore,auth\n'
  )
  process.exit(1)
}

const now = Date.now()

console.log('\n가게 문서')
for (const s of SHOPS) {
  const staffUid = await signUp(`shop${s.shopId}@bonghwang.local`, 'test1234')
  await put(`shops/${s.shopId}`, {
    shopId: S(s.shopId),
    name: S(s.name),
    couponId: S(s.shopId),
    benefit: S('시험용'),
    unitWon: N(1000),
    postToken: S(s.token),
    staffUids: A([S(staffUid)]),
    active: B(true),
    // 협력 무리와 추가 쿠폰 — 이 두 칸이 없어 그룹·뽑기 쿠폰이 거절됐다
    group: S(s.shopId === 'cp1' || s.shopId === 'cp4' ? 'cafe' : ''),
    accepts: A(
      s.shopId === 'cp4' ? [S('gcTangja')] : s.shopId === 'cp1' ? [S('gcBonghwang')] : []
    ),
    groupCoupons: A(
      s.shopId === 'cp1' || s.shopId === 'cp4' ? [S('gcCafe'), S('gcCafe2')] : []
    ),
    // 시범운영 — 무료 등급, 충당률 0%
    tier: S('free'),
    coverageRate: N(0),
    monthlyCapWon: N(30000),
    monthlyFeeWon: N(0),
    contract: S('active'),
    joinedAt: T(now),
    rateSince: T(now),
  })
  console.log(`  ${s.shopId} ${s.name} · 스티커 ${s.token} · 사장님 shop${s.shopId}/test1234`)
}

console.log('\n손님 계정')
const guestUid = await signUp('walker@bonghwang.local', 'test1234')
await put(`users/${guestUid}`, {
  uid: S(guestUid),
  loginId: S('walker'),
  nickname: S('시험걷는이'),
  nicknameKey: S('시험걷는이'),
  provider: S('password'),
  totalPoints: N(0),
  paid: B(true),
})
console.log(`  walker/test1234 · uid ${guestUid}`)

console.log('\n설정값')
await put('config/points', {
  minRedeemPoints: N(3000),
  pointExpiryMonths: N(6),
  missionPoints: N(100),
  linePoints: N(500),
  completePoints: N(200),
})
await put('config/settlement', {
  'coverage.free': N(0),
  capAlertPercent: N(80),
  budgetPercent: N(3),
  couponFaceWon: N(4500),
})
console.log('  config/points · config/settlement')

console.log(
  '\n✅ 심었습니다. 앱을 에뮬레이터에 붙여 여세요:\n' +
    '  NEXT_PUBLIC_USE_EMULATOR=1 npm run dev\n'
)
