/**
 * 봉황 메모리즈 EP.1 「아버지의 믹스테이프」 — 오디오 번들 데이터 (구현명세서 v2).
 *
 * 재생 단위는 '번들'이다(D13 — 짧은 컷 나열 금지). 번들 안의 호흡은
 * 오디오 파일 내부의 사이(pause)로 구현하고, 자막은 문장 단위로 싱크한다.
 * 대사는 명세서 §6의 원문 그대로다. 임의 수정 금지(명세서 상단 지시).
 *
 * 트리거 4계층(§4):
 *  - qr           : 실물 QR(인트로 1 + 거점 5 = 정확히 6회, D4). 인트로 테이프는 QR 후 PLAY 탭
 *  - auto_chain   : 선행 번들 종료 직후. 같은 장소 연속 서사에만
 *  - action_event : 미션 완료(정답 입력·사진·녹음·잠금 해제)가 트리거
 *  - user_tap     : [전화 걸기]·[이어서 재생]·[사장님의 이야기 듣기]·[B면 재생] 등 명시적 버튼
 *
 * 채널(D1): tape = 아버지·과거(로파이+히스+릴 UI) / call = 소영·현재(클린+통화 UI)
 *          / shop = 가게 주인 증언(약한 룸톤). D2: 소영은 현장에 없고 통화로만 동행.
 * D3: 테이프에 소영 목소리 없음. 자동 발신 금지 — 쪽지 번호로 참여자가 직접 [전화 걸기].
 */

export type StationId = 'intro' | 't1' | 't2' | 't3' | 't4' | 't5'
export type FragmentId = 'frag_1' | 'frag_2' | 'frag_3' | 'frag_4'
export type TapId = 'PLAY' | 'CALL' | 'LISTEN' | 'RESUME' | 'ASK' | 'BSIDE' | 'FINISH'

export type ActionId =
  | 'M1_count_ok'
  | 'M1_photo_done'
  | 'M2_photo_done'
  | 'M3_photo_done'
  | 'M4_done'
  | 'M5a_done'
  | 'unlock_done'
  | `bingo_cell_done:${string}`

/** 번들 ID — 명세서 §6/§12 기준. 파일명은 소문자(b0_tape 등) */
export type CueId =
  | 'B0_TAPE' | 'B0_CALL'
  | 'B1_A' | 'B1_S' | 'B1_B'
  | 'B2_A' | 'B2_B'
  | 'B3_A' | 'B3_B'
  | 'B4_A' | 'B4_RADIO' | 'B4_B' | 'B4_C'
  | 'B5_A' | 'B5_T1' | 'B5_T2' | 'B5_T3' | 'B5_LETTER' | 'B5_F'
  | 'B6_0' | 'B6_X_BUNSIK' | 'B6_X_BYEOKHWA' | 'B6_X_BONGHWANGDAE'
  | 'B7_0' | 'B7_1'

export type Speaker =
  | 'father'
  | 'soyoung'
  | 'shopkeeper1'
  | 'shopkeeper2'
  | 'dj_father'
  | 'father_soyoung'

/** UI 지시자 — 번들 종료 시점에 실행된다 */
export type UiDirective =
  | 'reel_spin'
  | 'reel_advance'
  | 'cassette_flip'
  | 'case_open'
  | 'show_call_button'
  | 'show_resume_button'
  | 'show_ask_button'
  | 'show_unlock_gate'
  | 'album_build'
  | 'last_wish_reserved'
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
  /** 한 번들에 화자가 여럿일 때만 표기(사장님·DJ·오버레이 등) */
  speaker?: string
  text: string
}

export interface Cue {
  id: CueId
  track: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  channel: 'tape' | 'call' | 'shop'
  speaker: Speaker
  voiceAge: 'young' | 'old' | null
  trigger: CueTrigger
  /** auto_chain 전용 — 선행 번들 종료 후 대기(기본 2500) */
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
  /** B7_1 전용 — feature flag가 켜져 있을 때만 재생 */
  optionalFlag?: 'epilogue_live_voice'
}

