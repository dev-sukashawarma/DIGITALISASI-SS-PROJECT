// apps/stok/src/app/actions/budget.ts
'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { BudgetStatus, PeriodType } from '@/lib/stok/budget'
import { assertOutletAccessible, getAccessibleOutletIds } from '@/lib/stok/outletAccess'
import { convertToDistribusiUnit } from '@/lib/format/compositeUnit'
import type {
  OutletBudgetSummaryItem,
  OutletSpendingTransaction,
  SpendingItemDetail,
  BudgetConfigHistoryItem,
} from '@/types/budgetMonitoring'

// ---------------------------------------------------------------------------
// Service role client — bypass RLS. WAJIB dipagari gerbang otorisasi sendiri
// di tiap action (mirror app/actions/permintaan.ts).
// ---------------------------------------------------------------------------

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'
  return createClient(url, key)
}

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}

async function getCurrentUserId(supabase: Awaited<ReturnType<typeof getAuthedClient>>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  return user.id
}

/** Gerbang minimal untuk aksi read-only ringan -- cukup staff aktif. */
async function requireActiveStaff(): Promise<string> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active') {
    throw new Error('Forbidden: akun tidak aktif')
  }
  return userId
}

/** Gerbang otorisasi pengawas: Kitchen, Admin, SPV, Area Manager, Leader, Owner, Finance */
async function requireBudgetViewer(): Promise<{ userId: string; accessibleIds: Set<string>; role: string }> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active') {
    throw new Error('Forbidden: akun tidak aktif')
  }

  const accessibleIds = await getAccessibleOutletIds(authedClient)
  return { userId, accessibleIds, role: staff.role }
}

const BUDGET_MANAGER_ROLES = ['owner', 'admin', 'admin_finance'] as const

/** Gerbang otorisasi manajemen plafon (Admin, Owner, Admin Finance) */
async function requireBudgetManager(): Promise<{ userId: string; staffName: string; role: string }> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('name, role, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !(BUDGET_MANAGER_ROLES as readonly string[]).includes(staff.role)) {
    throw new Error('Forbidden: hanya Admin, Owner, dan Admin Finance yang berwenang mengatur plafon budget')
  }
  return { userId, staffName: staff.name || 'Admin', role: staff.role }
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

// ---------------------------------------------------------------------------
// 1. getOutletBudgetStatus — status budget satu outlet
// ---------------------------------------------------------------------------

export async function getOutletBudgetStatus(outletId: string): Promise<BudgetStatus> {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, outletId)

  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('get_outlet_budget_status', { p_outlet_id: outletId })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return mapBudgetRow(row, outletId)
}

// ---------------------------------------------------------------------------
// 2. getAllOutletsBudgetStatus — status budget seluruh outlet untuk dashboard
// ---------------------------------------------------------------------------

