import TrackPageClient from './TrackPageClient'

/** S20 — 거점 미션 공통 템플릿 (Track 1~5 재사용) */

export function generateStaticParams() {
  return [1, 2, 3, 4, 5].map((n) => ({ n: String(n) }))
}

export default function TrackPage({ params }: { params: { n: string } }) {
  return <TrackPageClient n={parseInt(params.n, 10)} />
}
