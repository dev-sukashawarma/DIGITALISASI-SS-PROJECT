import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth';

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

    if (staff.role !== 'regional_manager' && staff.role !== 'area_manager') {
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
    if (staff.role === 'area_manager') {
       const { data: so } = await supabaseAdmin.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id);
       if (so && so.length > 0) {
         accessibleOutlets = so.map((s: any) => s.outlet_id);
         outletsQuery = outletsQuery.in('id', accessibleOutlets);
       } else {
         outletsQuery = outletsQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
       }
    }

    let stfQuery = supabaseAdmin.from('outlet_staff').select('id, name, outlet_id, role, is_active').eq('is_active', true).in('role', ['crew', 'leader', 'spv']);
    let mapQuery = supabaseAdmin.from('staff_outlets').select('staff_id, outlet_id');
    let attQuery = supabaseAdmin.from('attendance')
        .select('outlet_id, outlet_staff_id, type, ts_server')
        .gte('ts_server', start)
        .lte('ts_server', end)
        .order('ts_server', { ascending: true });
    let catQuery = supabaseAdmin.from('checklist_categories')
        .select('id, outlet_id, checklist_items(id, is_required)')
        .eq('phase', 'buka');
    let recQuery = supabaseAdmin.from('daily_checklist_records')
        .select('id, outlet_id, date')
        .gte('date', fromDate)
        .lte('date', toDate);
    let opnQuery = supabaseAdmin.from('opname')
        .select('id, outlet_id, created_at')
        .gte('created_at', start)
        .lte('created_at', end);

    if (staff.role === 'area_manager' && accessibleOutlets.length > 0) {
       stfQuery = stfQuery.in('outlet_id', accessibleOutlets);
       mapQuery = mapQuery.in('outlet_id', accessibleOutlets);
       attQuery = attQuery.in('outlet_id', accessibleOutlets);
       catQuery = catQuery.in('outlet_id', accessibleOutlets);
       recQuery = recQuery.in('outlet_id', accessibleOutlets);
       opnQuery = opnQuery.in('outlet_id', accessibleOutlets);
    }

    const [outRes, stfRes, mapRes, attRes, catRes, recRes, opnRes] = await Promise.all([
      outletsQuery,
      stfQuery,
      mapQuery,
      attQuery,
      catQuery,
      recQuery,
      opnQuery
    ]);

    let ticksData: any[] = [];
    if (recRes.data && recRes.data.length > 0) {
      const recIds = recRes.data.map((r: any) => r.id);
      const { data: tickRes } = await supabaseAdmin.from('daily_checklist_ticks').select('item_id, record_id').in('record_id', recIds);
      if (tickRes) {
        ticksData = tickRes;
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
