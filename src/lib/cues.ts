/**
 * 봉황1988 EP.1 「아버지의 타임캡슐」 — 오디오 큐 데이터.
 *
 * 대사는 명세서 §6의 원문 그대로다. 임의 수정 금지(명세서 상단 지시).
 * 자막은 명세서의 행 단위를 그대로 subtitleLines로 옮겼다.
 *
 * 트리거 4계층(§4):
 *  - qr           : 실물 QR 스캔(인트로 1 + 거점 5 = 정확히 6회, D4)
 *  - auto_chain   : 선행 큐 종료 후 delay(기본 2500ms) 뒤 자동 재생 — 같은 장소 안에서만
 *  - action_event : 미션 액션 완료(정답 입력·사진 촬영·녹음 종료·잠금 해제)
 *  - user_tap     : [다음으로 출발] 등 명시적 버튼. 이동 큐는 반드시 이 방식(D9)
 *
 * 채널(D1): tape = 아버지·과거(로파이+릴 UI) / call = 소영·현재(클린+통화 UI).
 * §5 예외: C1_3은 사장님 녹음이지만 소영이 통화로 틀어주는 형식 — channel: call.
 */

export type StationId = 'intro' | 't1' | 't2' | 't3' | 't4' | 't5'
export type FragmentId = 'frag_1' | 'frag_2' | 'frag_3' | 'frag_4'
export type TapId = 'PLAY' | 'CALL' | 'NEXT' | 'FINISH'

export type ActionId =
  | 'M1_count_ok'
  | 'M1_photo_done'
  | 'M2_photo_done'
  | 'M3_photo_done'
  | 'M4_done'
  | 'M5a_done'
  | 'unlock_done'
  | `bingo_cell_done:${string}`

export type CueId =
  | 'C0_A' | 'C0_B' | 'C0_C'
  | 'C1_1' | 'C1_2' | 'C1_3' | 'C1_4' | 'C1_5'
  | 'C2_1' | 'C2_2' | 'C2_3' | 'C2_4'
  | 'C3_1' | 'C3_2' | 'C3_3' | 'C3_4'
  | 'C4_1' | 'C4_2' | 'C4_3' | 'C4_4' | 'C4_5'
  | 'C5_1' | 'C5_2' | 'C5_3' | 'C5_4' | 'C5_5'
  | 'C6_0' | 'C6_X_BUNSIK' | 'C6_X_BYEOKHWA' | 'C6_X_BONGHWANGDAE'
  | 'C7_0' | 'C7_1'

export type Speaker =
  | 'father'
  | 'soyoung'
  | 'shopkeeper'
  | 'dj_father'
  | 'father_soyoung'

/** UI 지시자 — 큐 종료 시점에 실행된다 */
export type UiDirective =
  | 'reel_spin'
  | 'reel_advance'
  | 'cassette_flip'
  | 'case_open'
  | 'show_call_button'
  | 'show_unlock_gate'
  | 'album_build'
  | 'phase:act2'
  | 'speech_mode:casual'
  | `show_mission:${string}`
  | `fragment_award:${FragmentId}`
  | `coupon:${string}`
  | `track_check:${1 | 2 | 3 | 4 | 5}`

export type CueTrigger =
  | { type: 'qr'; ref: StationId }
  | { type: 'auto_chain'; ref: CueId }
  | { type: 'action_event'; ref: ActionId }
  | { type: 'user_tap'; ref: TapId }

export interface SubtitleLine {
  /** 한 큐 안에 화자가 여럿일 때만 표기(사장님·DJ 등) */
  speaker?: string
  text: string
}

export interface Cue {
  id: CueId
  track: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  channel: 'tape' | 'call'
  speaker: Speaker
  voiceAge: 'young' | 'old' | null
  trigger: CueTrigger
  /** auto_chain 전용 — 선행 큐 종료 후 대기(기본 2500) */
  autoChainDelayMs?: number
  /** /audio/{audioFile}.m4a → .mp3 순서로 탐색 */
  audioFile: string
  /** 구 파일명 호환 — audioFile이 없으면 순서대로 시도 */
  audioAliases?: string[]
  /** 오디오 파일이 없을 때 합성 클록이 쓰는 길이(초) */
  durationSec: number
  subtitleLines: SubtitleLine[]
  sfx?: { in?: 'tape_hiss' | 'call_ring' | 'none'; out?: 'tape_stop' | 'none' }
  next?: CueId | null
  ui?: UiDirective[]
  /** C7_1 전용 — feature flag가 켜져 있을 때만 재생 */
  optionalFlag?: 'epilogue_live_voice'
}

