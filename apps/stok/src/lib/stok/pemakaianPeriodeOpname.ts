import { isMutasiOrder, pemakaianPosPerBahan, type BarisMutasi } from './mutasiOrder'
import { ambilWaktuTutupOpname } from './waktuTutupOpname'

type SupabaseLike = {
  from: (table: string) => any
}

export interface OpnameWindowTarget {
  id: string
  created_at: string
  updated_at?: string | null
  status?: string | null
}

/**
 * Tarik seluruh halaman PostgREST (cap server = 1.000 baris) agar outlet ramai
 * tidak kehilangan baris pemakaian di periode opname.
 */
async function fetchAllPages<T>(build: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < pageSize) return all
  }
}

/**
 * Menghitung total Pemakaian POS bersih per bahan (dalam satuan kecil / gram)
 * untuk jendela periode opname satu outlet:
 *   [waktu tutup opname finalized sebelumnya, waktu tutup opname ini / sekarang]
 *
 * Aturan jendela, pembatalan order lintas periode, dan normalisasi skala
 * `saldo_is_gram = false` dibuat IDENTIK dengan `fetchReconciliationSnapshot`
 * di `jurnalMutasi.ts` agar status threshold antara Form Opname, Server
 * Validation (`upsertOpnameItems`), Detail Opname, Jurnal Rekonsiliasi, dan PDF
 * selalu 100% sinkron.
 */
export async function hitungPemakaianPosPeriodeOpname(
  supabase: SupabaseLike,
  params: {
    outletId: string
    opname?: OpnameWindowTarget | null
    nowIso?: string
  },
): Promise<Record<string, number>> {
  const { outletId, opname } = params
  const nowIso = params.nowIso ?? new Date().toISOString()

  // 1. Batas akhir periode (endIso)
  const endIso =
    opname && opname.status === 'finalized'
      ? await ambilWaktuTutupOpname(supabase, opname)
      : nowIso

  const refCreatedAt = opname?.created_at ?? endIso

  // 2. Batas awal periode (startIso) = tutup opname finalized sebelumnya (atau 7 hari lalu)
  let prevQuery = supabase
    .from('opname')
    .select('id, created_at, updated_at, status')
    .eq('outlet_id', outletId)
    .eq('status', 'finalized')
    .lt('created_at', refCreatedAt)
    .order('created_at', { ascending: false })
    .limit(1)

  if (opname?.id) {
    prevQuery = prevQuery.neq('id', opname.id)
  }

  const { data: prevList, error: prevErr } = await prevQuery
  if (prevErr) throw new Error(`Gagal memuat opname sebelumnya: ${prevErr.message}`)

  let startIso: string
  if (prevList && prevList.length > 0) {
    startIso = await ambilWaktuTutupOpname(supabase, prevList[0])
  } else {
    const baseMs = Date.parse(refCreatedAt)
    startIso = new Date((Number.isNaN(baseMs) ? Date.now() : baseMs) - 7 * 86_400_000).toISOString()
  }

  // 3. Tarik mutasi pemakaian & adjustment dalam periode [startIso, endIso]
  const inWindowRaw = await fetchAllPages<any>(() =>
    supabase
      .from('ledger_stok')
      .select('id, bahan_baku_id, tipe, qty, created_at, ref_order_id')
      .eq('outlet_id', outletId)
      .in('tipe', ['pemakaian', 'adjustment'])
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
  )

  const relevantInWindow = inWindowRaw.filter((r) => isMutasiOrder(r) || r.tipe === 'pemakaian')
  if (relevantInWindow.length === 0) return {}

  // 4. Tarik baris order yang sama di luar periode (pembalik batal belakangan / potongan sebelum periode)
  const orderIds = [
    ...new Set(
      relevantInWindow
        .filter((r) => isMutasiOrder(r))
        .map((r) => r.ref_order_id as string),
    ),
  ]

  const outsideRowsRaw: any[] = []
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200)
    const fetchedChunk = await fetchAllPages<any>(() =>
      supabase
        .from('ledger_stok')
        .select('id, bahan_baku_id, tipe, qty, created_at, ref_order_id')
        .eq('outlet_id', outletId)
        .in('ref_order_id', chunk)
        .in('tipe', ['pemakaian', 'adjustment'])
        .or(`created_at.lt."${startIso}",created_at.gt."${endIso}"`)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
    )
    outsideRowsRaw.push(...fetchedChunk)
  }

  // 5. Normalisasi skala satuan kecil apabila ada bahan yang belum gram-scale
  const { data: notGramRows } = await supabase
    .from('stok_balance')
    .select('bahan_baku_id')
    .eq('outlet_id', outletId)
    .eq('saldo_is_gram', false)

  const notGramIds = new Set<string>((notGramRows ?? []).map((r: any) => r.bahan_baku_id))
  const faktorMap = new Map<string, number>()

  if (notGramIds.size > 0) {
    const idsArr = Array.from(notGramIds)
    const [bahanRes, hargaRes] = await Promise.all([
      supabase
        .from('bahan_baku')
        .select('id, faktor_tampilan, faktor_konversi')
        .in('id', idsArr),
      supabase
        .from('bahan_baku_harga')
        .select('bahan_baku_id, kemasan_qty')
        .in('bahan_baku_id', idsArr),
    ])
    const hargaByBahan = new Map<string, number>(
      (hargaRes.data ?? []).map((h: any) => [h.bahan_baku_id, Number(h.kemasan_qty) || 0]),
    )
    for (const b of bahanRes.data ?? []) {
      const f =
        Number(b.faktor_tampilan) ||
        Number(b.faktor_konversi) ||
        hargaByBahan.get(b.id) ||
        1
      faktorMap.set(b.id, f > 0 ? f : 1)
    }
  }

  const normalize = (row: any): BarisMutasi => {
    const qty = Number(row.qty || 0)
    const f = notGramIds.has(row.bahan_baku_id) ? (faktorMap.get(row.bahan_baku_id) || 1) : 1
    return {
      tipe: row.tipe,
      qty: f > 1 ? qty * f : qty,
      created_at: row.created_at,
      ref_order_id: row.ref_order_id,
      bahan_baku_id: row.bahan_baku_id,
    }
  }

  const allNormalized = [
    ...relevantInWindow.map(normalize),
    ...outsideRowsRaw.map(normalize),
  ]

  const mapHasil = pemakaianPosPerBahan(allNormalized, startIso, endIso)
  const out: Record<string, number> = {}
  for (const [bahanId, qty] of mapHasil.entries()) {
    if (bahanId && qty > 0) {
      out[bahanId] = Math.round(qty * 100) / 100
    }
  }
  return out
}
