import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * Mengambil tap NFC kartu tak terdaftar terbaru (maksimal 5 menit terakhir)
 * agar modal "Daftarkan Kartu e-Toll Baru" di Web Finance bisa auto-fill
 * nomor kartu, bank, dan saldo secara real-time saat kartu ditempel di HP.
 */
export async function GET(req: NextRequest) {
  try {
    await requireEtollActor(req, { cardRegistrarOnly: true })
    const admin = getServiceSupabase()

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data, error } = await admin
      .from('etoll_pending_taps')
      .select(`
        id, card_number, issuer, balance, tapped_at,
        tapper:outlet_staff!etoll_pending_taps_tapped_by_fkey(id, name)
      `)
      .gte('tapped_at', fiveMinAgo)
      .order('tapped_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Pastikan belum terlanjur terdaftar
    if (data) {
      const { data: exists } = await admin
        .from('etoll_cards')
        .select('id')
        .eq('card_number', data.card_number)
        .maybeSingle()

      if (exists) {
        await admin.from('etoll_pending_taps').delete().eq('card_number', data.card_number)
        return NextResponse.json({ tap: null })
      }
    }

    return NextResponse.json({ tap: data ?? null })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal cek tap NFC terbaru' }, { status: 500 })
  }
}
