/**
 * 로컬 메모리즈 BEP 모델 — 순수 계산 모듈
 *
 * DOM·브라우저 의존이 전혀 없다. 앱(클라이언트)·서버(API)·검증 스크립트가
 * 모두 이 파일 하나를 import 해서 같은 숫자를 낸다.
 *
 * 입력 P 는 평면 객체이며 **비율은 소수**로 담는다 (15% → 0.15).
 * 연차별 값은 접미사 26 / 27 / 28 을 붙인다 (cv26, cv27, cv28).
 *
 * 사용:
 *   import { DEFAULTS, runModel } from "./bepModel.js";
 *   const { rows, kpi } = runModel({ ...DEFAULTS, cv28: 0.15 });
 */

/* ─────────────────────────── 기간 ─────────────────────────── */

export const MONTHS = (() => {
  const a = [];
  [9, 10, 11, 12].forEach((m) => a.push([2026, m]));
  for (let m = 1; m <= 12; m++) a.push([2027, m]);
  for (let m = 1; m <= 12; m++) a.push([2028, m]);
  return a;
})();

/** 지역 수는 분기 단위로만 계단식 증가한다 */
const STEP = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];

/* ─────────────────────── 연차별 목표치 ─────────────────────── */

/**
 * [key, 라벨, 2026말, 2027말, 2028말]
 *
 * 값은 8/2 확정안(`docs/bep/seed-scenario.json`)이다. 그날은 시나리오 파일로만
 * 남기고 기본값을 옛 숫자로 뒀는데, 그래서 시뮬레이터를 열면 확정 전 숫자가
 * 떴다 — 불러오기를 눌러야 보이는 값은 아무도 안 본다.
 */
export const YEAR_KEYS = [
  ["g", "제휴 가맹점 수 (곳)", 25, 80, 150],
  ["gb", "일반(무료) 상점 수 (곳)", 20, 60, 80],
  ["gp", "프리미엄 상점 수 (곳)", 5, 12, 50],
  ["gs", "스토리 파트너 수 (곳)", 0, 8, 20],
  ["tpd", "거점당 하루 진입 팀 (팀)", 3.3, 3.6, 4.1],
  ["cv", "결제 전환율", 0.09, 0.12, 0.15],
  ["mix", "2단 비중", 0.3, 0.4, 0.5],
  ["ku", "3단 업셀률", 0.05, 0.08, 0.15],
  // covMode가 1(자동)이면 이 값은 안 쓰인다. 직접입력으로 돌렸을 때의 값이다
  ["cov", "상점 충당률", 0, 1, 1],
  ["pu", "포인트 실사용률", 0.35, 0.45, 0.5],
  ["rv", "재방문 비중", 0, 0.08, 0.15],
  ["reg", "운영 지역 수 (곳)", 1, 3, 5],
  ["grp", "단체 예약 연 건수 (건)", 0, 0, 10],
];

/* ───────────────────────── 기본값 ───────────────────────── */

