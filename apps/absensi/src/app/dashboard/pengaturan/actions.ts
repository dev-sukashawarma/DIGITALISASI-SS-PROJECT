"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { wajibPeran, createUserServerClient } from "@/lib/auth-server";
import { keShiftDrafts, validasiShift, type ShiftDraft } from "@/lib/attendance/jadwalOutlet";
import { GEOFENCE_RADIUS_M } from "@/lib/gps";
import { keJadwalStaf, validasiJadwalStaf, type JadwalStaf } from "@/lib/attendance/jadwalStaf";

const SETTINGS_ALLOWED_ROLES = ["admin", "admin_hr", "regional_manager", "developer"];

/**
 * Hasil aksi. Galat DIKEMBALIKAN, bukan dilempar: pesan error server action yang
 * dilempar disamarkan Next.js di produksi, padahal pesan validasi dari database
 * (mis. "Ada dua shift dengan jam yang sama persis") perlu sampai ke admin.
 */
export type HasilAksi = { success: true } | { success: false; error: string };

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Identitas pemanggil diambil dari header tepercaya middleware — BUKAN dari
 * `caller_staff_id` kiriman klien (dulu bisa dikosongkan untuk melewati cek ini).
 */
async function verifySettingsRole(): Promise<string | null> {
  const cek = await wajibPeran(SETTINGS_ALLOWED_ROLES);
  return cek.ok
    ? null
    : "Akses Ditolak: Hanya Admin, Admin HR, Regional Manager, dan Developer yang diizinkan mengubah konfigurasi absensi.";
}

export async function saveGlobalConfig(formData: FormData): Promise<HasilAksi> {
  const ditolak = await verifySettingsRole();
  if (ditolak) return { success: false, error: ditolak };
  const supabaseAdmin = getSupabaseAdmin();

  const jam_masuk = formData.get("jam_masuk") as string;
  const jam_keluar = formData.get("jam_keluar") as string;
  const toleransi_menit = parseInt(formData.get("toleransi_menit") as string || "0", 10);
  const absen_window_mode = formData.get("absen_window_mode") as string;
  const is_active = formData.get("is_active") === "true";
  const overwrite_all = formData.get("overwrite_all") === "on";

  // Kolom `value` di-replace utuh, sementara form ini tidak punya field radius sama
  // sekali. Tanpa membaca nilai lama, menyimpan aturan pusat dari web akan menghapus
  // `radius_m` — dan geofence (di route submit-attendance maupun di app native) diam-diam
  // melebar ke default 100 m. Jadi pertahankan field yang tidak dimiliki form ini.
  const { data: existingRow } = await supabaseAdmin
    .from("global_settings")
    .select("value")
    .eq("key", "global_attendance_config")
    .maybeSingle();

  let existingValue = existingRow?.value as Record<string, unknown> | string | null;
  if (typeof existingValue === "string") {
    try {
      existingValue = JSON.parse(existingValue);
    } catch {
      existingValue = null;
    }
  }
  const existingRadius = (existingValue as { radius_m?: number } | null)?.radius_m;

  const globalValue = {
    jam_masuk,
    jam_keluar,
    toleransi_menit,
    absen_window_mode,
    ...(existingRadius != null ? { radius_m: existingRadius } : {}),
  };

  const { error: errGlobal } = await supabaseAdmin
    .from("global_settings")
    .upsert({ key: "global_attendance_config", value: globalValue });

  if (errGlobal) return { success: false, error: errGlobal.message };

  const { error: errOutlet } = await supabaseAdmin
    .from("outlets")
    .update({ is_active })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // update all

  if (errOutlet) return { success: false, error: errOutlet.message };

  if (overwrite_all) {
    // Shift outlet ikut terhapus (FK ON DELETE CASCADE ke outlet_attendance_shift).
    const { error: errDel } = await supabaseAdmin
      .from("outlet_attendance_config")
      .delete()
      .neq("outlet_id", "00000000-0000-0000-0000-000000000000"); // delete all exceptions
    if (errDel) return { success: false, error: errDel.message };
  }

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}

/**
 * Radius geofence yang dipakai saat menyimpan jadwal khusus (form ini tidak punya field
 * radius): radius outlet yang sudah tersimpan → radius pusat → default 100 m. Cabang
 * baru mewarisi radius pusat, bukan default kolom, agar geofence-nya tidak berubah
 * hanya karena jam kerjanya dibuat khusus.
 */
