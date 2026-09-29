import { NextResponse } from 'next/server'
import { createRetailClient, createServiceClient } from '@/lib/supabase'
import { insertCustomerNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Cron authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  const retail = createRetailClient()
  const db = createServiceClient()

  // Ambil draft yang sudah dibayar dalam 6 jam terakhir
  const enamJamLalu = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const tigaPuluhMenitLalu = new Date(Date.now() - 30 * 60 * 1000).getTime()

  const { data: drafts } = await retail
    .from('order_drafts')
    .select('id, customer_id, outlet_id, pos_order_id, pos_order_number, paid_at')
    .eq('status', 'dibayar')
    .not('pos_order_id', 'is', null)
    .gte('paid_at', enamJamLalu)

  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ checked: 0, reminders_sent: 0 })
  }

  let sentCount = 0

  // Status POS dibaca sekaligus (dulu satu kueri per draft). Dipecah per 100
  // id supaya URL filter `.in(...)` tidak kepanjangan. Galat = status tak
  // diketahui untuk potongan itu, sama seperti dulu (`pos` null -> dilewati).
  const statusPos = new Map<string, string>()
  const posIds = Array.from(new Set(drafts.map((d) => d.pos_order_id as string)))
  for (let i = 0; i < posIds.length; i += 100) {
    const { data: pos } = await db
      .from('orders')
      .select('id, status')
      .in('id', posIds.slice(i, i + 100))
    for (const p of pos ?? []) statusPos.set(p.id as string, p.status as string)
  }

  // Jika pesanan siap diambil tapi lewat dari 30 menit sejak dibayar
  const kandidat = drafts.filter((draft) =>
    statusPos.get(draft.pos_order_id as string) === 'ready' &&
    draft.paid_at && new Date(draft.paid_at).getTime() < tigaPuluhMenitLalu,
  )

  // Periksa sekaligus pengingat mana yang sudah pernah dikirim (dulu satu
  // kueri per kandidat). Kalau pemeriksaan ini GAGAL, run ini tidak mengirim
  // apa pun untuk potongan tsb -- lebih aman menunda pengingat ke run
  // berikutnya daripada mengirim ganda ke semua pelanggan.
  const sudahDiingatkan = new Set<string>()
  const gagalCek = new Set<string>()
  const kandidatIds = kandidat.map((d) => d.id as string)
  for (let i = 0; i < kandidatIds.length; i += 100) {
    const potongan = kandidatIds.slice(i, i + 100)
    const { data: existing, error: eExisting } = await retail
      .from('customer_notifications')
      .select('order_id')
      .in('order_id', potongan)
      .eq('type', 'reminder')
    if (eExisting) {
      console.error('gagal memeriksa pengingat terkirim', eExisting)
      for (const id of potongan) gagalCek.add(id)
      continue
    }
    for (const r of existing ?? []) sudahDiingatkan.add(r.order_id as string)
  }

  for (const draft of kandidat) {
    if (sudahDiingatkan.has(draft.id) || gagalCek.has(draft.id)) continue
    const orderNum = draft.pos_order_number ? `#${draft.pos_order_number}` : ''
    await insertCustomerNotification(retail, {
      customerId: draft.customer_id,
      orderId: draft.id,
      type: 'reminder',
      title: 'Pengingat Pengambilan ⏰',
      body: `Pesanan ${orderNum} sudah siap diambil lebih dari 30 menit. Silakan ambil di kasir agar tetap nikmat!`,
      data: {
        order_id: draft.id,
        status: 'ready',
        reminder_type: '30_min',
      },
    })
    sentCount++
  }

  return NextResponse.json({ checked: drafts.length, reminders_sent: sentCount })
}