export const SPEAKER_NAMES: Record<Speaker, string> = {
  father: '아버지',
  soyoung: '소영',
  shopkeeper: '봉황1935 사장님',
  dj_father: '라디오',
  father_soyoung: '아버지 · 소영',
}

// ---------------------------------------------------------------------------
// 화면 고정 텍스트 (명세서 §6 원문)
// ---------------------------------------------------------------------------

/** S02 — 테이프 발견 화면 */
export const S02_DISCOVERY_TEXT = [
  '골목 입구, 낡은 우체통 위에 놓인 카세트테이프 하나.',
  '라벨엔 만년필 글씨 — "소영에게 — 1988. 9. 17."',
  '테이프에 감긴 손글씨 쪽지: "이 테이프를 발견하신 분께. 끝까지 들어주세요. 부탁이 있어요."',
] as const

/** S22 — 잠금 해제 문구 */
export const UNLOCK_MESSAGE = 'B면의 마지막 트랙이 발견되었습니다.'

/** S10 — 잠긴 빙고 배지 문구 */
export const BINGO_LOCKED_MESSAGE = '다섯 소원 후 열립니다'

/** S40 — 피날레 화면 텍스트 템플릿 */
export const S40_TEXT = {
  title: (serial: string) => `소영의 곁을 지킨 친구이자, 이 약속의 기록자 No.${serial}`,
  journey: (date: string, partySize: number) =>
    `${date} — ${partySize}명이 소영과 함께 봉황동의 이야기를 이었습니다.`,
  stats: (elapsed: string, bingoCount: number) =>
    `함께한 시간 ${elapsed} · 이룬 소원 5개 · 발견한 골목 ${bingoCount}곳`,
  closing: '"오늘의 골목은, 이제 두 사람의 이야기입니다."',
  saveButton: '우리의 테이프 저장하기',
  ep2Button: 'EP.2 「첫사랑의 골목」 예약 — 8월',
  ep2Note: '(후기 작성 시 3,000원 할인)',
} as const

// ---------------------------------------------------------------------------
// 큐 스크립트 (§6 대사 원문 — 수정 금지)
// ---------------------------------------------------------------------------

