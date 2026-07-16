import type { SystemHealthLogRow } from '@/lib/types'
import { STATUS_CONFIG } from './AppHealthCard'
import { Activity, HardDrive } from 'lucide-react'

export function InfraHealthCard({ row }: { row: SystemHealthLogRow }) {
  const config = STATUS_CONFIG[row.status] || STATUS_CONFIG.unconfigured
  const name = row.target_name === 'supabase-db' ? 'Supabase Database' : 'cPanel Server'

  return (
    <div className={`rounded-xl border ${config.bg} p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-900">
            <HardDrive className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
            <h3 className="font-bold capitalize tracking-tight">{name}</h3>
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
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-white/60 px-2 py-1 rounded-md border border-black/5 shadow-sm">
              <Activity className="w-3.5 h-3.5 text-gray-400" />
              {row.response_time_ms}ms
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
