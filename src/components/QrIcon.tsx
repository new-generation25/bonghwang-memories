/**
 * QR 표식 — 실물 QR을 축약한 모양.
 *
 * 이모지(📷)는 카메라를 뜻해서 '사진 찍기'로 읽힐 수 있다. 이 앱에는 사진
 * 미션이 따로 있어서 그 오해가 실제로 값을 치른다. 거점에 붙은 종이 QR과
 * 같은 그림이어야 무엇을 찾아야 하는지 바로 안다.
 *
 * 플레이어 화면과 J-카드가 함께 쓰므로 파일로 갈라 두었다.
 */
export default function QrIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {/* 세 모서리의 찾기 표식 */}
      <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5z" />
      {/* 데이터 칸 몇 개 — 실물처럼 보이게 하는 최소한 */}
      <path d="M14 14h2v2h-2v-2zm4 0h3v2h-3v-2zm-4 4h2v3h-2v-3zm4 1h3v2h-3v-2z" />
    </svg>
  )
}
