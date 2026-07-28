/**
 * 골목 가게 스티커와 가게 문서를 만든다.
 *
 *   node scripts/make-shop-qr.mjs              토큰을 지키며 다시 뽑는다
 *   node scripts/make-shop-qr.mjs --rotate cp1 그 가게 토큰만 새로 만든다
 *
 * 내놓는 것 네 가지 — 손으로 옮겨 적을 일이 없게 한자리에서 만든다:
 *   shop-qr/{가게}.html        카운터에 붙일 A5 인쇄물 (QR + 토큰)
 *   shop-qr/{가게}-guide.html  사장님께 드릴 A4 안내문 한 장
 *   shop-qr/seed.txt           Firestore에 가게 문서를 심는 콘솔 스니펫
 *   shop-qr/tokens.json        토큰 보관 — 다시 돌려도 같은 값이 나오게 한다
 *
 * 토큰을 지키는 것이 이 스크립트의 핵심이다. 다시 돌릴 때마다 새 값이
 * 나오면 이미 붙여둔 스티커가 조용히 죽는다 — 사장님은 "어제는 됐는데"
 * 라고만 말할 수 있고 원인을 찾는 데 한나절이 간다.
 *
 * shop-qr/은 gitignore다. 토큰이 저장소에 올라가면 가게에 가지 않고도
 * 쿠폰을 태울 수 있다. public/에도 두지 않는다 — 주소만 알면 열린다.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import QRCode from 'qrcode'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'shop-qr')
const TOKENS = path.join(OUT, 'tokens.json')

/** 스티커 QR에 담기는 값 — src/lib/shops.ts의 SHOP_QR_PREFIX와 같아야 한다 */
const PREFIX = 'BHSHOP'

