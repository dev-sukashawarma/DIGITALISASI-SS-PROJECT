const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const filter = { from: '2026-07-27', to: '2026-07-27', outletId: 'all' };
  
  const [{ data: staffList }, { data: outletsList }] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role'),
    supabase.from('outlets').select('id, name')
  ]);

  const staffMap = new Map((staffList || []).map((s) => [s.id, s]));
  const outletMap = new Map((outletsList || []).map((o) => [o.id, o.name]));

  let query = supabase
    .from('attendance')
    .select('*')
    .order('ts_server', { ascending: false });

  if (filter.from) {
    query = query.gte('ts_server', `${filter.from}T00:00:00.000Z`);
  }
  if (filter.to) {
    query = query.lte('ts_server', `${filter.to}T23:59:59.999Z`);
  }

  const { data: attRows, error } = await query;
  console.log('Query returned', attRows.length, 'rows');

  const grouped = new Map();

  for (const r of attRows) {
    const dateStr = r.ts_server ? r.ts_server.split('T')[0] : '';
    const key = `${r.outlet_staff_id}|${r.outlet_id}|${dateStr}`;
    const st = staffMap.get(r.outlet_staff_id);
    const outletName = outletMap.get(r.outlet_id);

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: r.id,
        staff_id: r.outlet_staff_id || '',
        staff_name: st?.name || 'Kasir Staff',
        staff_role: (st?.role || 'CREW').toUpperCase(),
        outlet_id: r.outlet_id || '',
        outlet_name: outletName || 'Outlet Utama',
        date: dateStr,
      });
    }
  }

  console.log('Grouped into', grouped.size, 'records');
  console.log(Array.from(grouped.values()).slice(0, 2));
}
check();
