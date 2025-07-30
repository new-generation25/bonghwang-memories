import { mainMissions, subMissions } from '@/lib/missions'
import MissionPageClient from './MissionPageClient'

// Static params for all possible mission IDs
export async function generateStaticParams() {
  const allMissions = [...mainMissions, ...subMissions]
  
  return allMissions.map((mission) => ({
    missionId: mission.missionId,
  }))
}

export default function MissionPage({ params }: { params: { missionId: string } }) {
  return <MissionPageClient missionId={params.missionId} />
}