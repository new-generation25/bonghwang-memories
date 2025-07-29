'use client'

import { useState, useRef, useCallback } from 'react'

interface MissionCameraProps {
  onCapture: (imageData: string) => void
  onClose: () => void
}

export default function MissionCamera({ onCapture, onClose }: MissionCameraProps) {
  // PC Testing Mode - Camera disabled
  return (
    <div className="fixed inset-0 bg-vintage-paper z-50 flex flex-col items-center justify-center">
      <div className="max-w-md w-full text-center p-6">
        <div className="bg-vintage-cream border-2 border-sepia-400 rounded-lg shadow-2xl p-8">
          <div className="text-6xl mb-6">📸</div>
          
          <h2 className="font-vintage text-2xl text-vintage-brown mb-4">
            카메라 미션
          </h2>
          
          <p className="font-handwriting text-lg text-sepia-700 mb-6 leading-relaxed">
            PC 테스트 모드에서는 카메라 기능이 비활성화되어 있습니다.<br/>
            모바일에서 접속하시면 실제 카메라를 사용할 수 있습니다.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                // Simulate photo capture for PC testing
                const mockImageData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                onCapture(mockImageData)
              }}
              className="vintage-button w-full py-3 text-lg font-bold"
            >
              📷 모의 사진 촬영하기
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-sepia-200 text-sepia-700 rounded-lg 
                       hover:bg-sepia-300 transition-colors duration-200"
            >
              뒤로가기
            </button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-xs text-blue-700 font-handwriting">
              💡 실제 앱에서는 카메라로 사진을 촬영할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}