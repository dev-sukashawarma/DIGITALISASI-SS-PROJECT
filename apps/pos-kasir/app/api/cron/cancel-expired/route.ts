import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    // Verifikasi cron secret jika pakai Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Allow bypass for local testing if no secret set
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabase = createServiceClient()

    // 5 jam yang lalu
    const expiredTime = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()

    // Ambil order yang masih 'pending' (menunggu pembayaran) lebih dari 5 jam lalu update menjadi cancelled
    // Kita gunakan update dengan filter lte created_at
    const { data: cancelledOrders, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .lte('created_at', expiredTime)
      .select('id, receipt_number')

    if (updateError) throw updateError

    if (cancelledOrders && cancelledOrders.length > 0) {
      console.log(`Automatically cancelled ${cancelledOrders.length} expired orders:`, cancelledOrders.map(o => o.receipt_number).join(', '))
    }

    return NextResponse.json({ success: true, cancelled_count: cancelledOrders?.length || 0 })
  } catch (err: any) {
    console.error('Cron error cancel-expired:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
