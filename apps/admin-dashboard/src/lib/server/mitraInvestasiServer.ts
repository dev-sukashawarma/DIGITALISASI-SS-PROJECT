/* ── Profil investasi & transfer mitra (khusus kode server, BUKAN 'use server') ──
 *
 * Dipakai halaman Server Component (mis. Ringkasan Bisnis `/dashboard/owner`)
 * untuk menghitung status BEP dan beban Management Fee 3% per outlet mitra
 * agar selaras 1:1 dengan halaman Laba Rugi (`ProfitView.tsx`), tanpa terekspos
 * sebagai endpoint Server Action publik.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { getMitraAugustClosing } from '@/app/actions/mitraPnlClosingData'
import type { MitraInvestmentExtended, MitraTransferRecord } from '@/app/actions/mitraInvestments'

const MITRA_INV_MEMO_TTL_MS = 60_000

let mitraInvMemo: {
  expiresAt: number
  promise: Promise<Record<string, MitraInvestmentExtended>>
} | null = null

export function clearMitraInvestasiServerMemo() {
  mitraInvMemo = null
}

export async function ambilInvestasiMitraServer(): Promise<Record<string, MitraInvestmentExtended>> {
  const now = Date.now()
  if (mitraInvMemo && mitraInvMemo.expiresAt > now) {
    return mitraInvMemo.promise
  }

  const promise = (async () => {
    const supabase = createServiceClient()
    const [invRes, transfers] = await Promise.all([
      supabase.from('mitra_investments').select('*'),
      fetchAllPages<MitraTransferRecord>(() =>
        supabase.from('mitra_transfers').select('id, outlet_id, bulan, nominal').order('id', { ascending: true }),
      ),
    ])

    if (invRes.error) {
      throw new Error(invRes.error.message)
    }

    const transfersByOutlet = new Map<string, MitraTransferRecord[]>()
    for (const t of transfers ?? []) {
      if (!t.outlet_id) continue
      const list = transfersByOutlet.get(t.outlet_id) || []
      list.push(t)
      transfersByOutlet.set(t.outlet_id, list)
    }

    const map: Record<string, MitraInvestmentExtended> = {}
    for (const inv of invRes.data ?? []) {
      const outletTransfersList = transfersByOutlet.get(inv.outlet_id) ?? []
      let outletTransfers = outletTransfersList.reduce((sum, t) => sum + (Number(t.nominal) || 0), 0)

      const hasAugTransfer = outletTransfersList.some((t: any) => (t.bulan || '').slice(0, 7) === '2026-08')
      if (!hasAugTransfer) {
        const augClosing = getMitraAugustClosing(inv.outlet_id)
        if (augClosing && augClosing.totals.mitraShare > 0) {
          outletTransfers += Math.round(augClosing.totals.mitraShare)
        }
      }

      const totalDanaKembali =
        Number(inv.omzet_historis || 0) + Number(inv.transfer_historis || 0) + outletTransfers
      const modalInvestasi = Number(inv.nilai_investasi) || 0
      const isBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi

      map[inv.outlet_id] = {
        ...inv,
        totalTransfers: outletTransfers,
        totalDanaKembali,
        isBep,
        transfers: outletTransfersList,
      }
    }

    return map
  })()

  mitraInvMemo = { expiresAt: now + MITRA_INV_MEMO_TTL_MS, promise }
  promise.catch(() => {
    if (mitraInvMemo?.promise === promise) mitraInvMemo = null
  })
  return promise
}
