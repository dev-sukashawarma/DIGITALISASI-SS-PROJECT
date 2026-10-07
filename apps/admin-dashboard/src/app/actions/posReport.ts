// @ts-nocheck
'use server'

/* ── Rangkuman Penjualan (/dashboard/reports/pos & /dashboard/mitra/orderan) ──
 *
 * Seluruh perhitungan kini berjalan di server dengan rumus yang SAMA
 * (lib/posReport/compute). Browser hanya menerima hasil akhir + satu halaman
 * tabel (puluhan KB), bukan lagi seluruh order mentah (±24 MB untuk "Bulan
 * ini") yang dulu ditarik langsung dari Supabase setiap ada order baru.
 */

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { resolveCallerScope } from '@/lib/server/callerScope'
import { bumpDayGenerations } from '@/lib/server/dayGenerations'
import { eachDateInclusive, isDateStr, jakartaDate } from '@/lib/ownerDashboardCache'
import { posReportDayTag, clearPosReportTodayMemo } from '@/lib/posReport/load'
import { clearPrepared } from '@/lib/posReport/prepared'
import {
  laporanPosUntukScope,
  kategoriLaporanPosUntukScope,
  clearMenuMemo,
  type PosReportRequest,
} from '@/lib/posReport/laporan'

// JANGAN me-re-export tipe dari berkas 'use server': transform server action
// mengubahnya jadi nilai runtime (ReferenceError). Ambil tipe dari lib/posReport/laporan.

// Inti perhitungan ada di lib/posReport/laporan.ts. Berkas ini hanya pintu sesi-cookie:
// setiap ekspor di sini adalah endpoint publik, jadi cakupan SELALU dari resolveCallerScope().
export async function getPosReport(rawReq: PosReportRequest) {
  return laporanPosUntukScope(rawReq, await resolveCallerScope())
}

/** Data untuk ekspor "PDF/CSV Semua Channel" — hanya dihitung saat tombol ditekan. */
export async function getPosReportCategories(rawReq: PosReportRequest) {
  return kategoriLaporanPosUntukScope(rawReq, await resolveCallerScope())
}

async function requireUser() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  return !!userId
}

/** Order hari lampau berubah (void/batal belakangan): buang cache tanggal itu saja. */
export async function invalidatePosReportDays(dates: string[]) {
  if (!Array.isArray(dates) || dates.length === 0) return
  if (!(await requireUser())) return
  const today = jakartaDate(new Date())
  const valid = Array.from(new Set(dates.filter((d) => isDateStr(d) && d < today))).slice(0, 31)
  for (const d of valid) updateTag(posReportDayTag(d))
  bumpDayGenerations(valid)
  if (valid.length > 0) clearPrepared()
}

/** Tombol "Segarkan Data": buang cache tanggal yang sedang dilihat. */
export async function refreshPosReportRange(from: string, to: string) {
  if (!(await requireUser())) return
  clearPosReportTodayMemo()
  clearPrepared()
  clearMenuMemo()
  if (!isDateStr(from) || !isDateStr(to) || from > to) return
  const today = jakartaDate(new Date())
  // Batas bawah 2026-01-01: "Semua Waktu" dikirim sebagai 2000-01-01 dan tak ada
  // penjualan sebelum 2026 — tanpa batas ini ±9.000 tag ikut dibuang.
  const dates = eachDateInclusive(from < '2026-01-01' ? '2026-01-01' : from, to < today ? to : today)
  if (dates.length > 400) {
    updateTag('pos-report')
    return
  }
  for (const d of dates) updateTag(posReportDayTag(d))
  bumpDayGenerations(dates)
}
