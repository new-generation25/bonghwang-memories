# 게임 요소 보강 (F-1~F-7) — 요구사항·충돌 검토·확정 계획

2026-07-28 사용자 요구사항 문서 기준. **구현 시작 전** — 이 문서가
다른 세션이 이어받는 원본이다. 충돌 검토는 코드 전수 대조로 끝났고,
사용자 결정 4건까지 반영된 상태다.

> 원문 취지: '콘텐츠 소비'를 '플레이(수집·발견·긴장·경쟁)'로 확장하되
> 통화 프레임 몰입은 훼손하지 않는다. [P1] = 8월 실판매 전.

---

## 사용자 결정 (2026-07-28 · 재논의 불요)

1. **결제 제안(1단/2단)** — 모의 선택 화면까지 만든다. 결제는 모의,
   노출·선택 로그는 실측 (피날레의 라이트 무료 vs 리워드 5,000원)
2. **계측 로그** — Firestore 배치 전송 (`users/{uid}/events/{batchId}`)
3. **히든트랙 P1** — 3개(메인 편입 1 + 자유 2), 대사 초안은 Claude가 쓰고
   사용자가 SCRIPT.md에서 확정
4. **참여자 데이터는 전부 Firebase 기록이 전제.**
   예외는 사진·녹음 **원본**뿐(D12 — 동의 시에만). 메타는 전부 서버로

---

## 요구사항 요약 (P1만)

