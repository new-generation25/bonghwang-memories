#!/usr/bin/env node
/**
 * 관리자 대시보드 검증용 가상 데이터.
 *
 * ⚠️ 실서비스 전에 반드시 지운다 — `--clear`로 한 번에 삭제된다.
 * 모든 문서에 demo: true 를 달아두므로 그것만 골라 지운다.
 *
 * 보안 규칙이 클라이언트 쓰기를 막고 있으므로(남의 uid로 못 씀) 이 스크립트는
 * Firestore REST API를 관리자 인증 없이 쓸 수 없다. 대신 브라우저에서
 * 관리자로 로그인한 채 실행하도록 JS 스니펫을 뽑아준다.
 *
 *   node scripts/seed-demo.mjs            → 스니펫 출력
 *   node scripts/seed-demo.mjs --clear    → 삭제 스니펫 출력
 */

const N = 24
const NICKS = [
  '골목산책자', '테이프수집가', '봉황동토박이', '늦은귀향', '카세트키드',
  '능소화', '분식러버', '바나나우유', '릴감기', '소녀시대팬',
  '가야스탬프', '우물가', '벽화골목', '해질녘', '삼남매',
  '아빠딸', '주말산책', '필름카메라', '오래된편지', '봉황대오르막',
  '첫사랑골목', '라디오사연', '노란병', '타임캡슐',
]
const CELLS = [
  'bunsik', 'b02', 'byeokhwa', 'b04', 'b05', 'b06', 'bonghwangdae', 'b08',
  'b09', 'b10', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16', 'b17', 'b18',
  'b19', 'b20',
]
const FAVORITES = [
  '골목에서 테이프를 발견한 순간',
  '봉황1935 사장님의 이야기',
  '능소화가 다시 핀 순간',
  '라디오 사연을 들은 순간',
  'B면에 숨겨진 아버지의 편지',
  '골목 빙고를 돌아다닌 시간',
]
const DIFF = ['쉬웠다', '적당했다', '조금 헤맸다', '많이 헤맸다']
const SHOPS = ['봉황1935', '미야상회', '카페 탱자', '방하림', '분식점', '']
const FREE = [
  '아버지 생각이 났어요.',
  '소영이 목소리가 좋았습니다.',
  '중간에 길을 좀 헤맸어요.',
  '',
  '부모님이랑 다시 오고 싶어요.',
  '',
]

const POINTS = {
  mainMission: 300,
  bonusMission: 50,
  specialMission: 100,
  shareRecord: 100,
  treasureLine: 50,
  survey: 200,
}

/** 결정적 난수 — 매번 같은 데모 데이터가 나오도록 */
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function build() {
  const rand = rng(19880917)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const now = Date.now()
  const users = []

  for (let i = 0; i < N; i++) {
    // 최근 30일에 흩뿌리되 절반은 최근 7일에 몰아 준다(주말 행사 가정)
    const daysAgo = rand() < 0.5 ? Math.floor(rand() * 7) : Math.floor(rand() * 30)
    const hour = 10 + Math.floor(rand() * 8) // 10~17시 시작
    const start = new Date(now - daysAgo * 86400000)
    start.setHours(hour, Math.floor(rand() * 60), 0, 0)
    const startedAt = start.getTime()

    // 이탈 분포 — 뒤로 갈수록 줄어든다
    const r = rand()
    const tracks = r < 0.12 ? 0 : r < 0.22 ? 1 : r < 0.32 ? 2 : r < 0.44 ? 3 : r < 0.58 ? 4 : 5
    const finished = tracks === 5 && rand() < 0.75
    const cellCount = finished ? Math.floor(rand() * 14) + 4 : tracks === 5 ? Math.floor(rand() * 5) : 0
    const cells = CELLS.slice(0, cellCount)
    const lines = Math.floor(cellCount / 6)
    const shared = finished && rand() < 0.55
    const surveyed = finished && rand() < 0.7
    const special = tracks >= 4 && rand() < 0.8

    const entries = []
    for (let t = 1; t <= tracks; t++) entries.push([`main-${t}`, 'mainMission'])
    for (const c of cells) entries.push([`bingo-cell-${c}`, 'bonusMission'])
    for (let l = 1; l <= lines; l++) entries.push([`bingo-line-${l}`, 'treasureLine'])
    if (special) entries.push(['special-bside-unlock', 'specialMission'])
    if (shared) entries.push([`share-demo-${i}`, 'shareRecord'])
    if (surveyed) entries.push(['survey-ep1-finish', 'survey'])

    const totalPoints = entries.reduce((a, [, reason]) => a + POINTS[reason], 0)
    const durationMs = (70 + Math.floor(rand() * 50)) * 60000

    users.push({
      uid: `demo-${String(i + 1).padStart(3, '0')}`,
      nickname: NICKS[i % NICKS.length],
      totalPoints,
      missionCount: tracks + cells.length,
      tracksCompleted: tracks,
      bingoCells: cells.length,
      bingoLines: lines,
      couponCount: lines,
      phase: finished ? 'done' : tracks >= 5 ? 'act2' : tracks > 0 ? 'act1' : 'intro',
      startedAt,
      finishedAt: finished ? startedAt + durationMs : null,
      entries,
      survey: surveyed
        ? {
            nps: 3 + Math.floor(rand() * 3),
            favorite: pick(FAVORITES),
            difficulty: pick(DIFF),
            shop: pick(SHOPS),
            free: pick(FREE),
          }
        : null,
      post: shared
        ? { missionTitle: `TRACK ${1 + Math.floor(rand() * 5)} · 오늘의 기록`, comment: pick(FREE) || '좋았어요.' }
        : null,
    })
  }
  return users
}

