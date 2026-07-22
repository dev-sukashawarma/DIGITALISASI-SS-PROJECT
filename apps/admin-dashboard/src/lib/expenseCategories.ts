import { Wallet, Users, Award, UserCog, Clock, Megaphone, Star, Tag,
  Droplets, Zap, Wifi, Home, Globe, Building2, type LucideIcon } from 'lucide-react'

export const OUTLET_CATEGORIES = [
  'pengeluaran_outlet', 'gaji_crew_outlet', 'bonus_leader', 'bonus_area_manager',
  'lembur', 'ads', 'endorsement', 'promo', 'pdam', 'pln', 'internet', 'sewa_outlet',
] as const
export const PUSAT_CATEGORIES = ['pengeluaran_global', 'gaji_staff_kantor'] as const

export const EXPENSE_CATEGORIES = [...OUTLET_CATEGORIES, ...PUSAT_CATEGORIES] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type ExpenseScope = 'outlet' | 'pusat'

const PUSAT_SET = new Set<string>(PUSAT_CATEGORIES)
export function deriveScope(category: string): ExpenseScope {
  return PUSAT_SET.has(category) ? 'pusat' : 'outlet'
}

export const CATEGORY_META: Record<ExpenseCategory, { label: string; color: string; icon: LucideIcon }> = {
  pengeluaran_outlet: { label: 'Pengeluaran Outlet', color: '#4b5563', icon: Wallet },
  gaji_crew_outlet:   { label: 'Gaji Crew Outlet',   color: '#701604', icon: Users },
  bonus_leader:       { label: 'Bonus Leader',       color: '#b45309', icon: Award },
  bonus_area_manager: { label: 'Bonus Area Manager', color: '#92400e', icon: UserCog },
  lembur:             { label: 'Lembur',             color: '#c2410c', icon: Clock },
  ads:                { label: 'Ads',                color: '#2563eb', icon: Megaphone },
  endorsement:        { label: 'Endorsement',        color: '#7c3aed', icon: Star },
  promo:              { label: 'Promo',              color: '#db2777', icon: Tag },
  pdam:               { label: 'PDAM',               color: '#0891b2', icon: Droplets },
  pln:                { label: 'PLN',                color: '#0a7d2c', icon: Zap },
  internet:           { label: 'Internet',           color: '#0d9488', icon: Wifi },
  sewa_outlet:        { label: 'Biaya Sewa Outlet',  color: '#d97706', icon: Home },
  pengeluaran_global: { label: 'Pengeluaran Global', color: '#dc2626', icon: Globe },
  gaji_staff_kantor:  { label: 'Gaji Staff Kantor',  color: '#9f1239', icon: Building2 },
}
