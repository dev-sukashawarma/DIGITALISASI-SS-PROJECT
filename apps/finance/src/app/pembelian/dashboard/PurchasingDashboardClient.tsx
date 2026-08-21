'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { id } from 'date-fns/locale'
import { usePurchasingDashboard } from '@/hooks/usePurchasingDashboard'
import { 
  ClipboardList, 
  ClipboardCheck, 
  Package, 
  Receipt, 
  Loader2, 
  ArrowRight, 
  Plus, 
  Calendar, 
  Truck, 
  CheckCircle2, 
  Clock, 
  ExternalLink 
} from 'lucide-react'
import Link from 'next/link'
import CountUp from 'react-countup'

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
      case 'pending': 
      case 'draft':
        return 'bg-stone-100 text-stone-700 border-stone-200'
      case 'pending_approval': 
      case 'menunggu_approval_finance':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'approved': 
      case 'dikirim_ke_supplier':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'partial_receipt': 
      case 'sebagian_diterima':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'paid': 
      case 'diterima_lengkap':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'dibatalkan':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      default: 
        return 'bg-stone-100 text-stone-700 border-stone-200'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/95 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-sm border border-suka-brown/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-suka-brown tracking-tight">Dashboard Purchasing</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/80 text-amber-900 border border-amber-200">
              Kitchen Bogor
            </span>
          </div>
          <p className="text-xs sm:text-sm text-suka-brown/60 font-medium mt-0.5">
            Pusat monitoring arus pengadaan bahan baku, status dokumen PO, dan hutang supplier.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Date Range Picker */}
          <div className="flex items-center gap-1.5 bg-suka-cream/60 p-1.5 rounded-2xl border border-suka-brown/10 shadow-2xs">
            <Calendar className="w-4 h-4 text-suka-orange ml-1.5" />
            <input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-suka-brown/10 text-xs font-bold text-suka-brown rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-suka-orange/20"
            />
            <span className="text-suka-brown/40 font-bold text-xs">-</span>
            <input 
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-suka-brown/10 text-xs font-bold text-suka-brown rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-suka-orange/20"
            />
          </div>

          {/* Quick Create PO */}
          <Link
            href="/pembelian/new"
            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-bold px-4 py-2.5 rounded-2xl hover:opacity-95 active:scale-[0.98] transition-all text-xs shadow-md shadow-suka-brown/20"
          >
            <Plus className="w-4 h-4 text-suka-orange" />
            <span>Buat PO</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/60 rounded-3xl border border-suka-brown/5">
          <Loader2 className="w-8 h-8 text-suka-orange animate-spin mb-3" />
          <p className="text-suka-brown/60 font-semibold text-xs">Memuat ringkasan data pengadaan...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-200 text-xs font-semibold">
          Gagal memuat data dashboard purchasing. Silakan coba lagi.
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* PR Pending */}
            <Link href="/pembelian/permintaan" className="block group">
              <motion.div 
                whileHover={{ y: -3 }}
                className="bg-white/95 backdrop-blur-xl p-5 rounded-3xl shadow-sm border border-suka-brown/10 hover:border-suka-orange/40 hover:shadow-md transition-all h-full flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                    Permintaan
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-suka-brown tracking-tight tabular-nums">
                    <CountUp end={data?.prPendingCount || 0} duration={1} />
                  </h3>
                  <p className="text-xs font-semibold text-suka-brown/70 mt-0.5">PR Menunggu PO</p>
                </div>
              </motion.div>
            </Link>

            {/* PO Approval */}
            <Link href="/po-approval" className="block group">
              <motion.div 
                whileHover={{ y: -3 }}
                className="bg-white/95 backdrop-blur-xl p-5 rounded-3xl shadow-sm border border-suka-brown/10 hover:border-suka-orange/40 hover:shadow-md transition-all h-full flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Approval
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-suka-brown tracking-tight tabular-nums">
                    <CountUp end={data?.poPendingApprovalCount || 0} duration={1} />
                  </h3>
                  <p className="text-xs font-semibold text-suka-brown/70 mt-0.5">PO Menunggu Approval</p>
                </div>
              </motion.div>
            </Link>

            {/* Pending Receipt */}
            <Link href="/pembelian/penerimaan" className="block group">
              <motion.div 
                whileHover={{ y: -3 }}
                className="bg-white/95 backdrop-blur-xl p-5 rounded-3xl shadow-sm border border-suka-brown/10 hover:border-suka-orange/40 hover:shadow-md transition-all h-full flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Penerimaan
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-suka-brown tracking-tight tabular-nums">
                    <CountUp end={data?.poPendingReceiptCount || 0} duration={1} />
                  </h3>
                  <p className="text-xs font-semibold text-suka-brown/70 mt-0.5">Menunggu Penerimaan</p>
                </div>
              </motion.div>
            </Link>

            {/* Total Unpaid / Hutang */}
            <Link href="/pembelian/invoice" className="block group">
              <motion.div 
                whileHover={{ y: -3 }}
                className="bg-white/95 backdrop-blur-xl p-5 rounded-3xl shadow-sm border border-suka-brown/10 hover:border-suka-orange/40 hover:shadow-md transition-all h-full flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Hutang PO
                  </span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-suka-brown tracking-tight tabular-nums truncate" title={formatRupiah(data?.totalUnpaid || 0)}>
                    <CountUp 
                      end={data?.totalUnpaid || 0} 
                      duration={1} 
                      formattingFn={(val) => formatRupiah(val)}
                    />
                  </h3>
                  <p className="text-xs font-semibold text-suka-brown/70 mt-0.5">Total Hutang Berjalan</p>
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Quick Operations Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/pembelian/new"
              className="p-3.5 bg-white/80 hover:bg-white rounded-2xl border border-suka-brown/10 shadow-2xs flex items-center gap-3 transition-all hover:border-suka-orange/30 group"
            >
              <div className="w-8 h-8 rounded-xl bg-suka-orange/15 text-suka-orange flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-suka-brown truncate group-hover:text-suka-orange transition-colors">
                  Buat PO Baru
                </span>
                <span className="block text-[10px] text-suka-brown/50 font-medium truncate">Formulir Pesanan</span>
              </div>
            </Link>

            <Link
              href="/pembelian/supplier"
              className="p-3.5 bg-white/80 hover:bg-white rounded-2xl border border-suka-brown/10 shadow-2xs flex items-center gap-3 transition-all hover:border-suka-orange/30 group"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-suka-brown truncate group-hover:text-suka-orange transition-colors">
                  Data Supplier
                </span>
                <span className="block text-[10px] text-suka-brown/50 font-medium truncate">Mitra & Kontak</span>
              </div>
            </Link>

            <Link
              href="/pembelian/penerimaan"
              className="p-3.5 bg-white/80 hover:bg-white rounded-2xl border border-suka-brown/10 shadow-2xs flex items-center gap-3 transition-all hover:border-suka-orange/30 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-suka-brown truncate group-hover:text-suka-orange transition-colors">
                  Penerimaan Fisik
                </span>
                <span className="block text-[10px] text-suka-brown/50 font-medium truncate">Verifikasi Barang</span>
              </div>
            </Link>

            <Link
              href="/pembelian/laporan"
              className="p-3.5 bg-white/80 hover:bg-white rounded-2xl border border-suka-brown/10 shadow-2xs flex items-center gap-3 transition-all hover:border-suka-orange/30 group"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-suka-brown truncate group-hover:text-suka-orange transition-colors">
                  Laporan Rekap
                </span>
                <span className="block text-[10px] text-suka-brown/50 font-medium truncate">Histori & Ekspor</span>
              </div>
            </Link>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-sm border border-suka-brown/10 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-suka-brown/5 flex justify-between items-center bg-suka-cream/40">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-suka-brown">PO Aktif Terbaru</h2>
                <p className="text-[11px] text-suka-brown/60 font-medium">Daftar transaksi pengadaan bahan baku terkini.</p>
              </div>
              <Link 
                href="/pembelian" 
                className="text-xs font-bold text-suka-orange hover:text-suka-brown flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl hover:bg-suka-cream"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead>
                  <tr className="bg-suka-cream/70 border-b border-suka-brown/10 text-[11px] text-suka-brown/80 uppercase font-bold tracking-wider select-none">
                    <th className="px-5 py-3.5">Nomor PO</th>
                    <th className="px-5 py-3.5">Tanggal</th>
                    <th className="px-5 py-3.5">Supplier</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Total Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-brown/5 text-suka-ink font-medium">
                  {data?.recentPos && data.recentPos.length > 0 ? (
                    data.recentPos.map((po) => (
                      <tr 
                        key={po.id} 
                        className="hover:bg-amber-50/40 transition-colors group cursor-pointer"
                        onClick={() => window.location.href = `/pembelian/${po.id}`}
                      >
                        <td className="px-5 py-3.5 font-bold font-mono text-suka-brown group-hover:text-suka-orange transition-colors">
                          {po.po_number || '-'}
                        </td>
                        <td className="px-5 py-3.5 text-suka-brown/70 font-medium">
                          {format(new Date(po.created_at), 'dd MMM yyyy', { locale: id })}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-suka-brown">{po.supplier_name || '-'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${getStatusColor(po.status)}`}>
                            {formatStatus(po.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-suka-brown tabular-nums">
                          {formatRupiah(Number(po.total_amount || 0))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-suka-brown/40 font-medium italic">
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