async function radiusTersimpan(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, outletId: string): Promise<number> {
  const [outletRes, globalRes] = await Promise.all([
    supabaseAdmin.from("outlet_attendance_config").select("radius_m").eq("outlet_id", outletId).maybeSingle(),
    supabaseAdmin.from("global_settings").select("value").eq("key", "global_attendance_config").maybeSingle(),
  ]);
  const radiusOutlet = Number(outletRes.data?.radius_m ?? 0);
  if (Number.isFinite(radiusOutlet) && radiusOutlet > 0) return Math.round(radiusOutlet);

  let nilai = globalRes.data?.value as { radius_m?: number } | string | null;
  if (typeof nilai === "string") {
    try {
      nilai = JSON.parse(nilai);
    } catch {
      nilai = null;
    }
  }
  const radiusPusat = Number((nilai as { radius_m?: number } | null)?.radius_m ?? 0);
  if (Number.isFinite(radiusPusat) && radiusPusat > 0) return Math.round(radiusPusat);
  return GEOFENCE_RADIUS_M;
}

export async function saveOutletException(formData: FormData): Promise<HasilAksi> {
  const ditolak = await verifySettingsRole();
  if (ditolak) return { success: false, error: ditolak };

  const outlet_id = formData.get("outlet_id") as string;
  const toleransi_menit = parseInt(formData.get("toleransi_menit") as string || "0", 10);
  const absen_window_mode = formData.get("absen_window_mode") === "manual" ? "manual" : "auto";
  const is_active_str = formData.get("is_active");
  const is_active = is_active_str === "true";
  const pilih_shift_aktif = formData.get("pilih_shift_aktif") === "true";

  if (!outlet_id) return { success: false, error: "Pilih outlet terlebih dahulu" };

  // Daftar shift (urutan = posisi). Form lama tanpa field `shifts` tetap diterima
  // lewat jam_masuk/jam_keluar (+ shift2_*).
  let shifts: ShiftDraft[];
  const shiftsRaw = formData.get("shifts");
  if (typeof shiftsRaw === "string" && shiftsRaw) {
    try {
      shifts = keShiftDrafts(JSON.parse(shiftsRaw));
    } catch {
      return { success: false, error: "Daftar shift tidak valid" };
    }
  } else {
    shifts = keShiftDrafts([
      { jam_masuk: formData.get("jam_masuk"), jam_keluar: formData.get("jam_keluar") },
      ...(formData.get("shift2_jam_masuk") && formData.get("shift2_jam_keluar")
        ? [{ jam_masuk: formData.get("shift2_jam_masuk"), jam_keluar: formData.get("shift2_jam_keluar") }]
        : []),
    ]);
  }

  const salah = validasiShift(shifts, pilih_shift_aktif);
  if (salah) return { success: false, error: salah };

  const supabaseAdmin = getSupabaseAdmin();
  const radius_m = await radiusTersimpan(supabaseAdmin, outlet_id);

  // Satu RPC atomik (config + seluruh shift). Dipanggil atas nama user agar penjaga
  // peran di database ikut berlaku, bukan hanya cek header di atas.
  const supabaseUser = await createUserServerClient();
  const { error: errConfig } = await supabaseUser.rpc("simpan_jadwal_outlet", {
    p_outlet_id: outlet_id,
    p_toleransi_menit: toleransi_menit,
    p_radius_m: radius_m,
    p_absen_window_mode: absen_window_mode,
    p_pilih_shift_aktif: pilih_shift_aktif,
    p_shifts: shifts.map((s) => ({ nama: s.nama || null, jam_masuk: s.jam_masuk, jam_keluar: s.jam_keluar })),
  });

  if (errConfig) return { success: false, error: errConfig.message };

  if (is_active_str !== null) {
    const { error: errOutlet } = await supabaseAdmin
      .from("outlets")
      .update({ is_active })
      .eq("id", outlet_id);

    if (errOutlet) return { success: false, error: errOutlet.message };
  }

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}

