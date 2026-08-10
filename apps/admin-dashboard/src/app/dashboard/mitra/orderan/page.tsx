'use client'

import { useMitraOutlet } from '../MitraOutletContext'
import ReportsView from '../../reports/pos/ReportsView'
import { PageHeader } from '@/components/ui'
import type { Outlet } from '@/pos-types'

export default function OrderanPage() {
  const { selectedOutletId, selectedOutlet } = useMitraOutlet()

  if (!selectedOutletId || !selectedOutlet) {
    return (
      <div className="p-8 text-center text-gray-500">
        Silakan pilih outlet terlebih dahulu dari halaman Dashboard.
      </div>
    )
  }

  // Cast selectedOutlet to Outlet since useMitraOutlet might return a slightly different shape
  // but it's compatible enough for ReportsView initialOutlets
  const outletAsArray = [selectedOutlet as unknown as Outlet]

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader 
          title="Riwayat Orderan" 
          description={`Analitik performa dan histori transaksi untuk outlet ${selectedOutlet.name}`}
        />
        <div className="mt-6">
          <ReportsView initialOutlets={outletAsArray} />
        </div>
      </div>
    </div>
  )
}
