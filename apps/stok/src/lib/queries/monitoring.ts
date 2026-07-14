// Use @suka/auth browser client yang properly configure session untuk browser
import { createSupabaseBrowserClient } from '@suka/auth';

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Verify the current session is allowed to view `outletId`, using the same
 * accessible_outlet_ids() function the server already uses for monitoring
 * scoping (SECURITY DEFINER, scoped to auth.uid() — admin/owner/spv get all
 * outlets, leader gets their bound outlets, kasir/crew/kiosk get only their
 * own). Throws if not authenticated or the outlet isn't accessible.
 *
 * Used by detail/drill-down fetchers (fetchItemDetail, fetchOutletItemsDetail)
 * which query monitoring_view_spv directly (unrestricted, RLS-bypassing) and
 * therefore need this explicit check before reading data for a single outlet.
 */
async function assertOutletAccessible(supabase: SupabaseBrowserClient, outletId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('accessible_outlet_ids');
  if (error) throw error;

  // PostgREST returns SETOF scalar results as an array of either plain
  // values or single-key objects depending on client/version — handle both.
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
 * Batch-join satuan_kecil/faktor_tampilan dari bahan_baku ke sekumpulan item
 * monitoring (1 query per outletnya-outlet, bukan per-item -- hindari N+1).
 * Dipakai di semua fetcher monitoring supaya UI bisa pakai formatCompositeSaldo/
 * Delta tanpa perlu query terpisah per komponen.
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
 * Fetch monitoring data for SPV (multi-outlet view)
 * RLS enforced: SPV role can see all outlets
 */
export async function fetchSPVMonitoringData() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('monitoring_view_spv')
    .select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged, kategori, last_opname_date')
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

  const enrichedItems = await attachSatuanKecil(supabase, dedupedItems);

  return {
    items: enrichedItems,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch monitoring data scoped to the caller's accessible outlets
 * (used for leader role — sees only their bound outlets, not all 19).
 * Backed by monitoring_view_scoped, which filters monitoring_view_spv by
 * accessible_outlet_ids() server-side, so the payload itself is already
 * restricted before it leaves Postgres (not just filtered client-side).
 */
export async function fetchLeaderMonitoringData() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('monitoring_view_scoped')
    .select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged, kategori, last_opname_date')
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

  const enrichedItems = await attachSatuanKecil(supabase, dedupedItems);

  return {
    items: enrichedItems,
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
    .select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged, kategori, last_opname_date')
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

  const enrichedData = await attachSatuanKecil(supabase, dedupedData);

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
    items: enrichedData,
    summary,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch detail for a specific item, scoped to accessible_outlet_ids()
 * (admin/owner/spv: all outlets; leader: their bound outlets; kasir/crew/
 * kiosk: their own outlet only). Previously checked a hardcoded role list
 * that didn't match the app's actual role values and silently blocked
 * legitimate access — replaced with assertOutletAccessible().
 */
export async function fetchItemDetail(outletId: string, bahan_baku_id: string) {
  const supabase = createSupabaseBrowserClient();
  await assertOutletAccessible(supabase, outletId);

  const { data: itemData, error: itemError } = await supabase
    .from('monitoring_view_spv')
    .select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged, kategori, last_opname_date, last_updated')
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', bahan_baku_id)
    .single();

  if (itemError) throw itemError;

  // The 3 queries below only depend on bahan_baku_id/outletId (already known
  // at this point) — run them in parallel instead of one-by-one to avoid
  // unnecessary sequential network round-trips.
  const [
    // monitoring_view_spv doesn't carry satuan_kecil/faktor_tampilan (view is
    // intentionally left untouched to avoid drift risk). Fetch them separately
    // from bahan_baku so the modal can render composite unit format.
    { data: bahanExtra },
    // Fetch recent ledger entries. Alias tipe→type and catatan→notes so the
    // returned shape matches what MonitoringDetailModal renders (it reads
    // ledger.type / ledger.notes — the raw column names would be undefined and
    // crash on .replace()).
    { data: ledgerData, error: ledgerError },
    // Fetch opname discrepancy if exists. opname_item has no created_at column,
    // so recency is taken from the parent opname row (ordering directly by
    // created_at returns HTTP 400).
    { data: opnameData },
  ] = await Promise.all([
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
      .select('qty_system, qty_fisik, catatan, flagged, opname!inner(created_at)')
      .eq('bahan_baku_id', bahan_baku_id)
      .order('created_at', { ascending: false, referencedTable: 'opname' })
      .limit(1)
      .maybeSingle(),
  ]);

  if (ledgerError) throw ledgerError;

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
    satuan_kecil: bahanExtra?.satuan_kecil ?? null,
    satuan_tengah: bahanExtra?.satuan_tengah ?? null,
    faktor_tampilan: bahanExtra?.faktor_tampilan ?? null,
    faktor_tengah: bahanExtra?.faktor_tengah ?? null,
    recent_ledger: ledgerData || [],
    discrepancy_details: discrepancyDetails,
  };
}

/**
 * Fetch opname status per outlet (for Compliance tab), scoped to the
 * caller's accessible outlets via opname_compliance_view (filters by
 * accessible_outlet_ids() server-side — admin/owner/spv still get all 19
 * outlets since accessible_outlet_ids() returns everything for them; leader
 * gets only their bound outlets instead of every outlet's compliance data).
 */
export async function fetchOpnameStatus() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('opname_compliance_view')
    .select('outlet_id, outlet_name, last_opname_date')
    .order('outlet_name');

  if (error) throw error;

  return (
    data?.map((outlet) => {
      const lastOpname = outlet.last_opname_date;
      const lastOpnameDate = lastOpname ? new Date(lastOpname) : null;
      const daysSince = lastOpnameDate
        ? Math.floor((Date.now() - lastOpnameDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        outlet_id: outlet.outlet_id,
        outlet_name: outlet.outlet_name,
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
  satuan_kecil: string | null;
  faktor_tampilan: number | null;
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
    .select('id, outlet_id, outlet_name, bahan_baku_id, item_name, satuan, tipe, qty, catatan, saldo_sesudah, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return await attachSatuanKecil(supabase, (data || []) as LedgerFeedEntry[]);
}

export interface StockoutForecastItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string | null;
  satuan_kecil: string | null;
  faktor_tampilan: number | null;
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
    .select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, daily_rate, days_left')
    .lte('days_left', maxDays)
    .order('days_left', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return await attachSatuanKecil(supabase, (data || []) as StockoutForecastItem[]);
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
    .select('id, outlet_id, outlet_name, bahan_baku_id, item_name, satuan, tipe, qty, catatan, saldo_sesudah, created_at')
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
 * Karena monitoring_view_spv/ledger_feed_spv bypass RLS, akses ke outletId
 * di-cek manual lewat assertOutletAccessible() (accessible_outlet_ids())
 * sebelum query — tanpa ini siapa pun yang login bisa baca outlet manapun.
 */
export async function fetchOutletItemsDetail(outletId: string): Promise<OutletDetailItem[]> {
  const supabase = createSupabaseBrowserClient();
  await assertOutletAccessible(supabase, outletId);

  const { data: items, error } = await supabase
    .from('monitoring_view_spv')
    .select('bahan_baku_id, item_name, current_qty, threshold, satuan, status')
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