export const CUES: Record<CueId, Cue> = {
  // ============================== INTRO ==============================

  C0_A: {
    id: 'C0_A',
    track: 0,
    channel: 'tape',
    speaker: 'father',
    voiceAge: 'young',
    trigger: { type: 'user_tap', ref: 'PLAY' },
    audioFile: 'c0_a',
    durationSec: 35,
    subtitleLines: [
      { text: '…잘 돌아가나, 이거. 어험.' },
      { text: '소영아. 네가 태어난 날이다. 1988년 9월 17일.' },
      { text: '아빠가 오늘 소원을 다섯 개 적었다. 아니, 말로 남긴다. 글씨보다 이게 낫지.' },
      { text: '하나, 엄마랑 어떻게 만났는지 들려주기. 둘, 목욕탕 가서 등 밀어주기.' },
      { text: '셋, 예쁜 사진 찍어주기. 넷, 좋아하는 음악 같이 듣기. 다섯… 가족오락관 같이 나가기.' },
      { text: '이 테이프, 네가 크면 같이 듣자. 약속이다.' },
    ],
    sfx: { in: 'tape_hiss', out: 'tape_stop' },
    next: 'C0_B',
    ui: ['reel_spin'],
  },

  // 같은 테이프에 덧녹음된 현재의 목소리 — 노이즈 얕게, call보다 살짝 낮은 음질
  C0_B: {
    id: 'C0_B',
    track: 0,
    channel: 'tape',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'C0_A' },
    audioFile: 'c0_b',
    durationSec: 35,
    subtitleLines: [
      { text: '…여기까지 들으셨다면, 안녕하세요. 저는 이 테이프 주인의 딸이에요.' },
      { text: '아버지가 다리를 다치셔서, 제가 지금 곁을 떠날 수가 없어요.' },
      { text: '이 테이프에 있는 다섯 가지 소원… 아버지가 다 잊기 전에, 이뤄드리고 싶어요.' },
      { text: '염치없는 부탁인 거 알아요. 이 동네에 이제 아는 사람이 없어서요.' },
      { text: '혹시 시간이 조금 있으시다면… 아래 번호로 전화 주시겠어요?' },
    ],
    sfx: { in: 'tape_hiss', out: 'tape_stop' },
    next: null,
    // 자동 발신 금지(D3) — 버튼만 노출하고 사용자의 탭을 기다린다
    ui: ['show_call_button'],
  },

  C0_C: {
    id: 'C0_C',
    track: 0,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'CALL' },
    audioFile: 'c0_c',
    // 기존 준비 음성(38초 개정본)을 첫 통화 큐로 활용
    audioAliases: ['intro-soyoung'],
    durationSec: 45,
    subtitleLines: [
      { text: '…여보세요? 아, 진짜 걸어주셨네요. 감사합니다.' },
      { text: '갑자기 이상한 부탁이라 놀라셨죠. 저는 강소영이라고 해요.' },
      { text: '아버지가 요즘 자꾸 깜빡깜빡하세요. 근데 신기하죠, 제가 태어난 날만은 아직도 또렷하게 기억하세요.' },
      { text: '그 테이프 속 소원들, 전부 이 동네 골목에 있어요. 근데 저는 아버지 옆에 있어야 해서…' },
      { text: '저 대신 걸어주시겠어요? 제가 전화로 계속 같이 갈게요. 길도 다 알려드리고요.' },
      { text: '첫 번째 장소는 여기서 3분이에요. 봉황1935라는 카페. 가시면서 끊지 말고 계세요.' },
    ],
    sfx: { in: 'call_ring' },
    next: null,
  },

  // ============================== TRACK 1 — 봉황1935 ==============================

  C1_1: {
    id: 'C1_1',
    track: 1,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't1' },
    audioFile: 'c1_1',
    durationSec: 30,
    subtitleLines: [
      { text: '도착하셨어요? 거기가 봉황1935예요. 예전엔 그 자리에 동네 우물이 있었어요.' },
      { text: '사람들이 물 뜨러 와서 온종일 수다 떨던 곳. …그리고 저희 엄마 아빠가 처음 만난 곳이에요.' },
      { text: "테이프 첫 번째 소원, '엄마랑 어떻게 만났는지 들려주기'. 근데 아버지는 이제 그 얘길 잘 못 하세요." },
      { text: '대신 거기 사장님이 그날을 기억하고 계신대요. 그 이야기부터 찾아봐 주실래요?' },
    ],
    next: 'C1_2',
  },

  C1_2: {
    id: 'C1_2',
    track: 1,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'C1_1' },
    audioFile: 'c1_2',
    durationSec: 20,
    subtitleLines: [
      { text: '우물터 옆에 풍선초 보이세요? 초록색 꽈리 같은 열매요.' },
      { text: '아버지가 어머니한테 그걸로 하트를 만들어 줬대요. 몇 개나 열렸나 세어봐 주실래요?' },
      { text: '다 세면, 그 앞에서 사진 한 장 부탁해요. 오늘 우리 첫 번째 기록이에요.' },
    ],
    next: null,
    ui: ['show_mission:M1'],
  },

  // 소영 도입 1문장 + 사장님 녹음 재생 형식 (§5 예외: call 채널)
  C1_3: {
    id: 'C1_3',
    track: 1,
    channel: 'call',
    speaker: 'shopkeeper',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M1_count_ok' },
    audioFile: 'c1_3',
    durationSec: 30,
    subtitleLines: [
      { speaker: '소영', text: '사장님이 남겨주신 녹음, 지금 들려드릴게요.' },
      { speaker: '사장님', text: '아, 민수? 기억나고말고. 네 아버지가 이 풍선초로 하트를 딱 만들어서 네 엄마한테 그러더라.' },
      { speaker: '사장님', text: "'이게… 내 마음이오.' 아이고, 그 무뚝뚝한 사람이. 온 동네가 다 웃었지." },
      { speaker: '사장님', text: '너는 그 사랑의 결실로 태어난 거야. 잊지 마라.' },
    ],
    next: null,
  },

  C1_4: {
    id: 'C1_4',
    track: 1,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M1_photo_done' },
    audioFile: 'c1_4',
    durationSec: 20,
    subtitleLines: [
      { text: '…아버지가 그런 말을 했다고요? 상상이 안 돼요, 진짜.' },
      { text: "저한텐 평생 '밥 먹었나' 그 말밖에 안 하셨는데." },
      { text: '[옅게 웃음] 감사해요. 첫 소원, 이뤘어요. 테이프 하나 감았어요.' },
    ],
    next: null,
    ui: ['reel_advance', 'track_check:1', 'fragment_award:frag_1', 'coupon:cp1'],
  },

  // 말투 전환 큐 — D7: 이 큐 이후 소영은 반말 고정
  C1_5: {
    id: 'C1_5',
    track: 1,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'NEXT' },
    audioFile: 'c1_5',
    durationSec: 40,
    subtitleLines: [
      { text: '다음 장소로 가는 길 알려드릴게요. 골목 따라 쭉 직진이에요.' },
      { text: '…저기, 말 편하게 해도 될까요? 왠지 오래 알던 사이 같아서요. …고마워. 이제 말 놓을게.' },
      { text: '그 동네 많이 변했지? 그 카페들, 예전엔 다 철물점이고 방앗간이었어.' },
      { text: '가다 보면 파란 타일 건물 보일 거야. 그게 옛날 목욕탕이야.' },
      { text: '두 번째 소원이 그 목욕탕이랑 관계가 있어. 조금만 더 가면 나오는 가게에서 얘기해줄게.' },
    ],
    next: null,
    ui: ['speech_mode:casual'],
  },

  // ============================== TRACK 2 — 미야상회 ==============================

  C2_1: {
    id: 'C2_1',
    track: 2,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't2' },
    audioFile: 'c2_1',
    durationSec: 40,
    subtitleLines: [
      { text: '미야상회… 그 가게, 아직도 있구나.' },
      { text: "두 번째 소원, '목욕탕에서 딸 등 밀어주기'. 근데 그건 내가 일곱 살 때까지밖에 못 했잖아." },
      { text: '아빠가 그게 그렇게 아쉬웠나 봐. 그래서 목욕탕 못 가는 대신, 매주 일요일마다 거기서 바나나우유를 사 왔어.' },
      { text: "나 그게 그냥 우유인 줄 알았어. 그게 '목욕탕 대신'이었다는 걸, 이제야 알았어." },
    ],
    next: 'C2_2',
  },

  C2_2: {
    id: 'C2_2',
    track: 2,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'C2_1' },
    audioFile: 'c2_2',
    durationSec: 20,
    subtitleLines: [
      { text: '부탁 하나 해도 돼? 그 바나나우유, 나 대신 하나 마셔줄래.' },
      { text: '나는 지금 못 가니까… 네가 마시고, 무슨 맛인지 사진으로 보여줘.' },
      { text: '이건 미션이라기보단, 아빠의 일요일을 오늘 네가 대신 겪어주는 거야.' },
    ],
    next: null,
    ui: ['show_mission:M2'],
  },

  C2_3: {
    id: 'C2_3',
    track: 2,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M2_photo_done' },
    audioFile: 'c2_3',
    durationSec: 25,
    subtitleLines: [
      { text: '…사진 봤어. 그 노란 병, 하나도 안 변했네.' },
      { text: '그 맛이지? 달고, 조금 밍밍하고. 눈 감으면 아직도 일요일 저녁 같아.' },
      { text: '아빠는 말로 사랑한다고 한 적이 없어. 근데 이런 걸로 다 했던 거였네.' },
      { text: '나 그것도 모르고 19년을 미워했어. 바보같이.' },
    ],
    next: null,
    ui: ['reel_advance', 'track_check:2', 'fragment_award:frag_2', 'coupon:cp2'],
  },

  C2_4: {
    id: 'C2_4',
    track: 2,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'NEXT' },
    audioFile: 'c2_4',
    durationSec: 35,
    subtitleLines: [
      { text: '괜찮아, 나 안 울어. …가자.' },
      { text: '그 골목 끝에 오래된 한옥이 하나 있어. 능소화 고택이라고.' },
      { text: '아빠가 세상에서 제일 좋아하던 꽃이 능소화야. 여름이면 주황색으로 담장을 뒤덮는 꽃.' },
      { text: '세 번째 소원이 거기 있어. 근데 이건… 좀 오래 미뤄둔 약속이야. 도착하면 얘기해줄게.' },
    ],
    next: null,
  },

  // ============================== TRACK 3 — 능소화 고택 ==============================

  C3_1: {
    id: 'C3_1',
    track: 3,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't3' },
    audioFile: 'c3_1',
    durationSec: 40,
    subtitleLines: [
      { text: '도착했지? …지금은 철이 아니라 꽃이 다 졌을 텐데. 앙상하지.' },
      { text: "세 번째 소원, '딸이랑 예쁜 사진 찍기'." },
      { text: "능소화 꽃말이 뭔 줄 알아? '영원한 사랑', 그리고 '잊지 않겠다는 약속'이래." },
      { text: "아빠가 능소화 활짝 폈을 때 '여기서 사진 찍자' 그랬는데… 나 그때 사춘기라고 싫다고 했어." },
      { text: '그러고 못 찍었어. 그 약속만 남고, 사진은 없어.' },
    ],
    next: 'C3_2',
  },

  C3_2: {
    id: 'C3_2',
    track: 3,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'C3_1' },
    audioFile: 'c3_2',
    durationSec: 25,
    subtitleLines: [
      { text: '근데 오늘은… 그 꽃을 다시 피워볼 수 있대. 화면을 담장에 비춰봐.' },
      { text: '능소화가 다시 필 거야. 예쁘게 피면, 그 앞에서 찍어서 나한테 보여줘.' },
      { text: '아빠랑 못 찍은 그 사진… 오늘 네 손으로, 대신 남겨줘.' },
    ],
    next: null,
    ui: ['show_mission:M3'],
  },

  C3_3: {
    id: 'C3_3',
    track: 3,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M3_photo_done' },
    audioFile: 'c3_3',
    durationSec: 25,
    subtitleLines: [
      { text: '…사진 왔다. 와, 예쁘다. 진짜 피었네.' },
      { text: '아빠, 봤어요? 우리가 여기서 사진 찍었어요. 늦었지만… 약속 지켰어요.' },
      { text: '[숨 고르고] 고마워. 이 사진, 앨범에 제일 크게 넣을 거야.' },
    ],
    next: null,
    ui: ['reel_advance', 'track_check:3', 'fragment_award:frag_3', 'coupon:cp3'],
  },

  C3_4: {
    id: 'C3_4',
    track: 3,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'NEXT' },
    audioFile: 'c3_4',
    durationSec: 35,
    subtitleLines: [
      { text: '이제 네 번째. …이건 내가 제일 좋아하는 소원이야.' },
      { text: '아빠가 밤마다 라디오를 크게 틀어놨거든. 나 그 소리 들으면서 잠들었어.' },
      { text: '조금만 가면 카페 탱자가 보일 거야. 옛날에 그 자리가 음악다방이었어.' },
      { text: '아, 그리고 이어폰 꼭 준비해줘. 이건 귀에 딱 붙이고 들어야 하는 거라서.' },
      { text: '그 테이프, 아직 잘 갖고 있지? A면 뒤쪽에… 들려줄 게 하나 더 있어.' },
    ],
    next: null,
  },

  // ============================== TRACK 4 — 카페 탱자 ==============================

  C4_1: {
    id: 'C4_1',
    track: 4,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't4' },
    audioFile: 'c4_1',
    durationSec: 35,
    subtitleLines: [
      { text: '들어왔어? 창가 자리 있으면 거기 앉아.' },
      { text: "네 번째 소원, '딸이랑 좋아하는 음악 같이 듣기'." },
      { text: '그 테이프 A면 뒤쪽에 뭐가 더 있더라. 아빠가 1988년에 심야 라디오에 사연을 보냈었나 봐.' },
      { text: '그 방송 나온 날, 아빠가 직접 테이프에 녹음해뒀어.' },
      { text: '지금 그 부분 틀게. 나도 여기서 같이 들을게. 이어폰 잘 꼈어? 자, 눈 감고 들어봐.' },
    ],
    next: 'C4_2',
  },

  // tape 채널 — 히스 노이즈 강하게, 라디오 톤. 원곡 '소녀' 사용 금지, 유사 무드 오리지널 연주곡
  C4_2: {
    id: 'C4_2',
    track: 4,
    channel: 'tape',
    speaker: 'dj_father',
    voiceAge: 'young',
    trigger: { type: 'auto_chain', ref: 'C4_1' },
    audioFile: 'c4_2',
    durationSec: 60,
    subtitleLines: [
      { speaker: 'DJ', text: "다음 사연, 봉황동 강민수 씨. 신청곡은 이문세 '소녀'입니다. 사연 읽어드릴게요." },
      { speaker: '아버지', text: '…딸아이가 여섯 살입니다. 아들을 바랐는데, 세상에서 제일 예쁜 아이가 왔습니다.' },
      { speaker: '아버지', text: '일요일마다 목욕탕 데려가고, 바나나우유 사줍니다.' },
      { speaker: '아버지', text: "근데 제가 말재주가 없어서, '아빠가 너를 사랑한다' 이 한마디를 제대로 못 해봤습니다." },
      { speaker: '아버지', text: '우리 딸, 영원히 지금처럼 웃는 소녀로 남았으면 합니다.' },
      { speaker: '아버지', text: '소영아. …듣고 있니? 아빠는, 네가 웃을 때가 제일 행복하다.' },
      { speaker: 'DJ', text: '…강민수 씨, 따님한테 잘 전해졌길 바랍니다.' },
    ],
    sfx: { in: 'tape_hiss', out: 'tape_stop' },
    next: 'C4_3',
  },

  C4_3: {
    id: 'C4_3',
    track: 4,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'C4_2' },
    audioFile: 'c4_3',
    durationSec: 40,
    subtitleLines: [
      { text: '…나 이거 처음 들었을 때 한참 울었어.' },
      { text: '아빠가 이 말을 해주고 싶었는데, 평생 못 했던 거야.' },
      { text: "그 테이프 뒷면, B면이 비어 있어. …아빠가 '같이 듣자'고 남겨둔 자리 같아." },
      { text: '나 지금 여기서 아빠한테 답장을 녹음할래. 노래 흐르는 동안.' },
      { text: '너도, 마음에 떠오르는 사람 있으면 거기서 같이 남길래?' },
      { text: '아빠여도, 엄마여도, 그리운 누구여도 괜찮아. 목소리가 쑥스러우면 글로 적어도 되고,' },
      { text: '없으면 오늘 마음만 담아도 돼. 우리 둘 다, 한 트랙씩.' },
    ],
    next: null,
    ui: ['cassette_flip', 'show_mission:M4'],
  },

  C4_4: {
    id: 'C4_4',
    track: 4,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M4_done' },
    audioFile: 'c4_4',
    durationSec: 20,
    subtitleLines: [
      { text: '…남겼어? 나도.' },
      { text: '이상하다, 남기고 나니까 좀 가벼워졌어.' },
      { text: '고마워. 나 혼자였으면 못 했을 거야. 멀리서라도 같이 해주니까 됐어.' },
      { text: '자, 이제… 마지막 트랙이야.' },
    ],
    next: null,
    ui: ['reel_advance', 'track_check:4', 'fragment_award:frag_4', 'coupon:cp4'],
  },

  C4_5: {
    id: 'C4_5',
    track: 4,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'NEXT' },
    audioFile: 'c4_5',
    durationSec: 30,
    subtitleLines: [
      { text: "마지막 소원이 제일 웃겨. '딸이랑 가족오락관 나가기'." },
      { text: '아빠가 그 프로 진짜 좋아했거든. 온 가족이 나가서 문제 맞히는 거.' },
      { text: '근데 우리 가족은… 끝내 같이 못 나갔어.' },
      { text: '저 앞 방하림으로 가줘. 거기가 마지막이야. …나 좀 떨린다.' },
    ],
    next: null,
  },

  // ============================== TRACK 5 — 방하림 ==============================

  C5_1: {
    id: 'C5_1',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't5' },
    audioFile: 'c5_1',
    durationSec: 20,
    subtitleLines: [
      { text: '도착했어? 주변에 뭐 붙어 있는 거 없어? 포스터 같은 거.' },
      { text: '있으면… 사진으로 좀 보여줄래?' },
    ],
    next: null,
    ui: ['show_mission:M5a'],
  },

  C5_2: {
    id: 'C5_2',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M5a_done' },
    audioFile: 'c5_2',
    durationSec: 35,
    subtitleLines: [
      { text: "…방금 보낸 사진, 그 포스터… '봉황동 레트로 축제 — 추억의 가족오락관'. 오늘 날짜네." },
      { text: '이게… 우연일 리가 없는데. 잠깐만.' },
      { text: '[사이] 방금 마을 어르신한테 물어봤어. 우리 아빠가… 한 달 전에 거기 부탁을 남겨뒀대.' },
      { text: "'소영이가 올 거예요. 꼭 참여하게 해주세요. 마지막 소원이에요.'" },
      { text: '아빠가… 내가 올 걸 알고 있었어. 다리 다치기 전에, 다 준비해놨던 거야.' },
    ],
    next: null,
    ui: ['show_unlock_gate'],
  },

  C5_3: {
    id: 'C5_3',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'unlock_done' },
    audioFile: 'c5_3',
    durationSec: 15,
    subtitleLines: [
      { text: '잠깐… B면에 뭐가 있어? 나 이건 못 들었는데. 빈 면인 줄 알았어.' },
      { text: '…같이 듣자. 휴대폰, 테이프 가까이 대줄래? 나도 지금 아빠 옆에서 들을게.' },
    ],
    next: 'C5_4',
  },

  // voice_age=old — 느리고 갈라진 목소리. 자막은 손글씨 폰트, 한 줄씩
  C5_4: {
    id: 'C5_4',
    track: 5,
    channel: 'tape',
    speaker: 'father',
    voiceAge: 'old',
    trigger: { type: 'auto_chain', ref: 'C5_3' },
    audioFile: 'c5_4',
    durationSec: 50,
    subtitleLines: [
      { text: '소영아. 이 테이프 뒷면… 네가 찾았구나.' },
      { text: '다섯 가지 소원, 다 이뤘니?' },
      { text: '아빠는 한 달 동안 이거 준비했다. 네가 올까, 안 올까, 매일 불안했어.' },
      { text: '그래도 믿었다. 우리 딸, 꼭 올 거라고.' },
      { text: '네가 가족오락관에서 웃는 얼굴… 그거 상상만 해도 아빠는 좋았어.' },
      { text: '미안하다. 사랑한다는 말, 너무 늦게 한다.' },
      { text: '이제 아빠 소원은 다 이뤄졌어. 고맙다, 소영아.' },
      { text: '…아빠가.' },
    ],
    sfx: { in: 'tape_hiss', out: 'tape_stop' },
    next: 'C5_5',
  },

  C5_5: {
    id: 'C5_5',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'C5_4' },
    audioFile: 'c5_5',
    durationSec: 35,
    subtitleLines: [
      { text: '[울먹] …다 이뤘어요, 아빠. 다섯 개, 하나도 안 빼고.' },
      { text: '[사이] …야. 진짜 고마워.' },
      { text: '네가 그 조각들 다 모아줘서, 이 마지막 트랙도 들을 수 있었어.' },
      { text: '나 혼자였으면 오늘 여기까지 절대 못 왔어. 첫 골목에서 그냥 포기했을 거야.' },
      { text: '오늘 처음 만났는데… 너, 이제 내 친구야. 진심으로.' },
    ],
    next: 'C6_0',
    ui: ['track_check:5', 'album_build', 'phase:act2'],
  },

  // ============================== ACT 2 — 빙고 개방 ==============================

  C6_0: {
    id: 'C6_0',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'C5_5' },
    autoChainDelayMs: 4000,
    audioFile: 'c6_0',
    durationSec: 30,
    subtitleLines: [
      { text: '…자, 무거운 얘긴 여기까지!' },
      { text: '눈물 쏙 뺐으니까 이제 기분 전환하자.' },
      { text: '사실 나, 이번에 내려오기 전까진 이 동네가 싫었거든. 근데 너랑 통화하면서 걸으니까 다시 좋아졌어.' },
      { text: '이제 내가 자란 동네, 구경시켜줄게. 천천히, 마음 가는 대로 둘러봐 줘.' },
      { text: '골목마다 내 어릴 적 얘기가 숨어 있어. 찾아볼래?' },
    ],
    next: null,
    ui: ['case_open'],
  },

  C6_X_BUNSIK: {
    id: 'C6_X_BUNSIK',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'bingo_cell_done:bunsik' },
    audioFile: 'c6_x_bunsik',
    durationSec: 15,
    subtitleLines: [
      { text: '여기 떡볶이 진짜 맛있어. 나 학교 끝나면 매일 왔어. 아직도 하시네, 신기하다.' },
    ],
    next: null,
  },

  C6_X_BYEOKHWA: {
    id: 'C6_X_BYEOKHWA',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'bingo_cell_done:byeokhwa' },
    audioFile: 'c6_x_byeokhwa',
    durationSec: 15,
    subtitleLines: [
      { text: '이 골목에서 나 자전거 처음 배웠어. 여기서 넘어져서 무릎 다 까졌지.' },
    ],
    next: null,
  },

  C6_X_BONGHWANGDAE: {
    id: 'C6_X_BONGHWANGDAE',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'bingo_cell_done:bonghwangdae' },
    audioFile: 'c6_x_bonghwangdae',
    durationSec: 15,
    subtitleLines: [
      { text: '여기 올라가면 동네가 다 보여. 아빠가 소풍 데려와서 김밥 먹던 데야.' },
    ],
    next: null,
  },

  // ============================== FINALE ==============================

  C7_0: {
    id: 'C7_0',
    track: 7,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'FINISH' },
    audioFile: 'c7_0',
    durationSec: 35,
    subtitleLines: [
      { text: '오늘 하루, 정말 고마웠어.' },
      { text: '아빠 소원도 다 이루고, 나 이 동네랑도 화해했어. 다 네 덕분이야.' },
      { text: '그 테이프… A면은 아빠 목소리, B면은 우리 목소리로 채워졌어.' },
      { text: '이제 이 골목은, 나 혼자만의 기억이 아니라 우리 둘의 이야기야.' },
      { text: '다음에 내려오면 꼭 보자. 맛있는 거 살게. 진짜야.' },
      { text: '…오늘, 같이 걸어줘서 고마워.' },
    ],
    next: 'C7_1',
  },

  // OPTIONAL — feature flag `epilogue_live_voice`. 멀리서 배경음처럼
  C7_1: {
    id: 'C7_1',
    track: 7,
    channel: 'call',
    speaker: 'father_soyoung',
    voiceAge: 'old',
    trigger: { type: 'auto_chain', ref: 'C7_0' },
    audioFile: 'c7_1',
    durationSec: 8,
    subtitleLines: [
      { speaker: '아버지', text: '소영아, 누구랑 통화하노?' },
      { speaker: '소영', text: '내 친구!' },
    ],
    next: null,
    optionalFlag: 'epilogue_live_voice',
  },
}

