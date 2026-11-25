'use client'

import React, { useState } from 'react'
import { Card, Badge, Spinner, EmptyState } from '@suka/design-system'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { labelStatusPettyCash, sedangBerjalan } from '@/lib/pettyCash/tahap'
import { tanggalWaktu, relativeTime } from '@/lib/format'
import type { PettyCashTopup } from '@/lib/types'

export function PettyCashList({ initialRequests }: { initialRequests?: PettyCashTopup[] }) {
  // Sejak 25 Nov 2026 Area Manager tidak lagi menyetujui/menyerahkan dana: halaman ini hanya pantauan.
  const { data: allRequests, isLoading } = usePettyCashRequests(undefined, initialRequests, 'BOGOR')
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')

  const reviewRequests = allRequests?.filter(r => sedangBerjalan(r.status)) || []
  const historyRequests = allRequests?.filter(r => !sedangBerjalan(r.status)) || []
  const requests = activeTab === 'review' ? reviewRequests : historyRequests

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Spinner /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex space-x-2 border-b border-suka-gray-200">
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'review' ? 'border-suka-brown text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-gray-700'}`}
          onClick={() => setActiveTab('review')}
        >
          <span>Sedang Berjalan ({reviewRequests.length})</span>
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'history' ? 'border-suka-brown text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-gray-700'}`}
          onClick={() => setActiveTab('history')}
        >
          Riwayat ({historyRequests.length})
        </button>
      </div>

      {!requests || requests.length === 0 ? (
        <EmptyState
          title={activeTab === 'review' ? "Tidak ada pengajuan berjalan" : "Tidak ada riwayat"}
          description={activeTab === 'review' ? "Pengajuan petty cash kini langsung diproses Finance; halaman ini hanya untuk memantau." : "Belum ada riwayat petty cash."}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-suka-gray-200 bg-suka-gray-50">
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Tanggal</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Outlet</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Rekening Tujuan</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Nominal</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Alasan</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-suka-gray-100 last:border-0 hover:bg-suka-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm whitespace-nowrap" title={tanggalWaktu(req.created_at)}>
                    <div className="font-bold text-suka-brown">{relativeTime(req.created_at)}</div>
                    <div className="text-[11px] text-suka-gray-500 font-normal">{tanggalWaktu(req.created_at)}</div>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-suka-brown">{req.outlet?.name || '-'}</td>
                  <td className="py-3 px-4 text-xs text-suka-gray-600">
                    {req.bank_name ? (
                      <div>
                        <div className="font-semibold text-suka-brown">{req.bank_name} - {req.bank_account_number}</div>
                        <div className="text-suka-gray-500">a.n {req.bank_account_name || '-'}</div>
                      </div>
                    ) : (
                      <span className="text-suka-gray-400 font-mono">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-suka-brown whitespace-nowrap">
                    Rp {req.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-sm text-suka-gray-600">{req.reason || req.description}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <Badge variant={req.status === 'rejected' ? 'error' : sedangBerjalan(req.status) ? 'info' : 'success'}>
                      {labelStatusPettyCash(req.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

    </div>
  )
}
