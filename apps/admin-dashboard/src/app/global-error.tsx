'use client'

import { ServerError } from '@suka/design-system'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string; statusCode?: number }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ margin: 0, padding: 0 }}>
        <ServerError error={error} reset={reset} />
      </body>
    </html>
  )
}
