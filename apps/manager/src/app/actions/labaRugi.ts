'use server'

import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { getServiceSupabase } from '@/lib/supabase-service'
import { canAccessLabaRugi } from '@/lib/labaRugiAccess'
import type { Outlet, PeriodFilterValue, SalesSummaryRow } from '@/lib/laba-rugi/types'
import { ambilPengeluaranMentah, type FilterPengeluaran } from '@/lib/laba-rugi/pengeluaran/ambilPengeluaran'
import { ambilBiayaRab, type BiayaRabRow } from '@/lib/laba-rugi/biayaRab'
import { fetchHppRows, type HppRow } from '@/lib/laba-rugi/hpp/fetchHpp'
import { ambilVersiRiwayatHpp } from '@/lib/laba-rugi/hpp/riwayatHpp'
import {
  fetchProrataAuxiliaryDataCore,
  type ProrataAuxiliaryData,
} from '@/lib/laba-rugi/server/prorataAuxiliaryCore'
import {
  hitungRingkasanPayrollHr,
  type HRPayrollSummary,
} from '@/lib/laba-rugi/server/ringkasanPayrollHr'
import {
  fetchOutletsCore,
  fetchSalesDailyCore,
  fetchWasteCore,
  fetchPendapatanLainCore,
  fetchMitraInvestmentsCore,
  fetchAllPlatformSettlementsCore,
  type WasteRow,
  type MitraInvestmentExtended,
  type MitraTransferRecord,
  type TikTokSettlementSummary,
  type AllPlatformSettlementsResult,
} from '@/lib/laba-rugi/server/labaRugiQueries'

export type {
  ProrataAuxiliaryData,
  HRPayrollSummary,
  WasteRow,
  MitraInvestmentExtended,
  MitraTransferRecord,
  TikTokSettlementSummary,
  AllPlatformSettlementsResult,
  BiayaRabRow,
  HppRow,
}

async function requireManagerLabaRugiAccess() {
  const headersList = await headers()
  const headerStaff = parseStaffHeader(headersList.get(STAFF_HEADER))
  if (!headerStaff?.id) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  const supabase = getServiceSupabase()
  const { data: staff, error } = await supabase
    .from('outlet_staff')
    .select('id, email, role, status')
    .eq('id', headerStaff.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !canAccessLabaRugi(staff)) {
    throw new Error('Forbidden: akun Anda tidak memiliki akses ke Tab Laba Rugi')
  }

  return { supabase, staff }
}

export async function getLabaRugiOutletsAction(): Promise<Outlet[]> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchOutletsCore(supabase)
}

export async function getLabaRugiSalesDailyAction(filter: PeriodFilterValue): Promise<SalesSummaryRow[]> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchSalesDailyCore(supabase, filter)
}

export async function getExpensesAction(filter: FilterPengeluaran): Promise<{
  success: boolean
  expenses?: any[]
  pettyCashExpenses?: any[]
  error?: string
}> {
  try {
    const { supabase } = await requireManagerLabaRugiAccess()
    const { expenses, pettyCashExpenses } = await ambilPengeluaranMentah(supabase, filter)
    return { success: true, expenses, pettyCashExpenses }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memuat data pengeluaran' }
  }
}

export async function getLabaRugiHppVersionAction(): Promise<string> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return ambilVersiRiwayatHpp(supabase)
}

export async function getLabaRugiHppAction(filter: PeriodFilterValue): Promise<HppRow[]> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchHppRows(supabase, filter)
}

export async function getLabaRugiWasteAction(filter: PeriodFilterValue): Promise<WasteRow[]> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchWasteCore(supabase, filter)
}

export async function getLabaRugiPendapatanLainAction(filter: {
  from: string
  to: string
}): Promise<number> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchPendapatanLainCore(supabase, filter)
}

export async function getMitraInvestmentsAction(): Promise<Record<string, MitraInvestmentExtended>> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchMitraInvestmentsCore(supabase)
}

export async function getProrataAuxiliaryDataAction({
  from,
  to,
}: {
  from: string
  to: string
}): Promise<ProrataAuxiliaryData> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchProrataAuxiliaryDataCore(supabase, { from, to })
}

export async function getHRPayrollSummaryAction(filter: {
  from: string
  to: string
  outletId: string
}): Promise<HRPayrollSummary> {
  await requireManagerLabaRugiAccess()
  return hitungRingkasanPayrollHr(filter)
}

export async function getAllPlatformSettlementSummaries(
  from: string,
  to: string,
): Promise<{ success: boolean; data?: AllPlatformSettlementsResult; error?: string }> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return fetchAllPlatformSettlementsCore(supabase, from, to)
}

export async function getTikTokSettlementSummaries(
  from: string,
  to: string,
): Promise<{ success: boolean; data?: Record<string, TikTokSettlementSummary>; error?: string }> {
  const res = await getAllPlatformSettlementSummaries(from, to)
  if (!res.success || !res.data) {
    return { success: false, error: res.error }
  }
  return { success: true, data: res.data.tiktokSummaries }
}

export async function getLabaRugiBiayaRabAction(params: {
  from: string
  to: string
  outletIds?: string[]
}): Promise<BiayaRabRow[]> {
  const { supabase } = await requireManagerLabaRugiAccess()
  return ambilBiayaRab(supabase, params)
}
