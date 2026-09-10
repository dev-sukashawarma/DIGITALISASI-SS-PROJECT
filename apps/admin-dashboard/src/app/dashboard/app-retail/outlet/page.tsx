import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import OutletAppView from './OutletAppView'
import type { OutletApp } from '@/lib/appRetail/kesiapanOutlet'
import { bacaJumlah } from '@/lib/appRetail/jumlahKueri'

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
      .select('id, name, type, is_active, app_enabled')
      .neq('type', 'marketplace')
      .order('name'),
    // `outlet_id IS NULL` = menu umum, satu-satunya yang benar-benar berlaku di
    // SEMUA outlet. Baris ber-outlet_id hanya muncul di outlet pemiliknya
    // (gateway: `outlet_id.is.null,outlet_id.eq.<id>`), jadi memasukkannya ke
    // angka yang dipakai untuk setiap baris tabel akan melebih-lebihkan.
    supabase.from('menu_items').select('id', { count: 'exact', head: true })
      .eq('tampil_di_app', true).is('outlet_id', null),
  ])

  return (
    <OutletAppView
      outlets={(outletRes.data ?? []) as OutletApp[]}
      jumlahMenuTayang={bacaJumlah(menuRes)}
    />
  )
}
