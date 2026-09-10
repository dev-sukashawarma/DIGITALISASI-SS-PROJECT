import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import BannerView from './BannerView'

export const dynamic = 'force-dynamic'

export default async function AppRetailBannerPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [bannerRes, menuRes] = await Promise.all([
    supabase
      .from('app_banners')
      .select('id, slot, urutan, badge, judul, subjudul, teks_tombol, gambar_url, aksi, target_menu_item_id, aktif')
      .order('slot')
      .order('urutan'),
    supabase
      .from('menu_items')
      .select('id, name')
      .eq('tampil_di_app', true)
      .order('name'),
  ])

  return (
    <BannerView
      banners={bannerRes.data ?? []}
      menuPilihan={(menuRes.data ?? []) as { id: string; name: string }[]}
      galat={bannerRes.error ? bannerRes.error.message : null}
      galatMenu={menuRes.error ? menuRes.error.message : null}
    />
  )
}
