'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { createSupabaseServerClient } from '@suka/auth'
import { clearLaporanTodayMemo, eachDate, jakartaDate, laporanDayTag } from '@/lib/laporanPenjualan/load'

const ALLOWED_ROLES = ['kitchen', 'purchasing', 'admin', 'owner'] // sama dengan guard page.tsx
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Tombol "Refresh" Laporan Penjualan: buang cache ringkasan tanggal yang
 * sedang dilihat supaya dihitung ulang dari database. Server Action adalah
 * endpoint publik — role dicek di sini, bukan hanya di halaman.
 */
export async function refreshLaporanPenjualan(from: string, to: string) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: staff } = await supabase.from('outlet_staff').select('role, status').eq('id', user.id).maybeSingle()
  if (!staff || !ALLOWED_ROLES.includes(staff.role) || staff.status !== 'active') return

  clearLaporanTodayMemo()
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) return
  const today = jakartaDate()
  // Batas bawah 2026-01-01: "Semua waktu" tidak punya penjualan sebelum 2026.
  const dates = eachDate(from < '2026-01-01' ? '2026-01-01' : from, to < today ? to : today)
  if (dates.length > 400) {
    updateTag('laporan-penjualan')
    return
  }
  for (const d of dates) updateTag(laporanDayTag(d))
}
