import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { alasanTanpaChat } from '@/lib/server/izinChat'
import { profilUntukKunci } from '@/lib/peran'
import { keMeja, type BarisStatus, type MejaKantor } from '@/kantor/keadaan'

export const dynamic = 'force-dynamic'

const TANPA_CACHE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status, headers: TANPA_CACHE })
  const { data, error } = await g.sesi.supabase.rpc('status_kantor_bot')
  if (error) {
    const status = error.code === '42501' ? 403 : 502
    const galat = status === 403 ? 'Tidak punya akses.' : 'Gagal memuat status bot.'
    return NextResponse.json({ galat }, { status, headers: TANPA_CACHE })
  }
  const sekarang = new Date()
  const meja: MejaKantor[] = ((data ?? []) as BarisStatus[]).map((b) => {
    const profil = profilUntukKunci(b.scope)
    const alasan = alasanTanpaChat(g.sesi.role, profil)
    return { ...keMeja(b, sekarang), profil, bolehChat: alasan === null, alasanTanpaChat: alasan }
  })
  return NextResponse.json({ diambilAt: sekarang.toISOString(), meja }, { headers: TANPA_CACHE })
}
