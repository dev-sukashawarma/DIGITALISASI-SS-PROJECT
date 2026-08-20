'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

const AUTHORIZED_ROLES = ['admin', 'owner', 'finance', 'purchasing', 'spv'] as const

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

async function requirePriceMasterEditor(): Promise<{ userId: string; userRole: string; userName: string }> {
  const authedClient = await getAuthedClient()
  const { data: { user }, error: userError } = await authedClient.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized: Tidak ada sesi aktif pengguna')
  }
  const userId = user.id

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status, name')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  
  // Jika staff aktif dan role ada di daftar otorisasi
  if (!staff || staff.status !== 'active' || !(AUTHORIZED_ROLES as readonly string[]).includes(staff.role)) {
    throw new Error('Forbidden: Hanya Admin / Finance / Purchasing / SPV yang berhak mengubah Harga Master')
  }

  return { userId, userRole: staff.role, userName: staff.name || 'User' }
}

export type SyncMasterItemInput = {
  bahan_baku_id: string
  harga_baru: number
  ref_po_id?: string | null
  catatan?: string | null
}

export async function syncMasterPriceAction(items: SyncMasterItemInput[]) {
  if (!items || items.length === 0) {
    throw new Error('Tidak ada item bahan baku yang dipilih untuk disinkronkan')
  }

  const { userId, userName } = await requirePriceMasterEditor()
  const supabase = makeServiceClient()

  const results: { bahan_baku_id: string; success: boolean; error?: string }[] = []

  for (const item of items) {
    try {
      // 1. Ambil harga lama saat ini
      const { data: currentPriceRow } = await supabase
        .from('bahan_baku_harga')
        .select('harga_beli')
        .eq('bahan_baku_id', item.bahan_baku_id)
        .maybeSingle()

      const hargaLama = currentPriceRow?.harga_beli ?? null

      // 2. Upsert ke tabel master bahan_baku_harga
      const { error: upsertErr } = await supabase
        .from('bahan_baku_harga')
        .upsert({
          bahan_baku_id: item.bahan_baku_id,
          harga_beli: item.harga_baru,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'bahan_baku_id'
        })

      if (upsertErr) throw upsertErr

      // 3. Catat riwayat audit ke bahan_baku_harga_history
      const { error: histErr } = await supabase
        .from('bahan_baku_harga_history')
        .insert({
          bahan_baku_id: item.bahan_baku_id,
          harga_lama: hargaLama,
          harga_baru: item.harga_baru,
          ref_po_id: item.ref_po_id || null,
          catatan: item.catatan || `Sinkronisasi dari PO Vendor oleh ${userName}`,
          changed_by: userId,
          changed_at: new Date().toISOString()
        })

      if (histErr) {
        console.warn('Gagal mencatat history perubahan harga:', histErr.message)
      }

      results.push({ bahan_baku_id: item.bahan_baku_id, success: true })
    } catch (err: any) {
      console.error(`Gagal sync harga master untuk ${item.bahan_baku_id}:`, err)
      results.push({ bahan_baku_id: item.bahan_baku_id, success: false, error: err.message })
    }
  }

  const successCount = results.filter(r => r.success).length
  if (successCount === 0 && items.length > 0) {
    throw new Error('Gagal memperbarui harga master: ' + (results[0]?.error || 'Terjadi kesalahan sistem'))
  }

  return {
    success: true,
    total: items.length,
    successCount,
    failedCount: items.length - successCount,
    results
  }
}

export type FluktuasiHargaItem = {
  bahan_baku_id: string
  kode: string
  nama: string
  satuan: string
  kategori_id: string | null
  kategori_nama: string
  harga_master: number | null
  harga_terakhir: number | null
  effective_harga: number | null
  tgl_po_terakhir: string | null
  nomor_po_terakhir: string | null
  supplier_terakhir: string | null
  po_id_terakhir: string | null
  harga_sebelumnya: number | null
  tgl_po_sebelumnya: string | null
  nomor_po_sebelumnya: string | null
  supplier_sebelumnya: string | null
  po_id_sebelumnya: string | null
  selisih_nominal_prev: number | null
  selisih_pct_prev: number | null
  selisih_nominal_master: number | null
  selisih_pct_master: number | null
  total_transaksi_po: number
  trend_prices: number[]
}

