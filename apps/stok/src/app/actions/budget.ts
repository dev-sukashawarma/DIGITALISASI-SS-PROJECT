// apps/stok/src/app/actions/budget.ts
'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import type { BudgetStatus, PeriodType } from '@/lib/stok/budget'
import { assertOutletAccessible, getAccessibleOutletIds } from '@/lib/stok/outletAccess'
import { canViewVendorPrices } from '@/lib/stok/navAccess'
import { convertToBaseUnit } from '@/lib/format/compositeUnit'
import { hitungBarisBelanja, batasHariWib } from '@/lib/stok/riwayatBelanja'
import { nilaiBaris, type HargaVendorMap } from '@/lib/stok/hargaVendor'
import { muatHargaVendor } from '@/lib/stok/muatHargaVendor'
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    throw new Error('Unauthorized: No active user session found')
  }
  return userId
}

/** Gerbang minimal untuk aksi read-only ringan -- cukup staff aktif. */
async function requireActiveStaff(): Promise<{ userId: string; role: string }> {
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
  return { userId, role: staff.role }
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

const BUDGET_MANAGER_ROLES = ['owner', 'admin', 'admin_finance', 'developer'] as const

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

  // Batas hari WIB (+07:00), sama dengan RPC get_outlet_budget_status yang
  // memakai (updated_at AT TIME ZONE 'Asia/Jakarta')::date. Dulu batasnya UTC
  // (Z), sehingga permintaan yang disetujui 00:00–06:59 WIB jatuh ke hari lain.
  const batas = batasHariWib(fromDate, toDate)
  if (batas.dari) {
    query = query.gte('updated_at', batas.dari)
  }
  if (batas.sampai) {
    query = query.lte('updated_at', batas.sampai)
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
      // qty_disetujui & harga_snapshot sama-sama satuan BESAR → subtotal tanpa
      // konversi (identik dengan "terpakai" di RPC). Qty & harga di bawah
      // dikonversi ke satuan DISTRIBUSI hanya untuk tampilan, supaya kolom
      // "Harga Satuan" berdampingan dengan qty bersatuan sama.
      const baris = hitungBarisBelanja({
        qtyDisetujui: it.qty_disetujui,
        qtyDiminta: it.qty_diminta,
        hargaSnapshot: it.harga_snapshot,
        bahan: b,
      })
      const subtotal = baris.subtotal

      totalNilai += subtotal

      return {
        id: it.id,
        bahanBakuId: it.bahan_baku_id,
        namaBahan: b?.nama || 'Bahan Baku',
        kategori: b?.kategori || 'LAIN-LAIN',
        satuanDistribusi: b?.satuan_distribusi || b?.satuan || 'Pcs',
        qtyDimintaDistribusi: baris.qtyDimintaDistribusi,
        qtyDisetujuiDistribusi: baris.qtyDisetujuiDistribusi,
        // Harga per SATUAN DISTRIBUSI (bukan harga_snapshot mentah per satuan besar).
        hargaSnapshot: baris.hargaPerDistribusi,
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
  // qty & alokasi[].qty dalam satuan DISTRIBUSI. alokasi (opsional) = vendor
  // yang dipilih kitchen di layar approval: porsinya dihargai katalog vendor
  // itu, sama dengan harga_snapshot yang akan ditulis trigger surat jalan.
  items: { bahan_baku_id: string; qty: number; alokasi?: { vendor_id: string; qty: number }[] }[]
): Promise<CartEstimateResult> {
  // Sengaja cukup staff aktif: crew memakai estimasi ini di form Permintaan
  // Bahan untuk melihat dampak ke plafon budget outletnya. Yang dikembalikan
  // hanya agregat (total, total per kategori, daftar bahan tanpa harga) —
  // BUKAN harga per bahan. Harga per VENDOR (alokasi) hanya dipakai untuk role
  // pembaca harga vendor (layar approval kitchen); role lain alokasinya
  // diabaikan dan dihargai harga master, supaya harga katalog vendor tak bisa
  // diintip lewat endpoint ini. Action ini tidak menerima outlet_id (harga
  // bersifat global), jadi tidak ada scope outlet yang perlu dibatasi.
  const { role } = await requireActiveStaff()
  if (!canViewVendorPrices(role)) {
    items = items.map(({ bahan_baku_id, qty }) => ({ bahan_baku_id, qty }))
  }

  if (items.length === 0) return { totalNilai: 0, itemTanpaHarga: [], kategoriNilai: {} }

  const supabase = makeServiceClient()
  const ids = items.map((it) => it.bahan_baku_id)

  const adaAlokasi = items.some((it) => it.alokasi?.length)
  const [{ data: hg, error: errHg }, { data: bb, error: errBb }, hargaVendor] = await Promise.all([
    supabase.from('bahan_baku_harga').select('bahan_baku_id, harga_beli').in('bahan_baku_id', ids),
    supabase
      .from('bahan_baku')
      .select(
        'id, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, satuan_distribusi'
      )
      .in('id', ids),
    adaAlokasi ? muatHargaVendor(supabase, ids) : Promise.resolve({} as HargaVendorMap),
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
  // Konversi satuan pesan (distribusi) -> satuan besar. harga_beli SELALU per
  // satuan besar (lihat memory "basis-harga-kanonik-satuan-besar"), sedangkan
  // semua pemanggil action ini mengirim qty dalam satuan distribusi. Tanpa
  // konversi, BAWANG (Bal = 20 kg) diestimasi Rp 650.000 untuk 1 kg.
  const bahanMap = new Map<string, any>()
  bb?.forEach((b) => {
    kategoriMap.set(b.id, b.kategori || 'LAIN-LAIN')
    bahanMap.set(b.id, b)
  })

  let totalNilai = 0
  const itemTanpaHarga: string[] = []
  const kategoriNilai: Record<string, number> = {}

  for (const it of items) {
    const kat = kategoriMap.get(it.bahan_baku_id) || 'LAIN-LAIN'
    const bahan = bahanMap.get(it.bahan_baku_id)
    const keBesar = (q: number) => (bahan ? convertToBaseUnit(q, bahan) : q)
    const subtotal = nilaiBaris(
      keBesar(it.qty),
      it.alokasi?.map((a) => ({ vendor_id: a.vendor_id, qty: keBesar(a.qty) })),
      hargaVendor[it.bahan_baku_id],
      hargaMap.get(it.bahan_baku_id),
    )
    if (subtotal === null) {
      itemTanpaHarga.push(it.bahan_baku_id)
    } else {
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

  // Dipanggil dengan client SESI (bukan service role): RPC request_budget_topup_svc
  // punya jalur non-service yang memeriksa akun aktif + accessible_outlet_ids()
  // dan mengisi created_by = auth.uid(). Lewat service role, auth.uid() NULL →
  // pengaju tak pernah tercatat.
  const { data, error } = await authedClient.rpc('request_budget_topup_svc', {
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
  const userId = await getCurrentUserId(authedClient)

  const supabase = makeServiceClient()
  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (!staff || staff.status !== 'active') {
    throw new Error('Forbidden: akun tidak aktif')
  }

  const financeRoles = ['admin_finance', 'admin', 'owner', 'developer']
  const managerRoles = ['area_manager', 'regional_manager', 'korlap', 'spv', ...financeRoles]

  if (input.action === 'approve_finance' && !financeRoles.includes(staff.role)) {
    throw new Error('Forbidden: hanya Finance/Admin/Owner yang berwenang menyetujui pencairan budget')
  }
  if ((input.action === 'approve_am' || input.action === 'reject') && !managerRoles.includes(staff.role)) {
    throw new Error('Forbidden: peran Anda tidak berwenang memproses persetujuan budget ini')
  }

  // Scope outlet: area_manager/korlap hanya boleh memproses top-up outlet
  // binaannya. Role pusat mendapat semua outlet dari accessible_outlet_ids().
  const { data: req, error: errReq } = await supabase
    .from('outlet_budget_topup_requests')
    .select('outlet_id')
    .eq('id', input.requestId)
    .maybeSingle()
  if (errReq) throw new Error(errReq.message)
  if (!req) throw new Error('Request top-up tidak ditemukan')
  await assertOutletAccessible(authedClient, req.outlet_id)

  // Client SESI, bukan service role: RPC approve_budget_topup_svc memeriksa
  // ulang role + scope outlet dan mengisi am_approved_by / finance_approved_by
  // = auth.uid(). Lewat service role kolom pelaku selalu NULL.
  const { data, error } = await authedClient.rpc('approve_budget_topup_svc', {
    p_request_id: input.requestId,
    p_action: input.action,
    p_notes: input.notes
  })

  if (error) throw new Error(error.message)
  return data
}

export async function getOutletTopupRequestsAction(outletId?: string) {
  const authedClient = await getAuthedClient()
  await requireActiveStaff()

  // Scope = outlet yang boleh diakses pemanggil (sama dengan RLS ob_topup_select).
  // Dulu tanpa outletId semua request semua outlet dikembalikan ke staf aktif
  // mana pun, termasuk crew.
  const accessible = await getAccessibleOutletIds(authedClient)
  if (outletId && !accessible.has(outletId)) {
    throw new Error('Forbidden: outlet di luar scope akses Anda')
  }
  const outletIds = outletId ? [outletId] : [...accessible]
  if (outletIds.length === 0) return []

  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('outlet_budget_topup_requests')
    .select(`
      *,
      created_by_staff:outlet_staff!created_by(id, name),
      am_approved_staff:outlet_staff!am_approved_by(id, name),
      finance_approved_staff:outlet_staff!finance_approved_by(id, name)
    `)
    .in('outlet_id', outletIds)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return data
}
