import type { HealthStatus, SystemHealthLogRow } from '@/lib/types'
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Server, Activity, Database, Clock } from 'lucide-react'

export const STATUS_CONFIG: Record<HealthStatus, { color: string, bg: string, label: string, icon: any, dot: string }> = {
  up: { color: 'text-emerald-700', bg: 'bg-emerald-50/50 border-emerald-200', label: 'Operational', icon: CheckCircle2, dot: 'bg-emerald-500' },
  degraded: { color: 'text-amber-700', bg: 'bg-amber-50/50 border-amber-200', label: 'Degraded', icon: AlertTriangle, dot: 'bg-amber-500' },
  down: { color: 'text-red-700', bg: 'bg-red-50/50 border-red-200', label: 'Outage', icon: XCircle, dot: 'bg-red-500' },
  unconfigured: { color: 'text-slate-600', bg: 'bg-slate-50/50 border-slate-200', label: 'Unconfigured', icon: HelpCircle, dot: 'bg-slate-500' },
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return 'N/A'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin}m lalu`
  const diffHour = Math.floor(diffMin / 60)
  return `${diffHour}j lalu`
}

export function AppHealthCard({ row }: { row: SystemHealthLogRow }) {
  const config = STATUS_CONFIG[row.status] || STATUS_CONFIG.unconfigured

  return (
    <div className={`rounded-xl border ${config.bg} p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200`}>
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-900">
            <Server className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
            <h3 className="font-bold capitalize tracking-tight">{row.target_name.replace('-', ' ')}</h3>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${config.color} bg-white/60 shadow-sm border border-black/5`}>
            {row.status === 'up' ? (
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`}></span>
              </span>
            ) : (
              <span className={`h-2 w-2 rounded-full ${config.dot}`}></span>
            )}
            {config.label}
          </div>
        </div>
        
        {row.response_time_ms !== null && (
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-white/60 px-2 py-1 rounded-md border border-black/5 shadow-sm">
            <Activity className="w-3.5 h-3.5 text-gray-400" />
            {row.response_time_ms}ms
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/5">
        <div>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
            <Database className="w-3 h-3" />
            DB Status
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {row.db_status === 'ok' ? 'Connected' : row.db_status ?? '-'}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
            <Clock className="w-3 h-3" />
            Last Seen
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {formatLastActivity(row.last_activity_at)}
          </div>
        </div>
      </div>
    </div>
  )
}
