'use client'

import React, { useEffect } from 'react'
import { X, ShoppingBag, User, Calendar, Tag, CheckCircle2 } from 'lucide-react'
import type { OutletSpendingTransaction } from '@/types/budgetMonitoring'

interface Props {
  transaction: OutletSpendingTransaction | null
  onClose: () => void
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val)
}

export function SpendingDetailModal({ transaction, onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!transaction) return null

  const formattedDate = new Date(transaction.approvedAt || transaction.createdAt).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-suka-brown/15 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-suka-brown/10 flex items-center justify-between bg-suka-cream/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-suka-brown text-base">{transaction.kodePermintaan}</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Disetujui
                </span>
              </div>
              <p className="text-xs text-suka-brown/60 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-suka-brown/40" />
                {formattedDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-suka-cream/80 hover:bg-suka-cream text-suka-brown/60 hover:text-suka-brown flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata info row */}
        <div className="px-6 py-3 bg-suka-cream/10 border-b border-suka-brown/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-suka-brown/70 font-medium">
            <User className="w-4 h-4 text-suka-orange" />
            <span>Pemohon: <strong className="text-suka-brown">{transaction.requesterName}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-suka-brown/70 font-medium">
            <Tag className="w-4 h-4 text-suka-orange" />
            <span>Total Item: <strong className="text-suka-brown">{transaction.totalItems} jenis bahan</strong></span>
          </div>
        </div>

        {/* Items List Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-suka-brown/10 text-suka-brown/60 font-bold uppercase text-[10px] tracking-wider">
                <th className="pb-3 pl-1">Bahan Baku</th>
                <th className="pb-3 text-center">Qty Diminta</th>
                <th className="pb-3 text-center">Qty Disetujui</th>
                <th className="pb-3 text-right">Harga Satuan</th>
                <th className="pb-3 text-right pr-1">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/5">
              {transaction.items.map((it) => (
                <tr key={it.id} className="hover:bg-suka-cream/20 transition-colors">
                  <td className="py-3 pl-1">
                    <p className="font-bold text-suka-brown text-sm">{it.namaBahan}</p>
                    <span className="text-[10px] text-suka-brown/50 uppercase font-semibold">
                      {it.kategori}
                    </span>
                  </td>
                  <td className="py-3 text-center text-suka-brown/70 font-medium">
                    {it.qtyDimintaDistribusi} {it.satuanDistribusi}
                  </td>
                  <td className="py-3 text-center">
                    <span className="font-bold text-suka-brown bg-suka-cream/60 px-2 py-0.5 rounded-md">
                      {it.qtyDisetujuiDistribusi} {it.satuanDistribusi}
                    </span>
                  </td>
                  <td className="py-3 text-right text-suka-brown/70 font-medium font-mono">
                    {formatRupiah(it.hargaSnapshot)}
                  </td>
                  <td className="py-3 text-right pr-1 font-bold text-suka-brown font-mono">
                    {formatRupiah(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Total */}
        <div className="px-6 py-4 bg-suka-cream/40 border-t border-suka-brown/10 flex items-center justify-between">
          <span className="text-xs font-bold text-suka-brown/70 uppercase tracking-wider">
            Total Realisasi Belanja Transaksi:
          </span>
          <span className="text-xl font-black text-suka-brown font-mono">
            {formatRupiah(transaction.totalNilai)}
          </span>
        </div>
      </div>
    </div>
  )
}
