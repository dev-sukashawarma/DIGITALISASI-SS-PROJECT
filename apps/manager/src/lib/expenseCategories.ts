import {
  Wallet, Users, Award, UserCog, Clock, Megaphone, Star, Tag,
  Droplets, Zap, Wifi, Home, Globe, Building2, type LucideIcon
} from 'lucide-react'

// Kategori operasional cabang untuk Manager (Gaji/Payroll staff dikecualikan karena data sensitif)
export const OUTLET_CATEGORIES = [
  'pengeluaran_outlet',
  'lembur',
  'ads',
  'endorsement',
  'promo',
  'pdam',
  'pln',
  'gas',
  'internet',
  'sewa_outlet',
  'bahan_baku',
  'transport',
  'utilitas',
  'lainnya',
  'joint_expense',
] as const

export const SENSITIVE_SALARY_CATEGORIES = [
  'salary',
  'gaji_crew_outlet',
  'gaji_staff_kantor',
  'bonus_leader',
  'bonus_area_manager',
  'bonus_crew',
  'bonus_regional_manager',
] as const

export const PUSAT_CATEGORIES = ['pengeluaran_global', 'gaji_staff_kantor'] as const
export const INCOME_CATEGORIES = ['pemasukan_lain', 'modal_awal', 'setoran_owner'] as const

export const PENGELUARAN_CATEGORIES = [...OUTLET_CATEGORIES] as const
export const ALL_CATEGORIES = [...OUTLET_CATEGORIES, ...PUSAT_CATEGORIES, ...SENSITIVE_SALARY_CATEGORIES, ...INCOME_CATEGORIES] as const
export type ExpenseCategory = (typeof ALL_CATEGORIES)[number] | (string & {})
export type ExpenseScope = 'outlet' | 'pusat'
export type TransactionType = 'income' | 'expense'

export function isSalaryCategory(category?: string | null): boolean {
  if (!category) return false
  return (SENSITIVE_SALARY_CATEGORIES as readonly string[]).includes(category)
}

/**
 * Mendeteksi apakah suatu transaksi adalah lemburan outlet/petty cash
 * baik dari kategori sistem ('lembur', 'overtime') maupun dari kata kunci deskripsi.
 */
export function isLemburExpense(category?: string | null, description?: string | null): boolean {
  if (!category && !description) return false
  const cat = (category || '').toLowerCase().trim()
  if (cat === 'lembur' || cat === 'overtime') return true
  const d = (description || '').toLowerCase()
  if (d.includes('hpp menu kol') || d.includes('kol -')) return false
  return /\blembur(?:an)?\b/i.test(d) || /\bovertime\b/i.test(d)
}

export const CATEGORY_META: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  pengeluaran_outlet: { label: 'Pengeluaran Outlet', color: '#4b5563', icon: Wallet },
  lembur:             { label: 'Lembur',             color: '#c2410c', icon: Clock },
  ads:                { label: 'Ads',                color: '#2563eb', icon: Megaphone },
  endorsement:        { label: 'Endorsement',        color: '#7c3aed', icon: Star },
  promo:              { label: 'Promo',              color: '#db2777', icon: Tag },
  pdam:               { label: 'PDAM',               color: '#0891b2', icon: Droplets },
  pln:                { label: 'PLN',                color: '#0a7d2c', icon: Zap },
  gas:                { label: 'Gas',                color: '#ea580c', icon: Wallet },
  internet:           { label: 'Internet',           color: '#0d9488', icon: Wifi },
  sewa_outlet:        { label: 'Biaya Sewa Outlet',  color: '#d97706', icon: Home },
  bahan_baku:         { label: 'Bahan Baku Lainnya', color: '#ca8a04', icon: Wallet },
  utilitas:           { label: 'Utilitas',           color: '#0891b2', icon: Zap },
  transport:          { label: 'Transport',          color: '#0369a1', icon: Wallet },
  joint_expense:      { label: 'Joint Expense',      color: '#dc2626', icon: Globe },
  pengeluaran_global: { label: 'Pengeluaran Global', color: '#dc2626', icon: Globe },
  lainnya:            { label: 'Lainnya',            color: '#4b5563', icon: Wallet },
}

export function labelOf(category?: string | null): string {
  if (!category) return '-'
  return CATEGORY_META[category]?.label || category.replace(/_/g, ' ')
}