// ---------------------------------------------------------------------------
// 조회 헬퍼
// ---------------------------------------------------------------------------

export const ALL_CUE_IDS = Object.keys(CUES) as CueId[]

export function getCue(id: CueId): Cue {
  return CUES[id]
}

/** QR 스캔 → 거점 도착 큐 (T1 트리거) */
export function findCueByQr(station: StationId): Cue | null {
  return (
    Object.values(CUES).find(
      (c) => c.trigger.type === 'qr' && c.trigger.ref === station
    ) ?? null
  )
}

/** 미션 액션 → 후속 큐 (T3 트리거) */
export function findCueByAction(action: ActionId): Cue | null {
  return (
    Object.values(CUES).find(
      (c) => c.trigger.type === 'action_event' && c.trigger.ref === action
    ) ?? null
  )
}

/**
 * 버튼 탭 → 큐 (T4 트리거).
 * NEXT는 트랙마다 있으므로 현재 트랙으로 구분한다.
 */
export function findCueByTap(tap: TapId, currentTrack: number): Cue | null {
  const candidates = Object.values(CUES).filter(
    (c) => c.trigger.type === 'user_tap' && c.trigger.ref === tap
  )
  if (candidates.length === 1) return candidates[0]
  return candidates.find((c) => c.track === currentTrack) ?? null
}

