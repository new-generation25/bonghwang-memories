'use client'

/**
 * 카세트 오브제 — P3 「선셋 90」의 중심 장치.
 *
 * 브랜드 가이드 고정 요소: 셸 블랙 몸체, 크림 라벨,
 * 가는 3색 스트라이프(옐로·오렌지·티얼), 우측 '88' 넘버링(레드).
 * 교체 지점은 손글씨 라벨(title)과 좌우 헤드 텍스트뿐이다.
 *
 * 지면당 1개 원칙 — 한 화면에 두 개 이상 배치하지 않는다.
 */

/**
 * 표준 배율 — 카세트는 어느 화면에서나 같은 크기로 보여야 한다.
 * 특별한 이유(포스터 합성 등) 없이는 이 값을 쓴다.
 */
export const CASSETTE_SCALE = 0.9

interface CassetteProps {
  /** 손글씨 라벨 — 에피소드명 (지역판 교체 지점) */
  title: string
  /** 라벨 좌측 상단 소문자 표기 */
  headLeft?: string
  /** 라벨 우측 상단 표기. 'REC'을 넘기면 점멸하는 녹음 표시가 된다 */
  headRight?: string
  /** SIDE 배지. 'done'이면 레드 원형 체크로 바뀐다 */
  side?: 'A' | 'B' | 'done'
  /** 테이프 감김 정도 0~100 — 스토리 진행률 */
  progress?: number
  /** 릴 회전 애니메이션: 왼쪽 감김 / 오른쪽 감김 / 양쪽 동시 / 정지 */
  spin?: 'left' | 'right' | 'both' | 'none'
  /** 넘버링 연도 — 스토리 기점 연도 (지역판 교체 지점) */
  year?: string
  /** 배치 배율 */
  scale?: number
  className?: string
}

export default function Cassette({
  title,
  headLeft = 'LOCAL MEMORIES',
  headRight = 'SIDE A',
  side = 'A',
  progress = 50,
  spin = 'none',
  year = '88',
  scale = 1,
  className = '',
}: CassetteProps) {
  const isRec = headRight === 'REC'
  const clamped = Math.max(0, Math.min(100, progress))

  return (
    <div
      className={className}
      style={
        scale !== 1
          ? { transform: `scale(${scale})`, transformOrigin: 'top center' }
          : undefined
      }
    >
      <div className="cassette">
        <span className="screw s1" />
        <span className="screw s2" />
        <span className="screw s3" />
        <span className="screw s4" />

        <div className={`stag${side === 'done' ? ' done' : ''}`}>
          {side === 'done' ? '✓' : side}
        </div>

        <div className="lbl">
          <div className="stripes">
            <i />
            <i />
            <i />
          </div>
          <div className="lhead">
            <span>{headLeft}</span>
            <span className={isRec ? 'rec-dot' : undefined}>
              {isRec ? 'REC' : headRight}
            </span>
          </div>
          <div className="ltitle">{title}</div>
          <div className="num88">{year}</div>
        </div>

        {/*
          왼쪽은 공급 릴, 오른쪽은 감기 릴이다. 진행률만큼 한쪽이 풀리고
          그만큼 다른 쪽에 감긴다 — 두 뭉치의 두께 합은 늘 같다.
        */}
        <div className="win">
          <div
            className={`reel${spin === 'left' || spin === 'both' ? ' spin' : ''}`}
            style={{ '--fill': 1 - clamped / 100 } as React.CSSProperties}
          >
            <span className="hub" />
          </div>
          <div className="tamount">
            <i style={{ width: `${clamped}%` }} />
          </div>
          <div
            className={`reel${spin === 'right' || spin === 'both' ? ' spin' : ''}`}
            style={{ '--fill': clamped / 100 } as React.CSSProperties}
          >
            <span className="hub" />
          </div>
        </div>

        <div className="cbottom">
          <span className="hole" />
          <span className="hole" />
        </div>
      </div>
    </div>
  )
}
