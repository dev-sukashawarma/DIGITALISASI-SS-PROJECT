import React from 'react'
import { FinancePettyCashList } from './components/FinancePettyCashList'

export default function FinancePettyCashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Pencairan Petty Cash</h1>
        <p className="text-suka-gray-500 mt-1">Daftar pengajuan petty cash yang sudah disetujui Leader dan siap dicairkan.</p>
      </div>

      <FinancePettyCashList />
    </div>
  )
}
