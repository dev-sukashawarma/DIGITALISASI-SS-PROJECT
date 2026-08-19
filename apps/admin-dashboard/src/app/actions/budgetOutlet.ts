'use server'

import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Server Actions untuk halaman Budget Outlet (owner-only).
 *
 * `get_outlet_budget_status` di-GRANT ke `service_role` SAJA (REVOKE dari
 * PUBLIC/anon/authenticated) — sengaja, agar tak ada client-side/authenticated
 * call yang bisa membacanya langsung. Karena itu action ini WAJIB pakai
 * `createServiceClient()` (bypass RLS), dan justru karena itu WAJIB memanggil
 * `requireRole(['owner'])` di awal setiap export — 'use server' bukan privat,
 * setiap export adalah endpoint POST publik (lihat komentar di lib/authz.ts).
 */

export type PeriodType = 'harian' | 'mingguan' | 'bulanan' | 'custom'

export interface BudgetStatus {
  outletId: string
  nominal: number
  periodType: PeriodType | null
  periodStart: string | null
  periodEnd: string | null
  terpakai: number
  sisa: number
  hasConfig: boolean
  customDays: number | null
}

function mapBudgetRow(row: any, outletId: string): BudgetStatus {
  return {
    outletId,
    nominal: Number(row?.nominal ?? 0),
    periodType: (row?.period_type ?? null) as PeriodType | null,
    periodStart: row?.period_start ?? null,
    periodEnd: row?.period_end ?? null,
    terpakai: Number(row?.terpakai ?? 0),
    sisa: Number(row?.sisa ?? 0),
    hasConfig: !!row?.has_config,
    customDays: row?.custom_days != null ? Number(row.custom_days) : null,
  }
}

export async function listOutletBudgets(): Promise<Array<BudgetStatus & { outletName: string }>> {
  await requireRole(['owner', 'admin'])
  const supabase = createServiceClient()

  const { data: outlets, error: outletsError } = await supabase
    .from('outlets')
    .select('id, name')
    .eq('is_active', true)
    .neq('type', 'marketplace')
    .order('name')
  if (outletsError) throw new Error(outletsError.message)

  const operational = (outlets ?? []).filter(
    (o) => !o.name.toUpperCase().includes('GUDANG') && !o.name.toUpperCase().includes('KANTOR PUSAT')
  )

  const results: Array<BudgetStatus & { outletName: string }> = []
  for (const o of operational) {
    const { data, error } = await supabase.rpc('get_outlet_budget_status', { p_outlet_id: o.id })
    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? data[0] : data
    results.push({ ...mapBudgetRow(row, o.id), outletName: o.name })
  }
  return results
}

export async function setOutletBudgetConfig(
  outletId: string,
  nominal: number,
  periodType: PeriodType,
  customDays?: number | null,
): Promise<void> {
  const { userId } = await requireRole(['owner', 'admin'])
  if (!Number.isFinite(nominal) || nominal < 0) throw new Error('Nominal budget tidak valid')
  if (periodType === 'custom') {
    if (!customDays || !Number.isFinite(customDays) || customDays < 1) {
      throw new Error('Jumlah hari custom harus minimal 1')
    }
  }

  const supabase = createServiceClient()

  // Pertahankan effective_from yang sudah ada saat mengedit config existing —
  // kolom ini jadi jangkar batas periode mingguan, reset ke hari ini tiap
  // edit akan diam-diam menggeser jendela budget outlet (fix yang sama sudah
  // diterapkan di kode setara apps/stok).
  const { data: existing } = await supabase
    .from('outlet_budget_config')
    .select('effective_from')
    .eq('outlet_id', outletId)
    .maybeSingle()

  const { error } = await supabase.from('outlet_budget_config').upsert({
    outlet_id: outletId,
    nominal,
    period_type: periodType,
    custom_days: periodType === 'custom' ? (customDays ?? null) : null,
    effective_from: existing?.effective_from ?? new Date().toISOString().slice(0, 10),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}
