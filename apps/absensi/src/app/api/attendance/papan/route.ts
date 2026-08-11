import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeBoard, type BoardStaff, type BoardRecord } from '@/features/board/board';

export async function GET(request: Request) {
  const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const outlet_id = searchParams.get('outlet_id');
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!outlet_id) {
    return NextResponse.json({ error: 'outlet_id is required' }, { status: 400 });
  }

  try {
    const [primaryStaffRes, assignedStaffRes, attRes, alertsRes, localCfgRes, globalCfgRes] = await Promise.all([
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
        .select('outlet_staff_id, type, status, ts_server, selfie_url, telat_menit, is_manual_button')
        .eq('outlet_id', outlet_id)
        .gte('ts_server', `${date}T00:00:00+07:00`)
        .lte('ts_server', `${date}T23:59:59+07:00`),

      supabaseService
        .from('attendance')
        .select('id, outlet_staff_id, status, ts_server, gps_lat, gps_lng')
        .eq('outlet_id', outlet_id)
        .in('status', ['fake_gps_blocked', 'teleportation_blocked'])
        .gte('ts_server', `${date}T00:00:00+07:00`)
        .lte('ts_server', `${date}T23:59:59+07:00`),

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

    const staffList = Array.from(activeStaffMap.values());
    let cfg = localCfgRes.data;
    if (!cfg && globalCfgRes.data?.value) {
      try {
        cfg = typeof globalCfgRes.data.value === 'string' ? JSON.parse(globalCfgRes.data.value) : globalCfgRes.data.value;
      } catch (e) {}
    }

    if (!cfg) {
      cfg = { jam_masuk: '08:00', jam_keluar: '16:00', toleransi_menit: 15 };
    }

    const boardData = computeBoard(staffList as BoardStaff[], (attRes.data as BoardRecord[]) ?? [], cfg);

    const staffMap = new Map(staffList.map((s) => [s.id, s.name]));
    const formattedAlerts = (alertsRes.data || []).map((a) => ({
      ...a,
      staff_name: staffMap.get(a.outlet_staff_id) || 'Staf',
    }));

    return NextResponse.json({
      ok: true,
      ...boardData,
      securityAlerts: formattedAlerts,
    });
  } catch (err: any) {
    console.error('Error fetching papan attendance API:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
