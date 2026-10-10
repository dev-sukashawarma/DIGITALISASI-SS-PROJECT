'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  TrendingUp,
  Search,
  HelpCircle
} from 'lucide-react'
import { rupiah } from '@/lib/format'
import { ChannelLogo } from './ChannelLogo'

export interface SalesChannelItem {
  key: string
  label: string
  gross: number
  deductions: number
  net: number
  orderCount?: number
}

export interface SalesOutletItem {
  id: string
  name: string
  gross: number
  deductions: number
  net: number
  isMitra?: boolean
}

interface GrossSalesBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  periodLabel: string
  scopeLabel: string
  grossRevenue: number
  totalDeductions: number
  netRevenue: number
  managementFeeReceived?: number
  mitraHppMarginReceived?: number
  channels: SalesChannelItem[]
  outlets: SalesOutletItem[]
}

export function GrossSalesBreakdownModal({
  isOpen,
  onClose,
  periodLabel,
  scopeLabel,
  grossRevenue,
  totalDeductions,
  netRevenue,
  managementFeeReceived = 0,
  mitraHppMarginReceived = 0,
  channels,
  outlets,
}: GrossSalesBreakdownModalProps) {
  const [activeTab, setActiveTab] = useState<'channel' | 'outlet'>('channel')
  const [outletQuery, setOutletQuery] = useState('')
  const [outletSort, setOutletSort] = useState<'gross' | 'deductions' | 'net'>('gross')

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
      if (outletSort === 'deductions') return b.deductions - a.deductions
      if (outletSort === 'net') return b.net - a.net
      return b.gross - a.gross
    })
  }, [outlets, outletQuery, outletSort])

  if (!isOpen) return null

  const hasPartnershipIncome = managementFeeReceived > 0 || mitraHppMarginReceived > 0
  const deductionPct = grossRevenue > 0 ? (totalDeductions / grossRevenue) * 100 : 0
  const netPct = grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rincian Omzet Penjualan"
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-suka-gray-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-suka-gray-100 bg-suka-gray-50/70">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-orange-100/80 flex items-center justify-center text-orange-600 shadow-2xs">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-suka-brown tracking-tight">Rincian Omzet Penjualan</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  Gross Sales
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

        {/* Top Summary Cards (Fixed line-wrapping & clean layout) */}
        <div className="p-5 sm:p-6 bg-gradient-to-b from-suka-gray-50/40 to-white border-b border-suka-gray-100">
          <div className={`grid grid-cols-1 ${hasPartnershipIncome ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 sm:gap-3.5`}>
            {/* Omzet Kotor */}
            <div className="min-w-0 bg-white p-3.5 sm:p-4 rounded-2xl border border-suka-gray-200/80 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-500 truncate">Omzet Kotor (Gross)</p>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-suka-brown tracking-tight mt-1 whitespace-nowrap tabular-nums">
                {rupiah(grossRevenue)}
              </h3>
              <p className="text-[11px] font-semibold text-suka-gray-400 mt-1 truncate">100% Nilai Menu Pesanan</p>
            </div>

            {/* Admin Fee (Fixed nowrap for - sign) */}
            <div className="min-w-0 bg-rose-50/50 p-3.5 sm:p-4 rounded-2xl border border-rose-200/70 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 truncate">Admin Fee</p>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-rose-600 tracking-tight mt-1 whitespace-nowrap tabular-nums">
                -{rupiah(totalDeductions)}
              </h3>
              <p className="text-[11px] font-semibold text-rose-500 mt-1 truncate">
                {deductionPct.toFixed(1)}% Promo & Komisi Platform
              </p>
            </div>

            {/* Omzet Bersih Masuk */}
            <div className="min-w-0 bg-emerald-50/50 p-3.5 sm:p-4 rounded-2xl border border-emerald-200/70 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 truncate">Net Diterima (Bersih)</p>
              <h3 className="text-base sm:text-lg xl:text-xl font-black text-emerald-800 tracking-tight mt-1 whitespace-nowrap tabular-nums">
                {rupiah(netRevenue)}
              </h3>
              <p className="text-[11px] font-semibold text-emerald-600 mt-1 truncate">
                {netPct.toFixed(1)}% Dana Riil Masuk
              </p>
            </div>

            {/* Pendapatan Kemitraan (jika ada) */}
            {hasPartnershipIncome && (
              <div className="min-w-0 bg-blue-50/50 p-3.5 sm:p-4 rounded-2xl border border-blue-200/70 shadow-2xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 truncate">Fee & Margin Mitra</p>
                <h3 className="text-base sm:text-lg xl:text-xl font-black text-blue-800 tracking-tight mt-1 whitespace-nowrap tabular-nums">
                  +{rupiah(managementFeeReceived + mitraHppMarginReceived)}
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-blue-600 font-semibold mt-1 truncate">
                  {managementFeeReceived > 0 && <span>Fee: {rupiah(managementFeeReceived)}</span>}
                  {mitraHppMarginReceived > 0 && <span>Margin: {rupiah(mitraHppMarginReceived)}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Control */}
        <div className="px-6 pt-4 pb-2.5 border-b border-suka-gray-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-suka-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('channel')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'channel'
                  ? 'bg-white text-suka-brown shadow-xs border border-suka-gray-200/50'
                  : 'text-suka-gray-500 hover:text-suka-brown'
              }`}
            >
              Rincian Saluran ({channels.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('outlet')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'outlet'
                  ? 'bg-white text-suka-brown shadow-xs border border-suka-gray-200/50'
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
                  className="pl-8 pr-3 py-1.5 text-xs border border-suka-gray-200 rounded-xl focus:outline-hidden focus:border-suka-orange w-36 sm:w-52"
                />
              </div>
              <select
                value={outletSort}
                onChange={(e) => setOutletSort(e.target.value as any)}
                className="text-xs border border-suka-gray-200 rounded-xl px-2.5 py-1.5 font-semibold text-suka-brown focus:outline-hidden cursor-pointer"
              >
                <option value="gross">Urut Omzet Kotor</option>
                <option value="deductions">Urut Admin Fee</option>
                <option value="net">Urut Omzet Net</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 max-h-[52vh]">
          {activeTab === 'channel' ? (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-suka-gray-200 text-suka-gray-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pl-3">Saluran Penjualan</th>
                      <th className="pb-3 text-right">Omzet Kotor</th>
                      <th className="pb-3 text-right">Admin Fee</th>
                      <th className="pb-3 text-right">Net Diterima</th>
                      <th className="pb-3 text-right pr-3">Porsi Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium">
                    {channels.map((ch) => {
                      const sharePct = grossRevenue > 0 ? (ch.gross / grossRevenue) * 100 : 0

                      return (
                        <tr key={ch.key} className="hover:bg-suka-gray-50/80 transition-colors group">
                          {/* Channel Logo & Label */}
                          <td className="py-3 pl-3">
                            <div className="flex items-center gap-3">
                              {/* Official Brand Logo */}
                              <ChannelLogo channelKey={ch.key} size="md" />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-suka-brown text-sm tracking-tight group-hover:text-suka-orange transition-colors">
                                  {ch.label}
                                </span>
                                {ch.orderCount ? (
                                  <span className="text-[11px] text-suka-gray-400 font-medium mt-0.5">
                                    {ch.orderCount.toLocaleString('id-ID')} pesanan
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          {/* Omzet Kotor */}
                          <td className="py-3 text-right font-bold text-suka-brown text-sm tabular-nums">
                            {rupiah(ch.gross)}
                          </td>

                          {/* Potongan Merchant */}
                          <td className="py-3 text-right font-semibold text-sm tabular-nums whitespace-nowrap">
                            {ch.deductions > 0 ? (
                              <span className="text-rose-600 font-bold">
                                -{rupiah(ch.deductions)}
                              </span>
                            ) : (
                              <span className="text-suka-gray-300">Rp 0</span>
                            )}
                          </td>

                          {/* Net Diterima */}
                          <td className="py-3 text-right font-black text-emerald-700 text-sm tabular-nums whitespace-nowrap">
                            {rupiah(ch.net)}
                          </td>

                          {/* Porsi Omzet Progress Bar */}
                          <td className="py-3 text-right pr-3">
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="font-bold text-xs text-suka-brown tabular-nums">
                                {sharePct.toFixed(1)}%
                              </span>
                              <div className="w-20 h-1.5 bg-suka-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-suka-orange rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Math.max(2, sharePct))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-suka-brown/20 bg-suka-cream/40 font-black text-sm text-suka-brown">
                      <td className="py-3.5 pl-3">
                        <span className="uppercase tracking-wider font-black text-xs text-suka-brown">
                          TOTAL KESELURUHAN
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-black tabular-nums">{rupiah(grossRevenue)}</td>
                      <td className="py-3.5 text-right font-black text-rose-600 tabular-nums whitespace-nowrap">
                        {totalDeductions > 0 ? `-${rupiah(totalDeductions)}` : 'Rp 0'}
                      </td>
                      <td className="py-3.5 text-right font-black text-emerald-800 tabular-nums whitespace-nowrap">
                        {rupiah(netRevenue)}
                      </td>
                      <td className="py-3.5 text-right pr-3 font-black">100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOutlets.length === 0 ? (
                <div className="text-center py-10 text-suka-gray-400 text-xs">
                  Tidak ditemukan outlet yang sesuai dengan kata kunci pencarian.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-suka-gray-200 text-suka-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 pl-3">Outlet</th>
                        <th className="pb-3 text-right">Omzet Kotor</th>
                        <th className="pb-3 text-right">Admin Fee</th>
                        <th className="pb-3 text-right">Net Diterima</th>
                        <th className="pb-3 text-right pr-3">Kontribusi %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-suka-gray-100 font-medium">
                      {filteredOutlets.map((o) => {
                        const sharePct = grossRevenue > 0 ? (o.gross / grossRevenue) * 100 : 0
                        return (
                          <tr key={o.id} className="hover:bg-suka-gray-50/80 transition-colors">
                            <td className="py-3 pl-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-suka-brown text-sm">{o.name}</span>
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                    o.isMitra
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {o.isMitra ? 'Mitra' : 'Pusat'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-right font-bold text-suka-brown text-sm tabular-nums">
                              {rupiah(o.gross)}
                            </td>
                            <td className="py-3 text-right font-semibold text-rose-600 text-sm tabular-nums whitespace-nowrap">
                              {o.deductions > 0 ? `-${rupiah(o.deductions)}` : <span className="text-suka-gray-300">Rp 0</span>}
                            </td>
                            <td className="py-3 text-right font-black text-emerald-700 text-sm tabular-nums whitespace-nowrap">
                              {rupiah(o.net)}
                            </td>
                            <td className="py-3 text-right pr-3 font-bold text-suka-gray-600 text-xs tabular-nums">
                              {sharePct.toFixed(1)}%
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

        {/* Footer Note & Button */}
        <div className="px-6 py-4 border-t border-suka-gray-100 bg-suka-gray-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-suka-gray-500">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-suka-gray-400 shrink-0" />
            <span>
              <strong>Omzet Kotor (Gross)</strong> adalah total nilai menu sebelum potongan promo. 
              <strong> Net Diterima</strong> adalah dana penjualan bersih setelah dikurangi potongan diskon / promo toko merchant.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-suka-brown text-white text-xs font-bold rounded-xl hover:bg-suka-brown/90 transition-all self-end sm:self-auto cursor-pointer shadow-2xs active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
