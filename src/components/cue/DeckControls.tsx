'use client'

/**
 * 카세트 데크 컨트롤 바 — REW · PLAY/PAUSE · FF · STOP · REC.
 *
 * 실물 데크의 물리 키를 모사한다. 키 크기는 전부 동일하고,
 * 지금 누를 수 있는 키만 컬러로 살아난다(비활성은 눌린 채 어둡게).
 * 인트로 플레이어·큐 플레이어·통화 화면이 같은 컴포넌트를 쓴다.
 */

export type DeckKeyKind = 'rew' | 'play' | 'pause' | 'ff' | 'stop' | 'rec'

import { playDeckKey } from '@/lib/sfx'

export interface DeckKeySpec {
  kind: DeckKeyKind
  /** 키 각인 — 생략하면 kind의 기본 라벨 */
  label?: string
  /** 없으면 비활성(눌린 채 어두운 키) */
  onClick?: () => void
  /** 컬러 변형 — 기본은 kind에 따라 자동 */
  accent?: 'play' | 'rec' | 'go'
  ariaLabel?: string
  title?: string
}

const DEFAULT_LABEL: Record<DeckKeyKind, string> = {
  rew: 'REW',
  play: 'PLAY',
  pause: 'PAUSE',
  ff: 'FF',
  stop: 'STOP',
  rec: 'REC',
}

/** kind별 기본 강조색 — PLAY는 선셋, REC은 레드, 나머지는 크림 */
const DEFAULT_ACCENT: Partial<Record<DeckKeyKind, 'play' | 'rec' | 'go'>> = {
  play: 'play',
  rec: 'rec',
}

function Glyph({ kind }: { kind: DeckKeyKind }) {
  switch (kind) {
    case 'rew':
      return (
        <span className="glyph">
          <span className="tri sm back" />
          <span className="tri sm back" />
        </span>
      )
    case 'ff':
      return (
        <span className="glyph">
          <span className="tri sm" />
          <span className="tri sm" />
        </span>
      )
    case 'pause':
      return (
        <span className="glyph">
          <span className="pause">
            <i />
            <i />
          </span>
        </span>
      )
    case 'stop':
      return (
        <span className="glyph">
          <span className="sq" />
        </span>
      )
    case 'rec':
      return (
        <span className="glyph">
          <span className="dot" />
        </span>
      )
    default:
      return (
        <span className="glyph">
          <span className="tri" />
        </span>
      )
  }
}

interface DeckControlsProps {
  keys: DeckKeySpec[]
  className?: string
}

export default function DeckControls({ keys, className = '' }: DeckControlsProps) {
  return (
    <div className={`player-keys ${className}`}>
      {keys.map((spec, i) => {
        const enabled = Boolean(spec.onClick)
        const accent = spec.accent ?? DEFAULT_ACCENT[spec.kind]
        return (
          <button
            key={`${spec.kind}-${i}`}
            type="button"
            onClick={() => {
              // 소리는 여기 한 곳에서만 낸다 — 각 호출부가 따로 챙기면
              // 새 버튼이 생길 때마다 빠뜨린다
              playDeckKey(spec.kind)
              spec.onClick?.()
            }}
            tabIndex={enabled ? undefined : -1}
            aria-hidden={enabled ? undefined : true}
            aria-label={spec.ariaLabel ?? spec.label ?? DEFAULT_LABEL[spec.kind]}
            title={spec.title}
            className={`deck-key ${enabled ? 'on' : 'ghost'}${
              accent ? ` accent-${accent}` : ''
            }`}
          >
            <Glyph kind={spec.kind} />
            <span className="key-label">
              {spec.label ?? DEFAULT_LABEL[spec.kind]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
