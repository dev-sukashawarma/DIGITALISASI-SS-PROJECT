import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { ambilStatusPersiapan } from '../actions'
import { PapanPersiapan } from '@/components/pembukaan-outlet/PapanPersiapan'
import { hariIniWib } from '@/lib/pembukaanOutlet/konstanta'

export const dynamic = 'force-dynamic'

export default async function PapanPersiapanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { role } = await requireRole(['admin', 'owner'])
  const bolehTulis = role === 'admin' || role === 'developer'

  let status
  try {
    status = await ambilStatusPersiapan(id)
  } catch {
    notFound()
  }

  // Data pendukung editor (hanya dibaca sesudah requireRole).
  const svc = createServiceClient()
  const [rabRes, mitraRes] = await Promise.all([
    svc
      .from('rab_outlet_otomatis')
      .select('berlaku_sampai, kategori_kecuali')
      .eq('outlet_id', id)
      .order('berlaku_sampai', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc.from('mitra_profiles').select('user_id, nama_mitra').order('nama_mitra'),
  ])

  return (
    <PapanPersiapan
      status={status}
      bolehTulis={bolehTulis}
      hariIni={hariIniWib()}
      rab={rabRes.data ? { berlakuSampai: rabRes.data.berlaku_sampai, kategoriKecuali: rabRes.data.kategori_kecuali ?? [] } : null}
      opsiMitra={(mitraRes.data ?? []).map(m => ({ id: m.user_id, nama: m.nama_mitra }))}
    />
  )
}
