'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@suka/design-system'

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <Badge
      variant={isOnline ? 'success' : 'error'}
      className="fixed bottom-4 right-4 text-xs"
    >
      {isOnline ? '✓ Online' : '⚠ Offline'}
    </Badge>
  )
}
