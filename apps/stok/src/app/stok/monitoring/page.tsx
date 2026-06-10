'use client'
import { useAuth } from '@/context/AuthContext'
import { MonitoringDashboard } from '@/components/stok/MonitoringDashboard'

export default function MonitoringPage() {
  const { outletStaff } = useAuth()
  if (!outletStaff) return <main className="p-4">Memuat…</main>
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Monitoring Stok</h1>
      <MonitoringDashboard outletId={outletStaff.outlet_id} />
    </main>
  )
}