export const SPEAKER_NAMES: Record<Speaker, string> = {
  father: '아버지',
  soyoung: '소영',
  shopkeeper1: '봉황1935 사장님',
  shopkeeper2: '방하림 사장님',
  dj_father: '라디오',
  father_soyoung: '아버지 · 소영',
}

// ---------------------------------------------------------------------------
// 화면 고정 텍스트 (명세서 §6 원문)
// ---------------------------------------------------------------------------

/** S02 — 테이프 발견 화면 연출 순서 */
export const S02_DISCOVERY_TEXT = [
  '골목 입구, 낡은 우체통 위에 놓인 카세트 플레이어.',
  '재생 버튼 위 손글씨 스티커 — "눌러주세요."',
  '테이프 라벨: "소영에게 — 1988. 9. 17."',
] as const

/**
 * S02 — 쪽지 앞면 (§6 INTRO).
 *
 * 손으로 쓴 쪽지라 문장이 흐르는 대로 줄이 나뉜다. 한 덩어리로 두면
 * 폭에 따라 아무 데서나 접혀 손글씨 느낌이 사라지므로 줄을 직접 잡는다.
 * 서명은 마지막 줄에 혼자 둔다.
 */
export const NOTE_FRONT_LINES = [
  '이 테이프를 발견하신 분께.',
  '아버지의 목소리입니다. 끝까지 들어주세요.',
  '그리고 괜찮으시다면, 뒷면 번호로 전화 주세요. 부탁이 있습니다.',
  '— 딸 소영',
] as const

/** 줄바꿈 없이 한 줄로 필요한 곳(스크린리더 요약·검색 등)을 위한 형태 */
export const NOTE_FRONT_TEXT = NOTE_FRONT_LINES.join(' ')

/** S02 — 쪽지 뒷면 전화번호(연출용 잠정값) */
export const NOTE_PHONE_LABEL = '소영에게 전화 걸기'

/** S22 — 잠금 해제 문구 */
export const UNLOCK_MESSAGE = 'B면의 마지막 트랙이 발견되었습니다.'

/** S22 — 조각 부족 안내 (D10) */
export const UNLOCK_SHORT_MESSAGE =
  '기억의 조각이 부족합니다 — 지나온 소원을 완료해 주세요'

/** S10 — 잠긴 빙고 배지 문구 */
export const BINGO_LOCKED_MESSAGE = '다섯 소원 후 열립니다'

/** S40 — 피날레 화면 텍스트 템플릿 (§6 — 4+1개) */
export const S40_TEXT = {
  // '약속의 기록자'는 내부 세계관·상표 용어라 소비자 화면에 노출하지 않는다(브랜드 v2.1 §1).
  // 사용자 칭호는 '기록자'로 통일한다.
  title: (serial: string) => `소영의 곁을 지킨 친구, 기록자 No.${serial}`,
  journey: (date: string, partySize: number) =>
    `${date} — ${partySize}명이 소영과 함께 봉황동의 이야기를 이었습니다.`,
  stats: (elapsed: string, bingoCount: number) =>
    `함께한 시간 ${elapsed} · 이룬 소원 4+1개 · 발견한 골목 ${bingoCount}곳`,
  closing: '"오늘의 골목은, 이제 두 사람의 이야기입니다."',
  saveButton: '우리의 테이프 저장하기',
  ep2Button: 'EP.2 「첫사랑의 골목」 예약 — 8월',
  ep2Note: '(후기 작성 시 3,000원 할인)',
} as const

// ---------------------------------------------------------------------------
// 번들 스크립트 (§6 대사 원문 — 수정 금지)
// ---------------------------------------------------------------------------

