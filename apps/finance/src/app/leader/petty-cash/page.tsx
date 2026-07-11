import React from 'react'
import { PettyCashList } from './components/PettyCashList'

export default function PettyCashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Approval Petty Cash</h1>
        <p className="text-suka-gray-500 mt-1">Daftar pengajuan Top Up Petty Cash dari Kasir dan Crew.</p>
      </div>

      <PettyCashList />
    </div>
  )
}
