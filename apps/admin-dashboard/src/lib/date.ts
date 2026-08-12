export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return 'Baru saja'

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 45) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} mnt lalu`
  if (diffHour < 24) return `${diffHour} jam lalu`
  if (diffDay < 7) return `${diffDay} hr lalu`

  return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
