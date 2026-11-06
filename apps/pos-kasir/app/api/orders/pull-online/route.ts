import { NextResponse } from 'next/server'
import { requirePosCaller } from '@/lib/posApiGate'
import { pullOnlineOrder } from '@/lib/pullOnlineOrder'

// Dipanggil OnlineOrderSync (browser kasir) saat ada pesanan website `paid`.
// Wajib login sebagai staf POS (atau rahasia internal) — lihat lib/posApiGate.ts.
export async function POST(request: Request) {
  const caller = await requirePosCaller(request)
  if (caller instanceof NextResponse) return caller

  let body: { external_order_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const result = await pullOnlineOrder(body.external_order_id)
  return NextResponse.json(result.body, { status: result.status })
}
