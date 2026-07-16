'use client'
import { Spinner, EmptyState } from '@suka/design-system'
import { useSystemHealth } from '@/hooks/useSystemHealth'
import { AppHealthCard } from '@/components/AppHealthCard'
import { InfraHealthCard } from '@/components/InfraHealthCard'
import { IncidentTimeline } from '@/components/IncidentTimeline'
import { HardResetOutletCard } from '@/components/HardResetOutletCard'
import { ShieldCheck, Activity, Server, History, DatabaseBackup } from 'lucide-react'

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
    <div className="space-y-8 max-w-6xl pb-10">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
        <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 shadow-sm">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Kesehatan Sistem</h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">Pantau status aplikasi dan infrastruktur secara real-time</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
          <Activity className="w-5 h-5 text-gray-400" />
          <h3 className="font-bold tracking-tight">Layanan Aplikasi</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {apps.map((row) => <AppHealthCard key={row.target_name} row={row} />)}
        </div>
      </section>

      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
          <Server className="w-5 h-5 text-gray-400" />
          <h3 className="font-bold tracking-tight">Infrastruktur</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {infra.map((row) => <InfraHealthCard key={row.target_name} row={row} />)}
        </div>
      </section>

      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
          <History className="w-5 h-5 text-gray-400" />
          <h3 className="font-bold tracking-tight">Riwayat Insiden (24 jam terakhir)</h3>
        </div>
        <IncidentTimeline events={transitions} />
      </section>

      <section className="space-y-4 pt-8">
        <div className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
          <DatabaseBackup className="w-5 h-5 text-gray-400" />
          <h3 className="font-bold tracking-tight">Manajemen Data</h3>
        </div>
        <HardResetOutletCard />
      </section>
    </div>
  )
}
