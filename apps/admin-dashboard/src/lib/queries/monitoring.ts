import { createSupabaseBrowserClient } from '@suka/auth';
import { TEST_OUTLET_ID } from '@/lib/outletFilters';
import type { DetailItem } from '@/lib/types/monitoring';

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Verify current session has access to outletId using accessible_outlet_ids() RPC.
 */
async function assertOutletAccessible(supabase: SupabaseBrowserClient, outletId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('accessible_outlet_ids');
  if (error) throw error;

  const allowed = new Set(
    (data || []).map((row: unknown) =>
      typeof row === 'string' ? row : (row as { accessible_outlet_ids?: string })?.accessible_outlet_ids
    )
  );

  if (!allowed.has(outletId)) {
    throw new Error('Access denied: cannot view this outlet');
  }
}

/**
 * Batch-join satuan_kecil/faktor_tampilan dari bahan_baku ke item monitoring
 */
async function attachSatuanKecil<T extends { bahan_baku_id: string }>(
  supabase: SupabaseBrowserClient,
  items: T[]
): Promise<(T & { satuan_kecil: string | null; satuan_tengah: string | null; faktor_tampilan: number | null; faktor_tengah: number | null; kategori_core: string | null })[]> {
  const ids = [...new Set(items.map((i) => i.bahan_baku_id))];
  if (ids.length === 0) return items as (T & { satuan_kecil: string | null; satuan_tengah: string | null; faktor_tampilan: number | null; faktor_tengah: number | null; kategori_core: string | null })[];

  const { data } = await supabase
    .from('bahan_baku')
    .select('id, satuan_kecil, satuan_tengah, faktor_tampilan, faktor_tengah, kategori_core')
    .in('id', ids);

  const map = new Map((data ?? []).map((b) => [b.id, b]));
  return items.map((item) => ({
    ...item,
    satuan_kecil: map.get(item.bahan_baku_id)?.satuan_kecil ?? null,
    satuan_tengah: map.get(item.bahan_baku_id)?.satuan_tengah ?? null,
    faktor_tampilan: map.get(item.bahan_baku_id)?.faktor_tampilan ?? null,
    faktor_tengah: map.get(item.bahan_baku_id)?.faktor_tengah ?? null,
    kategori_core: map.get(item.bahan_baku_id)?.kategori_core ?? null,
  }));
}

/**
 * Fetch all rows with pagination past 1000 rows PostgREST limit
 */
