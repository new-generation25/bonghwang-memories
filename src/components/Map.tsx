'use client'

import { useEffect, useState } from 'react'
import { Mission } from '@/lib/types'
import { mainMissions } from '@/lib/missions'

interface MapProps {
  onMissionSelect: (mission: Mission) => void
  completedMissions: string[]
  userLocation?: { lat: number; lng: number }
}

export default function Map({ onMissionSelect, completedMissions, userLocation }: MapProps) {
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null)

  // Mock map implementation (replace with actual map library)
  useEffect(() => {
    if (!mapContainer) return

    // Clear previous content
    mapContainer.innerHTML = ''

    // Create map background
    const mapBg = document.createElement('div')
    mapBg.className = 'relative w-full h-full bg-sepia-200 rounded-lg overflow-hidden'
    mapBg.style.backgroundImage = `
      radial-gradient(circle at 20% 30%, rgba(212, 184, 150, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(193, 154, 107, 0.3) 0%, transparent 50%),
      linear-gradient(45deg, rgba(244, 241, 232, 0.8) 0%, rgba(232, 213, 183, 0.8) 100%)
    `

    // Add vintage paper texture overlay
    const overlay = document.createElement('div')
    overlay.className = 'absolute inset-0 opacity-20'
    overlay.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-opacity='0.1'%3E%3Cpolygon fill='%23000' points='50 0 60 40 100 50 60 60 50 100 40 60 0 50 40 40'/%3E%3C/g%3E%3C/svg%3E")`

    mapBg.appendChild(overlay)

    // Add mission markers
    mainMissions.forEach((mission, index) => {
      const marker = document.createElement('button')
      marker.className = `absolute w-12 h-12 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-110 z-10`
      
      const isCompleted = completedMissions.includes(mission.missionId)
      
      // Position markers (mock positions for demo)
      const positions = [
        { top: '20%', left: '30%' },
        { top: '40%', left: '60%' },
        { top: '60%', left: '25%' },
        { top: '35%', left: '75%' },
        { top: '70%', left: '50%' }
      ]
      
      marker.style.top = positions[index]?.top || '50%'
      marker.style.left = positions[index]?.left || '50%'
      
      marker.innerHTML = `
        <div class="compass-icon relative">
          <div class="w-12 h-12 rounded-full ${isCompleted ? 'bg-vintage-gold' : 'bg-vintage-brown'} 
                      shadow-lg border-2 border-white flex items-center justify-center">
            <div class="w-6 h-6 ${isCompleted ? 'text-white' : 'text-vintage-cream'} 
                        flex items-center justify-center font-bold text-sm">
              ${isCompleted ? '✓' : index + 1}
            </div>
          </div>
          ${!isCompleted ? `
            <div class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
          ` : ''}
        </div>
      `
      
      marker.onclick = () => onMissionSelect(mission)
      
      mapBg.appendChild(marker)
    })

    // Add user location marker if available (disabled for PC testing)
    // TODO: Re-enable for mobile testing
    // if (userLocation) {
    //   const userMarker = document.createElement('div')
    //   userMarker.className = 'absolute w-4 h-4 transform -translate-x-1/2 -translate-y-1/2 z-20'
    //   userMarker.style.top = '50%' // Mock position
    //   userMarker.style.left = '45%' // Mock position
      
    //   userMarker.innerHTML = `
    //     <div class="relative">
    //       <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
    //       <div class="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping opacity-75"></div>
    //     </div>
    //   `
      
    //   mapBg.appendChild(userMarker)
    // }

    mapContainer.appendChild(mapBg)
  }, [mapContainer, completedMissions, userLocation, onMissionSelect])

  return (
    <div className="w-full h-full min-h-[400px] relative">
      <div 
        ref={setMapContainer}
        className="w-full h-full rounded-lg shadow-inner"
      />
      
      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-vintage-brown rounded-full"></div>
            <span className="text-sepia-700">미완료</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-vintage-gold rounded-full"></div>
            <span className="text-sepia-700">완료</span>
          </div>
          {/* Disabled for PC testing */}
          {/* <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sepia-700">현재 위치</span>
          </div> */}
        </div>
      </div>
    </div>
  )
}