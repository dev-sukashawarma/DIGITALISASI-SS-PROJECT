import { NextResponse } from "next/server";
import { getTokensForOutlet } from "@/lib/calibrationStore";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const outlet_id = searchParams.get("outlet_id");
    
    if (!outlet_id) return NextResponse.json({ ok: false, error: "Missing outlet_id" }, { status: 400 });

    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: user, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const tokens = getTokensForOutlet(outlet_id);
    const activeToken = tokens.find(t => t.status === 'pending' || t.status === 'submitted');

    // Ambil data saved dari tabel outlets
    const { data: outletData } = await userClient
      .from('outlets')
      .select('lat, lng, address')
      .eq('id', outlet_id)
      .single();

    return NextResponse.json({ 
      ok: true, 
      data: activeToken || null,
      saved: outletData || null
    });
  } catch (err: any) {
    console.error("Error get calibration status", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
