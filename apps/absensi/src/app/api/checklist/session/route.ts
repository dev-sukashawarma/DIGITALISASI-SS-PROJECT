import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { outlet_id, date } = await req.json();

    if (!outlet_id || !date) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Cek apakah record sudah ada
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('daily_checklist_records')
      .select('id')
      .eq('outlet_id', outlet_id)
      .eq('date', date)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ id: existing.id });
    }

    // 2. Jika belum ada, buat baru
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('daily_checklist_records')
      .insert({ outlet_id, date })
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ id: inserted.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
