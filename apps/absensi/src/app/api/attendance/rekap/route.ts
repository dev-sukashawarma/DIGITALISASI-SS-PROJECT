import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(request: Request) {
  const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const outlet_id = searchParams.get('outlet_id');
  const dateParam = searchParams.get('date');
  let start_date = searchParams.get('start_date');
  let end_date = searchParams.get('end_date');

  if (!start_date || !end_date) {
    start_date = dateParam || dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
    end_date = dateParam || dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
  }

  if (!outlet_id) {
    return NextResponse.json({ error: 'outlet_id is required' }, { status: 400 });
  }

  try {
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
        .select('id, type, ts_server, ts_client, status, selfie_url, outlet_staff_id, telat_menit, is_manual_button')
        .eq('outlet_id', outlet_id)
        .gte('ts_server', `${start_date}T00:00:00+07:00`)
        .lte('ts_server', `${end_date}T23:59:59+07:00`)
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

    dbRows.forEach((r: any) => {
      if (r.status === 'telat' && r.type === 'in' && cfg?.jam_masuk) {
        const [h, m] = cfg.jam_masuk.split(':').map(Number);
        const expectedMinutes = h * 60 + m;
        const t = dayjs(r.ts_server).tz('Asia/Jakarta');
        const actualMinutes = t.hour() * 60 + t.minute();
        const diff = actualMinutes - expectedMinutes;
        r.delay_minutes = r.telat_menit ?? (diff > 0 ? diff : 0);
      }
    });

    const todayStr = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
    const virtualAlphas: any[] = [];
    
    let curr = dayjs(start_date);
    const end = dayjs(end_date);
    
    while (curr.isBefore(end) || curr.isSame(end, 'day')) {
      const dStr = curr.format('YYYY-MM-DD');
      
      if (dStr > todayStr) {
        curr = curr.add(1, 'day');
        continue;
      }
      
      const inRecordsForDay = new Set(
        dbRows
          .filter((r) => r.type === 'in' && r.ts_server.startsWith(dStr))
          .map((r) => r.outlet_staff_id)
      );
      
      activeStaff.forEach((staff) => {
        if (!inRecordsForDay.has(staff.id)) {
          virtualAlphas.push({
            id: `virtual-alpha-${staff.id}-${dStr}`,
            type: 'in',
            ts_server: `${dStr}T23:59:59+07:00`,
            ts_client: null,
            status: 'alpha',
            selfie_url: null,
            outlet_staff_id: staff.id,
            is_manual_button: false,
            outlet_staff: { name: staff.name },
          });
        }
      });
      
      curr = curr.add(1, 'day');
    }

    return NextResponse.json({
      ok: true,
      rows: [...dbRows, ...virtualAlphas].sort((a, b) => new Date(b.ts_server).getTime() - new Date(a.ts_server).getTime()),
      activeStaff,
    });
  } catch (err: any) {
    console.error('Error fetching rekap attendance API:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
