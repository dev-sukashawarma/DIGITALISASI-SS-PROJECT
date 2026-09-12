'use client'

import { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Edit2 } from 'lucide-react'
import type { StaffContract } from '@/lib/types'
import { ContractEditModal } from './ContractEditModal'

export function ContractTable({
  rows,
  onSaveContract,
}: {
  rows: StaffContract[]
  onSaveContract: (values: {
    staff_id: string
    contract_type: string
    join_date: string
    resign_date: string | null
  }) => void
}) {
  const [editingItem, setEditingItem] = useState<StaffContract | null>(null)

  const calcDaysLeft = (endStr: string | null) => {
    if (!endStr) return null
    const end = new Date(endStr)
    const now = new Date()
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const fmtDate = (dStr: string | null) => {
    if (!dStr) return 'Tetap (PKWTT)'
    try {
      const d = new Date(dStr)
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return dStr
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nama Staf</th>
                <th className="px-4 py-3.5">Outlet &amp; Jabatan</th>
                <th className="px-4 py-3.5">Jenis Kontrak</th>
                <th className="px-4 py-3.5">Mulai Kerja</th>
                <th className="px-4 py-3.5">Habis Kontrak</th>
                <th className="px-4 py-3.5">Sisa Hari</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {rows.map((r) => {
                const daysLeft = calcDaysLeft(r.end_date)
                return (
                  <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-suka-ink text-sm">
                      {r.outlet_staff?.name || 'Staff'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold text-suka-ink">
                        {r.outlet_staff?.outlets?.name || 'Pusat'}
                      </div>
                      <div className="text-[11px] text-suka-brown font-semibold uppercase">
                        {r.outlet_staff?.role?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-gray-700">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-stone-100 border border-stone-200">
                        {r.contract_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">
                      {fmtDate(r.start_date)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-gray-800">
                      {fmtDate(r.end_date)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {daysLeft === null ? (
                        <span className="text-gray-400 font-semibold">&infin;</span>
                      ) : daysLeft < 0 ? (
                        <span className="text-red-600 font-extrabold">Lewat {Math.abs(daysLeft)} hr</span>
                      ) : daysLeft <= 30 ? (
                        <span className="text-amber-600 font-extrabold">{daysLeft} hari lagi</span>
                      ) : (
                        <span className="text-gray-600 font-semibold">{daysLeft} hari</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'expiring_soon' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                          <AlertTriangle size={12} /> H-30
                        </span>
                      )}
                      {r.status === 'expired' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200">
                          <AlertCircle size={12} /> Habis
                        </span>
                      )}
                      {r.status === 'active' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} /> Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingItem(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-suka-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-suka-brown shadow-2xs hover:bg-stone-50 transition-all cursor-pointer"
                        title="Ubah / Perpanjang Kontrak"
                      >
                        <Edit2 size={12} />
                        <span>Perbarui</span>
                      </button>
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                    Tidak ada data kontrak yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingItem && (
        <ContractEditModal
          contract={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(values) => {
            onSaveContract(values)
            setEditingItem(null)
          }}
        />
      )}
    </>
  )
}
