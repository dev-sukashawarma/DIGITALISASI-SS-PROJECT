import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient, createServiceClient } from '@/lib/supabase'
import { periksaNama, periksaWhatsApp } from '@/lib/profil'

export const dynamic = 'force-dynamic'

const KOLOM = 'id, name, email, phone'

/** Profil pelanggan yang sedang masuk. */
export async function GET(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const { data, error } = await createRetailClient()
    .from('customers')
    .select(KOLOM)
    .eq('id', sesi.customerId)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Gagal memuat profil' }, { status: 502 })
  }
  if (data.email === null && data.name === null && data.phone === null) {
    return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })
  }
  return NextResponse.json({ customer: data })
}

/**
 * Ubah nama dan/atau nomor WhatsApp. Email tidak bisa diubah (identitas
 * akun Google). Field yang tidak dikirim tidak disentuh.
 */
export async function PATCH(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('name' in body) {
    const h = periksaNama(body.name)
    if (!h.ok) return NextResponse.json({ error: h.pesan }, { status: 400 })
    patch.name = h.nilai
  }

  if ('phone' in body) {
    const h = periksaWhatsApp(body.phone)
    if (!h.ok) return NextResponse.json({ error: h.pesan }, { status: 400 })
    patch.phone = h.nilai
    // Nomor yang diketik sendiri belum terverifikasi.
    patch.phone_verified = false
  }

  if (!('name' in patch) && !('phone' in patch)) {
    return NextResponse.json({ error: 'Tidak ada yang diubah' }, { status: 400 })
  }

  const { data, error } = await createRetailClient()
    .from('customers')
    .update(patch)
    .eq('id', sesi.customerId)
    .select(KOLOM)
    .maybeSingle()

  if (error || !data) {
    console.error('Gagal menyimpan profil:', error)
    return NextResponse.json({ error: 'Gagal menyimpan profil' }, { status: 500 })
  }
  return NextResponse.json({ customer: data })
}

/**
 * Hapus akun pelanggan beserta seluruh data pribadi (Google Play Account Deletion Policy).
 *
 * PENTING: `retail.order_drafts` dan `retail.voucher_pemakaian` memiliki constraint
 * `ON DELETE CASCADE` ke `retail.customers(id)` (dan `retail.customers` ke `auth.users(id)`).
 * Bila pelanggan sudah pernah memiliki pesanan berstatus `dibayar` atau pemakaian voucher
 * lunas, kita TIDAK memanggil `.delete()` pada `customers` maupun `auth.users` agar riwayat
 * akuntansi kasir, trigger refund POS (`retail.catat_refund_pesanan`), dan kuota voucher
 * tidak ikut terhapus oleh cascade. Sebagai gantinya, seluruh PII pelanggan dianonimkan
 * secara permanen di `retail.customers`, `public.orders`, dan `auth.users`.
 */
export async function DELETE(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const retail = createRetailClient()
  const db = createServiceClient()
  const customerId = sesi.customerId

  try {
    // 1. Bersihkan push token, notifikasi, dan batalkan draft yang belum dibayar
    const [, , , { data: draftsLunas }] = await Promise.all([
      retail.from('customer_push_tokens').delete().eq('customer_id', customerId),
      retail.from('customer_notifications').delete().eq('customer_id', customerId),
      retail
        .from('order_drafts')
        .update({ status: 'gagal' })
        .eq('customer_id', customerId)
        .eq('status', 'menunggu_bayar'),
      retail
        .from('order_drafts')
        .select('id, pos_order_id')
        .eq('customer_id', customerId)
        .eq('status', 'dibayar'),
    ])

    const daftarPosOrderIds = (draftsLunas ?? [])
      .map((d: { pos_order_id?: string | null }) => d.pos_order_id)
      .filter((id): id is string => Boolean(id))

    // 2. Anonimkan nama & nomor telepon pelanggan pada tabel kasir `public.orders`
    if (daftarPosOrderIds.length > 0) {
      await db
        .from('orders')
        .update({ customer_name: 'Pelanggan Terhapus', customer_phone: null })
        .in('id', daftarPosOrderIds)
    }

    const punyaRiwayatLunas = (draftsLunas?.length ?? 0) > 0

    if (punyaRiwayatLunas) {
      // Pertahankan baris `customers` & `order_drafts` lunas untuk pembukuan/refund POS,
      // tetapi hapus seluruh identitas pribadi (PII).
      const { error: anonError } = await retail
        .from('customers')
        .update({
          name: null,
          email: null,
          phone: null,
          phone_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)

      if (anonError) {
        console.error('Gagal menganonimkan profil pelanggan:', anonError)
        return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 })
      }

      try {
        await db.auth.admin.updateUserById(customerId, {
          user_metadata: { full_name: null, name: null, avatar_url: null, picture: null },
        })
      } catch (authErr) {
        console.warn('Peringatan saat membersihkan metadata Supabase Auth:', authErr)
      }
    } else {
      // Tidak ada transaksi lunas: hapus bersih baris `customers` dan akun `auth.users`
      const { error: deleteError } = await retail
        .from('customers')
        .delete()
        .eq('id', customerId)

      if (deleteError) {
        console.error('Gagal menghapus baris pelanggan:', deleteError)
        return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 })
      }

      try {
        await db.auth.admin.deleteUser(customerId)
      } catch (authErr) {
        console.warn('Peringatan saat menghapus user Supabase Auth:', authErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Gagal menghapus akun pelanggan:', e)
    return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 })
  }
}

