import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import PesananAppView from './PesananAppView'

export const dynamic = 'force-dynamic'

const WIB_MS = 7 * 60 * 60 * 1000
function awalHariIniWibIso(): string {
  const HARI = 24 * 60 * 60 * 1000
  return new Date(Math.floor((Date.now() + WIB_MS) / HARI) * HARI - WIB_MS).toISOString()
}

export default async function Page() {
  await requireRole(['owner', 'admin'])
  const db = createServiceClient()
  const retail = db.schema('retail')
  const [pesananRes, outletRes, refundPerluRes, refundSudahRes, pengaturanRes] = await Promise.all([
    db.from('orders')
      .select('id, order_number, outlet_id, status, kitchen_receipt_printed, created_at, total_amount')
      .eq('sales_source', 'app').gte('created_at', awalHariIniWibIso())
      .order('created_at', { ascending: false }).range(0, 499),
    db.from('outlets').select('id, name, phone').eq('app_enabled', true),
    retail.from('refund_pesanan').select('id, order_id, outlet_id, customer_id, nominal, dibuat_pada')
      .eq('status', 'perlu').order('dibuat_pada', { ascending: true }).range(0, 199),
    retail.from('refund_pesanan').select('id, order_id, outlet_id, nominal, catatan, diproses_pada')
      .eq('status', 'sudah').order('diproses_pada', { ascending: false }).range(0, 49),
    db.from('app_pengaturan').select('menit_tertahan').eq('id', 1).maybeSingle(),
  ])
  const idPelanggan = [...new Set((refundPerluRes.data ?? []).map((r) => r.customer_id))]
  const pelangganRes = idPelanggan.length
    ? await retail.from('customers').select('id, name, phone').in('id', idPelanggan)
    : { data: [] as { id: string; name: string | null; phone: string | null }[], error: null as { message: string } | null }

  return (
    <PesananAppView
      pesanan={pesananRes.data ?? []}
      outlets={outletRes.data ?? []}
      refundPerlu={refundPerluRes.data ?? []}
      refundSudah={refundSudahRes.data ?? []}
      pelanggan={pelangganRes.data ?? []}
      menitTertahan={pengaturanRes.data?.menit_tertahan ?? 10}
      galat={[pesananRes.error, outletRes.error, refundPerluRes.error, refundSudahRes.error, pengaturanRes.error, pelangganRes.error]
        .filter(Boolean).map((e) => e!.message)}
    />
  )
}