/**
 * 개발용 무결성 검사 — 참조가 끊긴 큐·트리거 수 위반을 빌드 전에 잡는다.
 * (명세 D4: qr 트리거 큐는 정확히 5개 — 인트로 테이프는 user_tap:PLAY)
 */
export function validateCueGraph(): string[] {
  const errors: string[] = []
  const ids = new Set(ALL_CUE_IDS)

  for (const cue of Object.values(CUES)) {
    if (cue.next && !ids.has(cue.next)) {
      errors.push(`${cue.id}: next "${cue.next}" 큐가 존재하지 않음`)
    }
    if (cue.trigger.type === 'auto_chain' && !ids.has(cue.trigger.ref)) {
      errors.push(`${cue.id}: auto_chain ref "${cue.trigger.ref}" 큐가 존재하지 않음`)
    }
    if (cue.subtitleLines.length === 0) {
      errors.push(`${cue.id}: 자막이 비어 있음`)
    }
    if (cue.durationSec <= 0) {
      errors.push(`${cue.id}: durationSec은 양수여야 함`)
    }
  }

  const qrCues = Object.values(CUES).filter((c) => c.trigger.type === 'qr')
  if (qrCues.length !== 5) {
    errors.push(`qr 트리거 큐는 정확히 5개여야 함 (현재 ${qrCues.length}개)`)
  }

  // auto_chain의 ref는 실제로 next 체인과 일치해야 함
  for (const cue of Object.values(CUES)) {
    if (cue.next) {
      const nextCue = CUES[cue.next]
      if (
        nextCue.trigger.type === 'auto_chain' &&
        nextCue.trigger.ref !== cue.id
      ) {
        errors.push(
          `${cue.id} → next ${cue.next}: auto_chain ref(${nextCue.trigger.ref}) 불일치`
        )
      }
    }
  }

  return errors
}
