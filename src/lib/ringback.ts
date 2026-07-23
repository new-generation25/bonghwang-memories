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

  const master = ctx.createGain()
  master.gain.value = 0 // 스케줄이 켜기 전까지는 무음
  master.connect(ctx.destination)

  const oscillators = RING_HZ.map((hz) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz
    osc.connect(master)
    return osc
  })

  let stopped = false

  /**
   * 스케줄은 컨텍스트가 실제로 돌기 시작한 뒤에 건다.
   *
   * 예전에는 resume()을 기다리지 않고 곧바로 ctx.currentTime 기준으로 예약했다.
   * 자동재생 정책 때문에 컨텍스트가 suspended로 생성되면 그 시점의 currentTime은
   * 0에서 멈춰 있고, 예약해둔 게인 변화가 재생 시작과 어긋나 소리가 나지 않았다.
   */
  const schedule = () => {
    if (stopped) return
    const gate = master.gain
    // 지금 이 순간을 기준으로 잡되, 첫 울림이 잘리지 않게 살짝 뒤에서 시작한다
    const start = ctx.currentTime + 0.05
    const CYCLES = 12 // 넉넉히 예약해두고 stop()에서 끊는다

    gate.cancelScheduledValues(0)
    gate.setValueAtTime(0, ctx.currentTime)
    for (let i = 0; i < CYCLES; i++) {
      const t = start + i * CYCLE_SEC
      gate.setValueAtTime(0.13, t) // 놀라지 않을 정도로 낮게
      gate.setValueAtTime(0.13, t + ON_SEC - 0.05)
      gate.linearRampToValueAtTime(0, t + ON_SEC)
    }
    oscillators.forEach((o) => {
      try {
        o.start(start)
      } catch {
        /* 이미 시작된 경우 */
      }
    })
  }

  if (ctx.state === 'suspended') {
    ctx.resume().then(schedule).catch(schedule)
  } else {
    schedule()
  }

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      try {
        master.gain.cancelScheduledValues(0)
        master.gain.setValueAtTime(0, ctx.currentTime)
        oscillators.forEach((o) => o.stop())
      } catch {
        /* 아직 시작 전이거나 이미 멈춘 경우 */
      }
      void ctx.close().catch(() => {})
    },
  }
}
