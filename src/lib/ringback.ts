'use client'

/**
 * 발신음(통화 연결음) 합성.
 *
 * 오디오 파일을 따로 두지 않는 이유: 인트로에서만 몇 초 쓰이는 소리인데
 * 파일을 추가하면 D8(전 큐 선다운로드)의 캐시 대상이 하나 늘고 sw.js 버전도
 * 함께 관리해야 한다. Web Audio로 만들면 오프라인에서도 항상 난다.
 *
 * 국내 통화 연결음 규격에 맞춰 440Hz + 480Hz를 겹치고
 * 1초 울리고 2초 쉬는 주기를 반복한다.
 */

const RING_HZ = [440, 480]
const ON_SEC = 1
const CYCLE_SEC = 3

export interface Ringback {
  stop: () => void
}

/**
 * 발신음 시작. 반환된 stop()으로 멈춘다.
 * 사용자 제스처 없이 호출되면 브라우저가 막을 수 있는데, 그때는 조용히 넘어간다
 * (소리는 연출이고 진행을 막는 요소가 아니다).
 */
export function startRingback(): Ringback {
  if (typeof window === 'undefined') return { stop: () => {} }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return { stop: () => {} }

  let ctx: AudioContext
  try {
    ctx = new Ctor()
  } catch {
    return { stop: () => {} }
  }

  void ctx.resume().catch(() => {})

  const master = ctx.createGain()
  master.gain.value = 0.13 // 놀라지 않을 정도로 낮게
  master.connect(ctx.destination)

  const oscillators = RING_HZ.map((hz) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz
    osc.connect(master)
    return osc
  })

  // 1초 울리고 2초 쉬는 주기를 게인으로 만든다
  const gate = master.gain
  const start = ctx.currentTime
  const CYCLES = 12 // 넉넉히 예약해두고 stop()에서 끊는다
  gate.setValueAtTime(0, start)
  for (let i = 0; i < CYCLES; i++) {
    const t = start + i * CYCLE_SEC
    gate.setValueAtTime(0.13, t)
    gate.setValueAtTime(0.13, t + ON_SEC - 0.05)
    gate.linearRampToValueAtTime(0, t + ON_SEC)
  }

  oscillators.forEach((o) => o.start(start))

  let stopped = false
  return {
    stop: () => {
      if (stopped) return
      stopped = true
      try {
        oscillators.forEach((o) => o.stop())
      } catch {
        /* 이미 멈춘 경우 */
      }
      void ctx.close().catch(() => {})
    },
  }
}
