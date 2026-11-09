'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Role pemakai layar master data, HURUF BESAR ('ADMIN' | 'OWNER' | 'PURCHASING' | ...).
 * Disediakan app pemakai: admin-dashboard dari RoleContext-nya, finance dari outlet_staff.role.
 * Layar hanya menyembunyikan tombol; penjaga sesungguhnya ada di RPC (_peran_master).
 */
/** Alamat halaman di app pemakai (admin & finance memasang layar ini di rute berbeda). */
export interface RuteMasterData {
  bahanBaku: string
  supplier: string
  buatPo: string
}

const RUTE_ADMIN: RuteMasterData = {
  bahanBaku: '/dashboard/bahan-baku',
  supplier: '/dashboard/pembelian/supplier',
  buatPo: '/dashboard/pembelian/new',
}

const PeranContext = createContext<{ role: string | null; rute: RuteMasterData }>({ role: null, rute: RUTE_ADMIN })

export function MasterDataProvider({ role, rute = RUTE_ADMIN, children }: {
  role: string | null
  rute?: RuteMasterData
  children: ReactNode
}) {
  return <PeranContext.Provider value={{ role, rute }}>{children}</PeranContext.Provider>
}

/** Pengganti useRole() admin-dashboard di dalam paket. */
export function useRole(): { role: string | null } {
  return { role: useContext(PeranContext).role }
}

export function useRuteMasterData(): RuteMasterData {
  return useContext(PeranContext).rute
}

/** Petakan role outlet_staff (huruf kecil) ke role layar master data. */
export function peranDariStaff(role: string | null | undefined): string | null {
  if (!role) return null
  const r = role.toLowerCase()
  if (r === 'admin' || r === 'developer') return 'ADMIN'
  if (r === 'purchase') return 'PURCHASING'
  return r.toUpperCase()
}
