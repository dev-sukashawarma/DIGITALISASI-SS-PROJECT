// @ts-nocheck
'use server'

/* ── Pintu Server Action untuk Audit Cetak Struk (/dashboard/reports/rekap-struk) ── */

import { resolveCallerScope } from '@/lib/server/callerScope'
import {
  laporanRekapStrukUntukScope,
  eksporRekapStrukUntukScope,
  type RekapStrukRequest,
} from '@/lib/posReport/laporanStruk'

export async function getRekapStrukReport(rawReq: RekapStrukRequest) {
  return laporanRekapStrukUntukScope(rawReq, await resolveCallerScope())
}

export async function getRekapStrukExport(rawReq: RekapStrukRequest) {
  return eksporRekapStrukUntukScope(rawReq, await resolveCallerScope())
}
