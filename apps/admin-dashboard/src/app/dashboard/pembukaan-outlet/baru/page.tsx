import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { WizardPembukaan, type OpsiStaf } from '@/components/pembukaan-outlet/WizardPembukaan'
import { hariIniWib } from '@/lib/pembukaanOutlet/konstanta'

export const dynamic = 'force-dynamic'

export default async function BukaOutletBaruPage() {
  await requireRole(['admin'])
  // Daftar pilihan (nama staf & akun mitra) dibaca dengan service client
  // sesudah requireRole: RLS outlet_staff tidak membuka semua nama ke admin.
  const svc = createServiceClient()
  const [stafRes, mitraRes] = await Promise.all([
    svc
      .from('outlet_staff')
      .select('id, name, role')
      .in('role', ['area_manager', 'leader'])
      .eq('status', 'active')
      .order('name'),
    svc.from('mitra_profiles').select('user_id, nama_mitra').order('nama_mitra'),
  ])
  if (stafRes.error) throw new Error(stafRes.error.message)
  if (mitraRes.error) throw new Error(mitraRes.error.message)

  const am: OpsiStaf[] = (stafRes.data ?? []).filter(s => s.role === 'area_manager').map(s => ({ id: s.id, nama: s.name }))
  const leader: OpsiStaf[] = (stafRes.data ?? []).filter(s => s.role === 'leader').map(s => ({ id: s.id, nama: s.name }))
  const mitra: OpsiStaf[] = (mitraRes.data ?? []).map(m => ({ id: m.user_id, nama: m.nama_mitra }))

  return <WizardPembukaan am={am} leader={leader} mitra={mitra} hariIni={hariIniWib()} />
}
