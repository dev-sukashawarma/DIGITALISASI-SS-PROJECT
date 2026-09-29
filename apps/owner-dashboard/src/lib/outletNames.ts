import type { createSupabaseBrowserClient } from '@suka/auth'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

type SupabaseClient = ReturnType<typeof createSupabaseBrowserClient>

// Daftar outlet (id + nama) dipakai bersama oleh halaman & hook dashboard.
// Dulu satu halaman Kinerja Penjualan menarik tabel `outlets` TIGA kali
// (halaman + useSalesSummary periode kini + periode sebelumnya). Di sini
// permintaan yang sedang berjalan dibagi, dan hasil sukses disimpan sebentar.
//
// Isi query SAMA dengan yang dipakai halaman sebelumnya: kecualikan outlet uji
// developer, urut nama. Hook useSalesSummary dulu tak mengurutkan, tapi ia
// hanya membangun peta id→nama, jadi urutan tak berpengaruh.
export type OutletName = { id: string; name: string }

const TTL_MS = 5 * 60 * 1000
let cache: { at: number; promise: Promise<OutletName[]> } | null = null

export function fetchOutletNames(supabase: SupabaseClient): Promise<OutletName[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.promise
  const promise = (async () => {
    const { data, error } = await supabase
      .from('outlets')
      .select('id,name')
      .neq('id', TEST_OUTLET_ID)
      .order('name')
    if (error) throw new Error(error.message)
    return (data ?? []) as OutletName[]
  })()
  const entry = { at: Date.now(), promise }
  cache = entry
  // Galat jangan di-cache: panggilan berikutnya mencoba lagi.
  promise.catch(() => { if (cache === entry) cache = null })
  return promise
}