export const CUES: Record<CueId, Cue> = {
  // ============================== INTRO ==============================

  // D3: 테이프엔 아버지 목소리만. 종료 후 쪽지 뒷면 → [전화 걸기] 버튼 노출.
  B0_TAPE: {
    id: 'B0_TAPE',
    track: 0,
    channel: 'tape',
    speaker: 'father',
    voiceAge: 'young',
    trigger: { type: 'user_tap', ref: 'PLAY' },
    audioFile: 'b0_tape',
    durationSec: 60,
    subtitleLines: [
      { text: '…잘 돌아가나, 이거. 어험.' },
      { text: '소영아. 아빠다. 곧 나온다더라. 이름은 정해놨다. 강소영. 아빠가 지었다.' },
      { text: '이런 거 왜 하나 싶다마는. 아빠가 원래 말주변이 없다. 그러니까 여기다 해두는 거다.' },
      { text: '너 기다리면서… 뭐, 소원이랄 것까진 없고. 다섯 개 정해봤다.' },
      { text: '하나, 엄마랑 어떻게 만났는지 들려주기. 둘, 목욕탕 가서 서로 등 밀어주기.' },
      { text: '셋, 예쁜 사진 찍어주기. 넷, 좋아하는 음악 같이 듣기. 다섯… 가족오락관 같이 나가기.' },
      { text: '네가 크면 같이 듣자. 몇 개나 지켰나 세어보고. …뭐, 그런 약속이다.' },
      { text: '…얼른 나와라.' },
    ],
    sfx: { in: 'tape_hiss', out: 'tape_stop' },
    next: null,
    ui: ['reel_spin', 'show_call_button'],
  },

  B0_CALL: {
    id: 'B0_CALL',
    track: 0,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'CALL' },
    audioFile: 'b0_call',
    // 기존 준비 음성(개정본)을 첫 통화 번들로 활용
    audioAliases: ['intro-soyoung'],
    durationSec: 70,
    subtitleLines: [
      { text: '…여보세요? 아, 진짜 걸어주셨네요. 감사합니다.' },
      { text: '갑자기 이상한 부탁이라 놀라셨죠. 저는 강소영이라고 해요.' },
      { text: '방법이… 이것밖에 생각이 안 났어요. 전단지를 붙일까도 했는데, 그건 아닌 것 같았고.' },
      { text: '아빠 목소리를 먼저 들려드리고 싶었어요.' },
      { text: '그 목소리를 끝까지 듣고도 그냥 지나가시는 분이라면, 어차피 부탁드릴 수 없는 거니까요.' },
      { text: '…끝까지 들어주셨네요.' },
      { text: '아버지가 얼마 전 넘어져서 다리에 깁스를 하셨어요. 그리고 요즘 자꾸 깜빡깜빡하세요.' },
      { text: '근데 신기하죠, 제가 태어나던 시기는 아직도 또렷하게 기억하세요.' },
      { text: '저도 사실… 그 테이프, 소원 부분까지 들었어요. 아빠 목소리가 너무 젊어서 신기했죠.' },
      { text: '소원들이 전부 이 동네 어딘가에 있어요. 근데 저는 아버지 옆에 있어야 해서 나갈 수가 없어요.' },
      { text: '그래서… 같이 가주시겠어요? 제가 전화 통화하며 함께 걸을게요.' },
      { text: '소원은 제가 이룰 거예요. 그냥, 옆에서 같이 걸어주시면 돼요.' },
      { text: '첫 번째 장소는 거기서 3분이에요. 우물이 있던 자리라고, 아빠한테 옛날에 들은 적이 있어요. 지금은 카페가 됐대요.' },
    ],
    sfx: { in: 'call_ring' },
    next: null,
  },

  // ============================== TRACK 1 — 봉황1935 ==============================

  B1_A: {
    id: 'B1_A',
    track: 1,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't1' },
    audioFile: 'b1_a',
    durationSec: 40,
    subtitleLines: [
      { text: '맞아요, 거기예요. 엄마 아빠가 처음 만난 곳.' },
      { text: '근데 어떻게 만났는지는 저도 몰라요. 그 얘기를 해주는 게 첫 번째 소원이었는데, 아빠는 이제 그 얘길 꺼려 하세요.' },
      { text: '마당에 초록 덩굴 보이세요? 꽈리처럼 생긴 열매가 달린 풀이요. 풍선초라고, 그게 힌트래요.' },
      { text: '열매가 몇 개 열렸는지 세어봐 주실래요?' },
      { text: '그리고… 가게에 그 시절을 기억하시는 사장님이 계실 거예요. 이야기를 청해봐 주세요.' },
    ],
    next: null,
    ui: ['show_mission:M1'],
  },

  B1_S: {
    id: 'B1_S',
    track: 1,
    channel: 'shop',
    speaker: 'shopkeeper1',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'LISTEN' },
    audioFile: 'b1_s',
    durationSec: 35,
    subtitleLines: [
      { text: '아, 민수? 기억나고말고. 근데 뉘신데?' },
      { text: '풍선초야. 이게 왜 여태 자라는 줄 알아? 네 아버지가 심은 거야.' },
      { text: "저 우물가에서, 네 아버지가 이 풍선초로 하트를 딱 만들어서 네 엄마한테 그러더라. '이게… 내 마음이오.'" },
      { text: '아이고, 그 무뚝뚝한 사람이. 온 동네가 다 웃었지.' },
    ],
    next: null,
    ui: ['show_mission:M1b'],
  },

  // 존댓말→반말 전환은 이 번들 안에서만 일어난다 (D7)
  B1_B: {
    id: 'B1_B',
    track: 1,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M1_photo_done' },
    audioFile: 'b1_b',
    durationSec: 55,
    subtitleLines: [
      { text: '…아버지가 그런 말을 했다고요? 상상이 안 돼요, 진짜.' },
      { text: "저한텐 평생 '밥 먹었나' 그 말밖에 안 하셨는데." },
      { text: '첫 번째 소원, 이뤘어요. 아빠가 못 해준 얘기, 방금 들었으니까.' },
      { text: '저기… 말 편하게 해도 될까요? 왠지 오래 알던 사이 같아서요.' },
      { text: '…고마워. 이제 말 놓을게.' },
      { text: '다음 가게는, 그 골목 쭉 가다가 파란 타일 건물 지나서였는데… 아직 있으려나 모르겠다.' },
      { text: '미야상회라고, 조그만 구멍가게야. 파란 타일 건물은 옛날 목욕탕이야.' },
    ],
    next: null,
    ui: [
      'reel_advance',
      'track_check:1',
      'fragment_award:frag_1',
      'coupon:cp1',
      'speech_mode:casual',
    ],
  },

  // ============================== TRACK 2 — 미야상회 ==============================

  B2_A: {
    id: 'B2_A',
    track: 2,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't2' },
    audioFile: 'b2_a',
    durationSec: 60,
    subtitleLines: [
      { text: '…아직도 있구나, 그 가게. 두 번째 소원이 목욕탕에서 서로 등 밀어주기잖아.' },
      { text: '아들 기대하면서 정한 소원이었는데, 태어난 건 딸이라… 일곱 살까지밖에 같이 못 갔대. 내가 커버렸으니까.' },
      { text: '그래서 아빠는 목욕탕 못 가는 대신, 매주 일요일마다 그 가게에서 바나나우유를 사 왔어.' },
      { text: "나 그게 그냥 바나나우유인 줄 알았어. 그게 '목욕탕 대신'이었다는 걸, 이번에 내려와서 이제야 알았네." },
      { text: '근데 생각해보니까, 이 소원은 이제 아무도 못 이뤄. 나는 다 컸고, 아빠는 다리에 깁스를 했고.' },
      { text: '…그러니까 네가 나 대신 바나나우유를 찾아 마셔줘. 그리고 무슨 맛인지 알려줘.' },
    ],
    next: null,
    ui: ['show_mission:M2'],
  },

  B2_B: {
    id: 'B2_B',
    track: 2,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M2_photo_done' },
    audioFile: 'b2_b',
    durationSec: 50,
    subtitleLines: [
      { text: '사진 봤어. 그 노란 병, 하나도 안 변했네.' },
      { text: '아빠는 말로 사랑한다고 한 적이 없어. 근데 이런 걸로 다 했던 거였네.' },
      { text: '나는… 아빠가 나한테 관심이 없는 줄 알았어. 서운해할 줄만 알았지, 19년 동안.' },
      { text: '괜찮아, 나 안 울어. 가자. 그 골목 끝에 오래된 한옥이 하나 있어.' },
      { text: '담장이 긴 집인데… 여름마다 담장이 주황색이 됐어. 그건 기억나.' },
    ],
    next: null,
    ui: ['reel_advance', 'track_check:2', 'fragment_award:frag_2', 'coupon:cp2'],
  },

  // ============================== TRACK 3 — 능소화 고택 ==============================

  B3_A: {
    id: 'B3_A',
    track: 3,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't3' },
    audioFile: 'b3_a',
    durationSec: 55,
    subtitleLines: [
      { text: '능소화야. 아빠가 세상에서 제일 좋아하던 꽃.' },
      { text: "꽃말이 뭔 줄 알아? '영원한 사랑', 그리고 '잊지 않겠다는 약속'이래." },
      { text: "세 번째 소원이 사진 찍어주기잖아. 아빠가 꽃 활짝 폈을 때 '여기서 사진 찍자' 그랬는데…" },
      { text: '나 그때 사춘기라고 싫다고 했어. 그러고 못 찍었어. 그 약속만 남고, 사진은 없어.' },
      { text: '휴대폰 들어서 담장 한번 비춰볼래? 요즘엔 그런 게 된다더라.' },
    ],
    next: null,
    ui: ['show_mission:M3'],
  },

  B3_B: {
    id: 'B3_B',
    track: 3,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M3_photo_done' },
    audioFile: 'b3_b',
    durationSec: 50,
    subtitleLines: [
      { text: '…와, 예쁘다. 진짜 피었네.' },
      { speaker: '소영(혼잣말)', text: '아빠, 봤어요? 우리가 여기서 사진 찍었어요. 늦었지만… 약속 지켰어요.' },
      { text: "네 번째 소원이 문제야. '좋아하는 음악 같이 듣기'인데… 아빠가 무슨 음악을 좋아했는지, 나 모르겠어." },
      { text: '밤마다 라디오를 들으셨던 건 기억나는데.' },
      { text: '저기, 그 테이프… 소원 뒤에 뭐가 더 있는지 볼래? 아빠가 뭘 남겼을지도 몰라. 나는 아빠의 소원까지만 돌려봤거든.' },
      { text: '찾기 어려울 텐데, 저 앞에 오른쪽으로 좁은 골목 있지? 거기로 들어가면 카페 탱자가 있어.' },
      { text: '옛날에 음악다방이었던 자리야. 거기 앉아서 틀어보자.' },
    ],
    next: null,
    ui: ['reel_advance', 'track_check:3', 'fragment_award:frag_3', 'coupon:cp3'],
  },

  // ============================== TRACK 4 — 카페 탱자 ==============================

  B4_A: {
    id: 'B4_A',
    track: 4,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't4' },
    audioFile: 'b4_a',
    durationSec: 12,
    subtitleLines: [
      { text: '들어왔어? 창가 자리 있으면 앉아. 볼륨은 조금만 키우고.' },
      { text: '…정지해둔 자리 그대로, 재생 버튼 눌러봐.' },
    ],
    next: null,
    // tape_position=wishes_end 지점에서 [▶ 이어서 재생]
    ui: ['show_resume_button'],
  },

  B4_RADIO: {
    id: 'B4_RADIO',
    track: 4,
    channel: 'tape',
    speaker: 'dj_father',
    voiceAge: 'young',
    trigger: { type: 'user_tap', ref: 'RESUME' },
    audioFile: 'b4_radio',
    durationSec: 75,
    subtitleLines: [
      { speaker: '라디오 DJ', text: "다음 사연, 봉황동 강민수 씨. 신청곡은 이문세 '소녀'입니다." },
      { speaker: '아버지', text: '…딸아이가 여섯 살입니다. 아들을 바랐는데, 세상에서 제일 예쁜 아이가 왔습니다.' },
      { speaker: '아버지', text: '일요일마다 목욕탕 데려가고, 바나나우유 사줍니다.' },
      { speaker: '아버지', text: "근데 제가 말재주가 없어서, '아빠가 너를 사랑한다' 이 한마디를 제대로 못 해봤습니다." },
      { speaker: '아버지', text: '우리 딸, 영원히 지금처럼 웃는 소녀로 남았으면 합니다.' },
      { speaker: '아버지', text: '소영아. … 아빠는, 네가 웃을 때가 제일 행복하다.' },
    ],
    sfx: { in: 'tape_hiss' },
    next: 'B4_B',
  },

  B4_B: {
    id: 'B4_B',
    track: 4,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'B4_RADIO' },
    audioFile: 'b4_b',
    durationSec: 55,
    subtitleLines: [
      { text: '…네 번째 소원, 방금 이뤘다. 같이 들었으니까. 삼십팔 년 걸렸네.' },
      { text: '나 이따가 아빠한테 직접 말할래. 사랑한다고. 오늘은 말할 수 있을 것 같아.' },
      { text: '…근데 너는, 혹시 지금 옆에 없는 사람 있어? 있으면, 휴대폰에라도 남겨봐.' },
      { text: '아빠도 그랬잖아. 얼굴 보고 못 하는 말은, 이렇게라도 전할 수 있는 거야.' },
    ],
    next: null,
    // S21 '나의 육십 초' 음성 메모 (D12 — 카세트 플립 아님)
    ui: ['show_mission:M4'],
  },

  B4_C: {
    id: 'B4_C',
    track: 4,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M4_done' },
    audioFile: 'b4_c',
    durationSec: 20,
    subtitleLines: [
      { text: '…남겼어? 나도, 이따가 할게.' },
      { text: '자, 이제 마지막이야. 방하림이라는 가게야.' },
      { text: '마지막 소원이 왜 가족오락관인지는 나도 몰라. 아빠가 그 프로를 좋아하긴 했는데.' },
    ],
    next: null,
    ui: ['reel_advance', 'track_check:4', 'fragment_award:frag_4', 'coupon:cp4'],
  },

  // ============================== TRACK 5 — 방하림 ==============================

  B5_A: {
    id: 'B5_A',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'qr', ref: 't5' },
    audioFile: 'b5_a',
    durationSec: 20,
    subtitleLines: [
      { text: '도착했어? 주변에 뭐 붙어 있는 거 없어? 포스터 같은 거.' },
      { text: '보이면 읽어줘… 아니, 사진으로 보여줘.' },
    ],
    next: null,
    ui: ['show_mission:M5a'],
  },

  B5_T1: {
    id: 'B5_T1',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'M5a_done' },
    audioFile: 'b5_t1',
    durationSec: 15,
    subtitleLines: [
      { text: '아, 그거. 아빠 집 올 때 얼핏 본 것 같아. 동네에서 축제 한다고.' },
      { text: '…근데 잠깐, 가족오락관?' },
      { text: '가게 안에 들어가서, 혹시 아는 게 있으신지 여쭤봐 줄래?' },
    ],
    next: null,
    ui: ['show_ask_button'],
  },

  B5_T2: {
    id: 'B5_T2',
    track: 5,
    channel: 'shop',
    speaker: 'shopkeeper2',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'ASK' },
    audioFile: 'b5_t2',
    durationSec: 30,
    subtitleLines: [
      { text: '혹시… 강민수 어르신 일로 오셨어요? 어르신이 한 달 전에 오셨어요.' },
      { text: '축제 가족오락관에 참가 신청을 하시더라고요. 우리 딸이 올 거라고.' },
      { text: '오면 꼭 같이 나가게 해달라고. 신청서에 두 사람 이름을 적어놓고 가셨어요. 강민수, 강소영.' },
    ],
    next: 'B5_T3',
  },

  B5_T3: {
    id: 'B5_T3',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'B5_T2' },
    audioFile: 'b5_t3',
    durationSec: 30,
    subtitleLines: [
      { text: '…내가 올 줄 알고 있었어. 나는 십구 년 동안 한 번도 안 내려왔는데.' },
      { text: '다리 다치기 전에, 다 준비해놨던 거야.' },
      { text: '…그 테이프, 뒤집어서 B면 틀어줄래? 아빠가 여기까지 준비한 사람이면… 뭔가 있을지도 몰라.' },
    ],
    next: null,
    // 카세트 플립 연출은 B면 편지 전용 (D12)
    ui: ['cassette_flip', 'show_unlock_gate'],
  },

  // voiceAge=old — 느리고 갈라진 목소리. 자막 손글씨 폰트. 공백 20초 포함 1파일.
  B5_LETTER: {
    id: 'B5_LETTER',
    track: 5,
    channel: 'tape',
    speaker: 'father',
    voiceAge: 'old',
    trigger: { type: 'user_tap', ref: 'BSIDE' },
    audioFile: 'b5_letter',
    durationSec: 80,
    subtitleLines: [
      { speaker: '소영', text: '잠깐, 끄지 마. …같이 듣자. 나도 지금 아빠 옆에서 들을게.' },
      { speaker: '아버지', text: '소영아. 이 테이프 뒷면… 네가 찾았구나. 다섯 가지 소원, 다 이뤘니?' },
      { speaker: '아버지', text: '아빠는 요즘 자꾸 잊어버린다. 그래서 잊어버리기 전에, 여기다 해둔다.' },
      { speaker: '아버지', text: '미안하다. 사랑한다는 말, 너무 늦게 한다.' },
      { speaker: '아버지', text: '다음 주에, 가족오락관 같이 나가자. 마지막 소원은 아빠가 직접 이루고 싶다.' },
      { speaker: '아버지', text: '…고맙다, 소영아. 아빠가.' },
    ],
    sfx: { in: 'tape_hiss', out: 'tape_stop' },
    next: 'B5_F',
  },

  B5_F: {
    id: 'B5_F',
    track: 5,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'B5_LETTER' },
    audioFile: 'b5_f',
    durationSec: 45,
    subtitleLines: [
      { text: '…네 개 이뤘어요, 아빠. 마지막 하나는 남겨둘게요. 그건 아빠 거니까.' },
      { text: '…야. 진짜 고마워. 네가 같이 걸어줘서, 여기까지 왔어. 나 혼자였으면 첫 골목에서 돌아갔을 거야.' },
      { text: '다음 주엔 아빠 휠체어 밀고 같이 나갈 거야. 마지막 소원은 우리가 직접 이룰게.' },
      { text: '오늘 처음 만났는데… 너, 이제 내 친구야. 진심으로.' },
    ],
    next: 'B6_0',
    // 4+1: 5번째 소원은 '다음 주' 리본으로 유보
    ui: ['track_check:5', 'last_wish_reserved', 'album_build', 'phase:act2'],
  },

  // ============================== ACT 2 — 빙고 개방 ==============================

  B6_0: {
    id: 'B6_0',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'auto_chain', ref: 'B5_F' },
    autoChainDelayMs: 4000,
    audioFile: 'b6_0',
    durationSec: 30,
    subtitleLines: [
      { text: '…자, 무거운 얘긴 여기까지! 눈물 쏙 뺐으니까 이제 기분 전환하자.' },
      { text: '사실 나, 이번에 내려오기 전까진 이 동네가 싫었거든. 근데 너랑 통화하면서 걸으니까 다시 좋아졌어.' },
      { text: '이제 내가 자란 동네, 구경시켜줄게. 천천히, 마음 가는 대로 둘러봐 줘.' },
      { text: '골목마다 내 어릴 적 얘기가 숨어 있어. 찾아볼래?' },
    ],
    next: null,
    ui: ['case_open'],
  },

  B6_X_BUNSIK: {
    id: 'B6_X_BUNSIK',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'bingo_cell_done:bunsik' },
    audioFile: 'b6_x_bunsik',
    durationSec: 15,
    subtitleLines: [
      { text: '여기 떡볶이 진짜 맛있어. 나 학교 끝나면 매일 왔어. 아직도 하시네, 신기하다.' },
    ],
    next: null,
  },

  B6_X_BYEOKHWA: {
    id: 'B6_X_BYEOKHWA',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'bingo_cell_done:byeokhwa' },
    audioFile: 'b6_x_byeokhwa',
    durationSec: 15,
    subtitleLines: [
      { text: '이 골목에서 나 자전거 처음 배웠어. 여기서 넘어져서 무릎 다 까졌지.' },
    ],
    next: null,
  },

  B6_X_BONGHWANGDAE: {
    id: 'B6_X_BONGHWANGDAE',
    track: 6,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'action_event', ref: 'bingo_cell_done:bonghwangdae' },
    audioFile: 'b6_x_bonghwangdae',
    durationSec: 15,
    subtitleLines: [
      { text: '여기 올라가면 동네가 다 보여. 아빠가 소풍 데려와서 김밥 먹던 데야.' },
    ],
    next: null,
  },

  // ============================== FINALE ==============================

  B7_0: {
    id: 'B7_0',
    track: 7,
    channel: 'call',
    speaker: 'soyoung',
    voiceAge: null,
    trigger: { type: 'user_tap', ref: 'FINISH' },
    audioFile: 'b7_0',
    durationSec: 40,
    subtitleLines: [
      { text: '오늘 하루, 정말 고마웠어.' },
      { text: '그 테이프… A면은 아빠의 서른여덟 해 전이고, B면은 아빠의 지금이야. 그 사이를 오늘 너랑 같이 걸었네.' },
      { text: '이제 이 골목은, 나 혼자만의 기억이 아니라 우리 둘의 이야기야.' },
    ],
    next: 'B7_1',
  },

  // OPTIONAL — feature flag epilogue_live_voice가 켜져 있을 때만 재생
  B7_1: {
    id: 'B7_1',
    track: 7,
    channel: 'call',
    speaker: 'father_soyoung',
    voiceAge: 'old',
    trigger: { type: 'auto_chain', ref: 'B7_0' },
    audioFile: 'b7_1',
    durationSec: 8,
    subtitleLines: [
      { speaker: '아버지(멀리서)', text: '소영아, 누구랑 통화하노?' },
      { speaker: '소영', text: '내 친구!' },
    ],
    next: null,
    optionalFlag: 'epilogue_live_voice',
  },
}

