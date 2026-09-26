import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import PengaturanAppView from './PengaturanAppView'
import SeksiMenuTerlaris from './SeksiMenuTerlaris'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireRole(['owner', 'admin'])
  const db = createServiceClient()
  const [pRes, logRes, menuRes] = await Promise.all([
    db.from('app_pengaturan').select('*').eq('id', 1).maybeSingle(),
    db.from('app_retail_log').select('id, aksi, sasaran_id, data, oleh, pada').order('pada', { ascending: false }).range(0, 19),
    db.from('menu_items').select('id, name').eq('tampil_di_app', true).order('name'),
  ])
  const idStaf = [...new Set((logRes.data ?? []).map((l) => l.oleh))]
  const stafRes = idStaf.length
    ? await db.from('outlet_staff').select('id, name').in('id', idStaf)
    : { data: [] as { id: string; name: string | null }[], error: null as { message: string } | null }

  const awalTerlaris = Array.isArray(pRes.data?.menu_terlaris_ids) ? (pRes.data.menu_terlaris_ids as string[]) : []

  return (
    <PengaturanAppView
      awal={pRes.data}
      log={logRes.data ?? []}
      staf={stafRes.data ?? []}
      galat={[pRes.error, logRes.error, stafRes.error, menuRes.error].filter(Boolean).map((e) => e!.message)}
      sisipan={
        <SeksiMenuTerlaris
          // Kunci ikut isi tersimpan: setelah simpan & revalidate, bagian ini
          // mulai lagi dari data server, bukan state lama di browser.
          key={awalTerlaris.join(',')}
          awal={awalTerlaris}
          menu={(menuRes.data ?? []) as { id: string; name: string }[]}
          gagalMuat={pRes.data == null || menuRes.error != null}
        />
      }
    />
  )
}