/** `_callerStaffId` diabaikan (dipertahankan agar pemanggil lama tetap kompatibel). */
export async function deleteOutletException(outlet_id: string, _callerStaffId?: string): Promise<HasilAksi> {
  const ditolak = await verifySettingsRole();
  if (ditolak) return { success: false, error: ditolak };
  const supabaseAdmin = getSupabaseAdmin();

  // Shift outlet ikut terhapus (FK ON DELETE CASCADE).
  const { error } = await supabaseAdmin
    .from("outlet_attendance_config")
    .delete()
    .eq("outlet_id", outlet_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}

/** `_callerStaffId` diabaikan (dipertahankan agar pemanggil lama tetap kompatibel). */
export async function deleteAllExceptions(_callerStaffId?: string): Promise<HasilAksi> {
  const ditolak = await verifySettingsRole();
  if (ditolak) return { success: false, error: ditolak };
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("outlet_attendance_config")
    .delete()
    .neq("outlet_id", "00000000-0000-0000-0000-000000000000"); // delete all

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}

// ─────────────────────────────────────────────── Jadwal khusus staf

/**
 * Hasil simpan/hapus jadwal khusus staf. `daftar` = seluruh aturan terbaru (dibaca di
 * aksi yang sama, jadi klien tidak perlu satu round trip lagi); null bila pembacaan
 * ulang gagal — klien lalu memuat sendiri.
 */
export type HasilJadwalStaf = { success: true; daftar: JadwalStaf[] | null } | { success: false; error: string };

export type InputJadwalStaf = {
  /** null = aturan baru. */
  id: string | null;
  outletId: string;
  nama: string;
  jamMasuk: string;
  jamKeluar: string;
  staffIds: string[];
};

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const adalahUuid = (x: unknown): x is string => typeof x === "string" && POLA_UUID.test(x);

async function daftarJadwalStafTerbaru(supabaseUser: Awaited<ReturnType<typeof createUserServerClient>>): Promise<JadwalStaf[] | null> {
  const { data, error } = await supabaseUser.rpc("list_jadwal_staf");
  return error || !Array.isArray(data) ? null : data.map(keJadwalStaf);
}

/**
 * Simpan aturan jadwal khusus staf (baru atau edit). RPC dipanggil atas nama USER —
 * penjaga peran database ikut berlaku dan `updated_by` tercatat. Pesan galat RPC
 * (mis. staf bentrok dengan aturan lain) berbahasa Indonesia dan diteruskan apa adanya.
 */
export async function simpanJadwalStaf(input: InputJadwalStaf): Promise<HasilJadwalStaf> {
  const ditolak = await verifySettingsRole();
  if (ditolak) return { success: false, error: ditolak };

  const id = adalahUuid(input?.id) ? input.id : null;
  const outletId = adalahUuid(input?.outletId) ? input.outletId : "";
  const nama = typeof input?.nama === "string" ? input.nama.trim() : "";
  const jamMasuk = typeof input?.jamMasuk === "string" ? input.jamMasuk.slice(0, 5) : "";
  const jamKeluar = typeof input?.jamKeluar === "string" ? input.jamKeluar.slice(0, 5) : "";
  const staffIds = Array.isArray(input?.staffIds) ? Array.from(new Set(input.staffIds.filter(adalahUuid))) : [];

  const salah = validasiJadwalStaf({ outletId, nama, jamMasuk, jamKeluar, staffIds });
  if (salah) return { success: false, error: salah };

  const supabaseUser = await createUserServerClient();
  const { error } = await supabaseUser.rpc("simpan_jadwal_staf", {
    p_id: id,
    p_outlet_id: outletId,
    p_nama: nama,
    p_jam_masuk: jamMasuk,
    p_jam_keluar: jamKeluar,
    p_staff_ids: staffIds,
  });
  if (error) return { success: false, error: error.message };

  return { success: true, daftar: await daftarJadwalStafTerbaru(supabaseUser) };
}

/** Hapus satu aturan jadwal khusus staf (anggotanya ikut terhapus — FK cascade). */
export async function hapusJadwalStaf(id: string): Promise<HasilJadwalStaf> {
  const ditolak = await verifySettingsRole();
  if (ditolak) return { success: false, error: ditolak };
  if (!adalahUuid(id)) return { success: false, error: "Aturan tidak valid." };

  const supabaseUser = await createUserServerClient();
  const { error } = await supabaseUser.rpc("hapus_jadwal_staf", { p_id: id });
  if (error) return { success: false, error: error.message };

  return { success: true, daftar: await daftarJadwalStafTerbaru(supabaseUser) };
}
