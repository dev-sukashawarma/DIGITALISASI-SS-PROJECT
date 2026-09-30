'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  X,
  Boxes,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowUpRight
} from 'lucide-react'
import { rupiah } from '@/lib/format'

export interface CogsOutletItem {
  id: string
  name: string
  hpp: number
  waste: number
  totalCost: number
  gross: number
  isMitra?: boolean
}

interface CogsWasteBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  periodLabel: string
  scopeLabel: string
  totalCogs: number
  totalHpp: number
  totalWaste: number
  grossRevenue: number
  outlets: CogsOutletItem[]
  wasteDetailHref?: string
}

export function CogsWasteBreakdownModal({
  isOpen,
  onClose,
  periodLabel,
  scopeLabel,
  totalCogs,
  totalHpp,
  totalWaste,
  grossRevenue,
  outlets,
  wasteDetailHref = '/dashboard/owner/waste',
}: CogsWasteBreakdownModalProps) {
  const [activeTab, setActiveTab] = useState<'composition' | 'outlet'>('composition')
  const [outletQuery, setOutletQuery] = useState('')
  const [outletSort, setOutletSort] = useState<'total' | 'hpp' | 'waste' | 'ratio'>('total')

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
      if (outletSort === 'hpp') return b.hpp - a.hpp
      if (outletSort === 'waste') return b.waste - a.waste
      if (outletSort === 'ratio') {
        const ratioA = a.gross > 0 ? (a.totalCost / a.gross) : 0
        const ratioB = b.gross > 0 ? (b.totalCost / b.gross) : 0
        return ratioB - ratioA
      }
      return b.totalCost - a.totalCost
    })
  }, [outlets, outletQuery, outletSort])

  if (!isOpen) return null

  const cogsPctOfGross = grossRevenue > 0 ? (totalCogs / grossRevenue) * 100 : 0
  const hppPctOfGross = grossRevenue > 0 ? (totalHpp / grossRevenue) * 100 : 0
  const wastePctOfGross = grossRevenue > 0 ? (totalWaste / grossRevenue) * 100 : 0

  const hppShare = totalCogs > 0 ? (totalHpp / totalCogs) * 100 : 100
  const wasteShare = totalCogs > 0 ? (totalWaste / totalCogs) * 100 : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rincian Beban Pokok (HPP & Waste)"
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-suka-gray-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-suka-gray-100 bg-suka-gray-50/70">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-100/80 flex items-center justify-center text-amber-700 shadow-2xs">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-suka-brown tracking-tight">Rincian Beban Pokok (HPP)</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  COGS & Waste
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

        {/* Top Summary Cards */}
        <div className="p-5 sm:p-6 bg-gradient-to-b from-suka-gray-50/40 to-white border-b border-suka-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5">
            {/* Total Beban Pokok */}
            <div className="min-w-0 bg-amber-50/60 p-3.5 sm:p-4 rounded-2xl border border-amber-200 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">Total Beban Pokok</p>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-amber-900 tracking-tight mt-1 whitespace-nowrap tabular-nums">
                -{rupiah(totalCogs)}
              </h3>
              <p className="text-[11px] font-semibold text-amber-700 mt-0.5 truncate">
                {cogsPctOfGross.toFixed(1)}% dari Omzet Kotor
              </p>
            </div>

            {/* HPP Resep Terjual */}
            <div className="min-w-0 bg-white p-3.5 sm:p-4 rounded-2xl border border-suka-gray-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-600 truncate">HPP Resep (Menu)</p>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </div>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-suka-brown tracking-tight mt-1 whitespace-nowrap tabular-nums">
                -{rupiah(totalHpp)}
              </h3>
              <p className="text-[11px] font-semibold text-emerald-700 mt-0.5 truncate">
                {hppPctOfGross.toFixed(1)}% Bahan Terjual
              </p>
            </div>

            {/* Kerugian Waste */}
            <div className="min-w-0 bg-rose-50/50 p-3.5 sm:p-4 rounded-2xl border border-rose-200/70 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 truncate">Kerugian Waste</p>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              </div>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-rose-600 tracking-tight mt-1 whitespace-nowrap tabular-nums">
                -{rupiah(totalWaste)}
              </h3>
              <p className="text-[11px] font-semibold text-rose-600 mt-0.5 truncate">
                {wastePctOfGross.toFixed(1)}% Basi, Rusak, Kadaluwarsa
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Control */}
        <div className="px-6 pt-4 pb-2 border-b border-suka-gray-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-suka-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('composition')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'composition'
                  ? 'bg-white text-suka-brown shadow-xs'
                  : 'text-suka-gray-500 hover:text-suka-brown'
              }`}
            >
              Komposisi HPP vs Waste
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
                <option value="total">Urut Total Beban</option>
                <option value="hpp">Urut HPP Resep</option>
                <option value="waste">Urut Waste</option>
                <option value="ratio">Urut Rasio HPP %</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-4 max-h-[50vh]">
          {activeTab === 'composition' ? (
            <div className="space-y-4">
              {/* Visual Proportion Bar */}
              <div className="bg-suka-gray-50 p-4 rounded-2xl border border-suka-gray-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-suka-brown">
                  <span>Distribusi Beban Pokok</span>
                  <span>Total: -{rupiah(totalCogs)}</span>
                </div>
                <div className="w-full h-3 bg-suka-gray-200 rounded-full overflow-hidden flex">
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{ width: `${Math.max(1, hppShare)}%` }}
                    title={`HPP Resep: ${hppShare.toFixed(1)}%`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{ width: `${Math.max(0, wasteShare)}%` }}
                    title={`Waste: ${wasteShare.toFixed(1)}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-suka-gray-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    HPP Bahan Resep: {hppShare.toFixed(1)}% (-{rupiah(totalHpp)})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Waste: {wasteShare.toFixed(1)}% (-{rupiah(totalWaste)})
                  </span>
                </div>
              </div>

              {/* Explanatory Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-white border border-suka-gray-200 shadow-2xs space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-suka-brown">HPP Bahan Baku Resep</h4>
                      <p className="text-[10px] text-suka-gray-400">Modal riil pesanan terproses</p>
                    </div>
                  </div>
                  <p className="text-xs text-suka-gray-600 leading-relaxed">
                    Dihitung otomatis dari resep dan HPP riwayat bahan baku pada saat transaksi berlangsung. Hanya mencakup bahan yang benar-benar tersaji ke pelanggan.
                  </p>
                  <div className="pt-2 border-t border-suka-gray-100 flex items-center justify-between text-xs font-bold text-suka-brown">
                    <span>Subtotal HPP Resep</span>
                    <span className="text-amber-900">-{rupiah(totalHpp)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-rose-200/80 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-rose-900">Kerugian Waste Bahan</h4>
                        <p className="text-[10px] text-rose-500">Bahan terbuang / tidak terjual</p>
                      </div>
                    </div>
                    {wasteDetailHref && (
                      <Link
                        href={wasteDetailHref}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 transition-colors"
                      >
                        Log Waste <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-suka-gray-600 leading-relaxed">
                    Akumulasi biaya kerugian bahan yang rusak, tumpah, basi, atau kedaluwarsa di dapur outlet. Dicatat kasir/leader melalui log insiden waste harian.
                  </p>
                  <div className="pt-2 border-t border-rose-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-suka-brown">Subtotal Kerugian Waste</span>
                    <span className="text-rose-600">-{rupiah(totalWaste)}</span>
                  </div>
                </div>
              </div>
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
                        <th className="pb-2.5 text-right">HPP Resep</th>
                        <th className="pb-2.5 text-right">Kerugian Waste</th>
                        <th className="pb-2.5 text-right">Total Beban Pokok</th>
                        <th className="pb-2.5 text-right pr-2">Rasio HPP %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-suka-gray-100 font-medium">
                      {filteredOutlets.map((o) => {
                        const hppRatio = o.gross > 0 ? (o.totalCost / o.gross) * 100 : 0
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
                            <td className="py-2.5 text-right font-bold text-suka-brown">
                              -{rupiah(o.hpp)}
                            </td>
                            <td className="py-2.5 text-right">
                              {o.waste > 0 ? (
                                <span className="font-semibold text-rose-600">
                                  -{rupiah(o.waste)}
                                </span>
                              ) : (
                                <span className="text-suka-gray-300">Rp 0</span>
                              )}
                            </td>
                            <td className="py-2.5 text-right font-black text-amber-950">
                              -{rupiah(o.totalCost)}
                            </td>
                            <td className="py-2.5 text-right pr-2 font-bold text-suka-gray-600">
                              {hppRatio.toFixed(1)}%
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

        {/* Footer Note */}
        <div className="px-6 py-3.5 border-t border-suka-gray-100 bg-suka-gray-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-suka-gray-500">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-suka-gray-400 shrink-0" />
            <span>
              Kerugian waste dipisahkan dari HPP resep agar efisiensi penggunaan bahan baku di dapur dapat dievaluasi secara akurat.
            </span>
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
