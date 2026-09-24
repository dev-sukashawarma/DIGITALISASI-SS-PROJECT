import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import OutletAppView from './OutletAppView'
import type { OutletApp } from '@/lib/appRetail/kesiapanOutlet'
import { bacaJumlah } from '@/lib/appRetail/jumlahKueri'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AppRetailOutletPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Outlet tes SENGAJA tidak disaring. Aturan "outlet tes jangan masuk
  // perhitungan" berlaku untuk laporan, bukan layar ini: retail-gateway juga
  // tidak menyaringnya, dan outlet tes satu-satunya baris app_enabled = true
  // hari ini. Menyaringnya akan menyembunyikan satu-satunya outlet yang
  // sedang melayani aplikasi. Marketplace dibuang karena gateway pun membuangnya.
  const [outletRes, menuRes] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, type, is_active, app_enabled, open_hour, close_hour')
      .neq('type', 'marketplace')
      .order('name'),
    // `outlet_id IS NULL` = menu umum, satu-satunya yang benar-benar berlaku di
    // SEMUA outlet. Baris ber-outlet_id hanya muncul di outlet pemiliknya
    // (gateway: `outlet_id.is.null,outlet_id.eq.<id>`), jadi memasukkannya ke
    // angka yang dipakai untuk setiap baris tabel akan melebih-lebihkan.
    supabase.from('menu_items').select('id', { count: 'exact', head: true })
      .eq('tampil_di_app', true).is('outlet_id', null),
  ])

  // Data pengaman operasional (tutup sementara/menu habis/jam) hanya bisa
  // dibaca owner/admin -- pakai service client, bukan client RLS di atas.
  await requireRole(['owner', 'admin'])
  const svc = createServiceClient()
  const [tutupRes, menuAplikasiRes, kioskRes, pengaturanRes] = await Promise.all([
    svc.from('outlet_tutup_sementara').select('id, outlet_id, sampai, alasan')
      .is('dicabut_pada', null).gt('sampai', new Date().toISOString()),
    svc.from('menu_items').select('id, name').eq('tampil_di_app', true).order('sort_order'),
    svc.from('kiosk_settings').select('outlet_id, value').eq('key', 'unavailable_menu_ids'),
    svc.from('app_pengaturan').select('menit_pesan_terakhir').eq('id', 1).maybeSingle(),
  ])
  const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'
  const mentahPerOutlet: Record<string, string[]> = {}
  for (const r of kioskRes.data ?? []) {
    try {
      const v = JSON.parse(r.value ?? '[]')
      mentahPerOutlet[r.outlet_id] = Array.isArray(v) ? v : []
    } catch {
      mentahPerOutlet[r.outlet_id] = []
    }
  }
  // Outlet tanpa baris sendiri "mewarisi" daftar PUSAT (sama dengan aturan
  // POS & gateway, apps/retail-gateway/src/lib/menuHabisOutlet.ts) -- kalau
  // tidak, dialog & hitungan "Menu habis (N)" akan diam-diam menampilkan
  // kosong padahal PUSAT sedang menandai menu itu habis di outlet ini juga.
  const daftarHabis: Record<string, string[]> = {}
  for (const o of outletRes.data ?? []) {
    daftarHabis[o.id] = mentahPerOutlet[o.id] ?? mentahPerOutlet[PUSAT_OUTLET_ID] ?? []
  }

  return (
    <OutletAppView
      outlets={(outletRes.data ?? []) as OutletApp[]}
      jumlahMenuTayang={bacaJumlah(menuRes)}
      tutupAktif={tutupRes.data ?? []}
      menuAplikasi={menuAplikasiRes.data ?? []}
      daftarHabis={daftarHabis}
      menitPesanTerakhir={pengaturanRes.data?.menit_pesan_terakhir ?? 30}
    />
  )
}
