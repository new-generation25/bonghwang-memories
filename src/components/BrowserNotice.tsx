'use client'

/**
 * 어디서 열렸는지 보고 한 번만 말해준다.
 *
 * 두 가지를 맡는다:
 *
 *  1. **앱 안의 브라우저에서 열렸을 때** — 카톡으로 QR을 받아 찍으면 여기로
 *     떨어진다. 그 안에서는 홈 화면에 못 넣고, 서비스워커가 안 붙어 오프라인
 *     재생이 안 되며, 창을 닫으면 기록이 사라지는 기기가 있다. 골목 한복판에서
 *     그러면 걸어온 만큼이 통째로 없어진다. 그래서 이건 세게 말한다.
 *  2. **홈 화면에 추가** — 야외에서 브라우저 주소창을 오가는 것보다 아이콘
 *     하나가 낫고, 넣어두면 오프라인에서도 열린다.
 *
 * **막지는 않는다.** 안내를 닫고 그대로 걸을 수 있어야 한다 — 카톡 브라우저를
 * 벗어날 방법이 기기마다 다르고, 못 벗어나는 사람을 문 앞에 세워두면 그 사람은
 * 그냥 돌아간다. 대신 무엇을 잃을 수 있는지는 분명히 적는다.
 *
 * 한 번 닫으면 다시 뜨지 않는다(기기에 기억). 걷는 도중에 같은 안내가
 * 또 끼어들면 그게 더 방해다.
 */

import { useEffect, useState } from 'react'
import {
  IN_APP_NAMES,
  InApp,
  androidIntentUrl,
  inAppBrowser,
  isAndroid,
  isIOS,
  isStandalone,
} from '@/lib/platform'

/** 닫았다는 기억 — 갈래마다 따로 둔다 */
const SEEN_INAPP = 'bh_notice_inapp'
const SEEN_INSTALL = 'bh_notice_install'

/** 크롬 계열이 설치를 제안할 때 주는 이벤트 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

export default function BrowserNotice() {
  const [app, setApp] = useState<InApp>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return

    const which = inAppBrowser()
    if (which && localStorage.getItem(SEEN_INAPP) !== '1') {
      setApp(which)
      return // 두 안내를 겹쳐 띄우지 않는다
    }

    /*
      아이폰에는 설치 이벤트가 없다. 사파리에서 열렸고 아직 안 넣었으면
      방법을 글로 알려주는 수밖에 없다.
    */
    if (!which && isIOS() && localStorage.getItem(SEEN_INSTALL) !== '1') {
      setShowInstall(true)
    }
  }, [])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // 브라우저가 제 자리에 띄우게 두지 않고 우리가 부른다
      if (localStorage.getItem(SEEN_INSTALL) === '1') return
      setInstallEvent(e as InstallEvent)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const closeInApp = () => {
    localStorage.setItem(SEEN_INAPP, '1')
    setApp(null)
  }
  const closeInstall = () => {
    localStorage.setItem(SEEN_INSTALL, '1')
    setShowInstall(false)
    setInstallEvent(null)
  }

  if (app) {
    const name = IN_APP_NAMES[app]
    return (
      <Sheet>
        <p className="font-mono-retro text-[10px] tracking-[0.2em] text-rec">NOTICE</p>
        <h2 className="mt-1 text-[15px] font-bold text-ink">
          {name} 안에서 열렸어요
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          여기서는 <b className="text-ink">걸어온 기록이 사라질 수 있고</b>, 소리를
          미리 받아두지 못해 신호가 약한 골목에서 끊깁니다.
          <br />
          브라우저로 옮겨서 들어주세요.
        </p>

        {isAndroid() ? (
          <a
            href={androidIntentUrl(window.location.href)}
            className="btn-teal mt-3 block w-full text-center text-[13px]"
          >
            크롬으로 열기
          </a>
        ) : (
          <div className="mt-3 rounded-xl bg-cream-dp px-3 py-2.5 text-[12px] leading-relaxed text-ink">
            {isIOS() ? (
              <>
                오른쪽 아래 <b>⋯</b> 또는 <b>공유</b> 버튼을 누르고
                <br />
                <b>「Safari로 열기」</b>를 골라주세요.
              </>
            ) : (
              <>주소를 복사해 브라우저에 붙여넣어 주세요.</>
            )}
          </div>
        )}

        <button
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href)
          }}
          className="mt-2 w-full rounded-xl border border-line py-2 text-[12px] text-ink-60"
        >
          주소 복사하기
        </button>
        <button
          onClick={closeInApp}
          className="mt-2 w-full text-center font-mono-retro text-[10.5px] text-ink-60 underline"
        >
          그냥 여기서 볼게요
        </button>
      </Sheet>
    )
  }

  if (!showInstall) return null

  return (
    <Sheet>
      <p className="font-mono-retro text-[10px] tracking-[0.2em] text-teal">HOME</p>
      <h2 className="mt-1 text-[15px] font-bold text-ink">홈 화면에 넣어두세요</h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
        아이콘으로 바로 열리고, 소리를 미리 받아둬서
        <br />
        신호가 약한 골목에서도 끊기지 않아요.
      </p>

      {installEvent ? (
        <button
          onClick={async () => {
            await installEvent.prompt()
            closeInstall()
          }}
          className="btn-teal mt-3 w-full text-center text-[13px]"
        >
          홈 화면에 추가
        </button>
      ) : (
        <div className="mt-3 rounded-xl bg-cream-dp px-3 py-2.5 text-[12px] leading-relaxed text-ink">
          아래 <b>공유</b> 버튼(￪)을 누르고
          <br />
          <b>「홈 화면에 추가」</b>를 골라주세요.
        </div>
      )}

      <button
        onClick={closeInstall}
        className="mt-2 w-full text-center font-mono-retro text-[10.5px] text-ink-60 underline"
      >
        나중에 할게요
      </button>
    </Sheet>
  )
}

/** 아래에서 올라오는 알림 판 — 화면을 다 덮지 않는다 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-3">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-paper p-4 shadow-lg">
        {children}
      </div>
    </div>
  )
}