export async function getAllOutletsBudgetStatus(): Promise<OutletBudgetSummaryItem[]> {
  const { accessibleIds } = await requireBudgetViewer()
  const supabase = makeServiceClient()

  // Ambil outlet aktif yang boleh diakses
  const { data: outlets, error: errOutlets } = await supabase
    .from('outlets')
    .select('id, name, region, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (errOutlets) throw new Error(errOutlets.message)

  const hiddenOutletNames = ['GUDANG PUSAT (HQ)', 'KANTOR PUSAT', 'Shopee', 'TikTok Shop']
  
  const filteredOutlets = (outlets ?? []).filter(
    (o) => 
      o.id !== '00000000-0000-0000-0000-000000000000' && 
      !hiddenOutletNames.includes(o.name) &&
      (accessibleIds.size === 0 || accessibleIds.has(o.id))
  )

  // Ambil info config terakhir beserta nama staf pengubah
  const { data: configs } = await supabase
    .from('outlet_budget_config')
    .select('outlet_id, updated_at, updated_by')

  const updatedByIds = [...new Set((configs ?? []).map((c: any) => c.updated_by).filter(Boolean))]
  const staffMap = new Map<string, string>()
  if (updatedByIds.length > 0) {
    const { data: staffList } = await supabase
      .from('outlet_staff')
      .select('id, name')
      .in('id', updatedByIds)
    staffList?.forEach((s: any) => staffMap.set(s.id, s.name))
  }

  const configMap = new Map<string, { updatedByName: string | null; updatedAt: string | null }>()
  configs?.forEach((c: any) => {
    configMap.set(c.outlet_id, {
      updatedByName: c.updated_by ? staffMap.get(c.updated_by) ?? null : null,
      updatedAt: c.updated_at ?? null,
    })
  })

  // Ambil status kalkulasi budget RPC untuk tiap outlet secara paralel
  const results = await Promise.all(
    filteredOutlets.map(async (outlet) => {
      try {
        const { data: rpcData } = await supabase.rpc('get_outlet_budget_status', { p_outlet_id: outlet.id })
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
        const base = mapBudgetRow(row, outlet.id)
        const cfgInfo = configMap.get(outlet.id)

        const percentage = base.nominal > 0 ? (base.terpakai / base.nominal) * 100 : 0

        return {
          ...base,
          outletName: outlet.name,
          region: outlet.region || 'Bogor',
          percentage,
          updatedByStaffName: cfgInfo?.updatedByName ?? null,
          updatedAt: cfgInfo?.updatedAt ?? null,
        }
      } catch {
        return {
          outletId: outlet.id,
          outletName: outlet.name,
          region: outlet.region || 'Bogor',
          nominal: 0,
          periodType: null,
          periodStart: null,
          periodEnd: null,
          terpakai: 0,
          sisa: 0,
          hasConfig: false,
          customDays: null,
          percentage: 0,
          updatedByStaffName: null,
          updatedAt: null,
        }
      }
    })
  )

  return results
}

// ---------------------------------------------------------------------------
// 3. updateOutletBudgetConfigAction — update plafon & catat audit trail
// ---------------------------------------------------------------------------

export async function updateOutletBudgetConfigAction(input: {
  outletId: string
  nominal: number
  periodType: PeriodType
  customDays?: number | null
  catatan?: string
}): Promise<void> {
  const { userId, staffName } = await requireBudgetManager()
  const supabase = makeServiceClient()

  if (input.nominal < 0) {
    throw new Error('Nominal plafon tidak boleh negatif')
  }

  // 1. Ambil data config lama
  const { data: oldCfg } = await supabase
    .from('outlet_budget_config')
    .select('nominal, period_type, custom_days')
    .eq('outlet_id', input.outletId)
    .maybeSingle()

  // 2. Upsert ke outlet_budget_config
  const { error: errUpsert } = await supabase.from('outlet_budget_config').upsert(
    {
      outlet_id: input.outletId,
      nominal: input.nominal,
      period_type: input.periodType,
      custom_days: input.periodType === 'custom' ? input.customDays ?? 7 : null,
      effective_from: new Date().toISOString().split('T')[0],
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'outlet_id' }
  )

  if (errUpsert) throw new Error(errUpsert.message)

  // 3. Catat audit history ke outlet_budget_config_history
  try {
    await supabase.from('outlet_budget_config_history').insert({
      outlet_id: input.outletId,
      nominal_lama: oldCfg?.nominal ?? null,
      nominal_baru: input.nominal,
      period_type_lama: oldCfg?.period_type ?? null,
      period_type_baru: input.periodType,
      custom_days_lama: oldCfg?.custom_days ?? null,
      custom_days_baru: input.periodType === 'custom' ? input.customDays ?? 7 : null,
      changed_by: userId,
      changed_by_name: staffName,
      catatan: input.catatan?.trim() || null,
      changed_at: new Date().toISOString(),
    })
  } catch (errAudit) {
    console.warn('Gagal mencatat audit history budget config:', errAudit)
  }
}

// ---------------------------------------------------------------------------
// 4. getOutletSpendingHistory — riwayat transaksi permintaan bahan disetujui
// ---------------------------------------------------------------------------

export async function getOutletSpendingHistory(
  outletId: string,
  fromDate?: string,
  toDate?: string
): Promise<OutletSpendingTransaction[]> {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, outletId)

  const supabase = makeServiceClient()

  let query = supabase
    .from('permintaan_bahan')
    .select(
      `
      id,
      outlet_id,
      status,
      dibuat_oleh,
      created_at,
      updated_at,
      surat_jalan_id,
      items:permintaan_bahan_item(
        id,
        bahan_baku_id,
        qty_diminta,
        qty_disetujui,
        harga_snapshot,
        bahan:bahan_baku(
          id,
          nama,
          satuan,
          satuan_distribusi,
          satuan_tengah,
          faktor_tengah,
          satuan_kecil,
          faktor_tampilan,
          faktor_konversi,
          kategori
        )
      )
    `
    )
    .eq('outlet_id', outletId)
    .eq('status', 'disetujui')
    .order('updated_at', { ascending: false })

  if (fromDate) {
    query = query.gte('updated_at', `${fromDate}T00:00:00.000Z`)
  }
  if (toDate) {
    query = query.lte('updated_at', `${toDate}T23:59:59.999Z`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rawData = data ?? []
  const staffIds = [...new Set(rawData.map((d: any) => d.dibuat_oleh).filter(Boolean))]
  const staffMap: Record<string, string> = {}

  if (staffIds.length > 0) {
    const { data: staffData } = await supabase
      .from('outlet_staff')
      .select('id, name')
      .in('id', staffIds)
    if (staffData) {
      staffData.forEach((s: any) => {
        staffMap[s.id] = s.name
      })
    }
  }

  return rawData.map((row: any): OutletSpendingTransaction => {
    const rawItems: any[] = row.items ?? []
    let totalNilai = 0

    const mappedItems: SpendingItemDetail[] = rawItems.map((it: any) => {
      const b = it.bahan
      const qtyDisetujuiDist = b ? convertToDistribusiUnit(it.qty_disetujui ?? 0, b) : (it.qty_disetujui ?? 0)
      const qtyDimintaDist = b ? convertToDistribusiUnit(it.qty_diminta ?? 0, b) : (it.qty_diminta ?? 0)
      const harga = Number(it.harga_snapshot ?? 0)
      const subtotal = qtyDisetujuiDist * harga

      totalNilai += subtotal

      return {
        id: it.id,
        bahanBakuId: it.bahan_baku_id,
        namaBahan: b?.nama || 'Bahan Baku',
        kategori: b?.kategori || 'LAIN-LAIN',
        satuanDistribusi: b?.satuan_distribusi || b?.satuan || 'Pcs',
        qtyDimintaDistribusi: qtyDimintaDist,
        qtyDisetujuiDistribusi: qtyDisetujuiDist,
        hargaSnapshot: harga,
        subtotal,
      }
    })

    return {
      id: row.id,
      kodePermintaan: `#REQ-${row.id.slice(0, 4).toUpperCase()}`,
      outletId: row.outlet_id,
      status: row.status,
      createdAt: row.created_at,
      approvedAt: row.updated_at,
      requesterName: (row.dibuat_oleh ? staffMap[row.dibuat_oleh] : null) || 'Staff Outlet',
      totalNilai,
      totalItems: mappedItems.length,
      items: mappedItems,
    }
  })
}

// ---------------------------------------------------------------------------
// 5. getOutletBudgetHistory — riwayat perubahan konfigurasi plafon
// ---------------------------------------------------------------------------

export async function getOutletBudgetHistory(outletId: string): Promise<BudgetConfigHistoryItem[]> {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, outletId)

  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('outlet_budget_config_history')
    .select('*')
    .eq('outlet_id', outletId)
    .order('changed_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    outletId: row.outlet_id,
    nominalLama: row.nominal_lama != null ? Number(row.nominal_lama) : null,
    nominalBaru: Number(row.nominal_baru),
    periodTypeLama: row.period_type_lama,
    periodTypeBaru: row.period_type_baru,
    customDaysLama: row.custom_days_lama,
    customDaysBaru: row.custom_days_baru,
    changedByName: row.changed_by_name || 'Admin',
    changedAt: row.changed_at,
    catatan: row.catatan,
  }))
}

