'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getVoidOrders } from '../app/actions/cancellations'
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
  loading: boolean
  refreshApprovals: () => Promise<void>
}

const ApprovalsContext = createContext<ApprovalsContextType>({
  pendingRequests: [],
  loading: true,
  refreshApprovals: async () => {},
})

export const useApprovals = () => useContext(ApprovalsContext)

export function ApprovalsProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createSupabaseBrowserClient())
  const [pendingRequests, setPendingRequests] = useState<VoidRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refreshApprovals = useCallback(async () => {
    try {
      const res = await getVoidOrders()
      if (res.success) {
        setPendingRequests(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch approvals', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshApprovals()
    
    if (!supabase) return;
    
    // Subscribe to realtime changes in cancellation_requests table
    const channel = supabase
      .channel('manager-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cancellation_requests' },
        () => {
          // Whenever there's any change, just refresh the list
          refreshApprovals()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshApprovals, supabase])

  return (
    <ApprovalsContext.Provider value={{ pendingRequests, loading, refreshApprovals }}>
      {children}
    </ApprovalsContext.Provider>
  )
}
