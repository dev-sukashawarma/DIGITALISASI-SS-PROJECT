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
 * Fetch detailed item info for modal inspection
 */
export async function fetchItemDetail(outletId: string, bahan_baku_id: string): Promise<DetailItem> {
  const supabase = createSupabaseBrowserClient();
  await assertOutletAccessible(supabase, outletId);

  const [
    { data: itemData, error: itemError },
    { data: bahanExtra },
    { data: ledgerData, error: ledgerError },
    { data: opnameData },
    { data: pemakaianData },
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
    supabase
      .from('opname_item')
      .select('qty_system, qty_fisik, catatan, flagged, opname!inner(created_at, outlet_id)')
      .eq('bahan_baku_id', bahan_baku_id)
      .eq('opname.outlet_id', outletId)
      .order('created_at', { ascending: false, referencedTable: 'opname' })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ledger_stok')
      .select('qty, created_at')
      .eq('outlet_id', outletId)
      .eq('bahan_baku_id', bahan_baku_id)
      .eq('tipe', 'pemakaian')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (itemError) throw itemError;
  if (ledgerError) throw ledgerError;

  const opnameDateStr = (opnameData?.opname as any)?.created_at;
  const opnameDate = opnameDateStr ? new Date(opnameDateStr) : new Date();
  const startOfDay = new Date(opnameDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(opnameDate);
  endOfDay.setHours(23, 59, 59, 999);

  const pemakaianToday = (pemakaianData || [])
    .filter(p => {
      const d = new Date(p.created_at);
      return d >= startOfDay && d <= endOfDay;
    })
    .reduce((sum, p) => sum + Math.abs(p.qty || 0), 0);

  const isGudang = (itemData?.outlet_name || '').toUpperCase().includes('GUDANG');

  const discrepancyDetails = (!isGudang && opnameData?.flagged)
    ? {
        type: opnameData.qty_fisik < opnameData.qty_system ? ('qty_mismatch' as const) : ('damaged' as const),
        qty_system: opnameData.qty_system,
        qty_fisik: opnameData.qty_fisik,
        catatan: opnameData.catatan || '',
        pemakaian_bom: pemakaianToday > 0 ? pemakaianToday : undefined,
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
