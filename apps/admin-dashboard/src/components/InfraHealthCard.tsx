import { Card } from '@suka/design-system'
import { STATUS_STYLES, STATUS_LABELS } from './AppHealthCard'
import type { SystemHealthLogRow } from '@/lib/types'

export function InfraHealthCard({ row }: { row: SystemHealthLogRow }) {
  return (
    <Card className="space-y-2">
      <div className="font-semibold text-suka-ink">
        {row.target_name === 'supabase-db' ? 'Supabase' : 'cPanel Server'}
      </div>
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
        {STATUS_LABELS[row.status]}
      </span>
      {row.response_time_ms !== null && (
        <div className="text-xs text-gray-400">{row.response_time_ms}ms</div>
      )}
    </Card>
  )
}
