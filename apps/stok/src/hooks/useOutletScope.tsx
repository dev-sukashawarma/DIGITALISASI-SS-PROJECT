'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@suka/auth'
import { createClient } from '@/lib/supabase'

export interface BoundOutlet {
  id: string
  name: string
}

interface OutletScopeValue {
  boundOutlets: BoundOutlet[]
  selectedOutletId: string | null
  setSelectedOutletId: (id: string) => void
  isMultiOutlet: boolean
}

const OutletScopeContext = createContext<OutletScopeValue | null>(null)

function storageKey(staffId: string) {
  return `stok:selectedOutletId:${staffId}`
}

interface StaffOutletRow {
  outlet_id: string
  outlets: { id: string; name: string } | null
}

export function OutletScopeProvider({ children }: { children: ReactNode }) {
  const { outletStaff } = useAuth()
  const staffId = outletStaff?.id
  const isLeader = outletStaff?.role === 'leader'

  const { data: fetchedOutlets = [] } = useQuery({
    queryKey: ['staff_outlets', staffId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('staff_outlets')
        .select('outlet_id, outlets(id, name)')
        .eq('staff_id', staffId)
      if (error) throw error
      return ((data ?? []) as unknown as StaffOutletRow[])
        .filter((row) => row.outlets)
        .map((row) => ({ id: row.outlets!.id, name: row.outlets!.name }))
    },
    enabled: isLeader && !!staffId,
    staleTime: 5 * 60 * 1000,
  })

  const boundOutlets = useMemo<BoundOutlet[]>(() => {
    if (isLeader) return fetchedOutlets
    if (!outletStaff?.outlet_id) return []
    return [{ id: outletStaff.outlet_id, name: outletStaff.outlets?.name ?? '' }]
  }, [isLeader, fetchedOutlets, outletStaff?.outlet_id, outletStaff?.outlets?.name])

  const [selectedOutletId, setSelectedOutletIdState] = useState<string | null>(null)

  useEffect(() => {
    if (!staffId || boundOutlets.length === 0) return
    if (!isLeader) {
      setSelectedOutletIdState(boundOutlets[0].id)
      return
    }
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey(staffId)) : null
    const validStored = stored && boundOutlets.some((o) => o.id === stored) ? stored : null
    setSelectedOutletIdState(validStored ?? boundOutlets[0].id)
  }, [staffId, isLeader, boundOutlets])

  const setSelectedOutletId = (id: string) => {
    if (!boundOutlets.some((o) => o.id === id)) return
    setSelectedOutletIdState(id)
    if (staffId && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(staffId), id)
    }
  }

  const value: OutletScopeValue = {
    boundOutlets,
    selectedOutletId,
    setSelectedOutletId,
    isMultiOutlet: isLeader && boundOutlets.length > 1,
  }

  return <OutletScopeContext.Provider value={value}>{children}</OutletScopeContext.Provider>
}

export function useOutletScope() {
  const ctx = useContext(OutletScopeContext)
  if (!ctx) throw new Error('useOutletScope must be used within OutletScopeProvider')
  return ctx
}
