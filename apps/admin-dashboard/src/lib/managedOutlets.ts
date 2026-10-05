import type { SupabaseClient } from '@supabase/supabase-js'
import type { Outlet, OutletStatus } from './types'

// Daftar outlet untuk halaman Manajemen Outlet.
//
// SENGAJA beda kunci dari `useOutlets()` (['outlets']). `useOutlets` dipakai ~20
// layar operasional dan membuang outlet tes/marketplace; halaman manajemen justru
// harus menampilkan SEMUA baris, termasuk outlet tes yang sedang dicoba admin.
// Dulu keduanya berbagi kunci ['outlets']: SSR mengisi daftar lengkap, lalu refetch
// sesudah simpan memakai versi tersaring → outlet bernama "tes" lenyap sampai refresh.
//
// Satu fetcher dipakai SSR (page.tsx) DAN klien, jadi daftar sebelum & sesudah
// simpan selalu sama. Prefix ['outlets'] dipertahankan supaya invalidasi
// ['outlets'] tetap ikut menyegarkan daftar ini.
export const MANAGED_OUTLETS_KEY = ['outlets', 'manage'] as const

export const OUTLET_COLUMNS =
  'id, slug, name, address, lat, lng, type, is_active, status, marquee_warning_threshold, open_hour, close_hour, deleted_at'

export async function fetchManagedOutlets(supabase: SupabaseClient): Promise<Outlet[]> {
  const { data, error } = await supabase
    .from('outlets')
    .select(OUTLET_COLUMNS)
    .order('name')
    .order('id')
  if (error) throw new Error(error.message)
  return (data ?? []) as Outlet[]
}

/** Status hasil simpan, sama dengan aturan server action & trigger DB. */
export function statusOutlet(o: { status?: OutletStatus; is_active: boolean }): OutletStatus {
  return o.status ?? (o.is_active ? 'active' : 'inactive')
}

/** Terapkan perubahan ke satu baris di cache (untuk optimistic update). */
export function patchOutlet(rows: Outlet[], id: string, patch: Partial<Outlet>): Outlet[] {
  return rows.map((o) => (o.id === id ? { ...o, ...patch } : o))
}

/**
 * Baris yang baru saja diubah tetap terlihat di tampilan saat ini walau statusnya
 * kini tak cocok dengan filter (mis. outlet pending diaktifkan dari tab Pending).
 * Pin dilepas begitu admin mengganti filter sendiri.
 */
export function withPinned(filtered: Outlet[], all: Outlet[], pinned: ReadonlySet<string>): Outlet[] {
  if (pinned.size === 0) return filtered
  const shown = new Set(filtered.map((o) => o.id))
  const extra = all.filter((o) => pinned.has(o.id) && !shown.has(o.id))
  if (extra.length === 0) return filtered
  return [...filtered, ...extra].sort((a, b) => a.name.localeCompare(b.name))
}
