import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const ATT_COLS = 'id, type, ts_server, ts_client, status, selfie_url, outlet_id, outlet_staff_id, telat_menit, is_manual_button, source, shift_jam_masuk, shift_jam_keluar';

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
    const [primaryStaffRes, assignedStaffRes, localCfgRes, globalCfgRes] = await Promise.all([
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
    const activeStaffIds = Array.from(activeStaffMap.keys());
    const nameById = new Map(activeStaff.map((s) => [s.id, s.name]));

    let attQuery = supabaseService
      .from('attendance')
      .select(ATT_COLS)
      .gte('ts_server', `${start_date}T00:00:00+07:00`)
      .lte('ts_server', `${end_date}T23:59:59+07:00`)
      .order('ts_server', { ascending: false });

    if (activeStaffIds.length > 0) {
      attQuery = attQuery.or(`outlet_id.eq.${outlet_id},outlet_staff_id.in.(${activeStaffIds.join(',')})`);
    } else {
      attQuery = attQuery.eq('outlet_id', outlet_id);
    }

    const attRes = await attQuery;

    let rawRows: any[] = attRes.data || [];

    // Manajer lintas outlet bisa absen masuk di outlet ini lalu pulang di outlet
    // lain (atau sebaliknya). Ambil pasangan absennya untuk staf & tanggal yang
    // sama agar jam & foto pulang/masuknya tetap tampil di rekap outlet ini.
    const wibDate = (ts: string) => dayjs(ts).tz('Asia/Jakarta').format('YYYY-MM-DD');
    const rowsHere = rawRows.filter((r) => r.outlet_id === outlet_id);
    const dayKeys = new Set(rowsHere.map((r) => `${r.outlet_staff_id}|${wibDate(r.ts_server)}`));
    const visitorIds = Array.from(new Set(rowsHere.map((r) => r.outlet_staff_id).filter((id) => id && !activeStaffMap.has(id))));
    if (visitorIds.length > 0) {
      const { data: pairRows } = await supabaseService
        .from('attendance')
        .select(ATT_COLS)
        .in('outlet_staff_id', visitorIds)
        .neq('outlet_id', outlet_id)
        .gte('ts_server', `${start_date}T00:00:00+07:00`)
        .lte('ts_server', `${end_date}T23:59:59+07:00`);
      const seen = new Set(rawRows.map((r) => r.id));
      for (const r of pairRows || []) {
        if (!seen.has(r.id) && dayKeys.has(`${r.outlet_staff_id}|${wibDate(r.ts_server)}`)) rawRows.push(r);
      }
    }

    // Nama untuk staf tamu (bukan staf outlet ini) + nama outlet tiap baris.
    const missingNameIds = Array.from(new Set(rawRows.map((r) => r.outlet_staff_id).filter((id) => id && !nameById.has(id))));
    const outletIds = Array.from(new Set(rawRows.map((r) => r.outlet_id).filter(Boolean)));
    const [extraStaffRes, outletsRes] = await Promise.all([
      missingNameIds.length > 0
        ? supabaseService.from('outlet_staff').select('id, name').in('id', missingNameIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      outletIds.length > 0
        ? supabaseService.from('outlets').select('id, name').in('id', outletIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    (extraStaffRes.data || []).forEach((s) => nameById.set(s.id, s.name));
    const outletNameById = new Map((outletsRes.data || []).map((o) => [o.id, o.name]));

    const dbRows = rawRows.map((r) => ({
      ...r,
      outlet_name: outletNameById.get(r.outlet_id) ?? null,
      outlet_staff: { name: nameById.get(r.outlet_staff_id) ?? '-' },
    }));

    let cfg = localCfgRes.data;
    if (!cfg && globalCfgRes.data?.value) {
      try {
        cfg = typeof globalCfgRes.data.value === 'string' ? JSON.parse(globalCfgRes.data.value) : globalCfgRes.data.value;
      } catch (e) {}
    }

    dbRows.forEach((r: any) => {
      const t = dayjs(r.ts_server).tz('Asia/Jakarta');
      const actualMinutes = t.hour() * 60 + t.minute();

      if (r.status === 'telat' && r.type === 'in') {
        const jamMasuk = r.shift_jam_masuk || cfg?.jam_masuk;
        if (jamMasuk) {
          const [h, m] = jamMasuk.split(':').map(Number);
          const diff = actualMinutes - (h * 60 + m);
          r.delay_minutes = r.telat_menit ?? (diff > 0 ? diff : 0);
        } else {
          r.delay_minutes = r.telat_menit ?? 0;
        }
      } else if (r.type === 'out') {
        const jamKeluar = r.shift_jam_keluar || cfg?.jam_keluar;
        if (jamKeluar) {
          const [h, m] = jamKeluar.split(':').map(Number);
          const diff = actualMinutes - (h * 60 + m);
          if (r.status === 'pulang_telat') {
            r.delay_minutes = r.telat_menit ?? (diff > 0 ? diff : 0);
          } else if (r.status === 'lebih_awal') {
            r.delay_minutes = r.telat_menit ?? (diff < 0 ? Math.abs(diff) : 0);
          }
        } else {
          r.delay_minutes = r.telat_menit ?? 0;
        }
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
      
      const presentStaffForDay = new Set(
        dbRows
          .filter((r) => dayjs(r.ts_server).tz('Asia/Jakarta').format('YYYY-MM-DD') === dStr && r.status !== 'alpha')
          .map((r) => r.outlet_staff_id)
      );
      
      activeStaff.forEach((staff) => {
        if (!presentStaffForDay.has(staff.id)) {
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
