import { EmptyState } from '@suka/design-system'
import type { HealthTransition } from '@/lib/healthStatus'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function IncidentTimeline({ events }: { events: HealthTransition[] }) {
  if (events.length === 0) {
    return <EmptyState title="Tidak ada insiden dalam 24 jam terakhir" />
  }

  return (
    <ul className="divide-y divide-suka-gray-200">
      {events.map((e, i) => (
        <li key={`${e.target_name}-${e.checked_at}-${i}`} className="flex items-center gap-3 py-2 text-sm">
          <span className="font-mono text-gray-400">{formatTime(e.checked_at)}</span>
          <span className="font-medium text-suka-ink">{e.target_name}</span>
          <span className="text-gray-500">{e.from} &rarr; {e.to}</span>
        </li>
      ))}
    </ul>
  )
}
