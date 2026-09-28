/**
 * Kantor Pusat: tidak ada kasir, pesanan, maupun checklist buka/tutup outlet di sana.
 * Staf-nya tidak diarahkan ke Checklist setelah absen, menu Checklist diganti Cuti, dan
 * gerbang absen pulang (laci kasir, checklist tutup) tidak berlaku — cermin
 * `StaffProfile.diKantorPusat` di app native.
 *
 * `outlets.type = 'office'` saja TIDAK cukup sebagai penanda: tipe itu juga dipegang
 * Gudang Pusat, gudang sungguhan yang tetap memakai checklist dan wajib menutup outlet.
 */
export const ID_KANTOR_PUSAT = "ffffffff-ffff-ffff-ffff-ffffffffffff";
export const SLUG_KANTOR_PUSAT = "kantor-pusat";

/**
 * Baris outlet adalah Kantor Pusat. ID dan slug dicocokkan lebih dulu; nama dipakai sebagai
 * cadangan kalau slug-nya pernah diubah, karena satu-satunya lokasi `office` yang bernama
 * "kantor" memang Kantor Pusat.
 */
export function adalahKantorPusat(
  outlet: { id?: string | null; slug?: string | null; name?: string | null; type?: string | null } | null | undefined,
): boolean {
  if (!outlet) return false;
  if (outlet.id === ID_KANTOR_PUSAT || outlet.slug === SLUG_KANTOR_PUSAT) return true;
  return outlet.type === "office" && /kantor/i.test(outlet.name ?? "");
}

/**
 * Staf yang outlet utamanya Kantor Pusat. Outlet utama ikut pindah ke outlet tempat absen
 * masuk terakhir (RPC submit_attendance), jadi ini juga mengikuti tempat kerja hari itu.
 * Profil staf di web hanya membawa id & nama outlet, bukan slug/tipe.
 */
export function staffDiKantorPusat(
  staff: { outlet_id: string | null; outlets: { name: string } | null } | null | undefined,
): boolean {
  if (!staff) return false;
  return staff.outlet_id === ID_KANTOR_PUSAT || /^kantor\s+pusat$/i.test(staff.outlets?.name?.trim() ?? "");
}
