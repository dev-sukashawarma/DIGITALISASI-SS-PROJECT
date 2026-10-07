'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  X,
  Receipt,
  Building2,
  Search,
  Sparkles,
  ArrowUpRight,
  Wallet,
  Users,
  Zap,
  Wifi,
  Package,
  Wrench,
  FileText,
  Landmark,
  Globe
} from 'lucide-react'
import { rupiah } from '@/lib/format'

export interface OpexCategoryItem {
  key: string
  label: string
  amount: number
  isProrated?: boolean
}

export interface OpexOutletItem {
  id: string
  name: string
  expense: number
  gross: number
  isMitra?: boolean
}

interface OpexBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  periodLabel: string
  scopeLabel: string
  totalOpex: number
  opexMonthly: number
  opexPettyCash: number
  centralExpense: number
  isAllOutlets: boolean
  isProrated: boolean
  prorataInfo?: { overlapDays: number; totalDays: number }
  categories: OpexCategoryItem[]
  outlets: OpexOutletItem[]
  detailHref?: {
    monthly?: string
    pettyCash?: string
  }
}

function getCategoryIcon(key: string) {
  const k = key.toLowerCase()
  if (k.includes('gaji') || k.includes('payroll') || k.includes('salary')) return Users
  if (k.includes('sewa') || k.includes('rent')) return Building2
  if (k.includes('listrik') || k.includes('utility') || k.includes('air') || k.includes('gas')) return Zap
  if (k.includes('internet') || k.includes('wifi') || k.includes('telp')) return Wifi
  if (k.includes('kas') || k.includes('petty')) return Wallet
  if (k.includes('pusat') || k.includes('central')) return Landmark
  if (k.includes('pemeliharaan') || k.includes('service') || k.includes('renov')) return Wrench
  if (k.includes('perlengkapan') || k.includes('logistik')) return Package
  if (k.includes('joint') || k.includes('bersama')) return Globe
  return FileText
}

