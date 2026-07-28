import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const outlet_id = searchParams.get('outlet_id');
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!outlet_id) {
    return NextResponse.json({ error: 'outlet_id is required' }, { status: 400 });
  }

  try {
    // 1. Fetch staff list for outlet (primary staff + multi-outlet assigned staff from staff_outlets)
    const [primaryStaffRes, assignedStaffRes, attRes, localCfgRes, globalCfgRes] = await Promise.all([
      supabaseService
        .from('outlet_staff')
        .select('id, name, role')
        .eq('outlet_id', outlet_id)
        .eq('status', 'active'),

      supabaseService
        .from('staff_outlets')
        .select('staff_id, outlet_staff!inner(id, name, role, status)')
        .eq('outlet_id', outlet_id),

      supabaseService
        .from('attendance')
        .select('id, type, ts_server, ts_client, status, selfie_url, outlet_staff_id, telat_menit')
        .eq('outlet_id', outlet_id)
        .gte('ts_server', `${date}T00:00:00+07:00`)
        .lte('ts_server', `${date}T23:59:59+07:00`)
        .order('ts_server', { ascending: false }),

      supabaseService
        .from('outlet_attendance_config')
        .select('jam_masuk, jam_keluar, toleransi_menit')
        .eq('outlet_id', outlet_id)
        .maybeSingle(),

      supabaseService
        .from('global_settings')
        .select('value')
        .eq('key', 'global_attendance_config')
        .maybeSingle()
    ]);

    // Merge primary and multi-outlet assigned staff
    const activeStaffMap = new Map<string, { id: string; name: string; role: string }>();

    (primaryStaffRes.data || []).forEach((s) => {
      activeStaffMap.set(s.id, { id: s.id, name: s.name, role: s.role });
    });

    (assignedStaffRes.data || []).forEach((row: any) => {
      const st = Array.isArray(row.outlet_staff) ? row.outlet_staff[0] : row.outlet_staff;
      if (st && st.status === 'active' && !activeStaffMap.has(st.id)) {
        activeStaffMap.set(st.id, { id: st.id, name: st.name, role: st.role });
      }
    });

    const activeStaff = Array.from(activeStaffMap.values());
    const nameById = new Map(activeStaff.map((s) => [s.id, s.name]));

    const rawRows = attRes.data || [];
    const dbRows = rawRows.map((r) => ({
      ...r,
      outlet_staff: { name: nameById.get(r.outlet_staff_id) ?? '-' },
    }));

    let cfg = localCfgRes.data;
    if (!cfg && globalCfgRes.data?.value) {
      try {
        cfg = typeof globalCfgRes.data.value === 'string' ? JSON.parse(globalCfgRes.data.value) : globalCfgRes.data.value;
      } catch (e) {}
    }

    // Calculate delay minutes if status is telat/pulang_telat/lebih_awal
    dbRows.forEach((r: any) => {
      if (r.status === 'telat' && r.type === 'in' && cfg?.jam_masuk) {
        const [h, m] = cfg.jam_masuk.split(':').map(Number);
        const serverTime = new Date(r.ts_server);
        const expectedTime = new Date(r.ts_server);
        expectedTime.setHours(h, m, 0, 0);
        const diffMs = serverTime.getTime() - expectedTime.getTime();
        r.delay_minutes = r.telat_menit ?? (diffMs > 0 ? Math.floor(diffMs / 60000) : 0);
      }
    });

    // Virtual Alphas for staff who haven't clocked in
    const inRecords = new Set(dbRows.filter((r) => r.type === 'in').map((r) => r.outlet_staff_id));
    const virtualAlphas = activeStaff
      .filter((staff) => !inRecords.has(staff.id))
      .map((staff) => ({
        id: `virtual-alpha-${staff.id}`,
        type: 'in' as const,
        ts_server: `${date}T23:59:59+07:00`,
        ts_client: null,
        status: 'alpha' as const,
        selfie_url: null,
        outlet_staff: { name: staff.name },
      }));

    return NextResponse.json({
      ok: true,
      rows: [...dbRows, ...virtualAlphas],
      activeStaff,
    });
  } catch (err: any) {
    console.error('Error fetching rekap attendance API:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
