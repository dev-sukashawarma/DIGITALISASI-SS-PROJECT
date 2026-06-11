// Use the shared browser client (@supabase/ssr) so the logged-in session
// is carried on every request. A raw @supabase/supabase-js client does NOT
// share the SSR session and causes "Not authenticated" errors.
import { createClient } from '@/lib/supabase';

const supabase = createClient();

/**
 * Fetch monitoring data for SPV (multi-outlet view)
 * RLS enforced: SPV role can see all outlets
 */
export async function fetchSPVMonitoringData() {
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

interface OutletStaffData {
  outlet_id: string;
  outlets: { nama: string };
}

/**
 * Fetch monitoring data for Crew (single-outlet view)
 * RLS enforced: Crew can only see own outlet
 */
export async function fetchCrewMonitoringData() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  // Get user's outlet_id from outlet_staff
  const { data: staffData, error: staffError } = await supabase
    .from('outlet_staff')
    .select('outlet_id, outlets(nama:name)')
    .eq('id', authData.user.id)
    .single<OutletStaffData>();

  if (staffError) throw staffError;
  if (!staffData || !staffData.outlets) throw new Error('User not assigned to outlet');

  const outletName = staffData.outlets.nama;

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
    .single();

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

/**
 * Fetch master list of all outlets
 */
export async function fetchOutletsList() {
  const { data, error } = await supabase
    .from('outlets')
    .select('id, nama:name')
    .order('name');

  if (error) throw error;
  return data || [];
}