export function OpexBreakdownModal({
  isOpen,
  onClose,
  periodLabel,
  scopeLabel,
  totalOpex,
  opexMonthly,
  opexPettyCash,
  centralExpense,
  isAllOutlets,
  isProrated,
  prorataInfo,
  categories,
  outlets,
  detailHref = {
    monthly: '/dashboard/reports/input-pengeluaran',
    pettyCash: '/dashboard/owner/petty-cash',
  },
}: OpexBreakdownModalProps) {
  const [activeTab, setActiveTab] = useState<'category' | 'outlet'>('category')
  const [outletQuery, setOutletQuery] = useState('')
  const [outletSort, setOutletSort] = useState<'expense' | 'ratio'>('expense')

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const filteredOutlets = useMemo(() => {
    let list = outlets
    if (outletQuery.trim()) {
      const q = outletQuery.toLowerCase()
      list = list.filter((o) => o.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (outletSort === 'ratio') {
        const ratioA = a.gross > 0 ? (a.expense / a.gross) : 0
        const ratioB = b.gross > 0 ? (b.expense / b.gross) : 0
        return ratioB - ratioA
      }
      return b.expense - a.expense
    })
  }, [outlets, outletQuery, outletSort])

  if (!isOpen) return null

  const hasCentral = isAllOutlets && centralExpense > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rincian Biaya Operasional (OPEX)"
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-suka-gray-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-suka-gray-100 bg-suka-gray-50/70">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-100/80 flex items-center justify-center text-rose-600 shadow-2xs">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-suka-brown tracking-tight">Rincian Biaya Operasional</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  OPEX
                </span>
              </div>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                {scopeLabel} · <span className="text-suka-brown font-semibold">{periodLabel}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-2 rounded-xl text-suka-gray-400 hover:text-suka-brown hover:bg-suka-gray-200/60 transition-colors active:scale-95 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Prorata Notice Banner */}
        {isProrated && prorataInfo && (
          <div className="px-6 py-2.5 bg-amber-50/80 border-b border-amber-200/80 flex items-center gap-2 text-xs text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Alokasi Prorata Aktif:</strong> Beban tetap bulanan (gaji, sewa tempat, internet) dihitung proporsional untuk <strong>{prorataInfo.overlapDays} hari</strong> dari total {prorataInfo.totalDays} hari bulan ini agar seimbang dengan omzet harian.
            </span>
          </div>
        )}

        {/* Top Summary Cards */}
        <div className="p-5 sm:p-6 bg-gradient-to-b from-suka-gray-50/40 to-white border-b border-suka-gray-100">
          <div className={`grid grid-cols-1 ${hasCentral ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 sm:gap-3.5`}>
            {/* Total OPEX */}
            <div className="min-w-0 bg-rose-50/60 p-3.5 sm:p-4 rounded-2xl border border-rose-200 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 truncate">Total OPEX</p>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-rose-700 tracking-tight mt-1 whitespace-nowrap tabular-nums">
                -{rupiah(totalOpex)}
              </h3>
              <p className="text-[11px] font-semibold text-rose-500 mt-0.5 truncate">Seluruh Beban Operasional</p>
            </div>

            {/* Beban Bulanan Outlet */}
            <div className="min-w-0 bg-white p-3.5 sm:p-4 rounded-2xl border border-suka-gray-200 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-600 truncate">Beban Bulanan Outlet</p>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-suka-brown tracking-tight mt-1 whitespace-nowrap tabular-nums">
                -{rupiah(opexMonthly)}
              </h3>
              <p className="text-[11px] font-semibold text-suka-gray-400 mt-0.5 truncate">Gaji, Sewa, Listrik & Utilitas</p>
            </div>

            {/* Kas Kecil (Petty Cash) */}
            <div className="min-w-0 bg-white p-3.5 sm:p-4 rounded-2xl border border-suka-gray-200 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-600 truncate">Kas Kecil (Petty Cash)</p>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-suka-brown tracking-tight mt-1 whitespace-nowrap tabular-nums">
                -{rupiah(opexPettyCash)}
              </h3>
              <p className="text-[11px] font-semibold text-suka-gray-400 mt-0.5 truncate">Belanja Harian Kasir/Outlet</p>
            </div>

            {/* Beban Kantor Pusat (jika ada) */}
            {hasCentral && (
              <div className="min-w-0 bg-purple-50/50 p-3.5 sm:p-4 rounded-2xl border border-purple-200/70 shadow-2xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">Beban Kantor Pusat</p>
                <h3 className="text-base sm:text-lg xl:text-xl font-black text-purple-900 tracking-tight mt-1 whitespace-nowrap tabular-nums">
                  -{rupiah(centralExpense)}
                </h3>
                <p className="text-[11px] font-semibold text-purple-600 mt-0.5 truncate">Operasional Pusat SS</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Control */}
        <div className="px-6 pt-4 pb-2 border-b border-suka-gray-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-suka-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('category')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'category'
                  ? 'bg-white text-suka-brown shadow-xs'
                  : 'text-suka-gray-500 hover:text-suka-brown'
              }`}
            >
              Rincian Kategori ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('outlet')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'outlet'
                  ? 'bg-white text-suka-brown shadow-xs'
                  : 'text-suka-gray-500 hover:text-suka-brown'
              }`}
            >
              Rincian Outlet ({outlets.length})
            </button>
          </div>

          {activeTab === 'outlet' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-suka-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari outlet..."
                  value={outletQuery}
                  onChange={(e) => setOutletQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs border border-suka-gray-200 rounded-lg focus:outline-hidden focus:border-suka-orange w-36 sm:w-48"
                />
              </div>
              <select
                value={outletSort}
                onChange={(e) => setOutletSort(e.target.value as any)}
                className="text-xs border border-suka-gray-200 rounded-lg px-2 py-1 font-semibold text-suka-brown focus:outline-hidden cursor-pointer"
              >
                <option value="expense">Urut Beban Terbesar</option>
                <option value="ratio">Urut Rasio OPEX %</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-4 max-h-[50vh]">
          {activeTab === 'category' ? (
            <div className="space-y-2.5">
              {categories.map((cat) => {
                const absAmount = Math.abs(cat.amount)
                const sharePct = totalOpex > 0 ? (absAmount / totalOpex) * 100 : 0
                const IconComponent = getCategoryIcon(cat.key)

                return (
                  <div
                    key={cat.key}
                    className="p-3.5 rounded-2xl bg-white border border-suka-gray-200 hover:border-suka-orange/30 transition-all flex items-center justify-between gap-4 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-suka-gray-100 flex items-center justify-center text-suka-gray-600 shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-suka-brown truncate">{cat.label}</span>
                          {cat.isProrated && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              Prorata
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-suka-gray-400 mt-0.5">
                          Porsi: {sharePct.toFixed(1)}% dari total operasional
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-rose-600 block">
                        -{rupiah(absAmount)}
                      </span>
                      <div className="w-20 h-1 bg-suka-gray-100 rounded-full mt-1.5 ml-auto overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${Math.min(100, sharePct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOutlets.length === 0 ? (
                <div className="text-center py-8 text-suka-gray-400 text-xs">
                  Tidak ditemukan outlet yang sesuai dengan kata kunci pencarian.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-suka-gray-200 text-suka-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-2.5 pl-2">Outlet</th>
                        <th className="pb-2.5 text-right">Beban Operasional</th>
                        <th className="pb-2.5 text-right">Porsi OPEX</th>
                        <th className="pb-2.5 text-right pr-2">Rasio terhadap Omzet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-suka-gray-100 font-medium">
                      {filteredOutlets.map((o) => {
                        const sharePct = totalOpex > 0 ? (o.expense / totalOpex) * 100 : 0
                        const opexRatio = o.gross > 0 ? (o.expense / o.gross) * 100 : 0
                        return (
                          <tr key={o.id} className="hover:bg-suka-gray-50/70 transition-colors">
                            <td className="py-2.5 pl-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-suka-brown text-xs">{o.name}</span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                    o.isMitra
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {o.isMitra ? 'Mitra' : 'Pusat'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right font-bold text-rose-600">
                              -{rupiah(o.expense)}
                            </td>
                            <td className="py-2.5 text-right text-suka-gray-600">
                              {sharePct.toFixed(1)}%
                            </td>
                            <td className="py-2.5 text-right pr-2 font-bold text-suka-brown">
                              {opexRatio.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Note & Quick Links */}
        <div className="px-6 py-3.5 border-t border-suka-gray-100 bg-suka-gray-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-suka-gray-500">
          <div className="flex items-center gap-3 flex-wrap">
            {detailHref?.pettyCash && (
              <Link
                href={detailHref.pettyCash}
                onClick={onClose}
                className="inline-flex items-center gap-1 font-bold text-suka-orange hover:text-suka-brown transition-colors"
              >
                Buka Buku Kas Kecil <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {detailHref?.monthly && (
              <Link
                href={detailHref.monthly}
                onClick={onClose}
                className="inline-flex items-center gap-1 font-bold text-suka-orange hover:text-suka-brown transition-colors"
              >
                Buka Input Pengeluaran <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-suka-brown text-white text-xs font-bold rounded-xl hover:bg-suka-brown/90 transition-all self-end sm:self-auto cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
