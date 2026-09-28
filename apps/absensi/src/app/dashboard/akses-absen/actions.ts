"use server";

import { revalidatePath } from "next/cache";
import { createUserServerClient, wajibPeran } from "@/lib/auth-server";
import { PERAN_PENGATUR_AKSES } from "./peran";

export type HasilAturAkses = { ok: true; jumlah: number } | { ok: false; error: string };

export type InputAturAkses = {
  staffIds: string[];
  outletIds: string[];
  /** null = izin "semua outlet" tidak diubah. */
  semuaOutlet: boolean | null;
  /** 'ganti' = outlet tambahan jadi persis outletIds; 'tambah' = ditambahkan. */
  mode: "ganti" | "tambah";
};

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidUnik = (xs: unknown): string[] =>
  Array.isArray(xs) ? Array.from(new Set(xs.filter((x): x is string => typeof x === "string" && POLA_UUID.test(x)))) : [];

/**
 * Atur izin absen satu atau banyak crew sekaligus. Peran dicek dari header tepercaya,
 * lalu RPC dipanggil atas nama USER (bukan service role) supaya penjaga peran di
 * database ikut berlaku dan `granted_by` tercatat. Galat dikembalikan (bukan dilempar)
 * agar pesan dari database sampai ke layar di produksi.
 */
export async function aturAksesAbsen(input: InputAturAkses): Promise<HasilAturAkses> {
  const cek = await wajibPeran(PERAN_PENGATUR_AKSES);
  if (!cek.ok) return { ok: false, error: cek.error };

  const staffIds = uuidUnik(input?.staffIds);
  const outletIds = uuidUnik(input?.outletIds);
  if (staffIds.length === 0) return { ok: false, error: "Pilih minimal satu crew" };
  const mode = input?.mode === "tambah" ? "tambah" : "ganti";
  const semuaOutlet = typeof input?.semuaOutlet === "boolean" ? input.semuaOutlet : null;

  const supabase = await createUserServerClient();
  const { data, error } = await supabase.rpc("atur_akses_absen", {
    p_staff_ids: staffIds,
    p_outlet_ids: outletIds,
    p_semua_outlet: semuaOutlet,
    p_mode: mode,
  });
  if (error) return { ok: false, error: error.message };

  // Server action + revalidatePath: data halaman ikut dirender ulang di respons yang
  // sama, jadi klien tidak perlu memanggil ulang daftar.
  revalidatePath("/dashboard/akses-absen");
  return { ok: true, jumlah: Number(data ?? 0) };
}