export const DEFAULTS = (() => {
  const D = {
    /* 퍼널·제약 */
    capMode: 1, // 0 = 지역당 고정 상한, 1 = 상권 침투율 기준 자동
    penMax: 0.3, // 상권 침투율 상한
    cap: 60, // capMode 0 일 때 지역 1곳당 상한
    vis: 30000, // 지역 1곳 월 방문객
    tm: 2.5, // 팀 평균 인원
    run: 1, // QR 후 게임 실행률

    /* 고정비 */
    opx: 2100000, // 월 운영비
    rgx: 400000, // 지역 1곳 추가당 월 관리비
    ceoS: 202703,
    ceo1: 2600000,
    ceo2: 3000000, // 대표 인건비 (2028~ ceo2)
    empS: 202706,
    emp: 2300000, // 신규 직원

    /* 조달 */
    l1m: 202609,
    l1: 30000000,
    l2m: 202702,
    l2: 0,
    rate: 0.05,
    grace: 24,
    term: 36,
    gov: 60000000, // 참고 표시용 — 손익·현금 어디에도 반영하지 않는다
    ownT: 30000000,
    ownK: 30000000,
    own: 0, // 자부담 총액 / 현물 / 현금유출

    /* 가격 · 원가 */
    p1: 5000,
    p2: 13000,
    p3: 35000,
    cg: 2500, // 굿즈 원가 (2단 상품 동봉) — 포인트 굿즈 pgCost와 같은 기준이다
    ck: 12000, // 3단 키트 추가원가
    cf: 0.03, // PG 결제 수수료율

    /* 쿠폰 */
    cp: 3500, // 액면
    thr: 8000, // 최소 결제 문턱
    cpUse: 0.5, // 실사용률
    mgn: 0.35, // 상점 매출총이익률
    covMode: 1, // 0 = 충당률 직접입력, 1 = 문턱·한도 자동
    covS: 202701, // 상점 충당 개시
    useCap: 1, // 상점 월 부담 한도 병행 적용
    limB: 10000,
    limP: 30000,
    exit: 50000,
    d1: 0.4,
    m1: 1, // 결제 분포 : 문턱만 / 1.5배 / 2.5배
    d2: 0.4,
    m2: 1.5,
    d3: 0.2,
    m3: 2.5,

    /* 뽑기 실물 */
    gaN: 2.2, // 팀당 뽑기 횟수
    gaP: 0.3, // 실물 당첨 비중
    gaC: 3000, // 실물 평균 원가

    /* 회비 · 리워드 */
    feeS: 202701, // 가맹회비 개시 연월 (그 전에는 전 등급 0원)
    fb: 0,
    fp: 10000,
    fs: 30000,
    rew: 300, // 송객 성과 리워드 건당
    rewT: 1, // 0 = 전등급, 1 = 프리미엄 이상

    /* 포인트 */
    ptMode: 1, // 0 = 상점 결제 사용, 1 = 앱내 전용
    pMissionN: 5,
    pMission: 100,
    pBonusN: 2.5,
    pBonus: 100,
    pBingoN: 2.2,
    pBingo: 500,
    pFinish: 200,
    pEtc: 400,
    pRate: 0.6, // 평균 달성률
    pLife: 6, // 유효기간 (개월)
    pgShare: 0.3, // 사용 포인트 중 굿즈 교환 비중
    pgCost: 2500, // 굿즈 1개 원가
    pgRate: 5000, // 교환 레이트 = 소비자 정가. 1p = 1원이므로 원가의 1.5~2.5배가 적정

    /* 단체 */
    gv: 1000000,
    gc: 0.5,

    /* 상점 리포트 전용 (손익 미반영) */
    incr: 0.6,
    pMul: 3,
    vat: 0.1,
  };
  YEAR_KEYS.forEach(([k, , a, b, c]) => {
    D[k + "26"] = a;
    D[k + "27"] = b;
    D[k + "28"] = c;
  });
  return D;
})();

/* ─────────────────────── 보조 계산 ─────────────────────── */

const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);

/** 연차별 값의 월 보간. 2026년은 4개월간 26말 값을 유지, 이후는 전년말 → 당해말 균등 보간 */
function interp(P, k, y, m) {
  if (y === 2026) return num(P[k + "26"]);
  const a = num(P[k + (y === 2027 ? "26" : "27")]);
  const b = num(P[k + (y === 2027 ? "27" : "28")]);
  return a + (b - a) * (m - 1) / 11;
}

function regionsOf(P, y, i) {
  if (y === 2026) return Math.round(num(P.reg26));
  const a = Math.round(num(P[y === 2027 ? "reg26" : "reg27"]));
  const b = Math.round(num(P[y === 2027 ? "reg27" : "reg28"]));
  return Math.round(a + STEP[i] * (b - a) / 2);
}

/**
 * 쿠폰 경제 — 상점 1장당 손익과 문턱 기준 최대 충당률.
 * 화면(상점 충당률 설계 탭)과 모델이 같은 값을 쓰도록 분리해 둔다.
 */
export function couponEconomics(P) {
  const face = num(P.cp), thr = num(P.thr), mgn = num(P.mgn);
  const w = num(P.d1) + num(P.d2) + num(P.d3) || 1;
  const avgMult =
    (num(P.d1) * num(P.m1) + num(P.d2) * num(P.m2) + num(P.d3) * num(P.m3)) / w;
  const avgSpend = thr * avgMult;
  return {
    face,
    thr,
    mgn,
    avgMult,
    avgSpend,
    baseProfit: thr * mgn - face, // 문턱만 딱 맞췄을 때
    profit: avgSpend * mgn - face, // 초과 지출 반영
    covMax: face > 0 ? Math.min(1, (avgSpend * mgn) / face) : 0,
    covRaw: face > 0 ? (avgSpend * mgn) / face : 0, // 1 초과 = 포화(여유 배율)
    mgnCrit: avgSpend > 0 ? face / avgSpend : 0, // 이 마진율 아래로 내려가야 충당률이 움직인다
  };
}

/**
 * 포인트 경제 — 기대 적립과 굿즈 단위원가.
 * 건당 자사 원가 = 기대적립 × 실사용률 × 굿즈구성비 × 단위원가
 */