/*
  헷갈리는 글자(O/0, I/1)를 뺀 32진수. coupons.ts의 쿠폰 코드와 같은 표다 —
  카메라가 안 될 때 사장님이나 참여자가 토큰을 눈으로 읽고 손으로 쳐야 하기
  때문이다. .mjs에서 .ts를 불러올 수 없어 여기 한 벌 더 둔다.
*/
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/** 40비트 — 찍어서 알아내는 값이 아니라 스티커 앞에 서야 얻는 값이라 이 길이면 된다 */
function newToken() {
  const bytes = crypto.randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

// ---------------------------------------------------------------------------
// 쿠폰 카탈로그는 coupons.ts가 원본이다 — 여기로 옮겨 적지 않고 읽어 쓴다
// ---------------------------------------------------------------------------

function readCatalog() {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/coupons.ts'), 'utf8')
  const body = src.slice(src.indexOf('export const COUPONS'))
  const end = body.indexOf('\n}')
  const rows = body.slice(0, end).matchAll(
    /(\w+):\s*\{\s*id:\s*'([^']+)',\s*shopId:\s*'([^']+)',\s*shop:\s*'([^']+)',\s*benefit:\s*'([^']+)',\s*unitWon:\s*(\d+),\s*track:\s*(\d+)/g
  )
  const out = []
  for (const m of rows) {
    out.push({
      couponId: m[2],
      shopId: m[3],
      name: m[4],
      benefit: m[5],
      unitWon: Number(m[6]),
      track: Number(m[7]),
    })
  }
  if (!out.length) {
    console.error('coupons.ts에서 COUPONS를 읽지 못했다 — 표 모양이 바뀌었는지 본다.')
    process.exit(1)
  }
  return out
}

// ---------------------------------------------------------------------------
// 인쇄물
// ---------------------------------------------------------------------------

/**
 * 토큰을 QR 아래에 글자로도 찍는다.
 * 카메라가 안 되는 참여자가 손으로 넣을 수 있어야 하는데, 그 글자를 읽으려면
 * 어차피 이 종이 앞에 서 있어야 하므로 QR과 신뢰 수준이 같다.
 */
function sheet(shop, svg) {
  return `<!doctype html>
<meta charset="utf-8">
<title>${shop.name} — 봉황 메모리즈 쿠폰</title>
<style>
  @page { size: A5; margin: 12mm; }
  body { margin:0; font-family:"Malgun Gothic","맑은 고딕",sans-serif;
         color:#262422; text-align:center; }
  .wrap { display:flex; flex-direction:column; align-items:center;
          justify-content:center; min-height:100vh; }
  h1 { font-size:22pt; margin:0 0 2mm; }
  .benefit { font-size:13pt; color:#5b5551; margin:0 0 8mm; }
  svg { width:78mm; height:78mm; }
  .how { font-size:11pt; line-height:1.7; margin-top:7mm; }
  .token { margin-top:5mm; font-family:Consolas,monospace; font-size:15pt;
           letter-spacing:.18em; }
  .token span { font-size:9pt; letter-spacing:0; color:#8a827c; display:block; }
  .foot { margin-top:9mm; font-size:8.5pt; color:#8a827c; }
</style>
<div class="wrap">
  <h1>${shop.name}</h1>
  <p class="benefit">${shop.benefit}</p>
  ${svg}
  <p class="how"><b>손님께</b><br>봉황 메모리즈 앱에서<br>[가게에서 사용하기]로 찍어주세요</p>
  <p class="token">${shop.postToken}<span>QR이 안 읽히면 이 글자를 입력</span></p>
  <p class="foot">봉황 메모리즈 EP.1 · ${shop.shopId}</p>
</div>
`
}

/**
 * 사장님께 드릴 A4 안내문.
 *
 * 카운터에서 급할 때 읽는 종이라 판단만 남긴다 — 무엇을 보면 드리고
 * 무엇을 보면 드리지 않는가. 원리 설명은 넣지 않았다.
 *
 * 아이디·비밀번호는 빈칸으로 둔다. 계정을 만든 사람이 손으로 적어
 * 건네는 편이, 파일에 적어 돌리다 새는 것보다 낫다.
 */
function guide(shop, origin) {
  return `<!doctype html>
<meta charset="utf-8">
<title>${shop.name} — 봉황 메모리즈 쿠폰 안내</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { margin:0; font-family:"Malgun Gothic","맑은 고딕",sans-serif;
         color:#262422; font-size:11.5pt; line-height:1.65; }
  h1 { font-size:19pt; margin:0 0 1mm; }
  .sub { color:#6b6560; font-size:10.5pt; margin:0 0 6mm; }
  h2 { font-size:13pt; margin:7mm 0 2mm; padding-bottom:1.5mm;
       border-bottom:2px solid #262422; }
  ol { margin:0; padding-left:6mm; }
  li { margin-bottom:1.5mm; }
  .big { background:#F3EAD3; padding:4mm 5mm; border-radius:3mm; margin:3mm 0; }
  table { width:100%; border-collapse:collapse; margin-top:2mm; }
  td { padding:2.5mm 2mm; border-bottom:1px solid #ddd7cf; vertical-align:top; }
  td.mark { width:22mm; font-size:15pt; text-align:center; }
  .give { color:#1f7a6b; font-weight:bold; }
  .no { color:#c0392b; font-weight:bold; }
  .fill { display:inline-block; min-width:42mm; border-bottom:1px solid #999;
          margin-left:2mm; }
  .foot { margin-top:8mm; font-size:9.5pt; color:#6b6560;
          border-top:1px solid #ddd7cf; padding-top:3mm; }
  b.url { font-family:Consolas,monospace; font-size:10.5pt; }
</style>

<h1>봉황 메모리즈 골목 쿠폰 — ${shop.name}</h1>
<p class="sub">손님이 골목을 걸으며 이야기를 듣고, 이 가게 쿠폰을 받아 옵니다.</p>

<div class="big">
  <b>드리는 것 — ${shop.benefit}</b><br>
  손님 한 분당 한 번입니다. 같은 쿠폰은 다시 쓸 수 없습니다.
</div>

<h2>기본 — 손님이 직접 찍습니다</h2>
<ol>
  <li>손님이 <b>카운터에 붙은 QR</b>을 앱으로 찍습니다. (사장님은 하실 일이 없습니다)</li>
  <li>손님 화면에 <b class="give">✓ 사용 완료</b>가 뜹니다.</li>
  <li>그 화면을 확인하시고 <b>${shop.benefit}</b>을 드리면 됩니다.</li>
</ol>

<h2>손님 휴대폰이 안 될 때 — 사장님이 대신</h2>
<ol>
  <li>가게 휴대폰으로 <b class="url">${origin}/shop/verify</b> 를 엽니다.</li>
  <li>처음 한 번만 로그인합니다.
      아이디<span class="fill"></span> 비밀번호<span class="fill"></span></li>
  <li><b>[손님 QR 찍기]</b>를 누르고 손님 화면의 QR을 찍습니다.<br>
      QR이 안 읽히면 손님 화면의 코드(BH1-…)를 직접 입력하셔도 됩니다.</li>
</ol>

<h2>화면을 보고 판단하세요</h2>
<table>
  <tr><td class="mark give">✓</td>
      <td><b class="give">사용 가능 / 사용 완료</b> — ${shop.benefit}을 드립니다.</td></tr>
  <tr><td class="mark no">✕</td>
      <td><b class="no">이미 사용됨</b> — 드리지 않습니다. 이미 쓴 쿠폰입니다.</td></tr>
  <tr><td class="mark">🧪</td>
      <td><b class="no">시험용 코드</b> — 드리지 않습니다. 점검용으로 만든 코드입니다.</td></tr>
  <tr><td class="mark">📶</td>
      <td><b>지금은 확인할 수 없어요</b> — 통신이 안 되는 상태입니다.
          이미 쓴 쿠폰일 수 있으니 <b>드리지 마시고</b> 잠시 뒤 다시 찍어주세요.</td></tr>
</table>

<h2>사용 내역 · 정산</h2>
<p style="margin:2mm 0 0">
  <b class="url">${origin}/shop/history</b> 에서 <b>오늘 몇 장</b>,
  <b>이번 달 몇 장</b>, <b>정산 예정 금액</b>을 직접 보실 수 있습니다.
  쿠폰 한 장 <b>${shop.unitWon.toLocaleString()}원</b> 기준입니다.
</p>

<div class="foot">
  카운터 QR이 훼손되거나 떨어지면 알려주세요 — 새로 보내드립니다.<br>
  문의 <span class="fill"></span> · 봉황 메모리즈 EP.1 · ${shop.shopId}
</div>
`
}

// ---------------------------------------------------------------------------

const rotate = process.argv.includes('--rotate')
  ? process.argv[process.argv.indexOf('--rotate') + 1]
  : null

/** 안내문에 찍히는 주소 — 도메인을 옮기면 --origin 으로 넘긴다 */
const ORIGIN = process.argv.includes('--origin')
  ? process.argv[process.argv.indexOf('--origin') + 1]
  : 'https://bonghwang-memories.vercel.app'

/**
 * 시드 스니펫에 넣을 Firebase 설정.
 *
 * 콘솔에서 gstatic으로 불러오는 SDK는 페이지 번들의 SDK와 다른 모듈
 * 인스턴스라 앱 등록부를 공유하지 않는다 — getFirestore()가 "앱이 없다"고
 * 한다. 그래서 스니펫이 자기 앱을 따로 세워야 하고, 그러려면 설정이 있어야
 * 한다. 값은 NEXT_PUBLIC_*이라 이미 클라이언트 번들에 들어 있는 공개값이다.
 *
 * 앱 이름이 같으면(기본값) Auth가 IndexedDB에 남은 세션을 그대로 복원하므로
 * 관리자로 로그인한 상태가 이어진다.
 */
function firebaseConfig() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) return null
  const env = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  const cfg = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  return cfg.apiKey && cfg.projectId ? cfg : null
}

