import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient } from '@/lib/supabase'
import { filterNotificationsByCategory, type CustomerNotificationItem } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = (searchParams.get('category') || 'all') as 'all' | 'orders' | 'promos'
  const limit = Math.min(Number(searchParams.get('limit')) || 30, 50)

  const retail = createRetailClient()

  // Ambil total notifikasi belum dibaca (unread count)
  const { count: unreadCount, error: countErr } = await retail
    .from('customer_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', sesi.customerId)
    .eq('is_read', false)

  if (countErr) {
    console.warn('Gagal menghitung unread notifications:', countErr)
  }

  // Ambil daftar notifikasi terbaru
  const { data: rows, error } = await retail
    .from('customer_notifications')
    .select('id, customer_id, order_id, type, title, body, data, is_read, created_at')
    .eq('customer_id', sesi.customerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Gagal mengambil daftar notifikasi:', error)
    return NextResponse.json({ error: 'Gagal memuat notifikasi' }, { status: 500 })
  }

  const items = (rows || []) as CustomerNotificationItem[]
  const filtered = filterNotificationsByCategory(items, category)

  return NextResponse.json({
    notifications: filtered,
    unread_count: unreadCount ?? 0,
  })
}

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: { notification_id?: string; mark_all?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  const retail = createRetailClient()

  if (body.mark_all) {
    const { error } = await retail
      .from('customer_notifications')
      .update({ is_read: true })
      .eq('customer_id', sesi.customerId)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: 'Gagal memperbarui status notifikasi' }, { status: 500 })
    }
    return NextResponse.json({ success: true, marked_all: true })
  }

  if (body.notification_id) {
    const { error } = await retail
      .from('customer_notifications')
      .update({ is_read: true })
      .eq('id', body.notification_id)
      .eq('customer_id', sesi.customerId)

    if (error) {
      return NextResponse.json({ error: 'Gagal memperbarui status notifikasi' }, { status: 500 })
    }
    return NextResponse.json({ success: true, marked_id: body.notification_id })
  }

  return NextResponse.json({ error: 'notification_id atau mark_all wajib diisi' }, { status: 400 })
}
