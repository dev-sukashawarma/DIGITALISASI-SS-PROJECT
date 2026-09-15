'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getVoidOrders } from '../app/actions/cancellations'
import { getPendingWasteReports } from '../app/actions/waste'
import { getPendingReturRequests, type ReturApprovalItem } from '../app/actions/retur'
import { createSupabaseBrowserClient } from '@suka/auth'

export type VoidRequest = {
  id: string
  order_id: string
  reason: string
  status: string
  created_at: string
  token: string
  order_number: string
  customer_name: string
  total_amount: number
  outlet_name: string
  requester_name: string
  order_items?: {
    menu_item_name: string;
    quantity: number;
    subtotal: number;
  }[];
}

interface ApprovalsContextType {
  pendingRequests: VoidRequest[]
  pendingWasteCount: number
  pendingReturRequests: ReturApprovalItem[]
  pendingReturCount: number
  loading: boolean
  refreshApprovals: () => Promise<void>
  refreshWasteCount: () => Promise<void>
  refreshReturApprovals: () => Promise<void>
}

const ApprovalsContext = createContext<ApprovalsContextType>({
  pendingRequests: [],
  pendingWasteCount: 0,
  pendingReturRequests: [],
  pendingReturCount: 0,
  loading: true,
  refreshApprovals: async () => {},
  refreshWasteCount: async () => {},
  refreshReturApprovals: async () => {},
})

export const useApprovals = () => useContext(ApprovalsContext)

export function ApprovalsProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createSupabaseBrowserClient())
  const [pendingRequests, setPendingRequests] = useState<VoidRequest[]>([])
  const [pendingWasteCount, setPendingWasteCount] = useState<number>(0)
  const [pendingReturRequests, setPendingReturRequests] = useState<ReturApprovalItem[]>([])
  const [loading, setLoading] = useState(true)

  const refreshApprovals = useCallback(async () => {
    try {
      const res = await getVoidOrders()
      if (res.success) {
        setPendingRequests(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch void approvals', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshWasteCount = useCallback(async () => {
    try {
      const res = await getPendingWasteReports()
      if (res.success && res.data) {
        setPendingWasteCount(res.data.length)
      }
    } catch (err) {
      console.error('Failed to fetch pending waste count', err)
    }
  }, [])

  const refreshReturApprovals = useCallback(async () => {
    try {
      const res = await getPendingReturRequests()
      if (res.success && res.data) {
        setPendingReturRequests(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch pending retur approvals', err)
    }
  }, [])

  useEffect(() => {
    refreshApprovals()
    refreshWasteCount()
    refreshReturApprovals()

    if (!supabase) return

    // Subscribe to realtime changes in cancellation_requests, stok_waste_reports, and retur_stok tables
    const channel = supabase
      .channel('manager-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cancellation_requests' },
        () => {
          refreshApprovals()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stok_waste_reports' },
        () => {
          refreshWasteCount()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'retur_stok' },
        () => {
          refreshReturApprovals()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshApprovals, refreshWasteCount, refreshReturApprovals, supabase])

  return (
    <ApprovalsContext.Provider
      value={{
        pendingRequests,
        pendingWasteCount,
        pendingReturRequests,
        pendingReturCount: pendingReturRequests.length,
        loading,
        refreshApprovals,
        refreshWasteCount,
        refreshReturApprovals,
      }}
    >
      {children}
    </ApprovalsContext.Provider>
  )
}