const catalog = readCatalog()
fs.mkdirSync(OUT, { recursive: true })

let kept = {}
if (fs.existsSync(TOKENS)) kept = JSON.parse(fs.readFileSync(TOKENS, 'utf8'))

const shops = []
for (const c of catalog) {
  const fresh = !kept[c.shopId] || rotate === c.shopId
  const postToken = fresh ? newToken() : kept[c.shopId]
  kept[c.shopId] = postToken
  shops.push({ ...c, postToken, fresh })
}

for (const shop of shops) {
  const payload = `${PREFIX}:${shop.shopId}:${shop.postToken}`
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#262422', light: '#FFFFFF' },
  })
  fs.writeFileSync(path.join(OUT, `${shop.shopId}.html`), sheet(shop, svg))
  fs.writeFileSync(path.join(OUT, `${shop.shopId}-guide.html`), guide(shop, ORIGIN))
}

fs.writeFileSync(TOKENS, JSON.stringify(kept, null, 2))

/*
  가게 문서는 관리자만 쓸 수 있다(규칙). 서비스 계정 키를 저장소에 두지
  않으려고 서버에서 심지 않고, 관리자로 로그인한 브라우저 콘솔에 붙여넣는
  방식을 쓴다 — seed-demo.mjs와 같은 결이다.

  staffUids는 make-shop-accounts.mjs가 남긴 accounts.json에서 가져온다.
  계정을 아직 안 만들었으면 빈칸으로 나오고, 그 가게는 보조 경로를 못 쓴다.
*/
const accountsPath = path.join(OUT, 'accounts.json')
const accounts = fs.existsSync(accountsPath)
  ? JSON.parse(fs.readFileSync(accountsPath, 'utf8'))
  : {}
