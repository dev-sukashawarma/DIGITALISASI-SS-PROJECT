'use client'

import React, { useMemo } from 'react'
import { X, Clock, Receipt, Building2, Wallet, Store, Tag } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { labelOf } from '@/lib/expenseCategories'

export type ManagerModalType = 'lembur' | 'petty_cash' | 'monthly' | 'total' | null

export interface TransactionItem {
  id: string
  date: string
  outlet_name: string
  outlet_id?: string | null
  recipient_name?: string | null
  category: string
  description?: string | null
  amount: number
  source: 'monthly' | 'petty_cash'
  receipt_url?: string | null
  isLembur?: boolean
}

interface ManagerOpexDetailModalProps {
  type: ManagerModalType
  onClose: () => void
  transactions: TransactionItem[]
  outletLabel?: string
  dateRangeLabel?: string
}

export function ManagerOpexDetailModal({
  type,
  onClose,
  transactions,
  outletLabel = 'Semua Cabang',
  dateRangeLabel = '',
}: ManagerOpexDetailModalProps) {
  if (!type) return null

  // Saring transaksi berdasarkan tipe modal
  const filteredItems = useMemo(() => {
    if (type === 'lembur') {
      return transactions.filter(t => t.category === 'lembur' || t.isLembur)
    }
    if (type === 'petty_cash') {
      return transactions.filter(t => t.source === 'petty_cash' && t.category !== 'lembur' && !t.isLembur)
    }
    if (type === 'monthly') {
      return transactions.filter(t => t.source === 'monthly' && t.category !== 'lembur' && !t.isLembur)
    }
    return transactions
  }, [type, transactions])

  const totalAmount = useMemo(() => {
    return filteredItems.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  }, [filteredItems])

  // Rangkuman per kategori
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; count: number; total: number }>()
    filteredItems.forEach(t => {
      const catKey = t.category || 'lainnya'
      const existing = map.get(catKey) || { label: labelOf(catKey), count: 0, total: 0 }
      existing.count += 1
      existing.total += Number(t.amount) || 0
      map.set(catKey, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filteredItems])

  // Rangkuman per cabang
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    filteredItems.forEach(t => {
      const outKey = t.outlet_name || 'Cabang'
      const existing = map.get(outKey) || { name: outKey, count: 0, total: 0 }
      existing.count += 1
      existing.total += Number(t.amount) || 0
      map.set(outKey, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filteredItems])

  const modalMeta = {
    lembur: {
      title: 'Rincian Biaya Lembur Kasir & Kru',
      desc: 'Pencatatan klaim lemburan toko yang dicairkan melalui kas kecil POS.',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    petty_cash: {
      title: 'Rincian Kas Kecil POS (Non-Lembur)',
      desc: 'Pengeluaran harian operasional toko (bahan baku darurat, gas, es, transport, dll).',
      icon: Receipt,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    monthly: {
      title: 'Rincian Biaya Bulanan Cabang',
      desc: 'Pengeluaran periodik outlet (sewa tempat, listrik PLN, air PDAM, internet/wifi).',
      icon: Building2,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    total: {
      title: 'Rekapitulasi Total Beban Operasional Cabang',
      desc: 'Seluruh akumulasi pengeluaran operasional cabang pada periode terpilih.',
      icon: Wallet,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
  }[type]

  const Icon = modalMeta.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${modalMeta.bgColor} flex items-center justify-center ${modalMeta.color}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">{modalMeta.title}</h3>
              <p className="text-xs text-gray-500 font-medium">
                {outletLabel} · {dateRangeLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
            title="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Total Metric Banner */}
        <div className="my-4 p-4 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Terverifikasi</span>
            <div className="text-2xl font-black text-gray-900 font-mono mt-0.5">
              {rupiah(totalAmount)}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Jumlah Transaksi</span>
            <div className="text-lg font-bold text-gray-700">
              {filteredItems.length} Pengeluaran
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 min-h-0">
          {/* Breakdown per Cabang */}
          {outletBreakdown.length > 1 && (
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Store size={14} className="text-suka-orange" />
                Rincian per Cabang Toko
              </h4>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Nama Cabang</th>
                      <th className="px-3 py-2 text-center">Frekuensi</th>
                      <th className="px-3 py-2 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outletBreakdown.map((ob, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-bold text-gray-800">{ob.name}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{ob.count}x</td>
                        <td className="px-3 py-2 text-right font-black font-mono text-gray-900">{rupiah(ob.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Breakdown per Kategori */}
          {categoryBreakdown.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag size={14} className="text-suka-orange" />
                Rincian per Kategori
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200/70 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-800 text-xs">{cat.label}</span>
                      <p className="text-[10px] text-gray-500">{cat.count} transaksi</p>
                    </div>
                    <span className="font-black font-mono text-gray-900 text-xs">
                      {rupiah(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10 Transaksi Terbaru pada Kategori Ini */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Daftar Transaksi ({filteredItems.length})
            </h4>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Cabang</th>
                    <th className="px-3 py-2">Keterangan</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-400 italic">
                        Tidak ada transaksi pada kelompok ini
                      </td>
                    </tr>
                  ) : (
                    filteredItems.slice(0, 50).map(t => (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-medium">{t.date}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-gray-800">{t.outlet_name}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-xs truncate" title={t.description || ''}>
                          {t.description || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-black font-mono text-gray-900">
                          {rupiah(t.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filteredItems.length > 50 && (
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-center text-[11px] text-gray-500 font-medium">
                  Menampilkan 50 transaksi teratas. Unduh file Excel/PDF untuk melihat seluruh data.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-gray-100 shrink-0 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
