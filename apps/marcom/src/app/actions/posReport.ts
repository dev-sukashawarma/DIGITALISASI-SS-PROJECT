// @ts-nocheck
'use server'

/* ── Rangkuman Penjualan (/dashboard/penjualan) — Khusus Akun Melani & Admin ──
 *
 * Seluruh perhitungan berjalan di server dengan mesin identik admin-dashboard
 * (lib/penjualan/posReport/laporan.ts). Setiap action memverifikasi sesi
 * getCurrentUser() + isMelani / isAdminLike sebelum mengakses service client.
 */

import { updateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { isAdminLike, isMelani } from '@/lib/access-control'
import { getPosSupabase } from '@/lib/supabase-pos'
import { bumpDayGenerations } from '@/lib/penjualan/server/dayGenerations'
import { eachDateInclusive, isDateStr, jakartaDate } from '@/lib/penjualan/ownerDashboardCache'
import { posReportDayTag, clearPosReportTodayMemo } from '@/lib/penjualan/posReport/load'
import { clearPrepared } from '@/lib/penjualan/posReport/prepared'
import {
  laporanPosUntukScope,
  eksporLaporanPosUntukScope,
  eksporHistoriTransaksiUntukScope,
  clearMenuMemo,
  type PosReportRequest,
  type CakupanLaporan,
} from '@/lib/penjualan/posReport/laporan'

async function requireMarcomPenjualanScope(): Promise<CakupanLaporan> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }
  if (!isMelani(user.email) && !isAdminLike(user.role)) {
    throw new Error('Forbidden: akun Anda tidak memiliki akses ke Rangkuman Penjualan')
  }
  return {
    supabase: getPosSupabase(),
    scopeKey: 'all',
    allowedOutletIds: 'all',
  }
}

export async function getPosReport(rawReq: PosReportRequest) {
  return laporanPosUntukScope(rawReq, await requireMarcomPenjualanScope())
}

/** Data ekspor PDF & Excel (per outlet × channel × menu) — hanya dihitung saat tombol ditekan. */
export async function getPosReportExport(rawReq: PosReportRequest) {
  return eksporLaporanPosUntukScope(rawReq, await requireMarcomPenjualanScope())
}

/** Data ekspor PDF Histori Transaksi Detail (seluruh baris terfilter, tanpa paginasi). */
export async function getPosTransactionHistoryExport(rawReq: PosReportRequest) {
  return eksporHistoriTransaksiUntukScope(rawReq, await requireMarcomPenjualanScope())
}

/** Order hari lampau berubah (void/batal belakangan): buang cache tanggal itu saja. */
export async function invalidatePosReportDays(dates: string[]) {
  if (!Array.isArray(dates) || dates.length === 0) return
  await requireMarcomPenjualanScope()
  const today = jakartaDate(new Date())
  const valid = Array.from(new Set(dates.filter((d) => isDateStr(d) && d < today))).slice(0, 31)
  for (const d of valid) updateTag(posReportDayTag(d))
  bumpDayGenerations(valid)
  if (valid.length > 0) clearPrepared()
}

/** Tombol "Segarkan Data": buang cache tanggal yang sedang dilihat. */
export async function refreshPosReportRange(from: string, to: string) {
  await requireMarcomPenjualanScope()
  clearPosReportTodayMemo()
  clearPrepared()
  clearMenuMemo()
  if (!isDateStr(from) || !isDateStr(to) || from > to) return
  const today = jakartaDate(new Date())
  const dates = eachDateInclusive(from < '2026-01-01' ? '2026-01-01' : from, to < today ? to : today)
  if (dates.length > 400) {
    updateTag('pos-report')
    return
  }
  for (const d of dates) updateTag(posReportDayTag(d))
  bumpDayGenerations(dates)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Riwayat waktu cetak struk satu order — dipanggil saat label "dicetak Nx" diklik. */
export async function getReceiptPrintLog(orderId: string) {
  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) throw new Error('Order tidak valid')
  const { supabase } = await requireMarcomPenjualanScope()
  const { data, error } = await supabase
    .from('order_receipt_prints')
    .select('kind, printed_at, printed_by_name')
    .eq('order_id', orderId)
    .order('printed_at', { ascending: true })
    .limit(200)
  if (error) throw new Error(`getReceiptPrintLog: ${error.message}`)
  return data ?? []
}

/** Rincian pengeluaran & topup petty cash per shift (diambil di server agar aman terhadap RLS). */
export async function getShiftPettyCashDetails(params: {
  outletId: string
  startTime: string
  endTime: string
}) {
  const { supabase } = await requireMarcomPenjualanScope()
  if (!params?.outletId || !params?.startTime || !params?.endTime) {
    return { expenses: [], topups: [] }
  }

  const [expRes, topRes] = await Promise.all([
    supabase
      .from('petty_cash_expenses')
      .select('id, outlet_id, category, description, amount, receipt_url, created_at')
      .eq('outlet_id', params.outletId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .gte('created_at', params.startTime)
      .lte('created_at', params.endTime)
      .order('created_at', { ascending: true }),
    supabase
      .from('petty_cash_topups')
      .select('id, outlet_id, description, status, amount, created_at')
      .eq('outlet_id', params.outletId)
      .gte('created_at', params.startTime)
      .lte('created_at', params.endTime)
      .order('created_at', { ascending: true }),
  ])

  return {
    expenses: expRes.data || [],
    topups: topRes.data || [],
  }
}
