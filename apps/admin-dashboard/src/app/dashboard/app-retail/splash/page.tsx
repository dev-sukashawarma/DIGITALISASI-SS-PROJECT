import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import SplashView from './SplashView'

export const dynamic = 'force-dynamic'

export default async function AppRetailSplashPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data, error } = await supabase
    .from('app_splash_setting')
    .select('gambar_url, durasi_ms, diubah_pada')
    .eq('id', true)
    .maybeSingle()

  return (
    <SplashView
      awal={{
        gambarUrl: data?.gambar_url ?? '',
        durasiMs: data?.durasi_ms ?? 3000,
      }}
      diubahPada={data?.diubah_pada ?? null}
      galat={error ? error.message : !data ? 'Pengaturan splash belum ada di basis data.' : null}
    />
  )
}
