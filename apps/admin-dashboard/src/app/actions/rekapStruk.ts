// @ts-nocheck
'use server'

/* ── Pintu Server Action untuk Audit Cetak Struk (/dashboard/reports/rekap-struk) ── */

import { resolveCallerScope } from '@/lib/server/callerScope'
import {
  laporanRekapStrukUntukScope,
  eksporRekapStrukUntukScope,
  laporanDetailKasirStrukUntukScope,
  eksporDetailKasirStrukUntukScope,
  type RekapStrukRequest,
  type DetailKasirStrukRequest,
} from '@/lib/posReport/laporanStruk'

export async function getRekapStrukReport(rawReq: RekapStrukRequest) {
  return laporanRekapStrukUntukScope(rawReq, await resolveCallerScope())
}

export async function getRekapStrukExport(rawReq: RekapStrukRequest) {
  return eksporRekapStrukUntukScope(rawReq, await resolveCallerScope())
}

export async function getDetailKasirStrukReport(rawReq: DetailKasirStrukRequest) {
  return laporanDetailKasirStrukUntukScope(rawReq, await resolveCallerScope())
}

export async function getDetailKasirStrukExport(rawReq: DetailKasirStrukRequest) {
  return eksporDetailKasirStrukUntukScope(rawReq, await resolveCallerScope())
}
