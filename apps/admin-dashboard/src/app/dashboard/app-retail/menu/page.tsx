import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import MenuAppView from './MenuAppView'
import type { MenuApp } from '@/lib/appRetail/tampilanMenu'

export const dynamic = 'force-dynamic'

export default async function AppRetailMenuPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [itemsRes, outletRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id, name, price, channel_prices, image_url, foto_app, deskripsi_app, tampil_di_app, is_available, outlet_id, categories(name)')
      .order('name'),
    // Sama dengan GET /api/v1/outlets: app_enabled DAN bukan marketplace.
    // Angka ini dipakai untuk klaim cakupan di layar, jadi tidak boleh lebih
    // longgar daripada yang benar-benar dilayani gateway.
    supabase.from('outlets').select('name')
      .eq('app_enabled', true).neq('type', 'marketplace').order('name'),
  ])

  return (
    <MenuAppView
      items={(itemsRes.data ?? []) as MenuApp[]}
      outletMelayani={(outletRes.data ?? []).map((o) => o.name as string)}
    />
  )
}