async function fetchAllRows<T>(
  supabase: SupabaseBrowserClient,
  view: string,
  selectStr: string
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(view)
      .select(selectStr)
      .order('outlet_name')
      .order('item_name')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all = all.concat(rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/**
 * Fetch monitoring data for SPV / Admin (multi-outlet view)
 */
export async function fetchSPVMonitoringData() {
  const supabase = createSupabaseBrowserClient();
  const data = await fetchAllRows<any>(
    supabase,
    'monitoring_view_spv',
    'outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged, kategori, last_opname_date, saldo_is_gram'
  );

  // Deduplicate by composite key (outlet_id, bahan_baku_id)
  const seen = new Set<string>();
  const dedupedItems = (data || []).filter((item) => {
    const key = `${item.outlet_id}-${item.bahan_baku_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const enrichedItems = await attachSatuanKecil(supabase, dedupedItems);

  return {
    items: enrichedItems,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch monitoring data scoped to caller's accessible outlets
 */
export async function fetchLeaderMonitoringData() {
  const supabase = createSupabaseBrowserClient();
  const data = await fetchAllRows<any>(
    supabase,
    'monitoring_view_scoped',
    'outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged, kategori, last_opname_date, saldo_is_gram'
  );

  const seen = new Set<string>();
  const dedupedItems = (data || []).filter((item) => {
    const key = `${item.outlet_id}-${item.bahan_baku_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const enrichedItems = await attachSatuanKecil(supabase, dedupedItems);

  return {
    items: enrichedItems,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Salinan identik pilihWaktuTutupOpname + ambilWaktuTutupOpname di
 * apps/stok/src/lib/stok/waktuTutupOpname.ts (ber-test di sana) — ubah
 * keduanya bersamaan. Batas opname di ledger = saat finalisasi (baris
 * opname_selisih pertama → updated_at → created_at), bukan saat draf dibuat.
 */
async function ambilWaktuTutupOpname(
  supabase: SupabaseBrowserClient,
  opname: { id: string; created_at: string; updated_at?: string | null; status?: string | null }
): Promise<string> {
  const { data } = await supabase
    .from('ledger_stok')
    .select('created_at')
    .eq('ref_opname_id', opname.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data?.created_at) return data.created_at;
  if (opname.status === 'finalized' && opname.updated_at) return opname.updated_at;
  return opname.created_at;
}

/**
 * Salinan identik pemakaianPosPeriode di apps/stok/src/lib/stok/mutasiOrder.ts
 * (ber-test di sana) — ubah keduanya bersamaan. Tiap order diatribusikan ke
 * periode potongan PERTAMANYA dengan neto SELURUH mutasinya (pembalik yang
 * datang belakangan ikut mengurangi; pembalik order lama diabaikan).
 * `rows` = baris periode + baris order yang sama di luar periode.
 */
function pemakaianPosPeriode(
  rows: { tipe: string; qty: number | string | null; ref_order_id?: string | null; created_at: string }[],
  startIso: string,
  endIso: string
): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const potonganPertama = new Map<string, number>();
  const neto = new Map<string, number>();
  let pakaiLain = 0;
  for (const row of rows) {
    const qty = Number(row.qty || 0);
    const t = Date.parse(row.created_at);
    const isOrder = !!row.ref_order_id && (row.tipe === 'pemakaian' || row.tipe === 'adjustment');
    if (isOrder) {
      const id = row.ref_order_id as string;
      if (row.tipe === 'pemakaian') {
        const cur = potonganPertama.get(id);
        if (cur === undefined || t < cur) potonganPertama.set(id, t);
      }
      neto.set(id, (neto.get(id) || 0) + qty);
    } else if (row.tipe === 'pemakaian' && t >= start && t <= end) {
      pakaiLain += Math.abs(qty);
    }
  }
  let pakaiOrder = 0;
  for (const [id, n] of neto) {
    const t = potonganPertama.get(id);
    if (t === undefined || t < start || t > end) continue;
    if (n < 0) pakaiOrder += -n;
  }
  return pakaiLain + pakaiOrder;
}

/**
 * Pemakaian POS satu bahan untuk opname yang ditampilkan — jendela & aturan
 * SAMA dengan kolom Pemakaian POS di Jurnal Rekonsiliasi: dari opname
 * finalized sebelumnya s/d opname ini (tanpa opname sebelumnya: 7 hari).
 * Dulu dijumlah dari 30 baris pemakaian TERAKHIR pada hari kalender opname:
 * terpotong di outlet ramai, menyusut tiap penjualan sesudah opname, dan
 * jendelanya tak sama dengan jurnal.
 */
async function fetchPemakaianPosOpname(
  supabase: SupabaseBrowserClient,
  outletId: string,
  bahanBakuId: string,
  opname: { id: string; created_at: string; updated_at?: string | null; status?: string | null }
): Promise<number> {
  const { data: prev } = await supabase
    .from('opname')
    .select('id, created_at, updated_at, status')
    .eq('outlet_id', outletId)
    .eq('status', 'finalized')
    .lt('created_at', opname.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  // Batas jendela = saat finalisasi, bukan saat draf dibuat (sama dengan jurnal).
  const end = await ambilWaktuTutupOpname(supabase, opname);
  const start = prev
    ? await ambilWaktuTutupOpname(supabase, prev)
    : new Date(new Date(opname.created_at).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  type Baris = { tipe: string; qty: number | string | null; ref_order_id: string | null; created_at: string };
  const ambil = async (build: () => any): Promise<Baris[] | null> => {
    const PAGE = 1000;
    const out: Baris[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build().range(from, from + PAGE - 1);
      if (error) {
        console.error('[fetchItemDetail] pemakaian POS:', error);
        return null;
      }
      out.push(...(data ?? []));
      if (!data || data.length < PAGE) return out;
    }
  };
  const base = () =>
    supabase
      .from('ledger_stok')
      .select('tipe, qty, ref_order_id, created_at')
      .eq('outlet_id', outletId)
      .eq('bahan_baku_id', bahanBakuId)
      .in('tipe', ['pemakaian', 'adjustment']);

  const rows = await ambil(() =>
    base().gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true }).order('id', { ascending: true })
  );
  if (!rows) return 0;
  // Baris order yang sama di luar periode (pembalik terlambat / potongan lebih awal).
  const orderIds = [...new Set(rows.filter((r) => r.ref_order_id).map((r) => r.ref_order_id as string))];
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const luar = await ambil(() =>
      base()
        .in('ref_order_id', chunk)
        .or(`created_at.lt."${start}",created_at.gt."${end}"`)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    );
    if (!luar) return 0;
    rows.push(...luar);
  }
  return pemakaianPosPeriode(rows, start, end);
}

/**
 * Fetch detailed item info for modal inspection
 */
export async function fetchItemDetail(outletId: string, bahan_baku_id: string): Promise<DetailItem> {
  const supabase = createSupabaseBrowserClient();
  await assertOutletAccessible(supabase, outletId);

  const [
    { data: itemData, error: itemError },
    { data: bahanExtra },
    { data: ledgerData, error: ledgerError },
    { data: opnameRow },
  ] = await Promise.all([
    supabase
      .from('monitoring_view_spv')
      .select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged, kategori, last_opname_date, saldo_is_gram')
      .eq('outlet_id', outletId)
      .eq('bahan_baku_id', bahan_baku_id)
      .maybeSingle(),
    supabase
      .from('bahan_baku')
      .select('satuan_kecil, satuan_tengah, faktor_tampilan, faktor_tengah')
      .eq('id', bahan_baku_id)
      .maybeSingle(),
    supabase
      .from('ledger_stok')
      .select('type:tipe, qty, notes:catatan, created_at')
      .eq('outlet_id', outletId)
      .eq('bahan_baku_id', bahan_baku_id)
      .order('created_at', { ascending: false })
      .limit(5),
    // Query dari tabel opname (bukan opname_item): order dengan
    // referencedTable hanya mengurutkan isi embed, BUKAN baris induk, sehingga
    // limit(1) dulu mengambil opname sembarang (mis. sebulan lalu).
    supabase
      .from('opname')
      .select('id, created_at, updated_at, status, opname_item!inner(qty_system, qty_fisik, catatan, flagged)')
      .eq('outlet_id', outletId)
      .eq('opname_item.bahan_baku_id', bahan_baku_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (itemError) throw itemError;
  if (ledgerError) throw ledgerError;

  const opnameItem = (opnameRow?.opname_item as any[] | undefined)?.[0];
  const opnameData = opnameItem
    ? { ...opnameItem, opname: { created_at: opnameRow!.created_at } }
    : null;

  const isGudang = (itemData?.outlet_name || '').toUpperCase().includes('GUDANG');
  const showDiscrepancy = !isGudang && !!opnameData?.flagged;

  const pemakaianPos = showDiscrepancy && opnameRow?.created_at
    ? await fetchPemakaianPosOpname(supabase, outletId, bahan_baku_id, opnameRow)
    : 0;

  const discrepancyDetails = showDiscrepancy && opnameData
    ? {
        type: opnameData.qty_fisik < opnameData.qty_system ? ('qty_mismatch' as const) : ('damaged' as const),
        qty_system: opnameData.qty_system,
        qty_fisik: opnameData.qty_fisik,
        catatan: opnameData.catatan || '',
        pemakaian_bom: pemakaianPos > 0 ? pemakaianPos : undefined,
      }
    : undefined;

  return {
    ...itemData,
    satuan_kecil: bahanExtra?.satuan_kecil ?? null,
    satuan_tengah: bahanExtra?.satuan_tengah ?? null,
    faktor_tampilan: bahanExtra?.faktor_tampilan ?? null,
    faktor_tengah: bahanExtra?.faktor_tengah ?? null,
    recent_ledger: ledgerData || [],
    discrepancy_details: discrepancyDetails,
  };
}

export type LedgerFeedTipe =
  | 'terima_kiriman' | 'pemakaian' | 'waste' | 'adjustment'
  | 'opname_selisih' | 'transfer_keluar' | 'transfer_masuk' | 'rejected_kiriman';

export interface LedgerFeedEntry {
  id: string;
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string;
  tipe: LedgerFeedTipe;
  qty: number;
  catatan: string | null;
  saldo_sesudah: number | null;
  created_at: string;
  satuan_kecil?: string | null;
  satuan_tengah?: string | null;
  faktor_tampilan?: number | null;
  faktor_tengah?: number | null;
  kategori_core?: string | null;
  saldo_is_gram?: boolean;
}

async function attachSaldoIsGram<T extends { outlet_id: string; bahan_baku_id: string }>(
  supabase: SupabaseBrowserClient,
  items: T[]
): Promise<(T & { saldo_is_gram: boolean })[]> {
  if (items.length === 0) return items as (T & { saldo_is_gram: boolean })[];
  const outletIds = [...new Set(items.map((i) => i.outlet_id))];
  const bahanIds = [...new Set(items.map((i) => i.bahan_baku_id))];

  const { data } = await supabase
    .from('stok_balance')
    .select('outlet_id, bahan_baku_id, saldo_is_gram')
    .in('outlet_id', outletIds)
    .in('bahan_baku_id', bahanIds);

  const map = new Map((data ?? []).map((b) => [`${b.outlet_id}:${b.bahan_baku_id}`, b.saldo_is_gram as boolean]));
  return items.map((item) => ({
    ...item,
    saldo_is_gram: map.get(`${item.outlet_id}:${item.bahan_baku_id}`) ?? false,
  }));
}

export async function fetchRecentLedger(limit = 50): Promise<LedgerFeedEntry[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('ledger_feed_spv')
    .select('id, outlet_id, outlet_name, bahan_baku_id, item_name, satuan, tipe, qty, catatan, saldo_sesudah, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const withSatuan = await attachSatuanKecil(supabase, (data || []) as LedgerFeedEntry[]);
  return await attachSaldoIsGram(supabase, withSatuan) as LedgerFeedEntry[];
}

const LOSS_TIPE = ['waste', 'rejected_kiriman', 'opname_selisih'] as const;

export interface WasteTodaySummary {
  count: number;
  entries: LedgerFeedEntry[];
}

export async function fetchWasteToday(): Promise<WasteTodaySummary> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('ledger_feed_spv')
    .select('id, outlet_id, outlet_name, bahan_baku_id, item_name, satuan, tipe, qty, catatan, saldo_sesudah, created_at')
    .in('tipe', LOSS_TIPE as unknown as string[])
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  const entries = (data || []).filter(
    (e) => e.tipe !== 'opname_selisih' || e.qty < 0
  ) as LedgerFeedEntry[];

  return { count: entries.length, entries };
}

export async function fetchOutletsList() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('outlets')
    .select('id, nama:name, slug, address, type')
    .neq('id', TEST_OUTLET_ID)
    .order('name');

  if (error) throw error;
  return data || [];
}
