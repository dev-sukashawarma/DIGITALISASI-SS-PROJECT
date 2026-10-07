import { NextResponse } from 'next/server'
import { ambilSesiKantor } from '@/lib/server/sesi'
import { keMeja, type BarisStatus } from '@/kantor/keadaan'

export const dynamic = 'force-dynamic'

const TANPA_CACHE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const g = await ambilSesiKantor()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status, headers: TANPA_CACHE })
  const { data, error } = await g.sesi.supabase.rpc('status_kantor_bot')
  if (error) {
    const status = error.code === '42501' ? 403 : 502
    const galat = status === 403 ? 'Tidak punya akses.' : 'Gagal memuat status bot.'
    return NextResponse.json({ galat }, { status, headers: TANPA_CACHE })
  }
  const sekarang = new Date()
  const meja = ((data ?? []) as BarisStatus[]).map((b) => keMeja(b, sekarang))
  return NextResponse.json({ diambilAt: sekarang.toISOString(), meja }, { headers: TANPA_CACHE })
}
