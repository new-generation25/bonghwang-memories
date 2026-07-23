'use client'

/**
 * QR 게이트 — 거점 진입 검증 (§4 T1 + §10 폴백).
 *
 * 기존 QRScanner(jsQR)를 감싸 페이로드를 검증한다:
 *  - 등록된 거점 QR(BH88:*)만 통과. 다른 QR은 오류 안내 후 재시도.
 *  - 순서 강제: allowedStations에 없는 거점은 "아직 차례가 아니에요".
 *  - QR 훼손·카메라 거부 → 4자리 수동 코드 입력 폴백.
 *  - 개발용 테스트 스캔('test-qr-code-data')은 허용 목록의 첫 거점으로 처리.
 */

import { useState } from 'react'
import QRScanner from '@/components/QRScanner'
import type { StationId } from '@/lib/cues'
import { submitOnEnter } from '@/lib/submitOnEnter'
import {
  CAMERA_SCAN_ENABLED,
  Station,
  UNIVERSAL_PASS_CODE,
  stationByManualCode,
  stationByQrPayload,
} from '@/lib/tracks'

interface QRGateProps {
  /** 지금 입장 가능한 거점들 (보통 다음 트랙 하나) */
  allowedStations: StationId[]
  onSuccess: (station: Station) => void
  onClose: () => void
}

export default function QRGate({
  allowedStations,
  onSuccess,
  onClose,
}: QRGateProps) {
  // 카메라를 끈 상태에서는 스캔 화면을 아예 거치지 않는다 — 권한 요청 자체가 없다
  const [mode, setMode] = useState<'scan' | 'manual'>(
    CAMERA_SCAN_ENABLED ? 'scan' : 'manual'
  )
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  const accept = (station: Station | null): boolean => {
    if (!station) {
      setError('봉황 메모리즈 거점 QR이 아니에요. 입구의 QR을 다시 확인해주세요.')
      return false
    }
    if (!allowedStations.includes(station.id)) {
      setError(`아직 ${station.name} 차례가 아니에요. 소영의 안내를 따라가 주세요.`)
      return false
    }
    onSuccess(station)
    return true
  }

  /** 지금 차례인 거점으로 통과 — 테스트 스캔·만능 코드 공용 */
  const acceptCurrent = () => {
    const first = allowedStations[0]
    if (first) {
      accept(stationByQrPayload(`BH88:${first.toUpperCase()}`) ?? null)
    }
  }

  const handleScan = (data: string) => {
    // 개발용 테스트 스캔 — 허용된 첫 거점으로 통과
    if (data === 'test-qr-code-data') {
      acceptCurrent()
      return
    }
    if (!accept(stationByQrPayload(data))) {
      // 스캐너는 첫 인식에서 닫히므로, 실패 시 수동 화면에서 재시도를 안내
      setMode('manual')
    }
  }

  const handleManualSubmit = () => {
    setError('')
    // 만능 통과 코드(검수용) — QR을 찍은 것으로 처리 (tracks.ts 참고, 실판매 전 비활성화)
    if (UNIVERSAL_PASS_CODE !== null && code === UNIVERSAL_PASS_CODE) {
      acceptCurrent()
      return
    }
    accept(stationByManualCode(code))
  }

  if (mode === 'scan' && CAMERA_SCAN_ENABLED) {
    return (
      <div className="fixed inset-0 z-50">
        <QRScanner onScanSuccess={handleScan} onClose={onClose} />
        {/* 수동 코드 폴백 진입 */}
        {/* QR 인식 실패 시 유일한 탈출구 — 홈 인디케이터에 가리지 않도록 안전영역만큼 띄운다 */}
        <button
          onClick={() => setMode('manual')}
          className="absolute left-1/2 z-[60] -translate-x-1/2 rounded-full bg-cream/95 px-5 py-2.5 text-[13px] font-bold text-ink shadow-lg"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          QR이 안 보이나요? 코드 입력
        </button>
      </div>
    )
  }

  // autoFocus로 키보드가 바로 올라오므로 위쪽에 붙인다 —
  // 가운데 정렬이면 키보드가 [입장하기] 버튼을 덮는다.
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-shell/85 px-6 py-12">
      <div className="w-full max-w-[340px] rounded-2xl bg-paper p-6">
        <h3 className="font-display text-[17px] text-ink">거점 코드 입력</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-60">
          거점 안내판에 적힌 4자리 코드를 입력해주세요.
        </p>

        {!CAMERA_SCAN_ENABLED && UNIVERSAL_PASS_CODE && (
          <p className="mt-2 rounded-lg bg-sunset-yellow/20 px-3 py-2 text-[11.5px] leading-relaxed text-ink">
            🧪 검수 모드 — 카메라 스캔이 꺼져 있습니다. 코드{' '}
            <b className="font-mono-retro">{UNIVERSAL_PASS_CODE}</b>로 지금 차례
            거점을 통과할 수 있어요.
          </p>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ''))
            setError('')
          }}
          onKeyDown={submitOnEnter(handleManualSubmit, code.length === 4)}
          autoFocus
          placeholder="0000"
          className="mt-4 w-full rounded-xl border border-line bg-cream px-4 py-3 text-center font-mono-retro text-[24px] tracking-[0.5em] text-ink outline-none focus:border-teal"
        />

        {error && (
          <p className="mt-2 text-center text-[12px] text-rec">{error}</p>
        )}

        <button
          onClick={handleManualSubmit}
          disabled={code.length !== 4}
          className={`mt-4 w-full rounded-xl py-3 font-display text-[15px] ${
            code.length === 4
              ? 'bg-teal text-cream'
              : 'cursor-not-allowed bg-line text-ink-60'
          }`}
        >
          입장하기
        </button>

        <div className="mt-3 flex justify-between">
          {CAMERA_SCAN_ENABLED ? (
            <button
              onClick={() => {
                setError('')
                setMode('scan')
              }}
              className="text-[12px] text-teal underline underline-offset-2"
            >
              ← QR 스캔으로
            </button>
          ) : (
            <span />
          )}
          <button onClick={onClose} className="text-[12px] text-ink-60 underline">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
