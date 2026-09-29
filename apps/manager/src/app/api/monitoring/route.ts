import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { fetchAllRows } from '@/lib/fetchAllRows';

// Batas jumlah id per filter .in(): daftar ratusan UUID membuat URL PostgREST
// kepanjangan. Dipecah per potongan lalu digabung.
const IN_CHUNK = 150;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Missing from or to params' }, { status: 400 });
    }

    const headersList = await headers();
    let staff = parseStaffHeader(headersList.get(STAFF_HEADER));

    // Fallback for development / scaffold where middleware doesn't inject staff header
    if (!staff) {
      staff = {
        role: 'regional_manager',
        id: 'scaffold-user',
        name: 'Scaffold User',
        status: 'active',
        outlet_id: null,
        username: 'dev',
        ref_photo_url: null,
        outlets: null
      };
    }

    if (staff.role !== 'regional_manager' && staff.role !== 'area_manager' && staff.role !== 'developer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const start = new Date(`${fromDate}T00:00:00+07:00`).toISOString();
    const end = new Date(`${toDate}T23:59:59+07:00`).toISOString();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let outletsQuery = supabaseAdmin.from('outlets').select('id, name, is_active, region, lat, lng, address').eq('is_active', true);
    
    let accessibleOutlets: string[] = [];
    if (staff.role === 'area_manager' || staff.role === 'regional_manager') {
       const { data: so } = await supabaseAdmin.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id);
       if (so && so.length > 0) {
         accessibleOutlets = so.map((s: any) => s.outlet_id);
         outletsQuery = outletsQuery.in('id', accessibleOutlets);
       } else if (staff.role === 'area_manager') {
         outletsQuery = outletsQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
       }
    }

    let stfQuery = supabaseAdmin.from('outlet_staff').select('id, name, outlet_id, role, is_active').eq('is_active', true).in('role', ['crew', 'leader', 'spv']);
    let mapQuery = supabaseAdmin.from('staff_outlets').select('staff_id, outlet_id');
    // attendance & daily_checklist_records dipaginasi (fetchAllRows) karena
    // rentang multi-hari bisa melewati batas 1.000 baris PostgREST yang dulu
    // memotong data diam-diam. Pabrik query + urutan unik (kolom + id).
    const scopeToOutlets = (staff.role === 'area_manager' || staff.role === 'regional_manager') && accessibleOutlets.length > 0;
    const buildAtt = () => {
      let q = supabaseAdmin.from('attendance')
        .select('outlet_id, outlet_staff_id, type, ts_server')
        .gte('ts_server', start)
        .lte('ts_server', end);
      if (scopeToOutlets) q = q.in('outlet_id', accessibleOutlets);
      return q
        .order('ts_server', { ascending: true })
        .order('id', { ascending: true });
    };
    let catQuery = supabaseAdmin.from('checklist_categories')
        .select('id, outlet_id, checklist_items(id, is_required)')
        .eq('phase', 'buka');
    const buildRec = () => {
      let q = supabaseAdmin.from('daily_checklist_records')
        .select('id, outlet_id, date')
        .gte('date', fromDate)
        .lte('date', toDate);
      if (scopeToOutlets) q = q.in('outlet_id', accessibleOutlets);
      return q
        .order('date', { ascending: true })
        .order('id', { ascending: true });
    };
    let opnQuery = supabaseAdmin.from('opname')
        .select('id, outlet_id, created_at')
        .gte('created_at', start)
        .lte('created_at', end);

    if (scopeToOutlets) {
       stfQuery = stfQuery.in('outlet_id', accessibleOutlets);
       mapQuery = mapQuery.in('outlet_id', accessibleOutlets);
       catQuery = catQuery.in('outlet_id', accessibleOutlets);
       opnQuery = opnQuery.in('outlet_id', accessibleOutlets);
    }

    const [outRes, stfRes, mapRes, attAll, catRes, recAll, opnRes] = await Promise.all([
      outletsQuery,
      stfQuery,
      mapQuery,
      fetchAllRows<any>(buildAtt),
      catQuery,
      fetchAllRows<any>(buildRec),
      opnQuery
    ]);
    // Galat → kosong, sama seperti perilaku lama (data null → []).
    const attRes = { data: attAll.error ? null : attAll.data };
    const recRes = { data: recAll.error ? null : recAll.data };

    let ticksData: any[] = [];
    if (recRes.data && recRes.data.length > 0) {
      const recIds: string[] = recRes.data.map((r: any) => r.id);
      const chunks: string[][] = [];
      for (let i = 0; i < recIds.length; i += IN_CHUNK) chunks.push(recIds.slice(i, i + IN_CHUNK));
      const tickResults = await Promise.all(
        chunks.map((ids) =>
          fetchAllRows<any>(() =>
            supabaseAdmin.from('daily_checklist_ticks')
              .select('item_id, record_id')
              .in('record_id', ids)
              .order('id', { ascending: true })
          )
        )
      );
      // Satu potongan gagal → kosong seluruhnya, sama seperti perilaku lama.
      if (tickResults.every((r) => !r.error)) {
        ticksData = tickResults.flatMap((r) => r.data);
      }
    }

    return NextResponse.json({
      outlets: outRes.data || [],
      staff: stfRes.data || [],
      staffOutlets: mapRes.data || [],
      attendances: attRes.data || [],
      checklistCategories: catRes.data || [],
      checklistRecords: recRes.data || [],
      checklistTicks: ticksData,
      opnames: opnRes.data || []
    });
  } catch (error: any) {
    console.error('Error fetching monitoring data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
