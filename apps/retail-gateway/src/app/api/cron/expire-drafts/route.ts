import { NextResponse } from 'next/server'
import { createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const rahasia = process.env.CRON_SECRET
  if (!rahasia || request.headers.get('authorization') !== `Bearer ${rahasia}`) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  const retail = createRetailClient()

  // Hanya draft yang belum dibayar. Draft yang sudah dibayar tapi belum
  // terdorong ke kasir TIDAK boleh dihanguskan -- itu uang pelanggan yang
  // butuh penanganan manusia, bukan penghapusan otomatis.
  const { data, error } = await retail
    .from('order_drafts')
    .update({ status: 'kadaluarsa' })
    .eq('status', 'menunggu_bayar')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('Gagal menghanguskan draft:', error)
    return NextResponse.json({ error: 'Gagal memproses' }, { status: 500 })
  }

  return NextResponse.json({ dihanguskan: data?.length ?? 0 })
}
