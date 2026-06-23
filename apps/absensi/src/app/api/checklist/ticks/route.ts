import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authorizeOutletAccess } from '../_authorizeOutlet';

export async function POST(req: Request) {
  try {
    const { record_id } = await req.json();

    if (!record_id) {
      return NextResponse.json({ error: 'Missing record_id' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: record, error: recordError } = await supabaseAdmin
      .from('daily_checklist_records')
      .select('outlet_id')
      .eq('id', record_id)
      .maybeSingle();

    if (recordError) {
      return NextResponse.json({ error: recordError.message }, { status: 500 });
    }
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const auth = await authorizeOutletAccess(record.outlet_id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('daily_checklist_ticks')
      .select('id, item_id, ticked_by, ticked_at')
      .eq('record_id', record_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch staff names for all ticked_by IDs (avoid embed to prevent schema cache issue)
    const tickedByIds = Array.from(
      new Set((data || []).map(t => t.ticked_by).filter(Boolean))
    );

    const staffMap: Record<string, { name: string }> = {};
    if (tickedByIds.length > 0) {
      const { data: staffData } = await supabaseAdmin
        .from('outlet_staff')
        .select('id, name')
        .in('id', tickedByIds);

      if (staffData) {
        staffData.forEach(s => {
          staffMap[s.id] = { name: s.name };
        });
      }
    }

    // Enrich ticks with staff info
    const enrichedData = (data || []).map(tick => ({
      ...tick,
      outlet_staff: tick.ticked_by ? staffMap[tick.ticked_by] : null
    }));

    return NextResponse.json({ data: enrichedData });
  } catch (error: any) {
    console.error('[ticks route] exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
