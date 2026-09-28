import { cookies, headers } from "next/headers";
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER, type OutletStaffProfile } from "@suka/auth";

/**
 * Helper khusus server (server component / server action / route handler).
 * JANGAN diimpor dari komponen klien — memakai next/headers.
 */

/**
 * Staff tepercaya dari header yang dipasang middleware (`enforceAppAccess`). Header dari
 * klien selalu dibuang middleware lebih dulu, jadi nilainya tidak bisa dipalsukan.
 */
export async function staffTepercaya(): Promise<OutletStaffProfile | null> {
  return parseStaffHeader((await headers()).get(STAFF_HEADER));
}

/** Pastikan pemanggil aktif dan berperan salah satu `peran`. */
export async function wajibPeran(
  peran: readonly string[]
): Promise<{ ok: true; staff: OutletStaffProfile } | { ok: false; error: string }> {
  const staff = await staffTepercaya();
  if (!staff || staff.status !== "active" || !peran.includes(staff.role)) {
    return { ok: false, error: "Akses ditolak: peran Anda tidak diizinkan melakukan tindakan ini." };
  }
  return { ok: true, staff };
}

/**
 * Client Supabase atas nama USER yang login (cookie sesi). Dipakai untuk RPC yang
 * menjaga peran sendiri dan mencatat auth.uid() — bukan service role.
 */
export async function createUserServerClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        );
      } catch {
        // Server Component: penulisan cookie ditangani middleware.
      }
    },
  });
}
