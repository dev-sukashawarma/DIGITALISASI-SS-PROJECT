/**
 * Helper utilities for formatting timestamps, particularly last update/sync labels.
 */

/**
 * Formats an ISO date string into a user-friendly Indonesian relative or absolute time.
 * Examples:
 * - "Baru saja" (less than 1 minute ago)
 * - "5 menit lalu"
 * - "Hari ini, 14:20 WIB"
 * - "Kemarin, 09:15 WIB"
 * - "18 Sep 2026, 11:30 WIB"
 */
export function formatLastUpdate(isoString: string | null | undefined): string {
  if (!isoString) return 'Belum pernah disinkron'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return 'Belum pernah disinkron'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  // Handle tiny clock skew between server and client
  if (diffMs < 0 && diffMs > -60000) {
    return 'Baru saja'
  }

  const diffSec = Math.max(0, Math.floor(diffMs / 1000))
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) {
    return 'Baru saja'
  }
  if (diffMin < 60) {
    return `${diffMin} menit lalu`
  }

  const timeStr = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Same calendar day
  if (date.toDateString() === now.toDateString()) {
    return `Hari ini, ${timeStr} WIB`
  }

  // Yesterday
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `Kemarin, ${timeStr} WIB`
  }

  // Older dates
  const dateStr = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return `${dateStr}, ${timeStr} WIB`
}

/**
 * Returns formatted full date time for accessible tooltips.
 */
export function formatFullDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Belum pernah disinkronkan'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return 'Belum pernah disinkronkan'

  return date.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' WIB'
}
