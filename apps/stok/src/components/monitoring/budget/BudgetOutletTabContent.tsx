'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@suka/auth'
import { useAllOutletsBudgetStatus } from '@/hooks/useOutletBudget'
import { OutletBudgetSummaryCards } from './OutletBudgetSummaryCards'
import { OutletBudgetGrid } from './OutletBudgetGrid'
import { OutletSpendingHistory } from './OutletSpendingHistory'
import { OutletTopUpRequests } from './OutletTopUpRequests'
import { OutletBudgetConfigModal } from './OutletBudgetConfigModal'
import { SpendingDetailModal } from './SpendingDetailModal'
import type { OutletBudgetSummaryItem, OutletSpendingTransaction } from '@/types/budgetMonitoring'
import { RefreshCw, WalletCards } from 'lucide-react'

export function BudgetOutletTabContent() {
  const { outletStaff } = useAuth()
  const { outlets, loading, error, refresh } = useAllOutletsBudgetStatus()

  // Selected outlet for spending history
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null)

  // Modals state
  const [configModalOutlet, setConfigModalOutlet] = useState<OutletBudgetSummaryItem | null>(null)
  const [detailModalTx, setDetailModalTx] = useState<OutletSpendingTransaction | null>(null)

  // Determine if user can edit budget (Admin, Owner, Admin Finance)
  const canManageBudget =
    outletStaff?.role === 'owner' ||
    outletStaff?.role === 'admin' ||
    outletStaff?.role === 'admin_finance'

  // Auto-select first outlet if none selected
  useEffect(() => {
    if (!selectedOutletId && outlets.length > 0) {
      setSelectedOutletId(outlets[0].outletId)
    }
  }, [outlets, selectedOutletId])

  const selectedOutlet = outlets.find((o) => o.outletId === selectedOutletId) || null

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-150">
      {/* Top Section Header with Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-suka-brown/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-suka-orange flex items-center justify-center text-white shadow-xs">
              <WalletCards className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-suka-brown tracking-tight">
                Plafon & Belanja Outlet
              </h2>
              <p className="text-xs text-suka-brown/60">
                Monitoring limit anggaran, realisasi belanja bahan baku, dan riwayat pesanan per outlet.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white border border-suka-brown/15 hover:bg-suka-cream/30 text-suka-brown text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && outlets.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-suka-brown/60">Memuat data plafon seluruh outlet...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">
          Terjadi kesalahan saat memuat data: {error}
        </div>
      ) : (
        <>
          {/* 1. Global Summary Metric Cards */}
          <OutletBudgetSummaryCards outlets={outlets} />

          {/* 2. Grid of Outlet Status Cards */}
          <OutletBudgetGrid
            outlets={outlets}
            selectedOutletId={selectedOutletId}
            onSelectOutlet={(id) => setSelectedOutletId(id)}
            onOpenConfigModal={(outlet) => setConfigModalOutlet(outlet)}
            canManageBudget={canManageBudget}
          />

          {/* 3. Top-Up Requests for Selected Outlet */}
          {selectedOutletId && (
            <OutletTopUpRequests outletId={selectedOutletId} />
          )}

          {/* 4. Spending History Feed for Selected Outlet */}
          <OutletSpendingHistory
            selectedOutlet={selectedOutlet}
            onViewDetail={(tx) => setDetailModalTx(tx)}
          />
        </>
      )}

      {/* Modals */}
      <OutletBudgetConfigModal
        outlet={configModalOutlet}
        onClose={() => setConfigModalOutlet(null)}
        onSuccess={() => refresh()}
      />

      <SpendingDetailModal
        transaction={detailModalTx}
        onClose={() => setDetailModalTx(null)}
      />
    </div>
  )
}
