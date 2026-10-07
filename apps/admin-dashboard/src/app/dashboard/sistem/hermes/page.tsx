import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import KunciHermesPanel from './KunciHermesPanel'

export const dynamic = 'force-dynamic'

export default async function HalamanKunciHermes() {
  await requireRole(['owner', 'admin'])
  const svc = createServiceClient()
  const [kunci, log] = await Promise.all([
    svc.from('hermes_api_key')
      .select('id, nama, prefix, scope, ip_diizinkan, aktif, dibuat_at, dicabut_at, terakhir_dipakai_at')
      .order('dibuat_at', { ascending: false }),
    svc.from('hermes_api_log')
      .select('id, prefix, alat, status, alasan, ip, durasi_ms, at')
      .order('at', { ascending: false })
      .limit(50),
  ])
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Kunci Hermes</h1>
        <p className="text-sm text-gray-600">
          Kunci API untuk bot Hermes (baca saja). Setiap kunci dibatasi domain dan IP. Kunci hanya ditampilkan sekali saat dibuat.
        </p>
      </header>
      {kunci.error || log.error ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat data: {kunci.error?.message ?? log.error?.message}
        </p>
      ) : (
        <KunciHermesPanel kunci={kunci.data ?? []} log={log.data ?? []} />
      )}
    </div>
  )
}
