'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { canViewVendorPrices } from '@/lib/stok/navAccess'

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

// Gerbang BACA harga master. Action di file ini memakai service-role client
// (bypass RLS) dan tiap export 'use server' adalah endpoint POST publik —
// menyembunyikan menu tidak melindungi apa pun. Daftar role = navAccess
// (sama dengan menu), supaya menu & server tak bisa beda aturan.
async function requirePriceReader(): Promise<void> {
  const authedClient = await getAuthedClient()
  const { data: { user }, error: userError } = await authedClient.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized: Tidak ada sesi aktif pengguna')
  }

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !canViewVendorPrices(staff.role)) {
    throw new Error('Forbidden: role Anda tidak berhak melihat Harga Master')
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
  await requirePriceReader()
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