export function pointEconomics(P) {
  const max =
    num(P.pMissionN) * num(P.pMission) +
    num(P.pBonusN) * num(P.pBonus) +
    num(P.pBingoN) * num(P.pBingo) +
    num(P.pFinish) +
    num(P.pEtc);
  const expected = max * num(P.pRate);
  const unitCost = num(P.pgRate) > 0 ? num(P.pgCost) / num(P.pgRate) : 0;
  return {
    max,
    expected,
    unitCost,
    rateMultiple: num(P.pgCost) > 0 ? num(P.pgRate) / num(P.pgCost) : 0,
  };
}

/* ─────────────────────────── 본체 ─────────────────────────── */

/**
 * @param {object} params  DEFAULTS 와 같은 형태. 비율은 소수.
 * @returns {{rows: object[], kpi: object, capped: boolean}}
 */
export function runModel(params) {
  const P = { ...DEFAULTS, ...(params || {}) };

  const vis = num(P.vis), tmv = num(P.tm), run = num(P.run);
  const kitDelta = num(P.p3) - num(P.p2);
  const ownMonthly = num(P.own) / 12;

  const pt = pointEconomics(P);
  const cpn = couponEconomics(P);
  const appPoint = num(P.ptMode) >= 1;

  const rows = [];
  let cum = 0, cash = 0, debt = 0, capped = false;
  const principal = num(P.l1) + num(P.l2);
  const loanIdx = MONTHS.findIndex(([y, m]) => y * 100 + m === num(P.l1m));

  MONTHS.forEach(([y, m], i) => {
    const ym = y * 100 + m;
    const idx = y === 2026 ? m - 9 : m - 1;

    /* ── 가맹점 수와 상한 ── */
    let g = interp(P, "g", y, m);
    let gb = interp(P, "gb", y, m);
    let gp = interp(P, "gp", y, m);
    let gs = interp(P, "gs", y, m);
    const reg = regionsOf(P, y, idx);
    const tpd = interp(P, "tpd", y, m);
    const rv = interp(P, "rv", y, m);

    // 가맹점 1곳이 상권에 만들어 내는 월 순방문 인원
    const perShopPpl = tpd * 30 * run * (1 - rv) * tmv;
    const gcap =
      num(P.capMode) >= 1
        ? perShopPpl > 0
          ? (num(P.penMax) * reg * vis) / perShopPpl
          : Infinity
        : reg * num(P.cap);
    if (g > gcap) {
      const sc = gcap / g;
      g = gcap;
      gb *= sc;
      gp *= sc;
      gs *= sc;
      capped = true;
    }

    /* ── 퍼널 ── */
    const cv = interp(P, "cv", y, m);
    const mix = interp(P, "mix", y, m);
    const ku = interp(P, "ku", y, m);
    const pu = interp(P, "pu", y, m);
    const grp = num(P[y === 2026 ? "grp26" : y === 2027 ? "grp27" : "grp28"]);

    const qr = g * tpd * 30 * run;
    const pay = qr * cv;
    const ppl = qr * (1 - rv) * tmv;
    const pen = reg * vis > 0 ? ppl / (reg * vis) : 0;
    const price = (1 - mix) * num(P.p1) + mix * num(P.p2) + ku * kitDelta;

    /* ── 리워드 사용액과 상점 충당 ── */
    const useCpn = pay * mix * num(P.cp) * num(P.cpUse);
    const usePt = appPoint ? 0 : pay * pt.expected * pu;
    const useAll = useCpn + usePt;

    const lim =
      ym >= num(P.covS) ? gb * num(P.limB) + (gp + gs) * num(P.limP) : 0;

    let cov = interp(P, "cov", y, m);
    if (num(P.covMode) >= 1) {
      cov = ym >= num(P.covS) ? Math.min(1, cpn.covRaw) : 0;
      if (num(P.useCap) >= 1 && useAll > 0) cov = Math.min(cov, lim / useAll);
    }
    const mine = useAll * (1 - cov);
    const shop = useAll * cov;

    /* ── 매출 ── */
    const b2c = pay * price;
    const b2b =
      ym >= num(P.feeS)
        ? gb * num(P.fb) + gp * num(P.fp) + gs * num(P.fs)
        : 0;
    const grpR = (grp * num(P.gv)) / 12;
    const rev = b2c + b2b + grpR;

    /* ── 변동원가 ── */
    const rewShare = num(P.rewT) >= 1 ? (g ? (gp + gs) / g : 0) : 1;
    const rewCost = pay * num(P.rew) * rewShare;
    const ptApp = appPoint
      ? pay * pt.expected * pu * num(P.pgShare) * pt.unitCost
      : 0;
    const gaCost = pay * num(P.gaN) * num(P.gaP) * num(P.gaC);
    const cost =
      pay * (num(P.cg) + ku * num(P.ck)) +
      b2c * num(P.cf) +
      mine +
      ptApp +
      rewCost +
      gaCost +
      grpR * num(P.gc);
    const vc = pay ? (cost - grpR * num(P.gc)) / pay : 0;
    const shopLoad = g ? (b2b + shop - rewCost) / g : 0;

    /* ── 고정비 · 손익 ── */
    let ceo = 0;
    if (ym >= num(P.ceoS)) ceo = y >= 2028 ? num(P.ceo2) : num(P.ceo1);
    const emp = ym >= num(P.empS) ? num(P.emp) : 0;
    const fix = num(P.opx) + (reg - 1) * num(P.rgx) + ceo + emp;
    const pl = rev - cost - fix;
    cum += pl;

    // 월 손익 0 이 되는 데 필요한 가맹점 수
    const perShop =
      tpd * 30 * run * cv * (price - vc) + (g ? b2b / g : 0);
    const bepG = perShop > 0 ? (fix - grpR * (1 - num(P.gc))) / perShop : NaN;

    /* ── 현금 ── */
    let inflow = 0;
    if (ym === num(P.l1m)) inflow += num(P.l1);
    if (num(P.l2) && ym === num(P.l2m)) inflow += num(P.l2);
    debt += inflow;
    let intr = 0, repay = 0;
    if (num(P.rate) > 0 && debt > 0) {
      intr = (debt * num(P.rate)) / 12;
      if (i >= (loanIdx < 0 ? 0 : loanIdx) + num(P.grace) && num(P.term) > 0) {
        repay = Math.min(debt, principal / num(P.term));
        debt -= repay;
      }
    }
    const ownOut = i < 12 ? ownMonthly : 0;
    cash += inflow + pl - ownOut - intr - repay;

    rows.push({
      ym: `${y}.${String(m).padStart(2, "0")}`, y, m, g, newg: 0, gb, gp, gs, reg,
      vis: reg * vis, tpd, run, qr, ppl, pen, cv, pay,
      n1: pay * (1 - mix), n2: pay * mix, nk: pay * ku, mix, ku, cov, pu, price, vc,
      useCpn, usePt, useAll, mine, shop, lim, shopLoad,
      rewCost, gaCost, ptApp,
      ptMine: appPoint ? ptApp : usePt * (1 - cov),
      ptIssue: pay * pt.expected,
      b2c, b2b, grpR, rev, cost,
      opx: num(P.opx), rgx: (reg - 1) * num(P.rgx), ceo, emp, fix,
      bepG, pl, cum, inflow, ownOut, fin: intr + repay, debt, cash,
    });
  });

  rows.forEach((r, i) => (r.newg = i ? r.g - rows[i - 1].g : r.g));

  const last = rows[rows.length - 1];
  const minCash = Math.min(...rows.map((r) => r.cash));
  const kpi = {
    cum2812: Math.round(last.cum),
    cash2812: Math.round(last.cash),
    minCum: Math.round(Math.min(...rows.map((r) => r.cum))),
    minCash: Math.round(minCash),
    minCashMonth: (rows.find((r) => r.cash === minCash) || {}).ym || null,
    surplusMonth: (rows.find((r) => r.pl > 0) || {}).ym || null,
    recoverMonth: (rows.find((r) => r.cum > 0) || {}).ym || null,
    bepShops: Number(last.bepG.toFixed(1)),
    penOver: rows.filter((r) => r.pen > num(P.penMax) + 1e-9).map((r) => r.ym),
    pointPerPay: Math.round(last.pay ? last.ptApp / last.pay : 0),
    gachaPerPay: Math.round(last.pay ? last.gaCost / last.pay : 0),
    coverage2812: Number(last.cov.toFixed(3)),
  };

  return { rows, kpi, capped, coupon: cpn, point: pt };
}

/* ───────────────── 시나리오 직렬화 ───────────────── */

/** 저장 형식 v1 — 앱·서버·검증 스크립트가 공유하는 계약 */
export const SCENARIO_VERSION = 1;

export function makeScenario(name, params, note) {
  const { kpi } = runModel(params);
  return {
    version: SCENARIO_VERSION,
    name: name || "이름 없음",
    note: note || "",
    params: { ...DEFAULTS, ...params },
    kpi,
  };
}

/** 저장된 시나리오를 읽을 때 — 없는 키는 기본값으로 채우고 남는 키는 버린다 */
export function normalizeParams(raw) {
  const out = {};
  Object.keys(DEFAULTS).forEach((k) => {
    out[k] = raw && raw[k] !== undefined && raw[k] !== null && isFinite(raw[k])
      ? Number(raw[k])
      : DEFAULTS[k];
  });
  return out;
}
