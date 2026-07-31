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
  return <ServerError error={error} reset={reset} />
}
