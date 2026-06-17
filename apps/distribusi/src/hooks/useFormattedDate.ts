'use client'
import { useEffect, useState } from 'react'

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

/**
 * Format an ISO date string for display, client-side only, to avoid
 * server/client hydration mismatches from locale/timezone differences.
 * Returns '' on the server render and first paint, then the formatted
 * value after mount.
 */
export function useFormattedDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = DEFAULT_OPTS
): string {
  const [formatted, setFormatted] = useState('')
  useEffect(() => {
    if (!iso) {
      setFormatted('')
      return
    }
    setFormatted(new Date(iso).toLocaleDateString('id-ID', opts))
  }, [iso, opts])
  return formatted
}
