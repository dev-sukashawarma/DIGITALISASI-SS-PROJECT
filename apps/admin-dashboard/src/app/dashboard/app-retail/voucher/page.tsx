import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import VoucherView from './VoucherView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireRole(['owner', 'admin'])
  const db = createServiceClient()
  const retail = db.schema('retail')
  const [vRes, rRes, menuRes, katRes, outRes] = await Promise.all([
    retail.from('vouchers').select('*').order('created_at', { ascending: false }),
    retail.from('voucher_ringkasan').select('voucher_id, terpakai, total_potongan'),
    db.from('menu_items').select('id, name').eq('tampil_di_app', true).order('name'),
    db.from('categories').select('id, name').order('name'),
    db.from('outlets').select('id, name').eq('app_enabled', true).order('name'),
  ])
  return (
    <VoucherView
      vouchers={vRes.data ?? []}
      ringkasan={rRes.data ?? []}
      menu={(menuRes.data ?? []) as { id: string; name: string }[]}
      kategori={(katRes.data ?? []) as { id: string; name: string }[]}
      outlet={(outRes.data ?? []) as { id: string; name: string }[]}
      galat={[vRes.error, rRes.error, menuRes.error, katRes.error, outRes.error].filter(Boolean).map((e) => e!.message)}
    />
  )
}
