import { Card } from '@suka/design-system'
import type { HealthStatus, SystemHealthLogRow } from '@/lib/types'

export const STATUS_STYLES: Record<HealthStatus, string> = {
  up: 'bg-[#e1f5ee] text-[#085041]',
  degraded: 'bg-[#faeeda] text-[#854f0b]',
  down: 'bg-[#fcebeb] text-[#a32d2d]',
  unconfigured: 'bg-[#f1efe8] text-[#5f5e5a]',
}

export const STATUS_LABELS: Record<HealthStatus, string> = {
  up: 'up',
  degraded: 'degraded',
  down: 'down',
  unconfigured: 'belum dikonfigurasi',
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return 'n/a'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'baru saja'
  if (diffMin < 60) return `${diffMin}m lalu`
  const diffHour = Math.floor(diffMin / 60)
  return `${diffHour}h lalu`
}

export function AppHealthCard({ row }: { row: SystemHealthLogRow }) {
  return (
    <Card className="space-y-2">
      <div className="font-semibold text-suka-ink">{row.target_name}</div>
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
        {STATUS_LABELS[row.status]}
      </span>
      <div className="text-sm text-gray-500">db: {row.db_status ?? '-'}</div>
      <div className="text-sm text-gray-500">last: {formatLastActivity(row.last_activity_at)}</div>
      {row.response_time_ms !== null && (
        <div className="text-xs text-gray-400">{row.response_time_ms}ms</div>
      )}
    </Card>
  )
}