const users = build()
const clear = process.argv.includes('--clear')

const snippet = clear
  ? `
// ── 봉황 메모리즈 데모 데이터 삭제 ──
// 관리자(socialceos@gmail.com)로 로그인한 상태에서 실행하세요.
(async () => {
  const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } =
    await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js')
  const db = getFirestore()
  let n = 0
  const users = await getDocs(query(collection(db, 'users'), where('demo', '==', true)))
  for (const u of users.docs) {
    for (const sub of ['points', 'surveyResponses', 'progress']) {
      const s = await getDocs(collection(db, 'users', u.id, sub))
      for (const d of s.docs) { await deleteDoc(d.ref); n++ }
    }
    await deleteDoc(u.ref); n++
  }
  const posts = await getDocs(query(collection(db, 'posts'), where('demo', '==', true)))
  for (const p of posts.docs) { await deleteDoc(p.ref); n++ }
  console.log('삭제 완료:', n, '건')
})()
`
  : `
// ── 봉황 메모리즈 데모 데이터 투입 (${users.length}명) ──
// ⚠️ 실서비스 전 반드시 삭제하세요: node scripts/seed-demo.mjs --clear
// 관리자(socialceos@gmail.com)로 로그인한 상태에서 실행하세요.
(async () => {
  const { getFirestore, doc, setDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js')
  const db = getFirestore()
  const DATA = ${JSON.stringify(users)}
  let n = 0
  for (const u of DATA) {
    await setDoc(doc(db, 'users', u.uid), {
      demo: true, uid: u.uid, nickname: u.nickname, provider: 'demo',
      totalPoints: u.totalPoints, missionCount: u.missionCount,
      tracksCompleted: u.tracksCompleted, bingoCells: u.bingoCells,
      bingoLines: u.bingoLines, couponCount: u.couponCount,
      phase: u.phase, paid: true,
      startedAt: u.startedAt, finishedAt: u.finishedAt,
      lastActiveAt: serverTimestamp(), createdAt: u.startedAt,
    })
    n++
    for (const [refId, reason] of u.entries) {
      await setDoc(doc(db, 'users', u.uid, 'points', refId.replace(/[/#?\\[\\]*]/g, '_')), {
        demo: true, refId, reason,
        points: ${JSON.stringify(POINTS)}[reason],
        createdAt: new Date(u.startedAt),
      })
      n++
    }
    if (u.survey) {
      await setDoc(doc(db, 'users', u.uid, 'surveyResponses', 'ep1-finish'), {
        demo: true, uid: u.uid, surveyId: 'ep1-finish',
        answers: u.survey, createdAt: new Date(u.finishedAt || u.startedAt),
      })
      n++
    }
    if (u.post) {
      await setDoc(doc(db, 'posts', 'demo-post-' + u.uid), {
        demo: true, authorUid: u.uid, authorNickname: u.nickname,
        missionTitle: u.post.missionTitle, comment: u.post.comment,
        likes: 0, likedBy: [], commentCount: 0, edited: false,
        imagePath: '', imageUrl: '',
        createdAt: new Date(u.finishedAt || u.startedAt),
      })
      n++
    }
  }
  console.log('투입 완료:', n, '건 /', DATA.length, '명')
})()
`

console.log(snippet.trim())
console.error(
  `\n--- 위 스니펫을 앱(localhost:3000)에서 관리자로 로그인한 뒤 콘솔에 붙여넣으세요 ---`
)