// ---------------------------------------------------------------------------
// 파생 상수 · 조회 헬퍼
// ---------------------------------------------------------------------------

export const ALL_CUE_IDS = Object.keys(CUES) as CueId[]

export function getCue(id: CueId): Cue {
  return CUES[id]
}

/** QR 스캔 → 거점 도착 번들 (T1 트리거) */
export function findCueByQr(station: StationId): Cue | null {
  return (
    Object.values(CUES).find(
      (c) => c.trigger.type === 'qr' && c.trigger.ref === station
    ) ?? null
  )
}

/** 미션 액션 → 후속 번들 (T3 트리거) */
export function findCueByAction(action: ActionId): Cue | null {
  return (
    Object.values(CUES).find(
      (c) => c.trigger.type === 'action_event' && c.trigger.ref === action
    ) ?? null
  )
}

/**
 * 버튼 탭 → 번들 (T4 트리거).
 * 같은 tap이 여러 트랙에 있으면 현재 트랙으로 구분한다.
 */
export function findCueByTap(tap: TapId, currentTrack: number): Cue | null {
  const candidates = Object.values(CUES).filter(
    (c) => c.trigger.type === 'user_tap' && c.trigger.ref === tap
  )
  if (candidates.length === 1) return candidates[0]
  return candidates.find((c) => c.track === currentTrack) ?? null
}

/**
 * 개발용 무결성 검사 — 참조가 끊긴 번들·트리거 수 위반을 빌드 전에 잡는다.
 * (D4: qr 트리거 번들은 정확히 5개 — 인트로 테이프는 user_tap:PLAY)
 */
export function validateCueGraph(): string[] {
  const errors: string[] = []
  const ids = new Set(ALL_CUE_IDS)

  for (const cue of Object.values(CUES)) {
    if (cue.next && !ids.has(cue.next)) {
      errors.push(`${cue.id}: next "${cue.next}" 번들이 존재하지 않음`)
    }
    if (cue.trigger.type === 'auto_chain' && !ids.has(cue.trigger.ref)) {
      errors.push(`${cue.id}: auto_chain ref "${cue.trigger.ref}" 번들이 존재하지 않음`)
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
    errors.push(`qr 트리거 번들은 정확히 5개여야 함 (현재 ${qrCues.length}개)`)
  }

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
