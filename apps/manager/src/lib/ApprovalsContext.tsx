'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getVoidOrders } from '../app/actions/cancellations'
import { createClient } from '@supabase/supabase-js'

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
    
    // Subscribe to realtime changes in cancellation_requests table
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
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
  }, [refreshApprovals])

  return (
    <ApprovalsContext.Provider value={{ pendingRequests, loading, refreshApprovals }}>
      {children}
    </ApprovalsContext.Provider>
  )
}
