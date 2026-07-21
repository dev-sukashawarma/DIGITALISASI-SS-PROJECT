import React from 'react'
import { Card } from '@suka/design-system'

export default function Area ManagerDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Overview Area Manager</h1>
        <p className="text-suka-gray-500 mt-1">Ringkasan aktivitas persetujuan Petty Cash luar Bogor.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-suka-gray-500">Menunggu Approval Petty Cash</h3>
          <p className="text-3xl font-bold text-suka-brown mt-2">Cek Tab Petty Cash</p>
          <div className="mt-4">
            <span className="text-xs text-suka-orange font-medium bg-orange-50 px-2 py-1 rounded-full">
              Butuh Review Area Manager
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-suka-gray-500">Total Cabang</h3>
          <p className="text-3xl font-bold text-suka-brown mt-2">Semua Cabang (Luar Bogor)</p>
          <p className="text-xs text-suka-gray-500 mt-2">Otomatis Terhubung</p>
        </Card>
      </div>
    </div>
  )
}