| # | 내용 |
|---|---|
| F-1 | **J-카드 소원 체크리스트** — 기억의 조각 구조 대체. 케이스 속지에 아버지가 눌러 적은 다섯 소원. A1~A4 완료 시 줄 채움(만년필 밑줄+아이콘+효과음), **5번째 줄은 영원히 미완**('아버지의 몫' 상태 문구 — 잠금 아이콘 아님), B면 청취 후 SIDE B 칸에 "아버지의 편지" 기록+릴 '탁'. A4 60초 녹음은 카드와 **비연동**(연동하면 6트랙 완성 구조가 되어 미완의 결말과 충돌). 홈/진행 화면 상시 노출. [선택] 완주 기념 촬영(J-카드 오버레이) |
| F-2 | **히든트랙(미공지 QR)** — 메인 중 발견: 재생 중단 없이 노이즈 1초+토스트 "미공개 트랙 발견 — 수집첩 보관, 완주 후 재생", 수집첩에 잠긴 트랙. 1막 완주 후 소영 **수신 전화** 연출로 일괄 해금("그런데… 아까 주운 테이프, 같이 들어볼래?"). 완주 후 스캔은 즉시 재생. 메인 편입 히든 1개는 소영 대사가 안내(플래그 구분) |
| F-3 | **힌트** — 미션마다 2단계(방향→직전), 회차 총 3회(카세트 라벨 스티커 3장), 소진 시 "일행과 상의해 보세요". 인증서에 힌트 수 + 0회 **NO-HINT CLEAR** 뱃지. 난이도 곡선(쉬움1·2-중간3-어려움4-감정5)은 콘텐츠 병행 |
| F-4 | **랭킹 8부문** — P1 자동: ①골목 탐정(미션 화면 진입~정답 합산, **이동 시간 제외**, 5분 미만 컷, 주간) ②기억 수집가(수집첩 수) ③단골 스트릭(완주 횟수). ⑤사진상 ⑥베스트프렌즈는 수동 게시 카드. 나머지 Coming Soon. 탭: 주간/월간/명예의 전당(주간은 월요일 리셋). 팀 유형·거주 지역은 시작 시 자기 선언 |
| F-5 | **88 필터** — P1은 프레임 제공형: 투명 PNG(REC·'88 스탬프·비네트) 다운로드 + 사용 가이드 1화면. 보너스 미션 "1988년의 한 장면". 인증은 해시태그 수동 |
| F-6 | **이동 안전** — '테이프 로딩' 연출에 고정 문구("걸을 땐 화면 대신 골목을… 이어폰은 한쪽만, 차도 앞에선 멈춤"), 이동 시작 시 1줄("화면을 주머니에") |
| F-7 | **계측** — QR 스캔(경로 태그: 자연/커뮤니티데이/초대/상점코드/평가단), 미션 진입·정답·오답, 힌트, J-카드 줄, 히든 발견, 60초 녹음, 결제 제안 노출·선택, 완주, 쿠폰 사용. 8월 실판매에서 스키마 검증 |

시나리오 병행(콘텐츠): 인트로에 J-카드 확인 지시문 1줄, B0_CALL 후반 소영
1~2줄("케이스 안에 카드 있지? …아빠 글씨야"), 해금 전화 대사 1건.
**기존 대사 수정 불요** — B0_TAPE 11("몇 개나 지켰나 세어보고")·B5_F("마지막
하나는 남겨둘게요")가 그대로 근거·마무리가 된다.

---

## 충돌 검토 결과 (코드 전수 대조 완료)

### 그대로 얹으면 부딪히는 8곳 → 해소 방침

| 충돌 | 방침 |
|---|---|
| F-2 × **D4** — `validateCueGraph()`가 "qr 트리거 큐 정확히 5개" 검사(`cues.ts:815`). `QRGate`는 미지 페이로드를 거절하고 첫 인식에 스캐너를 닫음 | 히든트랙은 **큐지만 qr 트리거가 아니다** — `trigger: action_event`로 수집첩에서 재생. 그래프 검사 무접촉. 실물 QR 페이로드(`BH88:H1..`)는 별도 등록부(`hiddenTracks.ts`)가 해석, QRGate에 수집 분기(스캐너 유지·오디오 무중단) |
| F-2 × 스캔 진입점 — QRGate 호출처가 `/play` 한 곳, 다음 거점 1개만 허용, **5/5 후 도달 불가** | 수집첩(=/me 섹션)에 act2용 스캔 버튼 신설 |
| F-2 수신 전화 — 수신 UI 없음(발신만). D3는 자동 *발신* 금지라 수신 자체는 무관 | 수신 오버레이 신설, **재생은 '받기' 탭으로 시작**(D9). 새 TapId `ANSWER`. `B5_F.next`가 이미 `B6_0`이라 auto_chain 불가 |
| F-7 × 계측 — `analytics.ts`는 localStorage 500개 링버퍼, 서버 전송 없음, **읽는 화면조차 없음** | `telemetry` 신설(결정 2). 랭킹 부문1도 이것 없이는 산출 불가(미션 진입 시각이 어디에도 없음) |
| F-7 결제 제안 — 그런 화면이 앱에 없음(랜딩 무료 단일 CTA→모의결제뿐) | 피날레에 모의 2단 제안(결정 1) |
| F-4 #3 전화번호 해시 | 불채택 — 정식 계정(uid)이 이미 있음. D12 부합 |
| F-6 '테이프 로딩' 화면 — 존재하지 않음(QR 통과→즉시 트랙. 릴 로딩은 `/download`뿐) | 2.5초 인터스티셜 신설(릴 회전+안전 문구). **iOS 제스처 유지 실기기 확인 항목** |
| F-1 × **D10** — "조각 3개"가 "J-카드 줄 3개"로 | 로직 `UNLOCK_THRESHOLD=3` 그대로. CLAUDE.md D10 문구 갱신 |

### 핵심 단순화 — 조각은 트랙 완료와 동일했다

fragment는 B1_B/B2_B/B3_B/B4_C에서 `track_check`와 **같은 큐**에서 지급됐다.
즉 `fragments` ≡ `tracksCompleted ∩ [1..4]`. J-카드는 `tracksCompleted`에서
직접 파생하고 **fragment 배관을 통째로 제거**한다(타입·지시자 4건·
`awardFragment`·tourSync union·SuperAdminBar·devEnter·데드 상수
`UNLOCK_SHORT_MESSAGE`). localStorage 로드가 스프레드 병합이라 마이그레이션 불요.

### 이미 정확히 맞는 것 (그대로 쓴다)

- **미완의 결말은 코드에 있다** — `last_wish_reserved` 지시자, 피날레 '다음 주'
  배지, 인증서 "이룬 소원 4+1개". F-1 결말 원칙과 일치
- 빙고 12줄(5+5+2) 일치, 주 대각선 = 다섯 소원 구현돼 있음
- 조각의 화면 표면이 `UnlockGate` 하나뿐 — 치환 부담 작음
- `MissionCamera.overlaySrc`가 실시간 미리보기+캡처 합성 지원 — 기념촬영·P2 88필터 뼈대
- `QuizInput`의 2회 오답 후 재청취 — HintBox 선례
- `awardCampaign`(동적 점수) — 88 보너스 지급 재사용
- `font-pen`(Nanum Pen Script) 이미 tailwind에 — J-카드 손글씨

### 알아둘 함정 (탐사에서 확인)

- `mergeTour`(tourSync:78-112)가 `speechConsent`·`audioCacheReady`·`memoType`·
  `photoSummary`를 **떨궈서 서버 복원 시 유실** — 기존 버그, 0단계에서 수정
- 오디오 프리로드 목록은 CUES에서 파생(download:34) — 히든을 큐로 만들면 자동
- **sw 버전 올리면 기존 기기 오디오 전체 재다운로드**(sw.js:94 activate가 옛 캐시 삭제)
- sw `assetsToCache`는 손관리 — 88 프레임 PNG 수동 추가(t5 사진 누락 전례)
- 탭 5개 고정(44px 터치) — 수집첩은 6번째 탭 불가, /me 섹션으로
- `record` interaction은 데드코드(TrackPageClient:287)
- validateCueGraph는 빌드에서 안 돌고 `/debug/cues`에서만 렌더
- 쿠폰 발급 순번은 의도적 로컬 — 서버 사본은 기회 동기화로(오프라인 우선 유지)

---

## 구현 순서 (의존성순 · 기능별 커밋)

### 0. 데이터 전제 + 계측 기반 [모든 기능의 전제]

- `src/lib/telemetry.ts` — `logEvent` 확장: 로컬 링버퍼 유지 + 서버 큐.
  15초/20건 배치 1문서 `users/{uid}/events/{batchId}` = `{events[], flushedAt}`.
  비로그인은 로컬 대기 후 로그인 시 flush(`points.ts` flushPending 패턴)
- 신규 이벤트: `mission_enter/wrong/correct`, `hint_used{step}`,
  `jcard_line_done{track}`, `hidden_found{id,during}`, `hidden_played{id}`,
  `qr_scan{via}`, `reward_offer_shown/choice{tier}`, `coupon_used` 발화 연결
- 경로 태그: 랜딩 `?via=` → `tourState.entryVia` + users 문서
- **mergeTour 유실 버그 수정** + 신규 상태(hintsUsed·hiddenFound·hiddenUnlocked·
  entryVia)를 SyncedTour에 처음부터 포함 + 쿠폰 순번 기회 동기화
- rules: events 본인 create만·수정 불가·읽기 본인+관리자. admin에
  `fetchEvents`(collectionGroup) + 막힘 지점 표

### 1. F-1 J-카드

- fragment 배관 제거(위 목록), tests/문서 동반 수정
- `src/components/JCard.tsx` — `TRACK_STATIONS.wish` 5줄, `font-pen`,
  완료 줄 애니메이션+효과음, 5번째 줄 '아버지의 몫'(B5_F 후 "다음 주, 아빠와
  소영"), SIDE B는 `album_build` 지시자(B5_F ui에 이미 존재)에 훅
- 배치: `/play` 빈 슬롯(play:187 주석 자리) + `/me`
- `UnlockGate` → `JCardGate`: "소원 3개 이상이면 B면"(tracksCompleted 기준)
- [선택] 기념 촬영은 스트레치(MissionCamera overlaySrc 구조 준비됨)
- CLAUDE.md D10 문구·SCRIPT.md 산문에 J-카드 설정

### 2. F-3 힌트

- `TrackMission.hints?: {h1, h2}` — A1·A4 우선
- `HintBox.tsx` — 공통 카드 셸에 부착, `tourState.hintsUsed: string[]`
  (`'M1:h1'` refId, restartTour 초기화), 잔여 = 스티커 3장
- 인증서 `S40_TEXT.stats`에 힌트 수 + NO-HINT CLEAR 뱃지
- CountInput·QuizInput 오답 분기에서 `mission_wrong`

### 3. F-2 히든트랙 (3개 · 초안 Claude → 사용자 확정)

- 히든 큐 `H1~H3` — CueId 확장, `trigger: action_event 'hidden_h1'..`,
  channel call, 소영 단문(빙고 셀 톤). 프리로드 자동
- `src/lib/hiddenTracks.ts` — `{id, qrPayload, cueId, mainline?}` + `parseHiddenQr`
- QRGate 분기: 수집만(노이즈 sfx+토스트, 스캐너 유지) / act2 후엔 즉시 재생
- 수집첩: `/me` 섹션(자물쇠→재생) + act2 스캔 버튼
- 수신 전화: act2 진입 후 hiddenFound>0 첫 방문에 오버레이(call-fab CSS·
  ringback 변형) → 받기 → 해금 큐 `B6_CALLBACK` → `hiddenUnlocked=true`
- 대본: cues.ts 먼저 → `script.mjs` WHERE 4건 → `script:dump` → 확정 후 `script:bake`
- `make-hidden-qr.mjs`(스티커 인쇄, make-shop-qr 패턴)
- CLAUDE.md D4 문구 갱신

### 4. F-6 안전 안내

- `TapeLoading.tsx` — QR 통과 후 2.5초(릴+문구), 큐 지연 시작.
  iOS 실기기 확인 항목에 추가
- `/play` 이동 중 배너 + exploration 안내 카드(97~105행) 문구

### 5. F-5 88 프레임

- `make-88-frame.mjs`(캔버스→투명 PNG) → `public/images/frame88.png` +
  **sw assetsToCache 수동 추가**
- `/treasure` 보너스 미션 카드: 프레임 받기(shareOrDownload 재사용)+가이드+
  해시태그 안내, 지급은 `awardCampaign`

### 6. F-4 랭킹

- 가입 확장: 팀 유형·지역 2필드(선택식) → users. 기존 가입자는 랭킹 첫 진입 시 1회
- users 확장: `teamType`·`region`·`completions`(done 시 증가)·
  `solveTimeSec`+`solveWeek`(완주 시 클라이언트가 mission_enter→correct 합산 —
  이동 시간 제외 충족, 5분 미만 컷)
- 커뮤니티 랭킹: 탭 주간/월간/명예의 전당.
  부문1 `where solveWeek orderBy solveTimeSec asc`(**복합 색인 1개** —
  firestore.indexes.json에 추가, CLI 배포) / 부문2 users.hiddenCount /
  부문3 users.completions / 부문5·6 `featured/{weekKey}` 관리자 폼+공개 카드 /
  나머지 Coming Soon. 주간 창은 클라이언트 계산(월요일 경계)

### 7. 결제 모의 2단 제안

- 피날레 `RewardOffer`: 라이트 무료 vs 리워드 5,000원(쿠폰 4,000원 포함) —
  선택해도 모의, `reward_offer_shown/choice` 실측

### 8. 마무리

- rules+indexes CLI 배포(`npx firebase-tools@13 deploy --only firestore` —
  **로그인돼 있음**, socialceos)
- CLAUDE.md D4·D10, HANDOFF 기록
- **콘텐츠 확정 대기 목록**: B0_CALL 소영 1~2줄(J-카드 언급, 초안 Claude),
  히든 3트랙 대사 초안, 해금 전화 대사, 힌트 문구(A1·A4), 메인 편입 히든 위치

## 검증

빌드 금지. `npx tsc --noEmit` + 파일별 lint + `check-forbidden`.

1. `/debug/cues` validateCueGraph 초록(qr 큐 여전히 5개)
2. 전 구간: J-카드 줄 채움·5번째 줄 문구·SIDE B 기록 → 빙고 → 제안 카드 로그
3. 히든: 메인 중 수집(오디오 무중단) → 수신 전화 → 해금 → 재생 · act2 즉시 재생
4. 힌트 3회 소진·인증서 NO-HINT
5. Firestore에서 events 배치·users 신규 필드, 관리자 막힘 지점 표
6. 주간 창 경계(월요일), 색인 배포
7. 회귀: 쿠폰 사용·speechAsk·빙고 재진입
8. iOS 실기기: 테이프 로딩 2.5초 후 오디오 시작

## 규모

한 세션에 끝나지 않는다 — 0→1→2→3 순으로 기능별 커밋·푸시, 단계마다
브라우저 회귀. 콘텐츠는 3단계에서 사용자 확정.
