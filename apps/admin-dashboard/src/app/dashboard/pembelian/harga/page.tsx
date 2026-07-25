'use client'

import { useState } from 'react'
import { usePOPriceAlerts } from '@/hooks/usePOPriceAlerts'
import { useHargaHistory } from '@/hooks/useHargaHistory'

export default function HargaPage() {
  const { data: alerts = [], isLoading } = usePOPriceAlerts()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNama, setSelectedNama] = useState<string | null>(null)
  const { rows: historyRows, loading: historyLoading } = useHargaHistory(selectedId)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-suka-brown mb-1">Harga & Bahan Baku</h1>
      <p className="text-sm text-suka-brown/70 mb-4">Bahan yang harganya berubah &gt;5% dari harga master dalam 30 hari terakhir.</p>
      {isLoading ? (
        <div className="text-suka-brown">Memuat…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-suka-outline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-suka-cream text-suka-brown">
              <tr>
                <th className="p-3 text-left">Bahan</th>
                <th className="p-3 text-right">Harga Master</th>
                <th className="p-3 text-right">Harga Terima</th>
                <th className="p-3 text-right">Selisih</th>
                <th className="p-3 text-left">PO</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr
                  key={a.bahan_baku_id + a.po_id}
                  className="border-t border-suka-outline/50 cursor-pointer hover:bg-suka-cream/50"
                  onClick={() => { setSelectedId(a.bahan_baku_id); setSelectedNama(a.nama) }}
                >
                  <td className="p-3 font-medium">{a.nama}</td>
                  <td className="p-3 text-right">{a.harga_master ?? '—'}</td>
                  <td className="p-3 text-right">{a.harga_terima}</td>
                  <td className={`p-3 text-right font-bold ${a.selisih_pct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {(a.selisih_pct * 100).toFixed(1)}%
                  </td>
                  <td className="p-3">{a.nomor_po}</td>
                </tr>
              ))}
              {alerts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-suka-brown/60">Tidak ada perubahan harga signifikan.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-suka-brown mb-2">Riwayat Harga: {selectedNama}</h2>
          {historyLoading ? (
            <div className="text-suka-brown">Memuat…</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-suka-outline bg-white">
              <table className="w-full text-sm">
                <thead className="bg-suka-cream text-suka-brown">
                  <tr>
                    <th className="p-3 text-left">Tanggal</th>
                    <th className="p-3 text-right">Harga Lama</th>
                    <th className="p-3 text-right">Harga Baru</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((h) => (
                    <tr key={h.id} className="border-t border-suka-outline/50">
                      <td className="p-3">{new Date(h.changed_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">{h.harga_lama ?? '—'}</td>
                      <td className="p-3 text-right">{h.harga_baru}</td>
                    </tr>
                  ))}
                  {historyRows.length === 0 && (
                    <tr><td colSpan={3} className="p-6 text-center text-suka-brown/60">Belum ada riwayat.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
