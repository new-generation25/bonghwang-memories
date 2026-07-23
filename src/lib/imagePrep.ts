'use client'

/**
 * 올리기 전에 사진을 다듬는다 — 줄이고, JPEG으로 다시 굽는다.
 *
 * 원본을 그대로 올리던 것이 문제였다. 요즘 휴대폰 사진은 한 장에 3~8MB라
 * 5MB 상한(community.ts·storage.rules)에 예사로 걸린다. 골목에서 찍은
 * 사진을 올리려다 "용량이 크다"는 말만 듣고 포기하게 된다. 화면에는
 * 최대 224px 높이로 들어가는 사진이라 원본 해상도가 아무 값도 하지 않는다.
 *
 * 아이폰 사진이 HEIC인 것도 같이 풀린다. canvas를 거치면 무엇으로 들어왔든
 * JPEG으로 나온다 — 사파리는 HEIC을 디코딩할 수 있기 때문이다. 반대로
 * 안드로이드·데스크톱 크롬은 HEIC을 못 읽는데, 그때는 아래에서 원본을
 * 그대로 돌려주고 검증이 형식 오류로 잡는다(엉뚱한 말로 실패하지 않는다).
 *
 * EXIF 회전은 createImageBitmap의 imageOrientation이 처리한다. 이것을
 * 빼먹으면 세로로 찍은 사진이 눕는다 — canvas는 EXIF를 보지 않는다.
 */

/** 긴 변 기준 상한. 목록 썸네일과 확대 보기 모두 이 안에서 충분하다 */
const MAX_EDGE = 1600

/** JPEG 품질 — 0.85면 눈에 띄는 열화 없이 원본의 1/10 근처로 떨어진다 */
const QUALITY = 0.85

/**
 * 이 크기 아래면 손대지 않는다.
 *
 * 이미 작은 사진을 다시 구우면 화질만 한 번 더 깎인다. 웹에서 받은
 * 그림처럼 원본이 작고 깨끗한 경우가 그렇다.
 */
const SKIP_UNDER_BYTES = 600 * 1024

export interface PreparedImage {
  file: File
  /** 줄였으면 true — 안내 문구에 쓴다 */
  resized: boolean
  originalBytes: number
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const originalBytes = file.size

  if (file.size <= SKIP_UNDER_BYTES) {
    return { file, resized: false, originalBytes }
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 열지 못했습니다')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    )
    if (!blob) throw new Error('JPEG 인코딩에 실패했습니다')

    // 줄인 것이 더 크면(작고 이미 잘 압축된 원본) 원본을 쓴다
    if (blob.size >= file.size) {
      return { file, resized: false, originalBytes }
    }

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return {
      file: new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }),
      resized: true,
      originalBytes,
    }
  } catch {
    /*
      디코딩 실패(대개 HEIC을 못 읽는 브라우저)나 메모리 부족. 원본을
      그대로 돌려주고 판단은 검증에 맡긴다 — 여기서 자체 오류를 던지면
      "형식이 맞지 않는다"는 정확한 말 대신 알 수 없는 실패가 된다.
    */
    return { file, resized: false, originalBytes }
  }
}

/** 사람이 읽는 용량 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.round(bytes / 1024)}KB`
}
