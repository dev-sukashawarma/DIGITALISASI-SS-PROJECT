'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  X,
  Sliders,
  Store,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowUpDown,
} from 'lucide-react'
import type { OutletBudgetSummaryItem } from '@/types/budgetMonitoring'

interface Props {
  outlets: OutletBudgetSummaryItem[]
  selectedOutletId: string | null
  onSelectOutlet: (outletId: string) => void
  onOpenConfigModal: (outlet: OutletBudgetSummaryItem) => void
  canManageBudget: boolean
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val)
}

const REGIONS = ['Semua Region', 'Bogor', 'Jakarta', 'Depok', 'Bekasi', 'Tangerang']
const STATUS_FILTERS = [
  { id: 'all', label: 'Semua Status' },
  { id: 'over', label: '🔴 Over Limit' },
  { id: 'warning', label: '🟡 Mendekati Limit' },
  { id: 'safe', label: '🟢 Aman' },
  { id: 'unconfigured', label: '⚪ Belum Diatur' },
]

export function OutletBudgetGrid({
  outlets,
  selectedOutletId,
  onSelectOutlet,
  onOpenConfigModal,
  canManageBudget,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('Semua Region')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortBy, setSortBy] = useState<'percent_desc' | 'sisa_asc' | 'name_asc'>('percent_desc')

  const filteredOutlets = useMemo(() => {
    return outlets
      .filter((o) => {
        // 1. Search
        if (searchTerm.trim() && !o.outletName.toLowerCase().includes(searchTerm.toLowerCase().trim())) {
          return false
        }
        // 2. Region
        if (selectedRegion !== 'Semua Region' && o.region.toLowerCase() !== selectedRegion.toLowerCase()) {
          return false
        }
        // 3. Status
        if (selectedStatus === 'over' && o.percentage <= 100) return false
        if (selectedStatus === 'warning' && (o.percentage < 80 || o.percentage > 100)) return false
        if (selectedStatus === 'safe' && (!o.hasConfig || o.percentage >= 80)) return false
        if (selectedStatus === 'unconfigured' && o.hasConfig) return false

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'percent_desc') {
          return b.percentage - a.percentage
        }
        if (sortBy === 'sisa_asc') {
          return a.sisa - b.sisa
        }
        return a.outletName.localeCompare(b.outletName)
      })
  }, [outlets, searchTerm, selectedRegion, selectedStatus, sortBy])

  return (
    <div className="space-y-4 mb-6">
      {/* Controls Bar: Search, Region, Status, Sort */}
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-suka-brown/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama outlet..."
              className="w-full pl-9 pr-8 py-2 bg-suka-cream/20 border border-suka-brown/15 rounded-xl text-xs text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-brown/40 hover:text-suka-brown"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-suka-brown/50" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-suka-cream/20 border border-suka-brown/15 rounded-xl text-xs font-bold text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange cursor-pointer"
            >
              <option value="percent_desc">Urut: % Pemakaian Tertinggi</option>
              <option value="sisa_asc">Urut: Sisa Saldo Terkecil</option>
              <option value="name_asc">Urut: Nama Outlet (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Region and Status filter chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-suka-brown/5">
          {/* Region chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-[10px] font-bold text-suka-brown/50 uppercase tracking-wider mr-1">Region:</span>
            {REGIONS.map((reg) => (
              <button
                key={reg}
                onClick={() => setSelectedRegion(reg)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedRegion === reg
                    ? 'bg-suka-brown text-white shadow-2xs'
                    : 'bg-suka-cream/40 hover:bg-suka-cream text-suka-brown/70'
                }`}
              >
                {reg}
              </button>
            ))}
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-[10px] font-bold text-suka-brown/50 uppercase tracking-wider mr-1">Status:</span>
            {STATUS_FILTERS.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedStatus === st.id
                    ? 'bg-suka-orange text-white shadow-2xs'
                    : 'bg-suka-cream/40 hover:bg-suka-cream text-suka-brown/70'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Outlet Cards */}
      {filteredOutlets.length === 0 ? (
        <div className="bg-white border border-suka-brown/10 rounded-2xl p-8 text-center">
          <Store className="w-8 h-8 text-suka-brown/30 mx-auto mb-2" />
          <p className="text-xs font-bold text-suka-brown/70">Tidak ada outlet yang cocok dengan filter pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOutlets.map((outlet) => {
            const isSelected = selectedOutletId === outlet.outletId
            const isOver = outlet.hasConfig && outlet.percentage > 100
            const isWarning = outlet.hasConfig && outlet.percentage >= 80 && outlet.percentage <= 100
            const isSafe = outlet.hasConfig && outlet.percentage < 80

            let barColor = 'bg-gray-300'
            let statusBadge = (
              <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                Belum Diatur
              </span>
            )

            if (isOver) {
              barColor = 'bg-red-500'
              statusBadge = (
                <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Over {outlet.percentage.toFixed(0)}%
                </span>
              )
            } else if (isWarning) {
              barColor = 'bg-amber-500'
              statusBadge = (
                <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Waspada {outlet.percentage.toFixed(0)}%
                </span>
              )
            } else if (isSafe) {
              barColor = 'bg-emerald-500'
              statusBadge = (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aman {outlet.percentage.toFixed(0)}%
                </span>
              )
            }

            return (
              <div
                key={outlet.outletId}
                onClick={() => onSelectOutlet(outlet.outletId)}
                className={`bg-white border rounded-2xl p-4 md:p-5 transition-all cursor-pointer relative flex flex-col justify-between group ${
                  isSelected
                    ? 'border-suka-orange ring-2 ring-suka-orange/30 shadow-md bg-suka-cream/10'
                    : 'border-suka-brown/10 hover:border-suka-brown/30 shadow-2xs hover:bg-suka-cream/5'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-suka-cream text-suka-brown/70">
                          {outlet.region}
                        </span>
                        {statusBadge}
                      </div>
                      <h4 className="font-black text-suka-brown text-sm tracking-tight truncate group-hover:text-suka-orange transition-colors">
                        {outlet.outletName}
                      </h4>
                    </div>

                    {canManageBudget && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenConfigModal(outlet)
                        }}
                        className="px-2.5 py-1 rounded-xl bg-suka-cream hover:bg-suka-orange hover:text-white text-suka-brown/70 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Atur</span>
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 mb-3.5">
                    <div className="w-full bg-suka-cream/80 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${barColor}`}
                        style={{ width: `${Math.min(outlet.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Rows */}
                  <div className="grid grid-cols-2 gap-2 bg-suka-cream/30 border border-suka-brown/5 rounded-xl p-2.5 text-xs mb-3">
                    <div>
                      <p className="text-[10px] text-suka-brown/60 font-semibold uppercase">Belanja Terpakai</p>
                      <p className="font-black text-suka-brown font-mono mt-0.5">
                        {formatRupiah(outlet.terpakai)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-suka-brown/60 font-semibold uppercase">Sisa Saldo</p>
                      <p className={`font-black font-mono mt-0.5 ${
                        outlet.sisa < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}>
                        {formatRupiah(outlet.sisa)}
                      </p>
                    </div>
                  </div>

                  {/* Plafon detail row */}
                  <div className="flex items-center justify-between text-[11px] text-suka-brown/70 border-b border-suka-brown/5 pb-2.5">
                    <span>Limit Plafon ({outlet.periodType || 'Belum diatur'}):</span>
                    <strong className="text-suka-brown font-mono font-bold">
                      {outlet.hasConfig ? formatRupiah(outlet.nominal) : 'Rp 0'}
                    </strong>
                  </div>
                </div>

                {/* Card Footer: Auditor info & Click hint */}
                <div className="pt-2.5 flex items-center justify-between text-[10px] text-suka-brown/50 font-medium">
                  {outlet.updatedByStaffName ? (
                    <span className="truncate max-w-[170px]">
                      Disetel: {outlet.updatedByStaffName}
                    </span>
                  ) : (
                    <span>Default sistem</span>
                  )}
                  <span className="font-bold text-suka-orange flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    {isSelected ? 'Riwayat Aktif' : 'Lihat Belanja'} <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
