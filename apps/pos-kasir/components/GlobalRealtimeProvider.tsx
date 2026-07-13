'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function GlobalRealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()

    // Listen to all changes on the public schema
    const channel = supabase
      .channel('global-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          console.log(`[Realtime] Table ${payload.table} changed. Invalidating queries...`)
          
          // Invalidate the specific table name in react-query
          // Most query keys start with the table name (e.g., ['petty_cash_topups'])
          queryClient.invalidateQueries({ queryKey: [payload.table] })
        }
      )
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Global subscriber connected successfully.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // This is a completely invisible component, it just wraps or sits alongside the tree
  return <>{children}</>
}
