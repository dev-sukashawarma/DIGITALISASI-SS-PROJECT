import type { HealthTransition } from '@/lib/healthStatus'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function getStatusIcon(status: string) {
  if (status === 'up') return <CheckCircle2 className="w-4 h-4 text-emerald-500 bg-white" />
  if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-amber-500 bg-white" />
  return <XCircle className="w-4 h-4 text-red-500 bg-white" />
}

export function IncidentTimeline({ events }: { events: HealthTransition[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-gray-900">Sistem Berjalan Lancar</h4>
        <p className="text-sm text-gray-500 mt-1">Tidak ada insiden dalam 24 jam terakhir.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 pb-2">
        {events.map((e, i) => (
          <div key={`${e.target_name}-${e.checked_at}-${i}`} className="relative pl-6">
            <div className="absolute -left-[9px] top-1">
              {getStatusIcon(e.to)}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
              <div>
                <span className="font-bold text-gray-900 capitalize tracking-tight">{e.target_name.replace('-', ' ')}</span>
                <span className="text-sm text-gray-500 ml-2">
                  mengalami perubahan status dari <span className="font-medium text-gray-700">{e.from}</span> ke <span className="font-medium text-gray-700">{e.to}</span>
                </span>
              </div>
              <time className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md w-fit">
                {formatTime(e.checked_at)}
              </time>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
