import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRequestStaff } from '@/lib/authz'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // `role` di sini HANYA dipakai untuk hint UI (sembunyikan tombol approve
    // di halaman kalau jelas-jelas bukan approver) -- gerbang yang
    // sebenarnya ada di action/route.ts (requireApprover), jadi walau field
    // ini dipalsukan/kosong, tidak membuka celah apa pun. Dulu dibaca dari
    // cookie cache client (`_suka_staff_cache`) yang gampang dipalsukan
    // browser -- diganti ke sesi tervalidasi server supaya hint-nya sendiri
    // juga akurat.
    const requestStaff = await getRequestStaff()
    const role = requestStaff?.role ?? null

    // 1. Dapatkan request pembatalan berdasarkan token
    const { data: request, error: reqErr } = await supabase
      .from('cancellation_requests')
      .select('*, orders(outlet_id, order_number, customer_name, total_amount)')
      .eq('token', token)
      .single()

    if (reqErr || !request) {
      return NextResponse.json({ error: 'Token tidak valid atau tidak ditemukan.' }, { status: 404 })
    }

    // 2. Cek apakah sudah expired
    if (new Date(request.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link ini sudah kedaluwarsa.' }, { status: 400 })
    }

    // 3. Cek status
    if (request.status !== 'pending') {
      return NextResponse.json({ error: `Link ini sudah diproses (Status: ${request.status}).` }, { status: 400 })
    }

    // 4. Ambil nama outlet
    const orderData = request.orders as any
    let outletName = 'Outlet'
    if (orderData?.outlet_id) {
      const { data: outletDataRes } = await supabase
        .from('outlets')
        .select('name')
        .eq('id', orderData.outlet_id)
        .single()
      if (outletDataRes) {
        outletName = outletDataRes.name
      }
    }

    return NextResponse.json({
      role,
      order: {
        outletName,
        customerName: orderData?.customer_name,
        orderNumber: orderData?.order_number,
        totalAmount: orderData?.total_amount,
        reason: request.reason
      }
    })
  } catch (error: any) {
    console.error('Cancellation Details Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
