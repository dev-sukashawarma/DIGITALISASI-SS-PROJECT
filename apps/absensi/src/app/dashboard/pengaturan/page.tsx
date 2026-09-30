import { createClient } from "@supabase/supabase-js";
import PengaturanClient from "./PengaturanClient";
import { keOutletJadwal } from "@/lib/attendance/jadwalOutlet";
import { keJadwalStaf } from "@/lib/attendance/jadwalStaf";
import { createUserServerClient } from "@/lib/auth-server";

// Disable caching for this page so it always fetches fresh data on full reload.
// However, the client component will keep it synced via Realtime.
export const revalidate = 0;

export default async function PengaturanAbsensiPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy_key_for_build";
  const supabase = createClient(supabaseUrl, serviceKey);

  const [globalRes, outletsRes, outletConfigsRes, jadwalStafRes] = await Promise.all([
    supabase.from("global_settings").select("value").eq("key", "global_attendance_config").maybeSingle(),
    supabase.from("outlets").select("id, name, is_active").order("name").limit(200),
    // Config + seluruh shift tiap outlet dalam satu query (embed tabel shift).
    supabase
      .from("outlet_attendance_config")
      .select("*, shifts:outlet_attendance_shift(urutan, nama, jam_masuk, jam_keluar)")
      .limit(200),
    // Jadwal khusus staf: hanya lewat RPC (tabelnya tertutup RLS), atas nama user supaya
    // penjaga peran di database berlaku. Peran lain ditolak → daftar kosong.
    createUserServerClient().then((c) => c.rpc("list_jadwal_staf")),
  ]);

  let cfgRaw = globalRes.data?.value;
  if (typeof cfgRaw === "string") {
    try {
      cfgRaw = JSON.parse(cfgRaw);
    } catch (e) {
      cfgRaw = null;
    }
  }
  const cfg = cfgRaw || { jam_masuk: "09:00", jam_keluar: "17:00", toleransi_menit: 15, absen_window_mode: "auto" };
  
  const initialGlobalConfig = {
    jam_masuk: cfg.jam_masuk?.slice(0, 5) || "09:00",
    jam_keluar: cfg.jam_keluar?.slice(0, 5) || "17:00",
    toleransi_menit: cfg.toleransi_menit || 15,
    is_active: true,
    absen_window_mode: cfg.absen_window_mode || "auto",
  };

  const initialOutlets = outletsRes.data || [];
  const initialOutletConfigs = (outletConfigsRes.data || []).map(keOutletJadwal);
  const initialJadwalStaf = Array.isArray(jadwalStafRes.data) ? jadwalStafRes.data.map(keJadwalStaf) : [];

  return (
    <PengaturanClient 
      initialGlobalConfig={initialGlobalConfig} 
      initialOutlets={initialOutlets} 
      initialOutletConfigs={initialOutletConfigs} 
      initialJadwalStaf={initialJadwalStaf}
    />
  );
}
