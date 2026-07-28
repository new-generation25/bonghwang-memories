/**
 * 골목 가게 스티커와 가게 문서를 만든다.
 *
 *   node scripts/make-shop-qr.mjs              토큰을 지키며 다시 뽑는다
 *   node scripts/make-shop-qr.mjs --rotate cp1 그 가게 토큰만 새로 만든다
 *
 * 내놓는 것 세 가지 — 손으로 옮겨 적을 일이 없게 한자리에서 만든다:
 *   shop-qr/{가게}.html  카운터에 붙일 A5 인쇄물 (QR + 토큰)
 *   shop-qr/seed.txt     Firestore에 가게 문서를 심는 브라우저 콘솔 스니펫
 *   shop-qr/tokens.json  토큰 보관 — 다시 돌려도 같은 값이 나오게 한다
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

// ---------------------------------------------------------------------------

const rotate = process.argv.includes('--rotate')
  ? process.argv[process.argv.indexOf('--rotate') + 1]
  : null

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
}

fs.writeFileSync(TOKENS, JSON.stringify(kept, null, 2))

/*
  가게 문서는 관리자만 쓸 수 있다(규칙). 서비스 계정 키를 저장소에 두지
  않으려고 서버에서 심지 않고, 관리자로 로그인한 브라우저 콘솔에 붙여넣는
  방식을 쓴다 — seed-demo.mjs와 같은 결이다.

  staffUids는 비워 둔다. 가게 계정을 앱 회원가입으로 만든 뒤 콘솔에서
  uid를 복사해 채운다 — 그때까지 그 가게는 보조 경로를 쓸 수 없다.
*/
const seed = `// 봉황 메모리즈 — 가게 문서 심기
// 관리자(socialceos@gmail.com)로 로그인한 탭의 콘솔에 붙여넣는다.
// ★ STAFF의 빈칸을 가게 계정 uid로 채운 뒤 실행할 것.

const STAFF = {
${shops.map((s) => `  ${s.shopId}: [''],   // ${s.name} — shop${s.shopId} 계정 uid`).join('\n')}
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

const { getFirestore, doc, setDoc } = await import(
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
)
const db = getFirestore()
for (const s of SHOPS) {
  const staffUids = STAFF[s.shopId].filter(Boolean)
  if (!staffUids.length) console.warn(s.shopId + ': staffUids가 비었다 — 보조 경로를 못 쓴다')
  await setDoc(doc(db, 'shops', s.shopId), { ...s, staffUids })
  console.log('OK', s.shopId, s.name)
}
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
console.log('  1. shop-qr/*.html 을 A5로 인쇄해 카운터에 붙인다')
console.log('  2. shop-qr/seed.txt 의 STAFF를 가게 계정 uid로 채워 콘솔에 붙여넣는다')
