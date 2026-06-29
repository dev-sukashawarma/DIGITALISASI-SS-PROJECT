import { NextResponse } from "next/server";
import { getToken, updateToken } from "@/lib/calibrationStore";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    // Use service role key to bypass RLS since SPV might only have read access to some fields,
    // or just let SPV use their token if RLS allows updating outlets.
    // The previous implementation used service key for bypassing RLS, but here we can just use the user's token 
    // if RLS allows it, or use service key. The previous kalibrasi API bypassed RLS.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Verifikasi user dulu
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: user, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const tokenData = getToken(token);
    if (!tokenData || tokenData.status !== 'submitted') {
      return NextResponse.json({ ok: false, error: "Data kalibrasi tidak valid atau belum di-submit" }, { status: 400 });
    }

    // Bypass RLS untuk update outlet
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error: updateError } = await adminClient
      .from('outlets')
      .update({
        lat: tokenData.lat,
        lng: tokenData.lng,
        address: tokenData.address
      })
      .eq('id', tokenData.outlet_id);

    if (updateError) {
      console.error("DB Update error:", updateError);
      return NextResponse.json({ ok: false, error: "Gagal menyimpan ke database" }, { status: 500 });
    }

    // Tandai token selesai
    updateToken(token, { status: 'completed' });

    return NextResponse.json({ ok: true, message: "Lokasi outlet berhasil diperbarui" });
  } catch (err: any) {
    console.error("Error approve calibration", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
