'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { getDistribusiFactor } from '@/lib/format/compositeUnit'
import { attributeFifo, labelFifo, type FifoWindowRow } from '@/lib/stok/vendorFifo'
import { assertStaffCanAccessOutlet } from '@/lib/stok/outletAccess'

const MANAGEMENT_ROLES = [
  'admin',
  'owner',
  'spv',
  'regional_manager',
  'area_manager',
  'leader',
  'kitchen',
  'purchasing',
  'admin_finance',
  'developer',
] as const

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

async function requireManagementAuth(outletId?: string) {
  const authedClient = await getAuthedClient()
  const { data: { user }, error: userError } = await authedClient.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized: Sesi login tidak ditemukan')
  }

  const serviceClient = makeServiceClient()
  const { data: staff, error: staffError } = await serviceClient
    .from('outlet_staff')
    .select('id, role, status, name, outlet_id')
    .eq('id', user.id)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  if (!staff || staff.status !== 'active') {
    throw new Error('Unauthorized: Akun staff tidak aktif')
  }

  if (!MANAGEMENT_ROLES.includes(staff.role as any)) {
    throw new Error('Forbidden: Laporan ini khusus untuk Manajemen (Owner, Admin, SPV, Leader, Kitchen, Finance)')
  }

  if (outletId) {
    await assertStaffCanAccessOutlet(serviceClient, staff.id, outletId)
  }

  return { staff, authedClient, serviceClient }
}

interface VendorRefRow {
  bahan_baku_id: string
  ref_shipment_id: string | null
  ref_terima_vendor_id: string | null
  ref_po_id: string | null
}

const vendorLabel = (nama: string | null | undefined) =>
  nama ? nama.replace(/\s*-\s*Tempo\s*\d+\s*$/i, '').trim() : null

/**
 * Vendor hanya diketahui untuk barang MASUK: surat jalan (vendor_id per baris),
 * terima drop-ship, atau PO. Pemakaian di outlet tidak dilacak per vendor.
 * Kunci hasil: `${tipeRef}:${refId}:${bahanId}` -> nama vendor.
 */
