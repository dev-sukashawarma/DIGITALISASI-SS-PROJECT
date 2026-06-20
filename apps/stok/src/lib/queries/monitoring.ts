// Use @suka/auth browser client yang properly configure session untuk browser
import { createSupabaseBrowserClient } from '@suka/auth';

/**
 * Fetch monitoring data for SPV (multi-outlet view)
 * RLS enforced: SPV role can see all outlets
 */
export async function fetchSPVMonitoringData() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('monitoring_view_spv')
    .select('*')
    .order('outlet_name')
    .order('item_name');

  if (error) throw error;

  // Deduplicate by composite key (outlet_id, bahan_baku_id)
  const seen = new Set<string>();
  const dedupedItems = (data || []).filter((item) => {
    const key = `${item.outlet_id}-${item.bahan_baku_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    items: dedupedItems,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch monitoring data for Crew (single-outlet view)
 * RLS enforced: Crew can only see own outlet
 */
export async function fetchCrewMonitoringData(userId?: string) {
  const supabase = createSupabaseBrowserClient();
  const actualUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!actualUserId) throw new Error('Not authenticated');

  // Get user's outlet_id from outlet_staff (tidak pakai embed karena masalah coerce)
  const { data: staffData, error: staffError } = await supabase
    .from('outlet_staff')
    .select('outlet_id')
    .eq('id', actualUserId)
    .single<{ outlet_id: string }>();

  if (staffError) throw staffError;
  if (!staffData?.outlet_id) throw new Error('User not assigned to outlet');

  // Get outlet name terpisah
  const { data: outletData, error: outletError } = await supabase
    .from('outlets')
    .select('name')
    .eq('id', staffData.outlet_id)
    .single<{ name: string }>();

  if (outletError) throw outletError;
  const outletName = outletData?.name || 'Unknown';

  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('*')
    .eq('outlet_id', staffData.outlet_id)
    .order('item_name');

  if (error) throw error;

  // Deduplicate by composite key (outlet_id, bahan_baku_id)
  const seen = new Set<string>();
  const dedupedData = (data || []).filter((item) => {
    const key = `${item.outlet_id}-${item.bahan_baku_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Calculate summary
  // Note: "below_threshold" counts only items strictly below threshold (status === 'below').
  // "warning" items (80-100% of threshold) are tracked separately and not included in this count.
  const summary = {
    below_threshold: dedupedData.filter((item) => item.status === 'below').length,
    flagged: dedupedData.filter((item) => item.is_flagged).length,
    ok: dedupedData.filter((item) => item.status === 'ok').length,
    total: dedupedData.length,
  };

  return {
    outlet_id: staffData.outlet_id,
    outlet_name: outletName,
    items: dedupedData,
    summary,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch detail for a specific item
 * RLS enforced: SPV can see all outlets, crew can only see own outlet
 */
export async function fetchItemDetail(outletId: string, bahan_baku_id: string) {
  const supabase = createSupabaseBrowserClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  // Get user's outlet_id and role to verify access
  const { data: staffData, error: staffError } = await supabase
    .from('outlet_staff')
    .select('outlet_id, role')
    .eq('id', authData.user.id)
    .single();

  if (staffError) throw staffError;
  if (!staffData) throw new Error('User not assigned to outlet');

  // Verify access: SPV can see all outlets, crew can only see own
  const isSPV = ['spv_produksi', 'spv_stok', 'admin'].includes(staffData.role || '');
  if (!isSPV && staffData.outlet_id !== outletId) {
    throw new Error('Access denied: cannot view other outlets');
  }

  const { data: itemData, error: itemError } = await supabase
    .from('monitoring_view_spv')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', bahan_baku_id)
    .single();

  if (itemError) throw itemError;

  // Fetch recent ledger entries
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('ledger_stok')
    .select('tipe, qty, catatan, created_at')
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', bahan_baku_id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (ledgerError) throw ledgerError;

  // Fetch opname discrepancy if exists
  const { data: opnameData } = await supabase
    .from('opname_item')
    .select('qty_system, qty_fisik, catatan, flagged')
    .eq('bahan_baku_id', bahan_baku_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const discrepancyDetails = opnameData?.flagged
    ? {
        // Type detection logic: qty_mismatch if qty_fisik < qty_system, otherwise damaged.
        // Note: 'lost' type requires additional context not available from opname_item data.
        type: opnameData.qty_fisik < opnameData.qty_system ? 'qty_mismatch' : 'damaged',
        qty_system: opnameData.qty_system,
        qty_fisik: opnameData.qty_fisik,
        catatan: opnameData.catatan || '',
      }
    : undefined;

  return {
    ...itemData,
    recent_ledger: ledgerData || [],
    discrepancy_details: discrepancyDetails,
  };
}

/**
 * Fetch opname status per outlet (for Compliance tab)
 */
export async function fetchOpnameStatus() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('outlets')
    .select(
      `
      id,
      nama:name,
      opname(created_at)
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (
    data?.map((outlet) => {
      // Safely handle opname as array (may be empty or single object depending on Supabase behavior)
      const opnames = Array.isArray(outlet.opname) ? outlet.opname : (outlet.opname ? [outlet.opname] : []);
      const lastOpname = opnames.length > 0 ? opnames[0]?.created_at : null;
      const lastOpnameDate = lastOpname ? new Date(lastOpname) : null;
      const daysSince = lastOpnameDate
        ? Math.floor((Date.now() - lastOpnameDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        outlet_id: outlet.id,
        outlet_name: outlet.nama,
        last_opname_date: lastOpname,
        days_since: daysSince,
        is_overdue: daysSince !== null && daysSince > 7,
      };
    }) || []
  );
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
  satuan: string | null;
  tipe: LedgerFeedTipe;
  qty: number;
  catatan: string | null;
  saldo_sesudah: number;
  created_at: string;
}

/**
 * Fetch recent stock-movement activity across all outlets (SPV live feed).
 * Backed by ledger_feed_spv (definer view) so SPV sees all outlets despite
 * the per-outlet RLS on ledger_stok.
 */
export async function fetchRecentLedger(limit = 50): Promise<LedgerFeedEntry[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('ledger_feed_spv')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as LedgerFeedEntry[];
}

export interface StockoutForecastItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string | null;
  current_qty: number;
  threshold: number;
  daily_rate: number;
  days_left: number;
}

/**
 * Fetch stockout forecast (cross-outlet). Returns items projected to run out
 * within `maxDays`, sorted soonest-first — predictive early warning before an
 * item hits the threshold. Backed by stockout_forecast_spv (definer view).
 */
export async function fetchStockoutForecast(maxDays = 1, limit = 6): Promise<StockoutForecastItem[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('stockout_forecast_spv')
    .select('*')
    .lte('days_left', maxDays)
    .order('days_left', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as StockoutForecastItem[];
}

const LOSS_TIPE = ['waste', 'rejected_kiriman', 'opname_selisih'] as const;

export interface WasteTodaySummary {
  count: number;
  entries: LedgerFeedEntry[];
}

/**
 * Aggregate today's loss events (waste, rejected shipments, negative opname
 * variance) across all outlets — a money-leak lens distinct from stock level.
 * Reuses the ledger_feed_spv definer view; no extra migration needed.
 */
export async function fetchWasteToday(): Promise<WasteTodaySummary> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('ledger_feed_spv')
    .select('*')
    .in('tipe', LOSS_TIPE as unknown as string[])
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  // opname_selisih counts as loss only when negative (shrinkage); positive
  // variance is a found surplus, not a loss.
  const entries = (data || []).filter(
    (e) => e.tipe !== 'opname_selisih' || e.qty < 0
  ) as LedgerFeedEntry[];

  return { count: entries.length, entries };
}

export interface OutletDetailItem {
  bahan_baku_id: string;
  item_name: string;
  current_qty: number;
  threshold: number;
  satuan: string | null;
  status: 'below' | 'warning' | 'ok';
  recent_ledger: Array<{
    tipe: string;
    qty: number;
    catatan: string | null;
    created_at: string;
  }>;
}

/**
 * Fetch ALL items (inventory lengkap) untuk satu outlet + ledger history.
 * Client-side via definer views (monitoring_view_spv + ledger_feed_spv) yang
 * bypass RLS — sama seperti papan utama. JANGAN query stok_balance/ledger_stok
 * langsung karena RLS membatasi ke outlet milik user (SPV lihat outlet lain → kosong).
 */
export async function fetchOutletItemsDetail(outletId: string): Promise<OutletDetailItem[]> {
  const supabase = createSupabaseBrowserClient();
  const { data: items, error } = await supabase
    .from('monitoring_view_spv')
    .select('*')
    .eq('outlet_id', outletId)
    .order('item_name');

  if (error) throw error;

  // Deduplicate by bahan_baku_id
  const seen = new Set<string>();
  const dedupedItems = (items || []).filter((it) => {
    if (seen.has(it.bahan_baku_id)) return false;
    seen.add(it.bahan_baku_id);
    return true;
  });

  // Sort: below → warning → ok, then by name
  const statusOrder: Record<string, number> = { below: 0, warning: 1, ok: 2 };
  dedupedItems.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return (a.item_name || '').localeCompare(b.item_name || '');
  });

  // Batch fetch all ledger entries for all items (single query instead of N+1)
  const bahanBakuIds = dedupedItems.map(it => it.bahan_baku_id);

  const { data: allLedgers, error: ledgerError } = await supabase
    .from('ledger_feed_spv')
    .select('bahan_baku_id, tipe, qty, catatan, created_at')
    .eq('outlet_id', outletId)
    .in('bahan_baku_id', bahanBakuIds)
    .order('created_at', { ascending: false });

  if (ledgerError) throw ledgerError;

  // Group ledger entries by bahan_baku_id on client
  const ledgerMap = new Map<string, typeof allLedgers>();
  allLedgers?.forEach(entry => {
    const key = entry.bahan_baku_id;
    if (!ledgerMap.has(key)) ledgerMap.set(key, []);
    ledgerMap.get(key)!.push(entry);
  });

  // Map items with their ledger history (last 5 entries per item)
  const enriched = dedupedItems.map((it): OutletDetailItem => ({
    bahan_baku_id: it.bahan_baku_id,
    item_name: it.item_name,
    current_qty: it.current_qty,
    threshold: it.threshold,
    satuan: it.satuan,
    status: it.status,
    recent_ledger: ledgerMap.get(it.bahan_baku_id)?.slice(0, 5) || [],
  }));

  return enriched;
}

/**
 * Fetch master list of all outlets
 */
export async function fetchOutletsList() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('outlets')
    .select('id, nama:name, slug, address, type')
    .order('name');

  if (error) throw error;
  return data || [];
}

