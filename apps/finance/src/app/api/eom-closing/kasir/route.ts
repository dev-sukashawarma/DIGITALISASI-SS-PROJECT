import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { createServerComponentClient } from '@/lib/supabase-server'
import { buildKasirReport } from '@/lib/eom/kasirReport'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  try {
    await requireRole(['admin_finance', 'owner', 'admin'])

    const { searchParams } = new URL(req.url)
    const month = Number(searchParams.get('month'))
    const year = Number(searchParams.get('year'))
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2025 || year > 2100) {
      return NextResponse.json({ error: 'Parameter bulan/tahun tidak valid' }, { status: 400 })
    }

    // Sesi user (RLS berlaku) — sama dengan Rangkuman Penjualan yang membaca lewat sesi user.
    const supabase = await createServerComponentClient()
    return NextResponse.json(await buildKasirReport(supabase, month, year))
  } catch (err: any) {
    const msg = err?.message || 'Gagal memuat data EOM kasir'
    const status = msg.startsWith('Unauthorized') ? 401 : msg.startsWith('Forbidden') ? 403 : 500
    console.error('API /api/eom-closing/kasir error:', err)
    return NextResponse.json({ error: msg }, { status })
  }
}
