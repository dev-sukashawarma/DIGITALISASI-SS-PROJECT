'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

export function GlobalRealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const timeouts = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    // Listen to all changes on the public schema
    const channel = supabase
      .channel('global-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          const table = payload.table
          if (!table) return

          console.log(`[Realtime] Table ${table} changed. Invalidating queries...`)
          
          if (timeouts.current[table]) {
            clearTimeout(timeouts.current[table])
          }
          
          timeouts.current[table] = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: [table] })
          }, 300)
        }
      )
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Global subscriber connected successfully.')
        }
      })

    return () => {
      Object.values(timeouts.current).forEach(clearTimeout)
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // This is a completely invisible component, it just wraps or sits alongside the tree
  return <>{children}</>
}
