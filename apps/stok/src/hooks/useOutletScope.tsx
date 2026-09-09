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

export function OutletScopeProvider({ children }: { children: ReactNode }) {
  const { outletStaff } = useAuth()
  const staffId = outletStaff?.id
  const role = (outletStaff?.role as string) ?? ''
  const isLeader = role === 'leader'
  const isPrivileged = ['admin', 'admin_hr', 'spv', 'kitchen', 'admin_finance', 'finance', 'purchasing', 'owner'].includes(role)
  const isKitchen = ['kitchen', 'admin_finance', 'purchasing', 'finance'].includes(role)

  const { data: fetchedOutlets = [] } = useQuery({
    queryKey: ['staff_outlets', staffId, role, isKitchen, isPrivileged, isLeader],
    queryFn: async () => {
      const supabase = createClient()
      
      if (isPrivileged) {
        // Outlet tes SENGAJA tidak disaring di sini. Ini OutletSwitcher —
        // pintu masuk developer untuk menjalankan pengujian (opname, mutasi,
        // permintaan) di outlet tes. Yang harus bersih adalah PERHITUNGAN,
        // dan itu sudah ditutup di sisi basis data (migration 20300131/32/33)
        // serta di daftar master `fetchOutletsList`. Lihat
        // `@/lib/outletFilters`.
        const { data, error } = await supabase
          .from('outlets')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        if (error) throw error
        return (data || []) as BoundOutlet[]
      }

      // 1. Fetch assigned outlet IDs from staff_outlets
      const { data: soData, error: soError } = await supabase
        .from('staff_outlets')
        .select('outlet_id')
        .eq('staff_id', staffId)
      if (soError) throw soError

      const assignedIds = new Set<string>((soData ?? []).map((s: { outlet_id: string }) => s.outlet_id).filter(Boolean))
      if (outletStaff?.outlet_id) {
        assignedIds.add(outletStaff.outlet_id)
      }

      // If regional_manager has no specific entries in staff_outlets, fallback to all active outlets
      if (role === 'regional_manager' && assignedIds.size === 0) {
        const { data, error } = await supabase
          .from('outlets')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        if (error) throw error
        return (data || []) as BoundOutlet[]
      }

      // 2. Fetch outlet details using .in('id', ...) to avoid missing FK relation in PostgREST
      let assigned: BoundOutlet[] = []
      if (assignedIds.size > 0) {
        const { data: outletsData, error: outletsError } = await supabase
          .from('outlets')
          .select('id, name')
          .in('id', Array.from(assignedIds))
          .eq('is_active', true)
          .order('name')
        if (outletsError) throw outletsError
        assigned = (outletsData || []) as BoundOutlet[]
      }

      // Ensure primary outlet is always in the list
      if (outletStaff?.outlet_id && !assigned.some(o => o.id === outletStaff.outlet_id)) {
        assigned = [{ id: outletStaff.outlet_id, name: outletStaff.outlets?.name ?? '' }, ...assigned]
      }

      // Ensure Gudang is available for kitchen staff
      const isWorkingInKitchen = isKitchen || outletStaff?.outlets?.name?.toUpperCase().includes('KITCHEN');
      if (isWorkingInKitchen && !assigned.some(o => o.name.toUpperCase().includes('GUDANG'))) {
         const { data: gudangData } = await supabase
           .from('outlets')
           .select('id, name')
           .ilike('name', '%GUDANG%')
           .limit(1)
           .single()
         if (gudangData) {
            assigned = [...assigned, gudangData]
         }
      }
      return assigned
    },
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000,
  })

  const boundOutlets = useMemo<BoundOutlet[]>(() => {
    if (fetchedOutlets && fetchedOutlets.length > 0) return fetchedOutlets
    if (!outletStaff?.outlet_id) return []
    return [{ id: outletStaff.outlet_id, name: outletStaff.outlets?.name ?? '' }]
  }, [fetchedOutlets, outletStaff?.outlet_id, outletStaff?.outlets?.name])

  const [selectedOutletId, setSelectedOutletIdState] = useState<string | null>(null)

  useEffect(() => {
    if (!staffId || boundOutlets.length === 0) return

    let defaultId = boundOutlets[0].id
    if (outletStaff?.outlet_id && boundOutlets.some(o => o.id === outletStaff.outlet_id)) {
      defaultId = outletStaff.outlet_id
    } else {
      const isWorkingInKitchen = isKitchen || outletStaff?.outlets?.name?.toUpperCase().includes('KITCHEN');
      if (isPrivileged || isWorkingInKitchen) {
        const gudang = boundOutlets.find(o => o.name.toUpperCase().includes('GUDANG'));
        if (gudang) {
          defaultId = gudang.id;
        }
      }
    }

    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey(staffId)) : null
    const validStored = stored && boundOutlets.some((o) => o.id === stored) ? stored : null
    setSelectedOutletIdState(validStored ?? defaultId)
  }, [staffId, isPrivileged, isKitchen, boundOutlets, outletStaff?.outlet_id, outletStaff?.outlets?.name])

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
    isMultiOutlet: boundOutlets.length > 1,
  }

  return <OutletScopeContext.Provider value={value}>{children}</OutletScopeContext.Provider>
}

export function useOutletScope() {
  const ctx = useContext(OutletScopeContext)
  if (!ctx) throw new Error('useOutletScope must be used within OutletScopeProvider')
  return ctx
}