async function resolveVendorNames(
  supabase: ReturnType<typeof makeServiceClient>,
  rows: VendorRefRow[]
): Promise<(row: VendorRefRow) => string | null> {
  const sjIds = [...new Set(rows.map((r) => r.ref_shipment_id).filter((v): v is string => !!v))]
  const tvIds = [...new Set(rows.map((r) => r.ref_terima_vendor_id).filter((v): v is string => !!v))]
  const poIds = [...new Set(rows.map((r) => r.ref_po_id).filter((v): v is string => !!v))]

  const [sjRes, tvRes, poRes] = await Promise.all([
    sjIds.length > 0
      ? supabase.from('surat_jalan_item').select('surat_jalan_id, bahan_baku_id, vendor_id').in('surat_jalan_id', sjIds).not('vendor_id', 'is', null)
      : Promise.resolve({ data: [] as any[] }),
    tvIds.length > 0
      ? supabase.from('terima_vendor_outlet').select('id, supplier_id').in('id', tvIds)
      : Promise.resolve({ data: [] as any[] }),
    poIds.length > 0
      ? supabase.from('purchase_order').select('id, supplier_id').in('id', poIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const supplierIds = [
    ...new Set([
      ...(sjRes.data || []).map((x: any) => x.vendor_id),
      ...(tvRes.data || []).map((x: any) => x.supplier_id),
      ...(poRes.data || []).map((x: any) => x.supplier_id),
    ].filter(Boolean)),
  ]
  const nameById = new Map<string, string>()
  if (supplierIds.length > 0) {
    const { data: sup } = await supabase.from('supplier').select('id, nama').in('id', supplierIds)
    for (const s of sup || []) nameById.set(s.id, vendorLabel(s.nama) || s.nama)
  }

  const sjMap = new Map<string, string>()
  for (const x of sjRes.data || []) sjMap.set(`${x.surat_jalan_id}_${x.bahan_baku_id}`, x.vendor_id)
  const tvMap = new Map<string, string>((tvRes.data || []).map((x: any) => [x.id, x.supplier_id]))
  const poMap = new Map<string, string>((poRes.data || []).map((x: any) => [x.id, x.supplier_id]))

  return (row) => {
    const sid =
      (row.ref_terima_vendor_id && tvMap.get(row.ref_terima_vendor_id)) ||
      (row.ref_po_id && poMap.get(row.ref_po_id)) ||
      (row.ref_shipment_id && sjMap.get(`${row.ref_shipment_id}_${row.bahan_baku_id}`)) ||
      null
    return sid ? nameById.get(sid) || null : null
  }
}

const INFLOW_TIPE = ['terima_kiriman', 'pembelian_supplier', 'transfer_masuk', 'adjustment']

/** Kiriman masuk terakhir sebelum periode (terbaru dulu) untuk membentuk lapisan saldo awal FIFO. */
async function fetchPriorInflows(
  supabase: ReturnType<typeof makeServiceClient>,
  outletId: string,
  startIso: string,
  bahanIds: string[] | null
) {
  let q = supabase
    .from('ledger_stok')
    .select('bahan_baku_id, qty, ref_shipment_id, ref_terima_vendor_id, ref_po_id')
    .eq('outlet_id', outletId)
    .lt('created_at', startIso)
    .gt('qty', 0)
    .in('tipe', INFLOW_TIPE)
    .order('created_at', { ascending: false })
    .limit(bahanIds ? 400 : 3000)
  if (bahanIds) q = q.in('bahan_baku_id', bahanIds)
  const { data } = await q
  const rows = (data || []) as any[]
  const vendorOf = await resolveVendorNames(supabase, rows)
  const byBahan = new Map<string, { qty: number; vendor: string | null }[]>()
  for (const r of rows) {
    const list = byBahan.get(r.bahan_baku_id) || []
    list.push({ qty: Number(r.qty), vendor: vendorOf(r) })
    byBahan.set(r.bahan_baku_id, list)
  }
  return byBahan
}

export interface OpnameSessionSummary {
  id: string
  tanggal: string
  tipe: string
  status: string
  notes: string | null
  created_at: string
  approved_at: string | null
  created_by_name: string | null
  item_count: number
  flagged_count: number
}

export interface DiagnosticAlert {
  type: 'ANOMALI_SKALA' | 'BOM_MISMATCH' | 'SJ_GANTUNG' | 'NOMINAL_EKSTREM'
  severity: 'danger' | 'warning' | 'info'
  message: string
}

export interface MenuItemUsage {
  menu_item_name: string
  porsi_terjual: number
  qty_per_porsi: number
  satuan: string
  total_pemakaian: number
}

export interface VendorMasuk {
  vendor_nama: string
  qty: number
}

export interface ReconciliationItem {
  bahan_baku_id: string
  nama: string
  kategori: string
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
  harga_beli_master: number
  unit_price_kecil: number
  satuan_kirim: string
  harga_master_kirim: number
  
  // Qty (dalam satuan terkecil / gram)
  saldo_awal_qty: number
  masuk_qty: number
  pakai_qty: number
  waste_qty: number
  mutasi_lain_qty: number
  stok_sistem_qty: number
  stok_fisik_qty: number | null
  selisih_qty: number
  
  // Valuasi Rupiah
  saldo_awal_rp: number
  masuk_rp_master: number
  masuk_rp_riil: number | null
  pakai_rp: number
  waste_rp: number
  mutasi_lain_rp: number
  stok_sistem_rp: number
  stok_fisik_rp: number | null
  selisih_rp: number
  
  vendor_masuk?: VendorMasuk[]
  vendor_pakai?: VendorMasuk[]

  has_opname: boolean
  status: 'MATCH' | 'MINUS' | 'SURPLUS' | 'TIDAK_OPNAME'
  selisih_persen: number | null
  diagnostics: DiagnosticAlert[]
  menu_usages: MenuItemUsage[]
}

export interface ReconciliationTotals {
  total_awal_rp: number
  total_masuk_rp_master: number
  total_masuk_rp_riil: number
  total_pakai_rp: number
  total_waste_rp: number
  total_sistem_rp: number
  total_fisik_rp: number
  total_selisih_rp: number
  bahan_berselisih_count: number
  anomali_skala_count: number
  ekstrem_count: number
}

export interface MenuBomIngredient {

  bahan_baku_id: string
  nama_bahan: string
  qty_per_porsi: number
  satuan: string
  total_kebutuhan: number
}

export interface MenuBomBreakdownItem {
  menu_item_id: string
  menu_item_name: string
  total_porsi: number
  has_recipe: boolean
  ingredients: MenuBomIngredient[]
}

export interface ReconciliationPeriodInfo {
  mode: 'opname_session' | 'date_range'
  opname_terpilih?: OpnameSessionSummary | null
  opname_sebelumnya?: OpnameSessionSummary | null
  start_date: string
  end_date: string
}

export interface ReconciliationSnapshotResponse {
  outlet: { id: string; name: string }
  period: ReconciliationPeriodInfo
  pending_surat_jalan_count: number
  items: ReconciliationItem[]
  totals: ReconciliationTotals
  menu_breakdown?: MenuBomBreakdownItem[]
  audit_note: string | null
}


export interface LedgerTimelineRow {
  id: string
  created_at: string
  tipe: string
  catatan: string | null
  qty: number
  harga_satuan: number
  debet_rp: number
  kredit_rp: number
  saldo_sesudah_qty: number
  saldo_sesudah_rp: number
  ref_shipment_id: string | null
  ref_order_id: string | null
  ref_opname_id: string | null
  ref_transfer_id: string | null
  ref_doc_number: string | null
  vendor_nama: string | null
  vendor_estimasi: string | null
}

export interface OutletOverviewItem {
  outlet_id: string
  outlet_name: string
  last_opname: {
    id: string
    tanggal: string
    tipe: string
    status: string
    created_at: string
    created_by_name: string | null
    total_items: number
    flagged_items: number
    total_selisih_rp: number
    anomali_skala_count: number
  } | null
}

/**
 * Mengambil daftar outlet yang dapat diakses oleh user yang sedang login
 */
export async function fetchAccessibleOutlets(): Promise<{ id: string; name: string }[]> {
  const { staff, serviceClient } = await requireManagementAuth()

  const isPrivileged = [
    'admin',
    'admin_hr',
    'owner',
    'spv',
    'kitchen',
    'admin_finance',
    'finance',
    'purchasing',
    'developer',
    'regional_manager',
  ].includes(staff.role)

  if (isPrivileged) {
    const { data, error } = await serviceClient
      .from('outlets')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error(`Gagal mengambil daftar outlet: ${error.message}`)
    return data || []
  }

  // Untuk role multi-outlet scoped (leader, area_manager, dsb):
  const { data: staffOutlets, error: soError } = await serviceClient
    .from('staff_outlets')
    .select('outlet_id, outlets(id, name, is_active)')
    .eq('staff_id', staff.id)

  if (soError) throw new Error(`Gagal mengambil outlet staff: ${soError.message}`)

  const outletMap = new Map<string, string>()
  for (const row of staffOutlets || []) {
    const o = (row as any).outlets
    if (o && o.is_active) {
      outletMap.set(o.id, o.name)
    }
  }

  if (staff.outlet_id) {
    const { data: homeOutlet } = await serviceClient
      .from('outlets')
      .select('id, name, is_active')
      .eq('id', staff.outlet_id)
      .maybeSingle()

    if (homeOutlet && homeOutlet.is_active) {
      outletMap.set(homeOutlet.id, homeOutlet.name)
    }
  }

  return Array.from(outletMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Mengambil ringkasan status opname & selisih seluruh cabang untuk mode "Pantau Semua Cabang"
 */
export async function fetchMultiOutletOverview(): Promise<OutletOverviewItem[]> {
  const outlets = await fetchAccessibleOutlets()
  if (outlets.length === 0) return []

  const supabase = makeServiceClient()
  const outletIds = outlets.map((o) => o.id)

  // 1. Fetch opname terbaru untuk seluruh outlet
  const { data: opnameList, error: opErr } = await supabase
    .from('opname')
    .select(`
      id,
      outlet_id,
      tanggal,
      tipe,
      status,
      created_at,
      outlet_staff!opname_created_by_fkey(name)
    `)
    .in('outlet_id', outletIds)
    .in('status', ['finalized', 'pending_approval'])
    .order('created_at', { ascending: false })

  if (opErr) throw new Error(`Gagal memuat rekap opname cabang: ${opErr.message}`)

  // Ambil hanya opname paling terakhir per outlet
  const latestOpnamePerOutlet = new Map<string, any>()
  for (const op of opnameList || []) {
    if (!latestOpnamePerOutlet.has(op.outlet_id)) {
      latestOpnamePerOutlet.set(op.outlet_id, op)
    }
  }

  const latestOpnameIds = Array.from(latestOpnamePerOutlet.values()).map((o) => o.id)

  // 2. Fetch master bahan, harga, dan item opname
  const [bahanRes, hargaRes, itemsRes] = await Promise.all([
    supabase.from('bahan_baku').select('id, satuan, faktor_tampilan').eq('is_active', true),
    supabase.from('bahan_baku_harga').select('bahan_baku_id, harga_beli'),
    latestOpnameIds.length > 0
      ? supabase.from('opname_item').select('opname_id, bahan_baku_id, selisih, flagged').in('opname_id', latestOpnameIds)
      : Promise.resolve({ data: [] }),
  ])

  const bahanMap = new Map((bahanRes.data || []).map((b) => [b.id, b]))
  const hargaMap = new Map((hargaRes.data || []).map((h) => [h.bahan_baku_id, h.harga_beli || 0]))

  // Kelompokkan item per opname_id
  const opnameItemsGroup = new Map<string, any[]>()
  for (const item of itemsRes.data || []) {
    let group = opnameItemsGroup.get(item.opname_id)
    if (!group) {
      group = []
      opnameItemsGroup.set(item.opname_id, group)
    }
    group.push(item)
  }

  // 3. Susun per outlet
  return outlets.map((o) => {
    const latestOp = latestOpnamePerOutlet.get(o.id)
    if (!latestOp) {
      return {
        outlet_id: o.id,
        outlet_name: o.name,
        last_opname: null,
      }
    }

    const items = opnameItemsGroup.get(latestOp.id) || []
    let totalSelisihRp = 0
    let flaggedCount = 0
    let anomaliSkalaCount = 0

    for (const it of items) {
      if (it.flagged) flaggedCount++
      const selisih = Number(it.selisih || 0)
      if (Math.abs(selisih) > 0.01) {
        const b = bahanMap.get(it.bahan_baku_id)
        const hargaMaster = hargaMap.get(it.bahan_baku_id) || 0
        const kemasanQty = Number(b?.faktor_tampilan) || 1
        const unitPriceKecil = kemasanQty > 0 ? hargaMaster / kemasanQty : hargaMaster
        totalSelisihRp += Math.round(selisih * unitPriceKecil)

        if (kemasanQty > 1 && Math.abs(selisih) >= kemasanQty && Math.abs(selisih) % kemasanQty === 0) {
          anomaliSkalaCount++
        }
      }
    }

    return {
      outlet_id: o.id,
      outlet_name: o.name,
      last_opname: {
        id: latestOp.id,
        tanggal: latestOp.tanggal,
        tipe: latestOp.tipe,
        status: latestOp.status,
        created_at: latestOp.created_at,
        created_by_name: (latestOp as any).outlet_staff?.name || null,
        total_items: items.length,
        flagged_items: flaggedCount,
        total_selisih_rp: totalSelisihRp,
        anomali_skala_count: anomaliSkalaCount,
      },
    }
  })
}

/**
 * Mengambil daftar sesi opname yang pernah difinalisasi di outlet ini
 */
export async function fetchOpnameSessions(outletId: string): Promise<OpnameSessionSummary[]> {
  await requireManagementAuth(outletId)
  const supabase = makeServiceClient()

  const { data, error } = await supabase
    .from('opname')
    .select(`
      id,
      tanggal,
      tipe,
      status,
      notes,
      created_at,
      approved_at,
      outlet_staff!opname_created_by_fkey(name),
      opname_item(id, flagged)
    `)
    .eq('outlet_id', outletId)
    .in('status', ['finalized', 'pending_approval'])
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw new Error(`Gagal memuat sesi opname: ${error.message}`)

  return (data || []).map((o: any) => ({
    id: o.id,
    tanggal: o.tanggal,
    tipe: o.tipe,
    status: o.status,
    notes: o.notes,
    created_at: o.created_at,
    approved_at: o.approved_at,
    created_by_name: o.outlet_staff?.name || null,
    item_count: o.opname_item?.length || 0,
    flagged_count: o.opname_item?.filter((item: any) => item.flagged)?.length || 0,
  }))
}

/**
 * Mengambil data Rekonsiliasi Snapshot Periodik
 */
export async function fetchReconciliationSnapshot(
  outletId: string,
  params: {
    mode: 'opname_session' | 'date_range'
    opnameId?: string
    startDate?: string
    endDate?: string
  }
): Promise<ReconciliationSnapshotResponse> {
  await requireManagementAuth(outletId)
  const supabase = makeServiceClient()

  // 1. Ambil info outlet
  const { data: outletData } = await supabase
    .from('outlets')
    .select('id, name')
    .eq('id', outletId)
    .single()

  const outletName = outletData?.name || 'Outlet'

  let startIso = ''
  let endIso = ''
  let opnameTerpilih: OpnameSessionSummary | null = null
  let opnameSebelumnya: OpnameSessionSummary | null = null
  let opnameItemMap = new Map<string, { qty_fisik: number | null; qty_system: number; selisih: number }>()
  let prevOpnameItemMap = new Map<string, number>()
  let auditNote: string | null = null

  if (params.mode === 'opname_session') {
    if (!params.opnameId) throw new Error('Parameter opnameId wajib diisi pada mode sesi opname')

    // Ambil opname terpilih
    const { data: curOpname, error: curErr } = await supabase
      .from('opname')
      .select('id, tanggal, tipe, status, notes, created_at, approved_at, outlet_staff!opname_created_by_fkey(name)')
      .eq('id', params.opnameId)
      .single()

    if (curErr || !curOpname) throw new Error('Sesi opname terpilih tidak ditemukan')

    opnameTerpilih = {
      id: curOpname.id,
      tanggal: curOpname.tanggal,
      tipe: curOpname.tipe,
      status: curOpname.status,
      notes: curOpname.notes,
      created_at: curOpname.created_at,
      approved_at: curOpname.approved_at,
      created_by_name: (curOpname as any).outlet_staff?.name || null,
      item_count: 0,
      flagged_count: 0,
    }
    auditNote = curOpname.notes

    endIso = curOpname.created_at

    // Ambil item opname terpilih
    const { data: curItems } = await supabase
      .from('opname_item')
      .select('bahan_baku_id, qty_fisik, qty_system, selisih')
      .eq('opname_id', curOpname.id)

    for (const item of curItems || []) {
      opnameItemMap.set(item.bahan_baku_id, {
        qty_fisik: item.qty_fisik,
        qty_system: item.qty_system,
        selisih: item.selisih,
      })
    }

    // Cari opname sebelumnya sebelum opname terpilih
    const { data: prevOpnameList } = await supabase
      .from('opname')
      .select('id, tanggal, tipe, status, notes, created_at, approved_at, outlet_staff!opname_created_by_fkey(name)')
      .eq('outlet_id', outletId)
      .eq('status', 'finalized')
      .lt('created_at', curOpname.created_at)
      .order('created_at', { ascending: false })
      .limit(1)

    if (prevOpnameList && prevOpnameList.length > 0) {
      const prev = prevOpnameList[0]
      opnameSebelumnya = {
        id: prev.id,
        tanggal: prev.tanggal,
        tipe: prev.tipe,
        status: prev.status,
        notes: prev.notes,
        created_at: prev.created_at,
        approved_at: prev.approved_at,
        created_by_name: (prev as any).outlet_staff?.name || null,
        item_count: 0,
        flagged_count: 0,
      }
      startIso = prev.created_at

      // Ambil item opname sebelumnya sebagai baseline Saldo Awal
      const { data: prevItems } = await supabase
        .from('opname_item')
        .select('bahan_baku_id, qty_fisik')
        .eq('opname_id', prev.id)

      for (const item of prevItems || []) {
        if (item.qty_fisik !== null && item.qty_fisik !== undefined) {
          prevOpnameItemMap.set(item.bahan_baku_id, item.qty_fisik)
        }
      }
    } else {
      // Jika belum ada opname sebelumnya, gunakan awal hari opname atau 7 hari sebelumnya
      const dateObj = new Date(curOpname.created_at)
      dateObj.setDate(dateObj.getDate() - 7)
      startIso = dateObj.toISOString()
    }
  } else {
    // Mode Rentang Tanggal Bebas
    const sDate = params.startDate || new Date().toISOString().slice(0, 10)
    const eDate = params.endDate || sDate
    startIso = `${sDate}T00:00:00+07:00`
    endIso = `${eDate}T23:59:59+07:00`

    // 1. Ambil opname terakhir yang terjadi pada atau sebelum startIso sebagai baseline Saldo Awal
    const { data: priorOpBeforeStart } = await supabase
      .from('opname')
      .select('id, tanggal, tipe, status, notes, created_at, approved_at, outlet_staff!opname_created_by_fkey(name)')
      .eq('outlet_id', outletId)
      .eq('status', 'finalized')
      .lte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(1)

    if (priorOpBeforeStart && priorOpBeforeStart.length > 0) {
      const prev = priorOpBeforeStart[0]
      opnameSebelumnya = {
        id: prev.id,
        tanggal: prev.tanggal,
        tipe: prev.tipe,
        status: prev.status,
        notes: prev.notes,
        created_at: prev.created_at,
        approved_at: prev.approved_at,
        created_by_name: (prev as any).outlet_staff?.name || null,
        item_count: 0,
        flagged_count: 0,
      }
      const { data: pItems } = await supabase
        .from('opname_item')
        .select('bahan_baku_id, qty_fisik')
        .eq('opname_id', prev.id)

      for (const item of pItems || []) {
        if (item.qty_fisik !== null && item.qty_fisik !== undefined) {
          prevOpnameItemMap.set(item.bahan_baku_id, Number(item.qty_fisik))
        }
      }
    }

    // 2. Ambil opname terakhir yang terjadi di dalam rentang tanggal (<= endIso) sebagai hasil hitung Stok Fisik
    const { data: endingOpInRange } = await supabase
      .from('opname')
      .select('id, tanggal, tipe, status, notes, created_at, approved_at, outlet_staff!opname_created_by_fkey(name)')
      .eq('outlet_id', outletId)
      .eq('status', 'finalized')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(1)

    if (endingOpInRange && endingOpInRange.length > 0) {
      const cur = endingOpInRange[0]
      opnameTerpilih = {
        id: cur.id,
        tanggal: cur.tanggal,
        tipe: cur.tipe,
        status: cur.status,
        notes: cur.notes,
        created_at: cur.created_at,
        approved_at: cur.approved_at,
        created_by_name: (cur as any).outlet_staff?.name || null,
        item_count: 0,
        flagged_count: 0,
      }
      auditNote = cur.notes

      const { data: eItems } = await supabase
        .from('opname_item')
        .select('bahan_baku_id, qty_fisik, qty_system, selisih')
        .eq('opname_id', cur.id)

      for (const item of eItems || []) {
        opnameItemMap.set(item.bahan_baku_id, {
          qty_fisik: item.qty_fisik,
          qty_system: item.qty_system,
          selisih: item.selisih,
        })
      }
    }
  }

  // 2. Cek Surat Jalan menggantung / in-transit di sekitar cut-off
  const { data: pendingSjList } = await supabase
    .from('surat_jalan')
    .select('id, document_number, status, created_at')
    .eq('outlet_id', outletId)
    .in('status', ['dikirim', 'in_transit', 'menunggu_verifikasi'])
    .lte('created_at', endIso)

  const pendingSjCount = pendingSjList?.length || 0

  // 3. Ambil Master Bahan Baku & Harga
  const [bahanRes, hargaRes] = await Promise.all([
    supabase
      .from('bahan_baku')
      .select('id, nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, satuan_distribusi, is_active')
      .eq('is_active', true)
      .order('kategori', { ascending: true })
      .order('nama', { ascending: true }),
    supabase
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli, kemasan_qty'),
  ])

  const hargaMap = new Map((hargaRes.data || []).map((h) => [h.bahan_baku_id, h]))
  // ASET (mis. printer) & PERLENGKAPAN (mis. ID card) bukan bahan baku -> tak ikut rekonsiliasi stok.
  const KATEGORI_NON_BAHAN = ['ASET', 'PERLENGKAPAN']
  const bahanList = (bahanRes.data || []).filter(
    (b) => !KATEGORI_NON_BAHAN.includes(String(b.kategori || '').toUpperCase())
  )

  // 4. Ambil mutasi dari ledger_stok antara startIso dan endIso
  let ledgerQuery = supabase
    .from('ledger_stok')
    .select('id, bahan_baku_id, tipe, qty, created_at, ref_shipment_id, ref_opname_id, ref_terima_vendor_id, ref_po_id, saldo_sebelum, saldo_sesudah')
    .eq('outlet_id', outletId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: true })

  const { data: rawLedgerRows, error: ledgerErr } = await ledgerQuery
  if (ledgerErr) throw new Error(`Gagal memuat mutasi ledger: ${ledgerErr.message}`)

  // Filter keluar baris 'opname_selisih' di JavaScript:
  // Catatan: 'opname_selisih' BUKAN mutasi operasional (bukan kiriman, pemakaian, atau waste).
  // Jika 'opname_selisih' dimasukkan ke mutasi, maka stok sistem otomatis dipaksa sama dengan fisik!
  const ledgerRows = (rawLedgerRows || []).filter((row) => row.tipe !== 'opname_selisih')

  // 5. Ambil harga pengadaan riil dari surat_jalan_item untuk transaksi terima_kiriman dalam periode
  const shipmentIds = [
    ...new Set(
      (ledgerRows || [])
        .map((l) => l.ref_shipment_id)
        .filter((v): v is string => !!v)
    ),
  ]

  const realPricesMap = new Map<string, number>() // key: `${shipmentId}_${bahanBakuId}` -> harga_snapshot
  if (shipmentIds.length > 0) {
    const { data: sjItems } = await supabase
      .from('surat_jalan_item')
      .select('surat_jalan_id, bahan_baku_id, harga_snapshot')
      .in('surat_jalan_id', shipmentIds)

    for (const item of sjItems || []) {
      if (item.harga_snapshot && item.harga_snapshot > 0) {
        realPricesMap.set(`${item.surat_jalan_id}_${item.bahan_baku_id}`, item.harga_snapshot)
      }
    }
  }

  const vendorOf = await resolveVendorNames(supabase, (ledgerRows || []) as any)
  const vendorMasukByBahan = new Map<string, Map<string, number>>()
  const vendorPakaiByBahan = new Map<string, Map<string, number>>()
  {
    const priorByBahan = await fetchPriorInflows(supabase, outletId, startIso, null)
    const rowsByBahan = new Map<string, any[]>()
    for (const r of ledgerRows || []) {
      const l = rowsByBahan.get(r.bahan_baku_id) || []
      l.push(r)
      rowsByBahan.set(r.bahan_baku_id, l)
    }
    for (const [bId, rs] of rowsByBahan) {
      const win: FifoWindowRow[] = rs.map((r) => ({
        id: r.id,
        qty: Number(r.qty || 0),
        vendor: Number(r.qty) > 0 ? vendorOf(r) : null,
      }))
      const attr = attributeFifo({
        openingBalance: Number(rs[0].saldo_sebelum || 0),
        priorInflowsNewestFirst: priorByBahan.get(bId) || [],
        windowRows: win,
      })
      const m = new Map<string, number>()
      for (const r of rs) {
        if (r.tipe !== 'pemakaian') continue
        for (const part of attr.get(r.id) || []) m.set(part.vendor, (m.get(part.vendor) || 0) + part.qty)
      }
      vendorPakaiByBahan.set(bId, m)
    }
  }

  // 5b. Ambil data penjualan menu POS untuk breakdown pemakaian bahan per item
  const menuUsageByBahan = new Map<string, MenuItemUsage[]>()
  const menuBreakdownList: MenuBomBreakdownItem[] = []


  const { data: ordersData } = await supabase
    .from('orders')
    .select('id')
    .eq('outlet_id', outletId)
    .eq('status', 'completed')
    .gte('created_at', startIso)
    .lte('created_at', endIso)

  const completedOrderIds = (ordersData || []).map((o) => o.id)

  if (completedOrderIds.length > 0) {
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    }

    const orderChunks = chunkArray(completedOrderIds, 200)
    const allOrderItems: { menu_item_id: string; menu_item_name: string | null; quantity: number }[] = []

    for (const chunk of orderChunks) {
      const { data: oiList } = await supabase
        .from('order_items')
        .select('menu_item_id, menu_item_name, quantity')
        .in('order_id', chunk)
        .not('menu_item_id', 'is', null)

      if (oiList) {
        allOrderItems.push(...(oiList as any))
      }
    }

    const soldMenuMap = new Map<string, { name: string; totalPorsi: number }>()
    for (const oi of allOrderItems) {
      const mid = String(oi.menu_item_id)
      const qty = Number(oi.quantity || 0)
      const existing = soldMenuMap.get(mid)
      if (existing) {
        existing.totalPorsi += qty
      } else {
        soldMenuMap.set(mid, {
          name: oi.menu_item_name || `Menu #${mid}`,
          totalPorsi: qty,
        })
      }
    }

    const menuItemIds = Array.from(soldMenuMap.keys())
    if (menuItemIds.length > 0) {
      // Ambil data menu_packages untuk mendeteksi apakah ada menu paket/combo yang terjual
      const { data: pkgList } = await supabase
        .from('menu_packages')
        .select('package_id, menu_item_id, quantity')
        .in('package_id', menuItemIds)

      // Kumpulkan semua menu_item_id yang butuh resep:
      // Menu langsung + komponen dari menu paket
      const pkgMap = new Map<string, { menu_item_id: string; quantity: number }[]>()
      const allMenuIdsToFetch = new Set<string>(menuItemIds)

      for (const p of pkgList || []) {
        let list = pkgMap.get(p.package_id)
        if (!list) {
          list = []
          pkgMap.set(p.package_id, list)
        }
        list.push({
          menu_item_id: p.menu_item_id,
          quantity: Number(p.quantity || 1),
        })
        allMenuIdsToFetch.add(p.menu_item_id)
      }

      const { data: resepList } = await supabase
        .from('resep')
        .select(`
          id,
          menu_item_ref,
          scope,
          outlet_id,
          resep_item (
            bahan_baku_id,
            qty_per_porsi,
            satuan
          )
        `)
        .in('menu_item_ref', Array.from(allMenuIdsToFetch))
        .eq('is_active', true)

      const activeResepPerMenu = new Map<string, any>()
      for (const r of resepList || []) {
        const ref = r.menu_item_ref
        const currentBest = activeResepPerMenu.get(ref)
        if (!currentBest) {
          if ((r.scope === 'outlet' && r.outlet_id === outletId) || r.scope === 'global') {
            activeResepPerMenu.set(ref, r)
          }
        } else if (currentBest.scope === 'global' && r.scope === 'outlet' && r.outlet_id === outletId) {
          activeResepPerMenu.set(ref, r)
        }
      }

      const bahanMap = new Map((bahanList || []).map((b) => [b.id, b]))

      for (const [mid, menuInfo] of soldMenuMap.entries()) {
        const directRecipe = activeResepPerMenu.get(mid)
        const hasDirectRecipe = !!(directRecipe && directRecipe.resep_item && directRecipe.resep_item.length > 0)
        const components = pkgMap.get(mid) || []
        const isPackage = components.length > 0

        let hasRecipe = hasDirectRecipe
        const ingredients: MenuBomIngredient[] = []

        if (isPackage) {
          // Kasus Menu Paket / Combo: Akumulasi BOM dari seluruh komponen paketnya
          const mergedIngredients = new Map<string, MenuBomIngredient>()
          let anyCompHasRecipe = false

          for (const comp of components) {
            const compResep = activeResepPerMenu.get(comp.menu_item_id)
            if (!compResep || !compResep.resep_item) continue
            anyCompHasRecipe = true

            for (const ri of (compResep as any).resep_item || []) {
              const bId = ri.bahan_baku_id
              const bObj = bahanMap.get(bId)
              const namaBahan = bObj?.nama || `Bahan #${bId.slice(0, 8)}`
              const satuan = ri.satuan || bObj?.satuan_kecil || bObj?.satuan || 'gr'
              const qtyPerPorsi = Number(ri.qty_per_porsi || 0) * comp.quantity
              const totalPemakaian = Math.round(menuInfo.totalPorsi * qtyPerPorsi * 100) / 100

              const existing = mergedIngredients.get(bId)
              if (existing) {
                existing.qty_per_porsi = Math.round((existing.qty_per_porsi + qtyPerPorsi) * 100) / 100
                existing.total_kebutuhan = Math.round((existing.total_kebutuhan + totalPemakaian) * 100) / 100
              } else {
                mergedIngredients.set(bId, {
                  bahan_baku_id: bId,
                  nama_bahan: namaBahan,
                  qty_per_porsi: qtyPerPorsi,
                  satuan,
                  total_kebutuhan: totalPemakaian,
                })
              }
            }
          }

          if (anyCompHasRecipe) {
            hasRecipe = true
            for (const ing of mergedIngredients.values()) {
              ingredients.push(ing)

              // Masukkan ke grouping pemakaian per bahan baku
              let list = menuUsageByBahan.get(ing.bahan_baku_id)
              if (!list) {
                list = []
                menuUsageByBahan.set(ing.bahan_baku_id, list)
              }
              list.push({
                menu_item_name: menuInfo.name,
                porsi_terjual: menuInfo.totalPorsi,
                qty_per_porsi: ing.qty_per_porsi,
                satuan: ing.satuan,
                total_pemakaian: ing.total_kebutuhan,
              })
            }
            ingredients.sort((a, b) => b.total_kebutuhan - a.total_kebutuhan)
          }
        } else if (hasDirectRecipe) {
          // Kasus Menu Single Biasa
          for (const ri of (directRecipe as any).resep_item || []) {
            const bId = ri.bahan_baku_id
            const bObj = bahanMap.get(bId)
            const namaBahan = bObj?.nama || `Bahan #${bId.slice(0, 8)}`
            const porsi = menuInfo.totalPorsi
            const qtyPerPorsi = Number(ri.qty_per_porsi || 0)
            const totalPemakaian = Math.round(porsi * qtyPerPorsi * 100) / 100
            const satuan = ri.satuan || bObj?.satuan_kecil || bObj?.satuan || 'gr'

            // Untuk grouping lama per bahan baku
            let list = menuUsageByBahan.get(bId)
            if (!list) {
              list = []
              menuUsageByBahan.set(bId, list)
            }
            list.push({
              menu_item_name: menuInfo.name,
              porsi_terjual: porsi,
              qty_per_porsi: qtyPerPorsi,
              satuan,
              total_pemakaian: totalPemakaian,
            })

            // Untuk breakdown terstruktur per menu (BOM)
            ingredients.push({
              bahan_baku_id: bId,
              nama_bahan: namaBahan,
              qty_per_porsi: qtyPerPorsi,
              satuan,
              total_kebutuhan: totalPemakaian,
            })
          }
          ingredients.sort((a, b) => b.total_kebutuhan - a.total_kebutuhan)
        }

        menuBreakdownList.push({
          menu_item_id: mid,
          menu_item_name: menuInfo.name,
          total_porsi: menuInfo.totalPorsi,
          has_recipe: hasRecipe,
          ingredients,
        })
      }

      menuBreakdownList.sort((a, b) => b.total_porsi - a.total_porsi)

      for (const list of menuUsageByBahan.values()) {
        list.sort((a, b) => b.total_pemakaian - a.total_pemakaian)
      }
    }
  }


  // Agregasi mutasi per bahan baku
  const movementMap = new Map<
    string,
    {
      firstSaldoSebelum: number | null
      lastSaldoSesudah: number | null
      masukQty: number
      masukRpRiilTotal: number
      hasRealPrice: boolean
      pakaiQty: number
      wasteQty: number
      mutasiLainQty: number
      rowCount: number
    }
  >()

  for (const row of ledgerRows || []) {
    let agg = movementMap.get(row.bahan_baku_id)
    if (!agg) {
      agg = {
        firstSaldoSebelum: row.saldo_sebelum !== null ? Number(row.saldo_sebelum) : null,
        lastSaldoSesudah: row.saldo_sesudah !== null ? Number(row.saldo_sesudah) : null,
        masukQty: 0,
        masukRpRiilTotal: 0,
        hasRealPrice: false,
        pakaiQty: 0,
        wasteQty: 0,
        mutasiLainQty: 0,
        rowCount: 0,
      }
      movementMap.set(row.bahan_baku_id, agg)
    }

    agg.lastSaldoSesudah = row.saldo_sesudah !== null ? Number(row.saldo_sesudah) : agg.lastSaldoSesudah
    agg.rowCount++

    const rawQty = Number(row.qty || 0)

    if (row.tipe === 'pemakaian') {
      agg.pakaiQty += Math.abs(rawQty)
    } else if (row.tipe === 'waste') {
      agg.wasteQty += Math.abs(rawQty)
    } else if (
      row.tipe === 'terima_kiriman' ||
      row.tipe === 'pembelian_supplier' ||
      row.tipe === 'transfer_masuk' ||
      (row.tipe === 'adjustment' && rawQty > 0)
    ) {
      agg.masukQty += Math.abs(rawQty)

      const vNama = vendorOf(row as any) || 'Vendor tidak tercatat'
      let vm = vendorMasukByBahan.get(row.bahan_baku_id)
      if (!vm) {
        vm = new Map()
        vendorMasukByBahan.set(row.bahan_baku_id, vm)
      }
      vm.set(vNama, (vm.get(vNama) || 0) + Math.abs(rawQty))

      // Cek apakah ada harga riil dari surat jalan
      if (row.ref_shipment_id) {
        const realPrice = realPricesMap.get(`${row.ref_shipment_id}_${row.bahan_baku_id}`)
        if (realPrice) {
          agg.masukRpRiilTotal += realPrice * Math.abs(rawQty)
          agg.hasRealPrice = true
        }
      }
    } else if (
      row.tipe === 'transfer_keluar' ||
      row.tipe === 'retur_supplier' ||
      (row.tipe === 'adjustment' && rawQty < 0)
    ) {
      // transfer_keluar, adjustment negatif, retur
      agg.mutasiLainQty += rawQty
    }
  }

  // 6. Susun tabel rekonsiliasi item per item
  const reconciliationItems: ReconciliationItem[] = []

  let totalAwalRp = 0
  let totalMasukRpMaster = 0
  let totalMasukRpRiil = 0
  let totalPakaiRp = 0
  let totalWasteRp = 0
  let totalSistemRp = 0
  let totalFisikRp = 0
  let totalSelisihRp = 0
  let berselisihCount = 0
  let anomaliSkalaCount = 0
  let ekstremCount = 0

  for (const b of bahanList) {
    const hargaRow = hargaMap.get(b.id)
    const hargaMaster = hargaRow?.harga_beli || 0
    const kemasanQty = Number(b.faktor_tampilan) || Number(hargaRow?.kemasan_qty) || 1
    const unitPriceKecil = kemasanQty > 0 ? hargaMaster / kemasanQty : hargaMaster

    const agg = movementMap.get(b.id)

    // Tentukan Saldo Awal:
    // 1) Dari opname sebelumnya jika ada
    // 2) Atau firstSaldoSebelum dari mutasi pertama di ledger
    // 3) Atau 0
    let saldoAwal = 0
    if (prevOpnameItemMap.has(b.id)) {
      saldoAwal = Number(prevOpnameItemMap.get(b.id) || 0)
    } else if (agg?.firstSaldoSebelum !== null && agg?.firstSaldoSebelum !== undefined) {
      saldoAwal = agg.firstSaldoSebelum
    }

    const masukQty = agg?.masukQty || 0
    const pakaiQty = agg?.pakaiQty || 0
    const wasteQty = agg?.wasteQty || 0
    const mutasiLainQty = agg?.mutasiLainQty || 0

    // Stok Ekspektasi Sistem = Awal + Masuk - Pakai - Waste + Mutasi Lain
    const stokSistem = Math.round((saldoAwal + masukQty - pakaiQty - wasteQty + mutasiLainQty) * 100) / 100

    // Stok Fisik dari opname (jika tidak ada opname, tetap null dan jangan dipalsukan dari saldo sistem!)
    let stokFisik: number | null = null
    const opItem = opnameItemMap.get(b.id)
    if (opItem && opItem.qty_fisik !== null && opItem.qty_fisik !== undefined) {
      stokFisik = Number(opItem.qty_fisik)
    }

    // Selisih = Fisik - Sistem
    const selisihQty = stokFisik !== null ? Math.round((stokFisik - stokSistem) * 100) / 100 : 0

    // Valuasi Rupiah
    const saldoAwalRp = Math.round(saldoAwal * unitPriceKecil)
    const masukRpMaster = Math.round(masukQty * unitPriceKecil)
    const masukRpRiil = agg?.hasRealPrice ? Math.round(agg.masukRpRiilTotal) : masukRpMaster
    const pakaiRp = Math.round(pakaiQty * unitPriceKecil)
    const wasteRp = Math.round(wasteQty * unitPriceKecil)
    const mutasiLainRp = Math.round(mutasiLainQty * unitPriceKecil)
    const stokSistemRp = Math.round(stokSistem * unitPriceKecil)
    const stokFisikRp = stokFisik !== null ? Math.round(stokFisik * unitPriceKecil) : null
    const selisihRp = stokFisik !== null ? Math.round(selisihQty * unitPriceKecil) : 0

    // Diagnostik Anomali
    const diagnostics: DiagnosticAlert[] = []

    // 1. Deteksi Skala / Salah Input Satuan (kelipatan faktor tampilan)
    if (stokFisik !== null && Math.abs(selisihQty) > 0 && kemasanQty > 1) {
      const absDiff = Math.abs(selisihQty)
      // Cek apakah selisih merupakan kelipatan tepat (atau toleransi +/- 2) dari faktor kemasan
      if (absDiff >= kemasanQty && (absDiff % kemasanQty === 0 || Math.abs((absDiff % kemasanQty) - kemasanQty) <= 2)) {
        const estUnitBesar = Math.round(absDiff / kemasanQty)
        diagnostics.push({
          type: 'ANOMALI_SKALA',
          severity: 'danger',
          message: `Selisih pas ${estUnitBesar} ${b.satuan} (${estUnitBesar * kemasanQty} ${b.satuan_kecil || 'gram'}). Kemungkinan salah input skala satuan!`,
        })
        anomaliSkalaCount++
      }
    }

    // 2. Deteksi Pemakaian POS vs Resep
    if (masukQty > 0 && pakaiQty === 0 && (b.kategori === 'FOOD & BEVERAGE' || b.kategori === 'BUMBU')) {
      diagnostics.push({
        type: 'BOM_MISMATCH',
        severity: 'warning',
        message: 'Bahan masuk & ada di outlet tapi pemakaian penjualan 0. Periksa mapping resep menu POS.',
      })
    }

    // 3. Deteksi Surat Jalan Gantung
    if (pendingSjCount > 0 && masukQty === 0) {
      diagnostics.push({
        type: 'SJ_GANTUNG',
        severity: 'info',
        message: `Terdapat ${pendingSjCount} Surat Jalan belum diverifikasi yang mungkin belum masuk ke stok ini.`,
      })
    }

    // 4. Peringatan Kerugian / Deviasi Nominal Ekstrem (>= Rp 50.000)
    if (Math.abs(selisihRp) >= 50000) {
      diagnostics.push({
        type: 'NOMINAL_EKSTREM',
        severity: 'danger',
        message: `Deviasi nominal tinggi (${selisihRp < 0 ? 'Kerugian' : 'Surplus'} Rp ${Math.abs(selisihRp).toLocaleString('id-ID')}).`,
      })
      ekstremCount++
    }

    if (Math.abs(selisihQty) > 0.01) {
      berselisihCount++
    }

    totalAwalRp += saldoAwalRp
    totalMasukRpMaster += masukRpMaster
    totalMasukRpRiil += masukRpRiil
    totalPakaiRp += pakaiRp
    totalWasteRp += wasteRp
    totalSistemRp += stokSistemRp
    if (stokFisikRp !== null) totalFisikRp += stokFisikRp
    totalSelisihRp += selisihRp

    const hasOpname = stokFisik !== null && stokFisik !== undefined
    let status: 'MATCH' | 'MINUS' | 'SURPLUS' | 'TIDAK_OPNAME' = 'TIDAK_OPNAME'
    let selisihPersen: number | null = null

    if (hasOpname) {
      if (Math.abs(selisihQty) <= 0.01) {
        status = 'MATCH'
      } else if (selisihQty < -0.01) {
        status = 'MINUS'
      } else {
        status = 'SURPLUS'
      }

      if (stokSistem !== 0) {
        selisihPersen = Math.round((selisihQty / Math.abs(stokSistem)) * 1000) / 10
      }
    }

    reconciliationItems.push({
      bahan_baku_id: b.id,
      nama: b.nama,
      kategori: b.kategori,
      satuan: b.satuan,
      satuan_tengah: b.satuan_tengah,
      faktor_tengah: b.faktor_tengah,
      satuan_kecil: b.satuan_kecil,
      faktor_tampilan: b.faktor_tampilan,
      harga_beli_master: hargaMaster,
      unit_price_kecil: unitPriceKecil,
      satuan_kirim: b.satuan_distribusi?.trim() || b.satuan,
      harga_master_kirim: (() => {
        const f = getDistribusiFactor(b as any)
        return f > 0 ? hargaMaster / f : hargaMaster
      })(),
      saldo_awal_qty: saldoAwal,
      masuk_qty: masukQty,
      pakai_qty: pakaiQty,
      waste_qty: wasteQty,
      mutasi_lain_qty: mutasiLainQty,
      stok_sistem_qty: stokSistem,
      stok_fisik_qty: stokFisik,
      selisih_qty: selisihQty,
      saldo_awal_rp: saldoAwalRp,
      masuk_rp_master: masukRpMaster,
      masuk_rp_riil: masukRpRiil,
      pakai_rp: pakaiRp,
      waste_rp: wasteRp,
      mutasi_lain_rp: mutasiLainRp,
      stok_sistem_rp: stokSistemRp,
      stok_fisik_rp: stokFisikRp,
      selisih_rp: selisihRp,
      has_opname: hasOpname,
      status,
      selisih_persen: selisihPersen,
      diagnostics,
      vendor_masuk: Array.from(vendorMasukByBahan.get(b.id)?.entries() || [])
        .map(([vendor_nama, qty]) => ({ vendor_nama, qty }))
        .sort((a, c) => c.qty - a.qty),
      vendor_pakai: Array.from(vendorPakaiByBahan.get(b.id)?.entries() || [])
        .map(([vendor_nama, qty]) => ({ vendor_nama, qty }))
        .sort((a, c) => c.qty - a.qty),
      menu_usages: menuUsageByBahan.get(b.id) || [],
    })
  }

  return {
    outlet: { id: outletId, name: outletName },
    period: {
      mode: params.mode,
      opname_terpilih: opnameTerpilih,
      opname_sebelumnya: opnameSebelumnya,
      start_date: startIso,
      end_date: endIso,
    },
    pending_surat_jalan_count: pendingSjCount,
    items: reconciliationItems,
    totals: {
      total_awal_rp: totalAwalRp,
      total_masuk_rp_master: totalMasukRpMaster,
      total_masuk_rp_riil: totalMasukRpRiil,
      total_pakai_rp: totalPakaiRp,
      total_waste_rp: totalWasteRp,
      total_sistem_rp: totalSistemRp,
      total_fisik_rp: totalFisikRp,
      total_selisih_rp: totalSelisihRp,
      bahan_berselisih_count: berselisihCount,
      anomali_skala_count: anomaliSkalaCount,
      ekstrem_count: ekstremCount,
    },
    menu_breakdown: menuBreakdownList,
    audit_note: auditNote,
  }
}


/**
 * Mengambil buku jurnal transaksi kronologis untuk satu bahan baku spesifik
 */
export async function fetchItemTransactionLedger(
  outletId: string,
  bahanBakuId: string,
  startDate: string,
  endDate: string
): Promise<LedgerTimelineRow[]> {
  await requireManagementAuth(outletId)
  const supabase = makeServiceClient()

  // Ambil data bahan baku & harga untuk konversi harga per unit
  const [bahanRes, hargaRes] = await Promise.all([
    supabase
      .from('bahan_baku')
      .select('id, nama, satuan, satuan_kecil, faktor_tampilan')
      .eq('id', bahanBakuId)
      .single(),
    supabase
      .from('bahan_baku_harga')
      .select('harga_beli, kemasan_qty')
      .eq('bahan_baku_id', bahanBakuId)
      .maybeSingle(),
  ])

  const bahan = bahanRes.data
  const kemasanQty = Number(bahan?.faktor_tampilan) || Number(hargaRes.data?.kemasan_qty) || 1
  const hargaMaster = Number(hargaRes.data?.harga_beli) || 0
  const unitPrice = kemasanQty > 0 ? hargaMaster / kemasanQty : hargaMaster

  // Query seluruh baris ledger_stok
  const { data: rows, error } = await supabase
    .from('ledger_stok')
    .select(`
      id,
      created_at,
      tipe,
      catatan,
      qty,
      saldo_sebelum,
      saldo_sesudah,
      ref_shipment_id,
      ref_order_id,
      ref_opname_id,
      ref_transfer_id,
      ref_terima_vendor_id,
      ref_po_id
    `)
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', bahanBakuId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Gagal memuat timeline mutasi: ${error.message}`)

  // Kumpulkan reference IDs untuk lookup nomor dokumen
  const shipmentIds = [...new Set((rows || []).map((r) => r.ref_shipment_id).filter((v): v is string => !!v))]
  const orderIds = [...new Set((rows || []).map((r) => r.ref_order_id).filter((v): v is string => !!v))]

  const [shipmentsRes, ordersRes] = await Promise.all([
    shipmentIds.length > 0
      ? supabase.from('surat_jalan').select('id, document_number').in('id', shipmentIds)
      : Promise.resolve({ data: [] }),
    orderIds.length > 0
      ? supabase.from('orders').select('id, order_number').in('id', orderIds)
      : Promise.resolve({ data: [] }),
  ])

  const sjDocMap = new Map((shipmentsRes.data || []).map((s: any) => [s.id, s.document_number]))
  const orderDocMap = new Map((ordersRes.data || []).map((o: any) => [o.id, `#${o.order_number}`]))

  const vendorOf = await resolveVendorNames(
    supabase,
    (rows || []).map((r: any) => ({ ...r, bahan_baku_id: bahanBakuId }))
  )

  const priorByBahan = await fetchPriorInflows(supabase, outletId, startDate, [bahanBakuId])
  const fifo = attributeFifo({
    openingBalance: Number((rows || [])[0]?.saldo_sebelum || 0),
    priorInflowsNewestFirst: priorByBahan.get(bahanBakuId) || [],
    windowRows: (rows || []).map((r: any) => ({
      id: r.id,
      qty: Number(r.qty || 0),
      vendor: Number(r.qty) > 0 ? vendorOf({ ...r, bahan_baku_id: bahanBakuId }) : null,
    })),
  })

  return (rows || []).map((r: any) => {
    const qty = Number(r.qty || 0)
    const isMasuk = qty > 0
    const debetRp = isMasuk ? Math.round(qty * unitPrice) : 0
    const kreditRp = !isMasuk ? Math.round(Math.abs(qty) * unitPrice) : 0
    const saldoSesudah = Number(r.saldo_sesudah || 0)
    const saldoSesudahRp = Math.round(saldoSesudah * unitPrice)

    let docNumber: string | null = null
    if (r.ref_shipment_id) docNumber = sjDocMap.get(r.ref_shipment_id) || 'SJ'
    else if (r.ref_order_id) docNumber = orderDocMap.get(r.ref_order_id) || 'Order'
    else if (r.ref_opname_id) docNumber = 'Opname'

    return {
      id: r.id,
      created_at: r.created_at,
      tipe: r.tipe,
      catatan: r.catatan,
      qty,
      harga_satuan: unitPrice,
      debet_rp: debetRp,
      kredit_rp: kreditRp,
      saldo_sesudah_qty: saldoSesudah,
      saldo_sesudah_rp: saldoSesudahRp,
      ref_shipment_id: r.ref_shipment_id,
      ref_order_id: r.ref_order_id,
      ref_opname_id: r.ref_opname_id,
      ref_transfer_id: r.ref_transfer_id,
      ref_doc_number: docNumber,
      vendor_estimasi: qty < 0 ? labelFifo(fifo.get(r.id)) : null,
      vendor_nama: qty > 0 ? vendorOf({ ...r, bahan_baku_id: bahanBakuId }) : null,
    }
  })
}

/**
 * Menyimpan catatan temuan audit manajemen pada sesi opname
 */
export async function saveOpnameAuditNote(opnameId: string, note: string): Promise<void> {
  const { staff } = await requireManagementAuth()
  const supabase = makeServiceClient()

  const formattedNote = `[Audit Manajemen ${staff.name} - ${new Date().toLocaleString('id-ID')}]: ${note}`

  const { error } = await supabase
    .from('opname')
    .update({
      notes: formattedNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opnameId)

  if (error) throw new Error(`Gagal menyimpan catatan audit: ${error.message}`)
}

/**
 * Mengambil detail bukti transaksi untuk modal pop-up (Surat Jalan, Waste, atau Order POS)
 */
export async function fetchProofDetails(type: 'surat_jalan' | 'waste' | 'order', id: string) {
  await requireManagementAuth()
  const supabase = makeServiceClient()

  if (type === 'surat_jalan') {
    const { data, error } = await supabase
      .from('surat_jalan')
      .select(`
        id,
        document_number,
        status,
        created_at,
        auto_verified_at,
        notes,
        outlets(name),
        surat_jalan_item(
          id,
          qty_dikirim,
          qty_terima,
          harga_snapshot,
          bahan_baku(nama, satuan)
        )
      `)

      .eq('id', id)
      .single()

    if (error) throw new Error(`Gagal memuat detail surat jalan: ${error.message}`)
    return { type: 'surat_jalan', data }
  }

  if (type === 'waste') {
    const { data, error } = await supabase
      .from('stok_waste_reports')
      .select(`
        id,
        qty,
        reason,
        photo_url,
        status,
        created_at,
        reported_by_staff:outlet_staff!reported_by(name),
        approved_by_staff:outlet_staff!approved_by(name),
        bahan_baku(nama, satuan)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Gagal memuat detail waste: ${error.message}`)
    return { type: 'waste', data }
  }

  if (type === 'order') {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        total_amount,
        order_items(id, menu_item_name, quantity, unit_price)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Gagal memuat detail order: ${error.message}`)
    return { type: 'order', data }
  }

  throw new Error('Tipe bukti tidak valid')
}
