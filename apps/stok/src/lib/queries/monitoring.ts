import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  return {
    items: data || [],
    lastFetched: new Date().toISOString(),
  };
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
    .select('outlet_id, outlets(nama)')
    .eq('id', authData.user.id)
    .single();

  if (staffError) throw staffError;
  if (!staffData) throw new Error('User not assigned to outlet');

  const outletInfo = staffData as any;
  const outletName = outletInfo.outlets?.[0]?.nama || outletInfo.outlets?.nama || 'Unknown';

  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('*')
    .eq('outlet_id', staffData.outlet_id)
    .order('item_name');

  if (error) throw error;

  // Calculate summary
  const summary = {
    below_threshold: (data || []).filter((item) => item.status === 'below').length,
    flagged: (data || []).filter((item) => item.is_flagged).length,
    ok: (data || []).filter((item) => item.status === 'ok').length,
    total: data?.length || 0,
  };

  return {
    outlet_id: staffData.outlet_id,
    outlet_name: outletName,
    items: data || [],
    summary,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch detail for a specific item
 */
export async function fetchItemDetail(outletId: string, bahan_baku_id: string) {
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
      nama,
      opname(created_at)
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (
    data?.map((outlet) => {
      const lastOpname = outlet.opname?.[0]?.created_at;
      const lastOpnameDate = lastOpname ? new Date(lastOpname) : null;
      const daysSince = lastOpnameDate
        ? Math.floor((Date.now() - lastOpnameDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        outlet_id: outlet.id,
        outlet_name: outlet.nama,
        last_opname_date: lastOpname,
        days_since: daysSince,
        is_overdue: daysSince && daysSince > 7,
      };
    }) || []
  );
}
