'use client'

/**
 * 구(舊) 스토리 페이지 — EP.1 개편으로 /intro가 역할을 이어받았다.
 * 북마크·공유 링크 호환을 위해 리다이렉트만 남긴다.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StoryRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/intro')
  }, [router])

  return null
}
