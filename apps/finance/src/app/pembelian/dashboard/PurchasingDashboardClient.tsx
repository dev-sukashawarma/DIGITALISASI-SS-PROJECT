'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { id } from 'date-fns/locale'
import { usePurchasingDashboard } from '@/hooks/usePurchasingDashboard'
import { ClipboardList, ClipboardCheck, Package, Receipt, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function PurchasingDashboardClient() {
  const now = new Date()
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'))

  const { data, isLoading, error } = usePurchasingDashboard({
    startDate: startDate || null,
    endDate: endDate || null
  })

  // Format currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'pending_approval': return 'bg-orange-100 text-orange-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'partial_receipt': return 'bg-indigo-100 text-indigo-800'
      case 'pending_payment': return 'bg-red-100 text-red-800'
      case 'partial_payment': return 'bg-rose-100 text-rose-800'
      case 'paid': return 'bg-emerald-100 text-emerald-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-suka-brown/5">
        <div>
          <h1 className="text-2xl font-display text-suka-brown">Dashboard Purchasing</h1>
          <p className="text-sm text-suka-brown/60 font-medium">Ringkasan aktivitas dan status dokumen</p>
        </div>
        
        <div className="flex items-center gap-2 bg-suka-cream/50 p-1.5 rounded-2xl border border-suka-brown/10">
          <input 
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-white border-none text-sm font-bold text-suka-brown rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-suka-orange"
          />
          <span className="text-suka-brown/40 font-bold">-</span>
          <input 
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-white border-none text-sm font-bold text-suka-brown rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-suka-orange"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-suka-orange animate-spin mb-4" />
          <p className="text-suka-brown/60 font-bold">Menyiapkan data...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100">
          Gagal memuat dashboard. Silakan coba lagi.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/pembelian/permintaan" className="block group">
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-suka-brown/5 hover:border-suka-orange/30 transition-all h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-3xl font-display text-suka-brown mb-1">{data?.prPendingCount || 0}</h3>
                <p className="text-sm font-bold text-suka-brown/60">PR Menunggu PO</p>
              </motion.div>
            </Link>

            <Link href="/po-approval" className="block group">
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-suka-brown/5 hover:border-suka-orange/30 transition-all h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-3xl font-display text-suka-brown mb-1">{data?.poPendingApprovalCount || 0}</h3>
                <p className="text-sm font-bold text-suka-brown/60">PO Menunggu Approval</p>
              </motion.div>
            </Link>

            <Link href="/pembelian/penerimaan" className="block group">
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-suka-brown/5 hover:border-suka-orange/30 transition-all h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Package className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-3xl font-display text-suka-brown mb-1">{data?.poPendingReceiptCount || 0}</h3>
                <p className="text-sm font-bold text-suka-brown/60">Menunggu Penerimaan</p>
              </motion.div>
            </Link>

            <Link href="/pembelian/invoice" className="block group">
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-suka-brown/5 hover:border-suka-orange/30 transition-all h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                    <Receipt className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-2xl font-display text-suka-brown mb-1">{formatRupiah(data?.totalUnpaid || 0)}</h3>
                <p className="text-sm font-bold text-suka-brown/60">Total Hutang Berjalan</p>
              </motion.div>
            </Link>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-suka-brown/5 overflow-hidden">
            <div className="p-6 border-b border-suka-brown/5 flex justify-between items-center">
              <h2 className="text-lg font-display text-suka-brown">PO Aktif Terbaru</h2>
              <Link href="/pembelian" className="text-sm font-bold text-suka-orange flex items-center gap-1 hover:gap-2 transition-all">
                Lihat Semua <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-suka-cream/50 text-xs text-suka-brown/60 uppercase font-black">
                  <tr>
                    <th className="px-6 py-4">Nomor PO</th>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-suka-brown">
                  {data?.recentPos && data.recentPos.length > 0 ? (
                    data.recentPos.map((po) => (
                      <tr key={po.id} className="border-b border-suka-brown/5 hover:bg-suka-orange/5 transition-colors">
                        <td className="px-6 py-4 font-bold">{po.po_number || '-'}</td>
                        <td className="px-6 py-4 text-suka-brown/60">
                          {format(new Date(po.created_at), 'dd MMM yyyy', { locale: id })}
                        </td>
                        <td className="px-6 py-4">{po.supplier_name || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(po.status)}`}>
                            {formatStatus(po.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          {formatRupiah(Number(po.total_amount || 0))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-suka-brown/40 font-bold">
                        Tidak ada transaksi aktif di rentang waktu ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
