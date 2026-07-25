'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePurchaseSuggestion } from '@/hooks/usePurchaseSuggestion'

const BADGE: Record<string, string> = {
  mendesak: 'bg-red-100 text-red-700',
  menipis: 'bg-amber-100 text-amber-700',
  aman: 'bg-emerald-100 text-emerald-700',
}

export default function PerluDibeliPage() {
  const { rows, loading } = usePurchaseSuggestion()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const router = useRouter()

  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }))
  const selected = rows.filter((r) => checked[r.bahan_baku_id])

  const buatDraft = () => {
    if (selected.length === 0) return
    sessionStorage.setItem('po_draft_items', JSON.stringify(
      selected.map((r) => ({ bahan_baku_id: r.bahan_baku_id, nama: r.nama, satuan: r.satuan, qty: r.qty_saran }))
    ))
    router.push('/dashboard/pembelian/new?from=suggestion')
  }

  if (loading) return <div className="p-6 text-suka-brown">Memuat usulan…</div>

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-suka-brown">Perlu Dibeli</h1>
        <button
          onClick={buatDraft}
          disabled={selected.length === 0}
          className="px-4 py-2 rounded-lg bg-suka-orange text-white font-bold disabled:opacity-40"
        >
          Buat Draft PO ({selected.length})
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-suka-outline bg-white">
        <table className="w-full text-sm">
          <thead className="bg-suka-cream text-suka-brown">
            <tr>
              <th className="p-3 text-left w-8"></th>
              <th className="p-3 text-left">Bahan</th>
              <th className="p-3 text-right">Stok</th>
              <th className="p-3 text-right">Threshold</th>
              <th className="p-3 text-right">Sisa Hari</th>
              <th className="p-3 text-right">Permintaan</th>
              <th className="p-3 text-right">Sudah Dipesan</th>
              <th className="p-3 text-right">Qty Saran</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bahan_baku_id} className="border-t border-suka-outline/50">
                <td className="p-3">
                  <input type="checkbox" checked={!!checked[r.bahan_baku_id]} onChange={() => toggle(r.bahan_baku_id)} />
                </td>
                <td className="p-3 font-medium">{r.nama}</td>
                <td className="p-3 text-right">{r.stok} {r.satuan}</td>
                <td className="p-3 text-right">{r.threshold}</td>
                <td className="p-3 text-right">{r.days_left ?? '—'}</td>
                <td className="p-3 text-right">{r.permintaan_pending || '—'}</td>
                <td className="p-3 text-right">{r.sudah_dipesan || '—'}</td>
                <td className="p-3 text-right font-bold">{r.qty_saran} {r.satuan}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BADGE[r.tingkat]}`}>{r.tingkat}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-suka-brown/60">Tidak ada usulan — stok pusat aman.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
