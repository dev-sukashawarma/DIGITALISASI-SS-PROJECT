'use client'

import { useState } from 'react'
import { usePOPriceAlerts } from '@/hooks/usePOPriceAlerts'
import { useHargaHistory } from '@/hooks/useHargaHistory'
import { PageHeader, StatTile } from '@/components/ui'
import { rupiah } from '@/lib/format'
import { TrendingUp, TrendingDown, AlertCircle, History, Package } from 'lucide-react'
import CountUp from 'react-countup'
import { Spinner } from '@suka/design-system'

export default function HargaPage() {
  const { data: alerts = [], isLoading } = usePOPriceAlerts()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNama, setSelectedNama] = useState<string | null>(null)
  const { rows: historyRows, loading: historyLoading } = useHargaHistory(selectedId)

  const naikCount = alerts.filter(a => a.selisih_pct > 0).length
  const turunCount = alerts.filter(a => a.selisih_pct < 0).length

  if (isLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-suka-gray-400 font-medium">
        <Spinner className="w-8 h-8 text-suka-orange" />
        <span className="mt-3 text-xs font-bold text-suka-brown">Memuat riwayat perubahan harga…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <PageHeader
        title="Harga & Fluktuasi Bahan Baku"
        description="Pantau perubahan harga bahan baku yang mengalami selisih >5% dari harga master dalam 30 hari terakhir."
      />

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Perubahan Harga >5%"
          value={<CountUp end={alerts.length} duration={1} />}
          sub="Alert Fluktuasi 30 Hari"
          icon={AlertCircle}
          accent="orange"
        />
        <StatTile
          label="Mengalami Kenaikan"
          value={<CountUp end={naikCount} duration={1} />}
          sub="Harga Terima Lebih Tinggi"
          icon={TrendingUp}
          accent="red"
        />
        <StatTile
          label="Mengalami Penurunan"
          value={<CountUp end={turunCount} duration={1} />}
          sub="Harga Terima Lebih Hemat"
          icon={TrendingDown}
          accent="green"
        />
      </div>

      {/* Glass Table 1: Price Alerts */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-5 border-b border-suka-gray-100 flex items-center justify-between">
          <h2 className="font-black text-suka-brown text-sm uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-suka-orange" />
            Daftar Perubahan Harga Aktif
          </h2>
          <span className="text-[10px] font-black text-suka-gray-400 uppercase tracking-wider">Klik baris untuk lihat riwayat</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-suka-cream/40 text-suka-gray-500 text-[9px] uppercase font-black tracking-widest border-b border-suka-gray-100">
                <th className="py-4 px-6">Nama Bahan Baku</th>
                <th className="py-4 px-6 text-right">Harga Master</th>
                <th className="py-4 px-6 text-right">Harga Terima PO</th>
                <th className="py-4 px-6 text-right">Selisih (%)</th>
                <th className="py-4 px-6 text-center">Nomor PO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 text-xs">
              {alerts.map((a) => {
                const naik = a.selisih_pct > 0
                const isSelected = selectedId === a.bahan_baku_id

                return (
                  <tr
                    key={a.bahan_baku_id + a.po_id}
                    onClick={() => { setSelectedId(a.bahan_baku_id); setSelectedNama(a.nama) }}
                    className={`transition-all duration-200 cursor-pointer ${
                      isSelected ? 'bg-orange-50/70 font-semibold' : 'hover:bg-white/80'
                    }`}
                  >
                    <td className="py-4 px-6 font-extrabold text-suka-brown text-sm">
                      {a.nama}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-suka-gray-500">
                      {a.harga_master ? rupiah(a.harga_master) : '—'}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-suka-brown text-sm">
                      {rupiah(a.harga_terima)}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black tracking-wider border ${
                        naik 
                          ? 'bg-red-50 text-red-600 border-red-200/80 shadow-2xs' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200/80 shadow-2xs'
                      }`}>
                        {naik ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {naik ? '+' : ''}{(a.selisih_pct * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-mono font-bold text-suka-gray-600">
                      {a.nomor_po}
                    </td>
                  </tr>
                )
              })}

              {alerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-suka-gray-400 space-y-2">
                    <Package className="w-10 h-10 mx-auto text-suka-gray-300" />
                    <p className="font-extrabold text-suka-brown text-sm">Tidak ada perubahan harga signifikan</p>
                    <p className="text-xs text-suka-gray-400">Seluruh harga PO dalam 30 hari terakhir sesuai dengan harga master.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Glass Table 2: Selected Item History */}
      {selectedId && (
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden space-y-4">
          <div className="p-5 border-b border-suka-gray-100 flex items-center justify-between">
            <h2 className="font-black text-suka-brown text-sm uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-suka-orange" />
              Riwayat Perubahan Harga: <span className="text-suka-orange">{selectedNama}</span>
            </h2>
            <button 
              onClick={() => { setSelectedId(null); setSelectedNama(null) }}
              className="text-xs font-bold text-suka-gray-400 hover:text-suka-brown"
            >
              Tutup Riwayat
            </button>
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-12"><Spinner className="w-6 h-6 text-suka-orange" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-suka-cream/40 text-suka-gray-500 text-[9px] uppercase font-black tracking-widest border-b border-suka-gray-100">
                    <th className="py-3.5 px-6">Tanggal Perubahan</th>
                    <th className="py-3.5 px-6 text-right">Harga Lama</th>
                    <th className="py-3.5 px-6 text-right">Harga Baru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 text-xs">
                  {historyRows.map((h) => (
                    <tr key={h.id} className="hover:bg-white/80 transition-all">
                      <td className="py-3.5 px-6 font-bold text-suka-gray-600">
                        {new Date(h.changed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-6 text-right font-medium text-suka-gray-400">
                        {h.harga_lama ? rupiah(h.harga_lama) : '—'}
                      </td>
                      <td className="py-3.5 px-6 text-right font-black text-suka-brown text-sm">
                        {rupiah(h.harga_baru)}
                      </td>
                    </tr>
                  ))}
                  {historyRows.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-suka-gray-400 font-medium">Belum ada riwayat perubahan tercatat.</td></tr>
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
