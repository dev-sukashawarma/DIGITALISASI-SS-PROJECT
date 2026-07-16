'use client'
import { Spinner, EmptyState } from '@suka/design-system'
import { useSystemHealth } from '@/hooks/useSystemHealth'
import { AppHealthCard } from '@/components/AppHealthCard'
import { InfraHealthCard } from '@/components/InfraHealthCard'
import { IncidentTimeline } from '@/components/IncidentTimeline'
import { HardResetOutletCard } from '@/components/HardResetOutletCard'

const APP_ORDER = ['stok', 'absensi', 'pos-kasir', 'distribusi']
const INFRA_ORDER = ['supabase-db']

export default function SystemHealthPage() {
  const { data, isLoading } = useSystemHealth()

  if (isLoading) return <Spinner />
  const latest = data?.latest ?? []
  const transitions = data?.transitions ?? []
  if (latest.length === 0) {
    return <EmptyState title="Belum ada data health check" description="Collector belum pernah berjalan." />
  }

  const apps = APP_ORDER.map((name) => latest.find((r) => r.target_name === name)).filter((r) => r !== undefined)
  const infra = INFRA_ORDER.map((name) => latest.find((r) => r.target_name === name)).filter((r) => r !== undefined)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Kesehatan Sistem</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-500">Apps</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {apps.map((row) => <AppHealthCard key={row.target_name} row={row} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-500">Infrastructure</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {infra.map((row) => <InfraHealthCard key={row.target_name} row={row} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-500">Riwayat Insiden (24 jam terakhir)</h3>
        <IncidentTimeline events={transitions} />
      </section>

      <section className="space-y-2 pt-8">
        <h3 className="text-sm font-semibold text-gray-500">Manajemen Data</h3>
        <HardResetOutletCard />
      </section>
    </div>
  )
}
