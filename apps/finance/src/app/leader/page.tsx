import React from 'react'
import { Card } from '@suka/design-system'

export default function LeaderDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Overview Leader</h1>
        <p className="text-suka-gray-500 mt-1">Ringkasan aktivitas dan metrik shift hari ini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-suka-gray-500">Request Top Up Pending</h3>
          <p className="text-3xl font-bold text-suka-brown mt-2">3</p>
          <div className="mt-4">
            <span className="text-xs text-suka-orange font-medium bg-orange-50 px-2 py-1 rounded-full">
              Menunggu Approval
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-suka-gray-500">Total Pengeluaran Hari Ini</h3>
          <p className="text-3xl font-bold text-suka-brown mt-2">Rp 150.000</p>
          <p className="text-xs text-suka-gray-500 mt-2">Berdasarkan request yang disetujui</p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-suka-gray-500">Sisa Saldo Petty Cash (Estimasi)</h3>
          <p className="text-3xl font-bold text-suka-brown mt-2">Rp 850.000</p>
          <p className="text-xs text-suka-gray-500 mt-2">Plafon: Rp 1.000.000</p>
        </Card>
      </div>
    </div>
  )
}
