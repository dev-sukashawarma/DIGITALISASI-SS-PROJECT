import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const { id } = await params
  const retail = createRetailClient()

  // Selalu dibatasi ke customer_id dari token. Tanpa ini, siapa pun yang
  // menebak id pesanan bisa membaca pesanan orang lain.
  const { data: draft } = await retail
    .from('order_drafts')
    .select('id, status, total_amount, outlet_id, pos_order_id, pos_order_number, created_at')
    .eq('id', id)
    .eq('customer_id', sesi.customerId)
    .maybeSingle()

  if (!draft) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
  }

  const db = createServiceClient()
  const { data: outlet } = await db
    .from('outlets')
    .select('name')
    .eq('id', draft.outlet_id)
    .maybeSingle()

  let statusDapur: string | null = null
  if (draft.pos_order_id) {
    const { data: pos } = await db
      .from('orders')
      .select('status')
      .eq('id', draft.pos_order_id)
      .maybeSingle()
    statusDapur = pos?.status ?? null
  }

  return NextResponse.json({
    id: draft.id,
    status: draft.status,
    status_dapur: statusDapur,
    total_amount: draft.total_amount,
    pos_order_number: draft.pos_order_number,
    outlet_name: outlet?.name ?? null,
    created_at: draft.created_at,
  })
}