// ---------------------------------------------------------------------------
// 6. estimateCartValue — estimasi nilai Rupiah keranjang
// ---------------------------------------------------------------------------

export interface CartEstimateResult {
  totalNilai: number
  itemTanpaHarga: string[]
  kategoriNilai: Record<string, number>
}

export async function estimateCartValue(
  items: { bahan_baku_id: string; qty: number }[]
): Promise<CartEstimateResult> {
  await requireActiveStaff()

  if (items.length === 0) return { totalNilai: 0, itemTanpaHarga: [], kategoriNilai: {} }

  const supabase = makeServiceClient()
  const ids = items.map((it) => it.bahan_baku_id)

  const [{ data: hg, error: errHg }, { data: bb, error: errBb }] = await Promise.all([
    supabase.from('bahan_baku_harga').select('bahan_baku_id, harga_beli').in('bahan_baku_id', ids),
    supabase.from('bahan_baku').select('id, kategori').in('id', ids),
  ])

  if (errHg) throw new Error(errHg.message)
  if (errBb) throw new Error(errBb.message)

  const hargaMap = new Map<string, number>()
  hg?.forEach((h) => {
    if (h.harga_beli != null) {
      hargaMap.set(h.bahan_baku_id, Number(h.harga_beli))
    }
  })

  const kategoriMap = new Map<string, string>()
  bb?.forEach((b) => {
    kategoriMap.set(b.id, b.kategori || 'LAIN-LAIN')
  })

  let totalNilai = 0
  const itemTanpaHarga: string[] = []
  const kategoriNilai: Record<string, number> = {}

  for (const it of items) {
    const harga = hargaMap.get(it.bahan_baku_id)
    const kat = kategoriMap.get(it.bahan_baku_id) || 'LAIN-LAIN'
    if (harga === undefined) {
      itemTanpaHarga.push(it.bahan_baku_id)
    } else {
      const subtotal = it.qty * harga
      totalNilai += subtotal
      kategoriNilai[kat] = (kategoriNilai[kat] || 0) + subtotal
    }
  }

  return {
    totalNilai,
    itemTanpaHarga,
    kategoriNilai,
  }
}


