import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, outlet } = body

    if (!action || !outlet || !outlet.id) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
    const KASIR_TO_ORDER_SECRET = process.env.KASIR_TO_ORDER_SECRET

    if (!SS_ORDER_URL || !KASIR_TO_ORDER_SECRET) {
      console.warn('Sync URL atau Secret tidak dikonfigurasi, mengabaikan sinkronisasi.')
      return NextResponse.json({ success: false, message: 'Not configured' })
    }

    // Transform type for SS_ORDER compatibility
    const syncOutlet = { ...outlet };
    syncOutlet.type = outlet.type === 'mitra' ? 'partner' : 'owned';

    // Call SS_ORDER Edge Function
    const res = await fetch(`${SS_ORDER_URL}/functions/v1/sync-outlet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KASIR_TO_ORDER_SECRET}`
      },
      body: JSON.stringify({ action, outlet: syncOutlet })
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Gagal sinkronisasi ke SS_ORDER:', errorText)
      return NextResponse.json({ error: 'Gagal sinkronisasi ke sistem online' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saat sinkronisasi outlet:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
