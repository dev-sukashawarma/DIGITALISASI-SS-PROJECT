import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authorizeOutletAccess } from '../_authorizeOutlet';

export async function POST(req: Request) {
  try {
    const { outlet_id } = await req.json();

    if (!outlet_id) {
      return NextResponse.json({ error: 'Missing outlet_id' }, { status: 400 });
    }

    const auth = await authorizeOutletAccess(outlet_id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('checklist_categories')
      .select('*, checklist_items(*)')
      .eq('outlet_id', outlet_id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[categories route] exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
