'use client'

/**
 * 새 판이 올라왔으면 스스로 받아온다.
 *
 * 서비스워커가 갈아타기를 기다렸더니 될 때도 있고 안 될 때도 있었다.
 * 그 생명주기는 브라우저마다 다르고, 홈 화면에서 띄운 PWA는 좀처럼 죽지
 * 않아 며칠 전 판을 그대로 쓰기도 한다. "고쳤다는데 그대로다"가 그래서였다.
 *
 * 그래서 앱이 직접 견준다. 자기 번들에 박힌 버전(BUILD_VERSION)과 서버의
 * sw.js에 박힌 버전을 비교해, 다르면 새 배포가 있다는 뜻이므로 새로고침해
 * 최신 판을 받는다. 워커가 무슨 상태든 상관없다.
 *
 * 언제 보느냐 —
 *  · 앱을 열 때 한 번
 *  · 다른 앱에 갔다 돌아올 때마다
 *
 * 언제 새로고침하지 않느냐 —
 *  · 이야기가 재생 중일 때. 새로고침은 재생을 끊고 화면을 처음부터 다시
 *    그리는 일이라, 걷는 도중에 일어나면 무슨 일이 난 줄 안다
 *  · 이미 한 번 새로고침했는데 또 버전이 다를 때. 배포가 반쯤 올라간
 *    상태라면 무한히 새로고침하게 된다
 */

import { useEffect } from 'react'
import { BUILD_VERSION } from '@/lib/buildVersion'

/** 서버의 sw.js에서 지금 배포된 버전을 읽는다 */
async function serverVersion(): Promise<string | null> {
  try {
    const res = await fetch('/sw.js', { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    return text.match(/bonghwang-memories-(v[\d.]+)/)?.[1] ?? null
  } catch {
    return null
  }
}

const RELOADED_KEY = 'bh_version_reloaded'

export default function VersionGate() {
  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (cancelled) return
      // 이야기가 흐르는 중에는 건드리지 않는다
      if ((window as unknown as Record<string, unknown>).__bhPlaying) return

      const latest = await serverVersion()
      if (cancelled || !latest || latest === BUILD_VERSION) return

      /*
        한 번만 시도한다. 새로고침했는데도 여전히 다르면 배포가 아직
        덜 올라갔거나 캐시가 엉킨 것이고, 계속 새로고침하면 앱을 아예
        못 쓴다. 다음에 열 때 다시 본다.
      */
      try {
        if (sessionStorage.getItem(RELOADED_KEY) === latest) return
        sessionStorage.setItem(RELOADED_KEY, latest)
        // 갈아탄 뒤 한 줄 알리려고 표식을 남긴다(PointToast가 읽는다)
        sessionStorage.setItem('bh_updated', '1')
      } catch {
        return
      }

      /*
        캐시된 옛 화면이 다시 뜨지 않도록 서비스워커를 먼저 재운다.
        워커가 옛 HTML·청크를 쥐고 있으면 새로고침해도 같은 판이 온다.
      */
      try {
        const reg = await navigator.serviceWorker?.getRegistration()
        if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      } catch {
        /* 워커가 없어도 새로고침은 한다 */
      }

      window.location.reload()
    }

    void check()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
