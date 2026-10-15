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
 * Bila baris `customers` masih dirujuk oleh riwayat transaksi yang sudah dibayar,
 * identitas pribadi (nama, email, nomor telepon) dianonimkan secara permanen
 * dan akun Supabase Auth dicabut.
 */
export async function DELETE(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const retail = createRetailClient()
  const customerId = sesi.customerId

  try {
    await Promise.all([
      retail.from('customer_push_tokens').delete().eq('customer_id', customerId),
      retail.from('customer_notifications').delete().eq('customer_id', customerId),
      retail
        .from('order_drafts')
        .update({ status: 'gagal' })
        .eq('customer_id', customerId)
        .eq('status', 'menunggu_bayar'),
    ])

    const { error: deleteError } = await retail
      .from('customers')
      .delete()
      .eq('id', customerId)

    if (deleteError) {
      // Baris dipertahankan untuk keutuhan pembukuan pesanan lama, namun seluruh PII dihapus.
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
    }

    try {
      await createServiceClient().auth.admin.deleteUser(customerId)
    } catch (authErr) {
      console.warn('Peringatan saat menghapus user Supabase Auth:', authErr)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Gagal menghapus akun pelanggan:', e)
    return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 })
  }
}

