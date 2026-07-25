'use client'

/**
 * 찍은 사진을 기기에 남긴다.
 *
 * 웹은 사진첩에 직접 쓸 수 없다. 카메라 권한은 '영상을 읽을' 권한이고,
 * 사진첩에 '쓰는' 권한은 브라우저가 웹사이트에 내주지 않는다. 그래서
 * 지금까지 미션 사진은 IndexedDB에만 남았고, 사파리 데이터를 지우면
 * 여행 사진이 통째로 사라졌다 — 카톡으로 보낼 방법도 없었다.
 *
 * 할 수 있는 건 공유 시트를 여는 것까지다(navigator.share). 아이폰에서
 * 사진 볼 때 뜨는 그 창이고, 거기서 '이미지 저장'을 누르면 사진첩에
 * 들어간다. 카톡·인스타로 바로 보내는 것도 같은 자리에서 된다.
 * 자동 저장은 못 한다 — 사용자가 시트에서 한 번 더 눌러야 한다.
 *
 * 공유 시트가 없는 곳(데스크톱 브라우저 등)에서는 내려받기로 떨어진다.
 */

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/** dataURL → File. 공유 시트는 File만 받는다 */
function toFile(dataUrl: string, name: string): File | null {
  try {
    const [head, body] = dataUrl.split(',')
    const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
    const bin = atob(body)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new File([arr], name, { type: mime })
  } catch {
    return null
  }
}

/**
 * 사진 한 장을 기기에 남긴다.
 *
 * track은 파일 이름에만 쓴다 — 사진첩에서 봤을 때 어느 거점이었는지
 * 알아볼 수 있도록.
 */
export async function savePhotoToDevice(
  dataUrl: string,
  track: number
): Promise<SaveResult> {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const name = `봉황메모리즈-A${track}-${stamp}.jpg`
  const file = toFile(dataUrl, name)
  if (!file) return 'failed'

  /*
    canShare로 먼저 물어본다. 파일 공유를 지원하지 않는 브라우저에서
    share()를 그냥 부르면 예외가 나는데, 그걸 실패로 보고하면 사용자는
    되지도 않을 버튼을 계속 누르게 된다.
  */
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return 'shared'
    } catch (err) {
      // 사용자가 시트를 닫은 것은 실패가 아니다 — 아무 말도 하지 않는다
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
      return 'failed'
    }
  }

  // 공유 시트가 없는 곳 — 내려받기. 데스크톱에서는 이게 자연스럽다
  try {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
