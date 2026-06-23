import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authorizeOutletAccess } from '../_authorizeOutlet';

export async function POST(req: Request) {
  try {
    const { action, item_id, record_id, staff_id } = await req.json();

    if (!action || !item_id || !record_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
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

    if (action === 'insert') {
      const { error } = await supabaseAdmin
        .from('daily_checklist_ticks')
        .insert({
          item_id,
          record_id,
          ticked_by: staff_id || null,
        });
      if (error) throw error;
    } else if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('daily_checklist_ticks')
        .delete()
        .eq('item_id', item_id)
        .eq('record_id', record_id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
