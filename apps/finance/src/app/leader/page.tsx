'use client'

import React, { useMemo } from 'react'
import { Card } from '@suka/design-system'
import { useAuth } from '@suka/auth'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { useCashOverview } from '@/hooks/useCashData'
import { Loader2 } from 'lucide-react'

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

export default function LeaderDashboardPage() {
  const { outletStaff } = useAuth()
  
  // 1. Fetch all requests
  const { data: topupRequests, isLoading: isLoadingTopups } = usePettyCashRequests()
  
  // 2. Fetch cash locations (to get plafon & sisa saldo)
  const { locations, isLoading: isLoadingLocations } = useCashOverview()

  // Filter requests based on outlet id if outletStaff exists
  const myOutletId = outletStaff?.outlet_id

  const outletRequests = useMemo(() => {
    if (!topupRequests) return []
    // If the staff has an outlet, only show theirs, else show all
    if (myOutletId) {
      return topupRequests.filter(req => req.outlet?.id === myOutletId)
    }
    return topupRequests
  }, [topupRequests, myOutletId])

  // Calculate Request Top Up Pending
  const pendingRequests = useMemo(() => {
    return outletRequests.filter(req => req.status === 'pending')
  }, [outletRequests])

  // Calculate Total Pengeluaran Hari Ini (approved requests today)
  const totalPengeluaranHariIni = useMemo(() => {
    const today = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'
    return outletRequests
      .filter(req => {
        const isApproved = ['approved', 'approved_by_finance', 'completed'].includes(req.status)
        const isToday = req.created_at.startsWith(today)
        return isApproved && isToday
      })
      .reduce((sum, req) => sum + req.amount, 0)
  }, [outletRequests])

  // Get Sisa Saldo Petty Cash & Plafon
  const pettyCashInfo = useMemo(() => {
    if (!locations) return { saldo: 0, plafon: 0 }
    // Filter for current outlet if possible, and kind 'cash'
    let cashLocs = locations.filter(loc => loc.kind === 'cash')
    if (myOutletId) {
      cashLocs = cashLocs.filter(loc => loc.outlet_id === myOutletId)
    }
    
    // Fallback to first if not found
    const cashLoc = cashLocs[0]
    return {
      saldo: cashLoc?.saldo || 0,
      plafon: cashLoc?.opening_balance || 0
    }
  }, [locations, myOutletId])

  const isLoading = isLoadingTopups || isLoadingLocations

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Overview Leader</h1>
        <p className="text-suka-gray-500 mt-1">Ringkasan aktivitas dan metrik shift hari ini.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-suka-orange" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-sm font-medium text-suka-gray-500">Request Top Up Pending</h3>
            <p className="text-3xl font-bold text-suka-brown mt-2">{pendingRequests.length}</p>
            <div className="mt-4">
              {pendingRequests.length > 0 ? (
                <span className="text-xs text-suka-orange font-medium bg-orange-50 px-2 py-1 rounded-full">
                  Menunggu Approval
                </span>
              ) : (
                <span className="text-xs text-suka-gray-500 font-medium bg-suka-gray-50 px-2 py-1 rounded-full">
                  Tidak ada request
                </span>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-suka-gray-500">Total Pengeluaran Hari Ini</h3>
            <p className="text-3xl font-bold text-suka-brown mt-2">{formatCurrency(totalPengeluaranHariIni)}</p>
            <p className="text-xs text-suka-gray-500 mt-2">Berdasarkan request yang disetujui</p>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-suka-gray-500">Sisa Saldo Petty Cash (Estimasi)</h3>
            <p className="text-3xl font-bold text-suka-brown mt-2">{formatCurrency(pettyCashInfo.saldo)}</p>
            <p className="text-xs text-suka-gray-500 mt-2">Plafon: {formatCurrency(pettyCashInfo.plafon)}</p>
          </Card>
        </div>
      )}
    </div>
  )
}
