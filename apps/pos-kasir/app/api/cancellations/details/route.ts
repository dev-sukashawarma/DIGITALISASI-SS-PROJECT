import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Ambil data sesi/role dari cookie yang diinject oleh middleware
    const cookieHeader = req.headers.get('cookie') || ''
    let role: string | null = null
    const cacheMatch = cookieHeader.match(/_suka_staff_cache=([^;]+)/)
    
    if (cacheMatch && cacheMatch[1]) {
      try {
        const decoded = decodeURIComponent(cacheMatch[1])
        const parsed = JSON.parse(decoded)
        role = parsed.role
      } catch (e) {
        console.error('Failed to parse staff cache cookie', e)
      }
    }

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