// ---------------------------------------------------------------------------
// 7. Top-Up Requests Actions
// ---------------------------------------------------------------------------

export async function requestBudgetTopupAction(input: {
  outletId: string
  requestedAmount: number
  periodCategory: 'weekday' | 'weekend'
}) {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, input.outletId)

  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('request_budget_topup_svc', {
    p_outlet_id: input.outletId,
    p_requested_amount: input.requestedAmount,
    p_period_category: input.periodCategory
  })

  if (error) throw new Error(error.message)
  return data
}

export async function approveBudgetTopupAction(input: {
  requestId: string
  action: 'approve_am' | 'approve_finance' | 'reject'
  notes?: string
}) {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)

  // Otorisasi sederhana berdasarkan role (bisa diperketat lagi nanti jika perlu)
  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('approve_budget_topup_svc', {
    p_request_id: input.requestId,
    p_action: input.action,
    p_notes: input.notes
  })

  if (error) throw new Error(error.message)
  return data
}

export async function getOutletTopupRequestsAction(outletId?: string) {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)

  const supabase = makeServiceClient()
  let query = supabase
    .from('outlet_budget_topup_requests')
    .select(`
      *,
      created_by_staff:outlet_staff!created_by(id, name),
      am_approved_staff:outlet_staff!am_approved_by(id, name),
      finance_approved_staff:outlet_staff!finance_approved_by(id, name)
    `)
    .order('created_at', { ascending: false })

  if (outletId) {
    await assertOutletAccessible(authedClient, outletId)
    query = query.eq('outlet_id', outletId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  
  return data
}
