'use client'

/**
 * 거점 실물 사진 — 정사각.
 *
 * 이 화면은 목소리로만 진행된다. 눈이 머물 곳이 자막뿐이면 '지금 어디에
 * 서 있는지'가 흐려진다. 골목에서 고개를 들어 실제 간판을 찾을 때
 * 대조할 그림이 하나 있어야 한다.
 *
 * 오래된 인화 사진처럼 흰 테두리와 아래쪽 여백을 둔다 — 카세트·쪽지와
 * 같은 결이고, 사진이 아직 없을 때의 빈 자리도 덜 허전하다.
 *
 * 사진이 없으면 거점 이름을 크게 적은 자리표를 대신 보여준다.
 * 빈 상자를 두면 '안 불러와졌나' 싶지만, 이름이 적혀 있으면 그 자체로
 * 화면이 된다. 사진은 tracks.ts의 photo 한 줄로 채운다.
 */

interface PlacePhotoProps {
  name: string
  photo?: string
  /** 트랙 번호 — 자리표에 A1 같은 표기를 남긴다 */
  track: number
}

export default function PlacePhoto({ name, photo, track }: PlacePhotoProps) {
  return (
    <figure className="mx-auto w-full max-w-[300px]">
      <div className="rounded-sm bg-paper p-2.5 pb-8 shadow-[0_6px_18px_rgba(43,36,32,0.18)]">
        <div className="relative aspect-square overflow-hidden rounded-sm bg-cream-dp">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            /* 사진이 오기 전의 자리표 — 비어 보이지 않게 이름을 크게 */
            <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
              <span className="font-mono-retro text-[10px] tracking-[0.3em] text-teal">
                SIDE A · {String(track).padStart(2, '0')}
              </span>
              <span className="mt-2 font-display text-[22px] leading-tight text-ink">
                {name}
              </span>
              <span className="mt-3 h-px w-10 bg-line" aria-hidden />
            </div>
          )}
        </div>
      </div>

      {/* 인화지 아래 여백에 적는 손글씨 — 실물 사진의 그 자리다 */}
      <figcaption className="-mt-6 text-center font-pen text-[15px] text-ink-60">
        {name}
      </figcaption>
    </figure>
  )
}