export async function getFluktuasiHargaAction(days: number | null = 30): Promise<FluktuasiHargaItem[]> {
  const supabase = makeServiceClient()
  const sinceDate = days ? new Date(Date.now() - days * 86400000).toISOString().split('T')[0] : null

  // 1. Ambil seluruh bahan baku aktif
  const { data: bahanRows, error: bbErr } = await supabase
    .from('bahan_baku')
    .select('id, nama, satuan, kategori, kategori_core')
    .eq('is_active', true)
    .order('nama', { ascending: true })

  if (bbErr) throw new Error(bbErr.message)
  if (!bahanRows || bahanRows.length === 0) return []

  const bbIds = bahanRows.map((b: any) => b.id)

  // 2. Ambil harga master dari bahan_baku_harga
  const { data: hargaRows, error: hgErr } = await supabase
    .from('bahan_baku_harga')
    .select('bahan_baku_id, harga_beli, harga_beli_display')
    .in('bahan_baku_id', bbIds)

  if (hgErr) {
    console.warn('Error fetching bahan_baku_harga:', hgErr.message)
  }

  const hargaMasterMap = new Map<string, number | null>(
    (hargaRows ?? []).map((h: any) => [h.bahan_baku_id, h.harga_beli_display ?? h.harga_beli ?? null])
  )

  // 3. Ambil PO yang valid (diterima)
  let poQuery = supabase
    .from('purchase_order')
    .select('id, nomor_po, supplier_nama, tanggal_po, status, created_at')
    .in('status', ['diterima_lengkap', 'sebagian_diterima'])
    .order('tanggal_po', { ascending: false })

  if (sinceDate) {
    poQuery = poQuery.gte('tanggal_po', sinceDate)
  }

  const { data: poRows, error: poErr } = await poQuery
  if (poErr) console.warn('Error fetching purchase_order:', poErr.message)

  const validPoIds = (poRows ?? []).map((p: any) => p.id)
  const poMap = new Map((poRows ?? []).map((p: any) => [p.id, p]))

  // 4. Ambil item PO
  let items: any[] = []
  if (validPoIds.length > 0) {
    const { data: itemRows, error: itemErr } = await supabase
      .from('purchase_order_item')
      .select('purchase_order_id, bahan_baku_id, harga_terima')
      .in('purchase_order_id', validPoIds)
      .not('harga_terima', 'is', null)
      .gt('harga_terima', 0)

    if (itemErr) console.warn('Error fetching purchase_order_item:', itemErr.message)
    items = itemRows ?? []
  }

  // Kelompokkan item per bahan_baku_id
  const itemsByBahan = new Map<string, Array<{ harga: number; po: any }>>()
  for (const item of items) {
    const po = poMap.get(item.purchase_order_id)
    if (!po) continue
    if (!itemsByBahan.has(item.bahan_baku_id)) {
      itemsByBahan.set(item.bahan_baku_id, [])
    }
    itemsByBahan.get(item.bahan_baku_id)!.push({
      harga: item.harga_terima,
      po
    })
  }

  // 5. Susun hasil
  const results: FluktuasiHargaItem[] = []

  for (const bb of bahanRows as any[]) {
    const txList = itemsByBahan.get(bb.id) ?? []
    txList.sort((a, b) => new Date(b.po.tanggal_po).getTime() - new Date(a.po.tanggal_po).getTime())

    const latest = txList[0] || null
    const prev = txList[1] || null
    const rawMaster = hargaMasterMap.get(bb.id) ?? null
    const hargaMaster = rawMaster != null ? Number(rawMaster) : null

    const hargaTerakhir = latest?.harga != null ? Number(latest.harga) : null
    const effectiveHarga = hargaTerakhir ?? hargaMaster
    const hargaSebelumnya = prev?.harga != null ? Number(prev.harga) : null

    let selisihNominalPrev: number | null = null
    let selisihPctPrev: number | null = null
    if (hargaTerakhir !== null && hargaSebelumnya !== null) {
      selisihNominalPrev = hargaTerakhir - hargaSebelumnya
      selisihPctPrev = hargaSebelumnya > 0 ? (hargaTerakhir - hargaSebelumnya) / hargaSebelumnya : null
    }

    let selisihNominalMaster: number | null = null
    let selisihPctMaster: number | null = null
    if (hargaTerakhir !== null && hargaMaster !== null) {
      selisihNominalMaster = hargaTerakhir - hargaMaster
      selisihPctMaster = hargaMaster > 0 ? (hargaTerakhir - hargaMaster) / hargaMaster : null
    }

    const recentTx = txList.slice(0, 8).reverse()
    const trendPrices = recentTx.map(t => Number(t.harga))

    results.push({
      bahan_baku_id: bb.id,
      kode: '',
      nama: bb.nama,
      satuan: bb.satuan || '',
      kategori_id: null,
      kategori_nama: bb.kategori || bb.kategori_core || 'Lainnya',
      harga_master: hargaMaster,
      harga_terakhir: hargaTerakhir,
      effective_harga: effectiveHarga,
      tgl_po_terakhir: latest?.po.tanggal_po || null,
      nomor_po_terakhir: latest?.po.nomor_po || null,
      supplier_terakhir: latest?.po.supplier_nama || null,
      po_id_terakhir: latest?.po.id || null,
      harga_sebelumnya: hargaSebelumnya,
      tgl_po_sebelumnya: prev?.po.tanggal_po || null,
      nomor_po_sebelumnya: prev?.po.nomor_po || null,
      supplier_sebelumnya: prev?.po.supplier_nama || null,
      po_id_sebelumnya: prev?.po.id || null,
      selisih_nominal_prev: selisihNominalPrev,
      selisih_pct_prev: selisihPctPrev,
      selisih_nominal_master: selisihNominalMaster,
      selisih_pct_master: selisihPctMaster,
      total_transaksi_po: txList.length,
      trend_prices: trendPrices
    })
  }

  return results
}
