import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, AlertTriangle, AlertCircle, Search, Filter } from 'lucide-react'
import { Spinner, EmptyState } from '@suka/design-system'
import { useStokData } from '@/hooks/useStokData'
import { formatNumber } from '@/lib/format'

export default function StokMonitoringTab() {
  const { data: stokList, isLoading, error } = useStokData()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'kritis' | 'habis'>('all')

  const filteredStok = useMemo(() => {
    if (!stokList) return []
    let result = stokList

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(
        (s) =>
          s.item_name.toLowerCase().includes(lower) ||
          s.outlet_name.toLowerCase().includes(lower) ||
          s.kategori.toLowerCase().includes(lower)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }

    return result
  }, [stokList, searchTerm, statusFilter])

  // Group by outlet for better presentation
  const groupedByOutlet = useMemo(() => {
    const groups: Record<string, typeof filteredStok> = {}
    for (const item of filteredStok) {
      if (!groups[item.outlet_name]) {
        groups[item.outlet_name] = []
      }
      groups[item.outlet_name].push(item)
    }
    return groups
  }, [filteredStok])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data stok: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display text-suka-brown flex items-center gap-2">
            <Package className="text-suka-orange" size={24} />
            Stok & Persediaan
          </h2>
          <p className="text-sm text-suka-ink/60">Monitoring ketersediaan bahan baku di seluruh outlet</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-ink/40" size={16} />
            <input
              type="text"
              placeholder="Cari bahan / outlet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-suka-brown/10 bg-white focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange text-sm w-full sm:w-64 transition-all shadow-sm"
            />
          </div>
          <div className="flex bg-white rounded-xl shadow-sm border border-suka-brown/10 p-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === 'all' ? 'bg-suka-brown text-white' : 'text-suka-ink/60 hover:text-suka-ink'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('kritis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                statusFilter === 'kritis' ? 'bg-orange-500 text-white' : 'text-orange-600 hover:bg-orange-50'
              }`}
            >
              Kritis
            </button>
            <button
              onClick={() => setStatusFilter('habis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                statusFilter === 'habis' ? 'bg-red-500 text-white' : 'text-red-600 hover:bg-red-50'
              }`}
            >
              Habis
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Spinner size={32} />
        </div>
      ) : filteredStok.length === 0 ? (
        <EmptyState
          icon={<Package size={32} />}
          title="Stok Kosong / Tidak Ditemukan"
          description={searchTerm || statusFilter !== 'all' ? 'Coba ubah filter pencarian Anda.' : 'Data stok belum tersedia.'}
        />
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {Object.entries(groupedByOutlet).map(([outletName, items]) => (
              <motion.div
                key={outletName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-[2rem] border border-suka-brown/5 shadow-sm overflow-hidden"
              >
                <div className="bg-suka-brown/5 px-6 py-4 border-b border-suka-brown/5">
                  <h3 className="font-bold text-lg text-suka-brown">{outletName}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="bg-white text-suka-ink/60 border-b border-suka-brown/5">
                        <th className="px-6 py-3 font-semibold w-1/3">Bahan Baku</th>
                        <th className="px-6 py-3 font-semibold">Kategori</th>
                        <th className="px-6 py-3 font-semibold text-right">Saldo Saat Ini</th>
                        <th className="px-6 py-3 font-semibold text-right">Batas Kritis</th>
                        <th className="px-6 py-3 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-suka-brown/5">
                      {items.map((item) => (
                        <tr key={item.bahan_baku_id} className="hover:bg-suka-cream/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-suka-ink">{item.item_name}</td>
                          <td className="px-6 py-4 text-suka-ink/70">
                            <span className="bg-suka-brown/5 px-2 py-1 rounded-md text-xs font-semibold">
                              {item.kategori}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-suka-brown">
                              {formatNumber(item.current_qty)} {item.satuan}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-suka-ink/60">
                            {formatNumber(item.threshold)} {item.satuan}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.status === 'habis' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-red-50 text-red-600 border border-red-200">
                                <AlertCircle size={14} /> Habis
                              </span>
                            ) : item.status === 'kritis' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-orange-50 text-orange-600 border border-orange-200">
                                <AlertTriangle size={14} /> Kritis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-suka-cream text-suka-brown border border-suka-brown/10">
                                Aman
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