const staffOf = (shopId) => accounts[`shop${shopId}`]?.uid ?? ''

const cfg = firebaseConfig()
const seed = `// 봉황 메모리즈 — 가게 문서 심기
//
// 관리자(socialceos@gmail.com)로 로그인한 "앱" 탭의 콘솔에 붙여넣는다.
// (Firebase 콘솔 화면이 아니라 bonghwang-memories.vercel.app 또는 localhost:3000)
//
// 크롬이 붙여넣기를 막으면 콘솔에 allow pasting 을 직접 타이핑하고 Enter.

const CFG = ${JSON.stringify(cfg ?? { apiKey: '★ .env.local을 찾지 못했다' }, null, 2)}

const STAFF = {
${shops.map((s) => `  ${s.shopId}: ['${staffOf(s.shopId)}'],   // ${s.name}`).join('\n')}
}

const SHOPS = ${JSON.stringify(
  shops.map((s) => ({
    shopId: s.shopId,
    name: s.name,
    couponId: s.couponId,
    benefit: s.benefit,
    unitWon: s.unitWon,
    postToken: s.postToken,
    active: true,
  })),
  null,
  2
)}

// 여기서 불러오는 SDK는 페이지 번들의 것과 다른 모듈 인스턴스라 앱 등록부를
// 공유하지 않는다 — getFirestore()가 "앱이 없다"고 한다. 그래서 앱을 따로
// 세운다. 이름이 같아 Auth는 남아 있는 로그인 세션을 그대로 복원한다.
const V = 'https://www.gstatic.com/firebasejs/10.12.0'
const { initializeApp, getApps } = await import(V + '/firebase-app.js')
const { getAuth, onAuthStateChanged } = await import(V + '/firebase-auth.js')
const { getFirestore, doc, setDoc } = await import(V + '/firebase-firestore.js')

const app = getApps()[0] || initializeApp(CFG)
const auth = getAuth(app)
const user = auth.currentUser || await new Promise((res) => {
  const off = onAuthStateChanged(auth, (u) => { off(); res(u) })
})
if (!user) throw new Error('로그인이 확인되지 않는다. 앱에서 관리자로 로그인한 뒤 다시 실행할 것.')
console.log('로그인:', user.email)

const db = getFirestore(app)
for (const s of SHOPS) {
  const staffUids = (STAFF[s.shopId] || []).filter(Boolean)
  if (!staffUids.length) console.warn(s.shopId + ': staffUids가 비었다 — 보조 경로를 못 쓴다')
  await setDoc(doc(db, 'shops', s.shopId), { ...s, staffUids })
  console.log('OK', s.shopId, s.name)
}
console.log('끝 — 가게 ' + SHOPS.length + '곳')
`
fs.writeFileSync(path.join(OUT, 'seed.txt'), seed)

console.log(`가게 ${shops.length}곳 -> shop-qr/`)
for (const s of shops) {
  console.log(
    `  ${s.shopId.padEnd(4)} ${s.name.padEnd(8)} ${s.postToken}` +
      (s.fresh ? '  ← 새 토큰 (스티커 다시 인쇄)' : '')
  )
}
console.log('\n다음 —')
console.log('  1. shop-qr/{가게}.html 을 A5로 인쇄해 카운터에 붙인다')
console.log('  2. shop-qr/{가게}-guide.html 을 A4로 인쇄해 사장님께 드린다')
console.log('     (아이디·비밀번호 빈칸은 손으로 적어 건넨다)')
console.log('  3. shop-qr/seed.txt 의 STAFF를 가게 계정 uid로 채워 콘솔에 붙여넣는다')
