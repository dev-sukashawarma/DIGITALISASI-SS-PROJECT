import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { outlet_id } = body;

    if (!outlet_id) {
      return NextResponse.json({ ok: false, error: "Outlet ID is required" }, { status: 400 });
    }

    // Bypass RLS untuk menyimpan ke database, karena hanya SPV yang bisa panggil fungsi ini di dashboard
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const adminClient = require('@supabase/supabase-js').createClient(supabaseUrl, serviceKey);

    const { error } = await adminClient
      .from('outlets')
      .update({ lat: null, lng: null, address: null })
      .eq('id', outlet_id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
