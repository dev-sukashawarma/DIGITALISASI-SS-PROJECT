import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import PengaturanAppView from './PengaturanAppView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireRole(['owner', 'admin'])
  const db = createServiceClient()
  const [pRes, logRes] = await Promise.all([
    db.from('app_pengaturan').select('*').eq('id', 1).maybeSingle(),
    db.from('app_retail_log').select('id, aksi, sasaran_id, data, oleh, pada').order('pada', { ascending: false }).range(0, 19),
  ])
  const idStaf = [...new Set((logRes.data ?? []).map((l) => l.oleh))]
  const stafRes = idStaf.length
    ? await db.from('outlet_staff').select('id, name').in('id', idStaf)
    : { data: [] as { id: string; name: string | null }[], error: null as { message: string } | null }

  return (
    <PengaturanAppView
      awal={pRes.data}
      log={logRes.data ?? []}
      staf={stafRes.data ?? []}
      galat={[pRes.error, logRes.error, stafRes.error].filter(Boolean).map((e) => e!.message)}
    />
  )
}
