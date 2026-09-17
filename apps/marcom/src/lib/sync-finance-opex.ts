import { prisma } from '@/lib/prisma'
import { getPosSupabase } from '@/lib/supabase-pos'
import crypto from 'crypto'

function toDateString(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().split('T')[0]
  if (typeof d === 'string') return d.split('T')[0]
  return d.toISOString().split('T')[0]
}

function toPeriodMonth(dateStr: string): string {
  const parts = dateStr.split('-')
  const year = parts[0] || new Date().getFullYear().toString()
  const month = parts[1] || String(new Date().getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/**
 * Batas tanggal awal pencatatan OPEX ke Finance (Bulan Agustus 2026 dan sebelumnya sudah closing buku)
 */
export const OPEX_CUTOFF_DATE = '2026-09-01'

/**
 * Sinkronisasi pengeluaran Endorsement (Fee Rate Card & Ongkir Sample) ke OPEX Supabase
 */
export async function syncEndorsementOpex(endorsementId: bigint | number | string) {
  try {
    const id = BigInt(endorsementId)
    const endorsement = await prisma.endorsement.findUnique({
      where: { id },
      include: { kol: true, outlet: true },
    })

    if (!endorsement) return { success: false, error: 'Endorsement tidak ditemukan' }

    const supabase = getPosSupabase()
    const posOutletId = endorsement.outlet?.posOutletId || null
    const kolName = endorsement.kol?.name || 'KOL'
    const outletName = endorsement.outlet?.name || 'Kantor Pusat'

    // ==========================================
    // 1. Sinkronisasi Fee Rate Card
    // ==========================================
    const rateCard = Number(endorsement.rateCard) || 0
    const expenseDate = toDateString(endorsement.paymentDate || endorsement.scheduleDate)
    const isAfterCutoff = expenseDate >= OPEX_CUTOFF_DATE
    const isRateCardPaid = endorsement.paymentStatus === 'PAID' && rateCard > 0 && isAfterCutoff

    if (isRateCardPaid) {
      const expenseDate = toDateString(endorsement.paymentDate || endorsement.scheduleDate)
      const periodMonth = toPeriodMonth(expenseDate)
      const category = posOutletId ? 'endorsement' : 'pengeluaran_global'
      const description = `[MARCOM: Endorsement - ${kolName}] Fee Rate Card (Outlet: ${outletName})`

      const expenseId = endorsement.rateCardExpenseId || crypto.randomUUID()

      const { error: upsertErr } = await supabase.from('expenses').upsert(
        {
          id: expenseId,
          outlet_id: posOutletId,
          category,
          amount: rateCard,
          description,
          expense_date: expenseDate,
          period_month: periodMonth,
          payment_source: 'transfer_pusat',
          type: 'expense',
        },
        { onConflict: 'id' }
      )

      if (upsertErr) {
        console.error(`[syncEndorsementOpex] Error upserting rateCard expense for Endorsement #${id}:`, upsertErr)
      } else if (!endorsement.rateCardExpenseId) {
        await prisma.endorsement.update({
          where: { id },
          data: { rateCardExpenseId: expenseId },
        })
      }
    } else if (endorsement.rateCardExpenseId) {
      // Jika status berubah kembali ke UNPAID atau rateCard 0, hapus dari OPEX
      const { error: delErr } = await supabase.from('expenses').delete().eq('id', endorsement.rateCardExpenseId)
      if (delErr) {
        console.error(`[syncEndorsementOpex] Error deleting rateCard expense ${endorsement.rateCardExpenseId}:`, delErr)
      } else {
        await prisma.endorsement.update({
          where: { id },
          data: { rateCardExpenseId: null },
        })
      }
    }

    // ==========================================
    // 2. Sinkronisasi Biaya Ongkir Sample (Delivery)
    // ==========================================
    const shippingCost = Number(endorsement.shippingCost) || 0
    const shippingDate = toDateString(endorsement.shippingDate || endorsement.scheduleDate)
    const isShippingAfterCutoff = shippingDate >= OPEX_CUTOFF_DATE
    const isShippingValid = endorsement.type === 'DELIVERY' && endorsement.isShipped && shippingCost > 0 && isShippingAfterCutoff

    if (isShippingValid) {
      const periodMonth = toPeriodMonth(shippingDate)
      const category = posOutletId ? 'transport' : 'pengeluaran_global'
      const resiText = endorsement.courierResi ? ` Resi: ${endorsement.courierResi}` : ''
      const description = `[MARCOM: Ongkir Sample - ${kolName}]${resiText} (Outlet: ${outletName})`

      const expenseId = endorsement.shippingExpenseId || crypto.randomUUID()

      const { error: upsertErr } = await supabase.from('expenses').upsert(
        {
          id: expenseId,
          outlet_id: posOutletId,
          category,
          amount: shippingCost,
          description,
          expense_date: shippingDate,
          period_month: periodMonth,
          payment_source: 'transfer_pusat',
          type: 'expense',
        },
        { onConflict: 'id' }
      )

      if (upsertErr) {
        console.error(`[syncEndorsementOpex] Error upserting shipping expense for Endorsement #${id}:`, upsertErr)
      } else if (!endorsement.shippingExpenseId) {
        await prisma.endorsement.update({
          where: { id },
          data: { shippingExpenseId: expenseId },
        })
      }
    } else if (endorsement.shippingExpenseId) {
      // Jika dibatalkan, bukan delivery, atau tanggal sebelum September 2026, hapus dari OPEX
      const { error: delErr } = await supabase.from('expenses').delete().eq('id', endorsement.shippingExpenseId)
      if (delErr) {
        console.error(`[syncEndorsementOpex] Error deleting shipping expense ${endorsement.shippingExpenseId}:`, delErr)
      } else {
        await prisma.endorsement.update({
          where: { id },
          data: { shippingExpenseId: null },
        })
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error(`[syncEndorsementOpex] Exception:`, err)
    return { success: false, error: err?.message || 'Gagal sinkronisasi endorsement ke OPEX' }
  }
}

/**
 * Sinkronisasi pengeluaran Ads ke OPEX Supabase
 */
export async function syncAdOpex(adId: bigint | number | string) {
  try {
    const id = BigInt(adId)
    const ad = await prisma.ad.findUnique({
      where: { id },
      include: { outlet: true },
    })

    if (!ad) return { success: false, error: 'Data Ad tidak ditemukan' }

    const supabase = getPosSupabase()
    const posOutletId = ad.outlet?.posOutletId || null
    const outletName = ad.outlet?.name || 'Pusat/Nasional'
    const spent = Number(ad.spent) || 0
    const expenseDate = toDateString(ad.scheduleDate)
    const isAfterCutoff = expenseDate >= OPEX_CUTOFF_DATE

    if (spent > 0 && isAfterCutoff) {
      const periodMonth = toPeriodMonth(expenseDate)
      const category = posOutletId ? 'ads' : 'pengeluaran_global'
      const accountInfo = ad.accountName ? ` - Akun: ${ad.accountName}` : ''
      const description = `[MARCOM: Ads - ${ad.platform}]${accountInfo} (Outlet: ${outletName})`

      const expenseId = ad.expenseId || crypto.randomUUID()

      const { error: upsertErr } = await supabase.from('expenses').upsert(
        {
          id: expenseId,
          outlet_id: posOutletId,
          category,
          amount: spent,
          description,
          expense_date: expenseDate,
          period_month: periodMonth,
          payment_source: 'transfer_pusat',
          type: 'expense',
        },
        { onConflict: 'id' }
      )

      if (upsertErr) {
        console.error(`[syncAdOpex] Error upserting expense for Ad #${id}:`, upsertErr)
      } else if (!ad.expenseId) {
        await prisma.ad.update({
          where: { id },
          data: { expenseId },
        })
      }
    } else if (ad.expenseId) {
      // Jika nilai spent diubah ke 0, hapus dari OPEX
      const { error: delErr } = await supabase.from('expenses').delete().eq('id', ad.expenseId)
      if (delErr) {
        console.error(`[syncAdOpex] Error deleting expense ${ad.expenseId}:`, delErr)
      } else {
        await prisma.ad.update({
          where: { id },
          data: { expenseId: null },
        })
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error(`[syncAdOpex] Exception:`, err)
    return { success: false, error: err?.message || 'Gagal sinkronisasi Ads ke OPEX' }
  }
}

/**
 * Hapus catatan OPEX berdasarkan ID expense di Supabase
 */
export async function deleteOpexByExpenseId(expenseId: string | null | undefined) {
  if (!expenseId) return
  try {
    const supabase = getPosSupabase()
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (error) {
      console.error(`[deleteOpexByExpenseId] Error deleting expense ${expenseId}:`, error)
    }
  } catch (err) {
    console.error(`[deleteOpexByExpenseId] Exception:`, err)
  }
}

/**
 * Sinkronisasi massal seluruh data historis MARCOM ke OPEX Supabase
 */
export async function syncAllHistoricalMarcomToOpex() {
  try {
    const [endorsements, ads] = await Promise.all([
      prisma.endorsement.findMany({
        select: { id: true },
      }),
      prisma.ad.findMany({
        select: { id: true },
      }),
    ])

    let syncedEndorsements = 0
    let syncedAds = 0
    let errorsCount = 0

    for (const e of endorsements) {
      const res = await syncEndorsementOpex(e.id)
      if (res.success) {
        syncedEndorsements++
      } else {
        errorsCount++
      }
    }

    for (const a of ads) {
      const res = await syncAdOpex(a.id)
      if (res.success) {
        syncedAds++
      } else {
        errorsCount++
      }
    }

    return {
      success: true,
      totalProcessed: endorsements.length + ads.length,
      syncedEndorsements,
      syncedAds,
      errorsCount,
    }
  } catch (err: any) {
    console.error('[syncAllHistoricalMarcomToOpex] Error:', err)
    return {
      success: false,
      error: err?.message || 'Gagal melakukan sinkronisasi data historis ke OPEX',
    }
  }
}
