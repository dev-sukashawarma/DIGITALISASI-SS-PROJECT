import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { tutupSementaraAktif, statusUntuk } from '@/lib/statusOutletDb'
import { pesanStatus } from '@/lib/jamBuka'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('outlets')
    .select('id, name, address, lat, lng, is_active, open_hour, close_hour')
    .eq('app_enabled', true)
    .neq('type', 'marketplace')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat outlet' }, { status: 502 })
  }

  const outlets = data ?? []
  let peta
  try {
    peta = await tutupSementaraAktif(outlets.map((o) => o.id))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat outlet' }, { status: 502 })
  }

  const hasil = await Promise.all(outlets.map(async (o) => {
    const s = await statusUntuk(o, peta)
    return {
      ...o,
      // `is_active` sengaja TIDAK diubah artinya: APK versionCode 1 membacanya.
      bisa_pesan: s.bisaPesan,
      alasan: s.alasan,
      buka_lagi: s.bukaLagi?.toISOString() ?? null,
      pesan_terakhir: s.pesanTerakhir?.toISOString() ?? null,
      alasan_tutup: s.alasanTutup,
      pesan_status: s.bisaPesan ? null : pesanStatus(s),
    }
  }))
  return NextResponse.json({ outlets: hasil })
}
