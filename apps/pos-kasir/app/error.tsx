'use client'

import { ServerError } from '@suka/design-system'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string; statusCode?: number }
  reset: () => void
}) {
  useEffect(() => {
    const isChunkLoadError = error.name === 'ChunkLoadError' || error.message.includes('Failed to load chunk') || error.message.includes('Loading chunk failed')
    if (isChunkLoadError) {
      const reloadKey = 'chunk_error_reloaded'
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true')
        window.location.reload()
      } else {
        sessionStorage.removeItem(reloadKey) // reset for next time
      }
    }
  }, [error])

  return <ServerError error={error} reset={reset} />
}
