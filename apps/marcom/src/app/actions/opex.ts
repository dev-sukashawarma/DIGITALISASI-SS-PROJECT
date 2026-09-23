'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { syncManualExpenseOpex, deleteOpexByExpenseId } from '@/lib/sync-finance-opex'

import {
  type OpexItemSource,
  type OpexItem,
  type OpexSummary,
  type ActionState,
  MARCOM_EXPENSE_CATEGORIES,
} from '@/lib/opex-constants'

export type { OpexItemSource, OpexItem, OpexSummary, ActionState }

/**
 * Mengambil ringkasan dan daftar seluruh realisasi OPEX Marcom pada bulan dan tahun tertentu
 */
export async function getOpexData(
  month: number,
  year: number,
  outletFilter?: string
): Promise<OpexSummary> {
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const startDate = new Date(`${startDateStr}T00:00:00.000Z`)
  const endDate = new Date(`${endDateStr}T23:59:59.999Z`)

  const outletIdBigInt = outletFilter && outletFilter !== 'ALL' && outletFilter !== 'GLOBAL'
    ? BigInt(outletFilter)
    : undefined

  const isGlobalOnly = outletFilter === 'GLOBAL'

  const [budgets, endorsements, ads, manualExpenses] = await Promise.all([
    // 1. Target Budgets
    prisma.outletBudget.findMany({
      where: {
        periodMonth: month,
        periodYear: year,
        ...(outletIdBigInt ? { outletId: outletIdBigInt } : {}),
      },
    }),

    // 2. Endorsements (Rate Card & Ongkir Sample)
    isGlobalOnly
      ? Promise.resolve([])
      : prisma.endorsement.findMany({
          where: {
            scheduleDate: { gte: startDate, lte: endDate },
            ...(outletIdBigInt ? { outletId: outletIdBigInt } : {}),
          },
          include: {
            kol: { select: { id: true, name: true } },
            outlet: { select: { id: true, name: true } },
          },
          orderBy: { scheduleDate: 'desc' },
        }),

    // 3. Ads & Paid Traffic
    prisma.ad.findMany({
      where: {
        scheduleDate: { gte: startDate, lte: endDate },
        ...(isGlobalOnly
          ? { outletId: null }
          : outletIdBigInt
          ? { outletId: outletIdBigInt }
          : {}),
      },
      include: {
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { scheduleDate: 'desc' },
    }),

    // 4. Manual Expenses
    prisma.marcomExpense.findMany({
      where: {
        expenseDate: { gte: startDate, lte: endDate },
        ...(isGlobalOnly
          ? { outletId: null }
          : outletIdBigInt
          ? { outletId: outletIdBigInt }
          : {}),
      },
      include: {
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: 'desc' },
    }),
  ])

  const items: OpexItem[] = []

  let totalEndorsement = 0
  let totalAds = 0
  let totalManual = 0

  // Proses Endorsement
  for (const e of endorsements) {
    const rateCard = Number(e.rateCard) || 0
    const shippingCost = Number(e.shippingCost) || 0
    const dateStr = e.scheduleDate.toISOString().split('T')[0]
    const outletName = e.outlet?.name || 'Kantor Pusat'
    const kolName = e.kol?.name || 'KOL'

    // Fee Rate Card jika PAID
    if (e.paymentStatus === 'PAID' && rateCard > 0) {
      totalEndorsement += rateCard
      items.push({
        id: `endorsement-rate-${e.id}`,
        source: 'ENDORSEMENT',
        sourceId: e.id.toString(),
        date: e.paymentDate ? e.paymentDate.toISOString().split('T')[0] : dateStr,
        category: 'endorsement',
        categoryLabel: 'Endorsement (Rate Card)',
        description: `Fee Rate Card: ${kolName}${e.paymentNotes ? ` - ${e.paymentNotes}` : ''}`,
        outletId: e.outletId.toString(),
        outletName,
        amount: rateCard,
        paymentSource: 'transfer_pusat',
        paymentStatus: 'PAID',
        receiptUrl: null,
        isEditable: false,
      })
    }

    // Ongkir Sample jika Delivery & Shipped
    if (e.type === 'DELIVERY' && e.isShipped && shippingCost > 0) {
      totalEndorsement += shippingCost
      const shipDateStr = e.shippingDate ? e.shippingDate.toISOString().split('T')[0] : dateStr
      items.push({
        id: `endorsement-ship-${e.id}`,
        source: 'ENDORSEMENT',
        sourceId: e.id.toString(),
        date: shipDateStr,
        category: 'transport',
        categoryLabel: 'Ongkir Sample Delivery',
        description: `Ongkir Sample untuk ${kolName}${e.courierResi ? ` (Resi: ${e.courierResi})` : ''}`,
        outletId: e.outletId.toString(),
        outletName,
        amount: shippingCost,
        paymentSource: 'transfer_pusat',
        paymentStatus: 'PAID',
        receiptUrl: null,
        isEditable: false,
      })
    }
  }

  // Proses Ads
  for (const a of ads) {
    const spent = Number(a.spent) || 0
    if (spent > 0) {
      totalAds += spent
      const dateStr = a.scheduleDate.toISOString().split('T')[0]
      const outletName = a.outlet?.name || 'Kantor Pusat / Global'
      const accountInfo = a.accountName ? ` - ${a.accountName}` : ''
      items.push({
        id: `ad-${a.id}`,
        source: 'ADS',
        sourceId: a.id.toString(),
        date: dateStr,
        category: 'ads',
        categoryLabel: `Ads (${a.platform})`,
        description: `Iklan Berbayar ${a.platform}${accountInfo}`,
        outletId: a.outletId ? a.outletId.toString() : null,
        outletName,
        amount: spent,
        paymentSource: 'transfer_pusat',
        paymentStatus: 'PAID',
        receiptUrl: a.adUrl || null,
        isEditable: false,
      })
    }
  }

  // Proses Manual Marcom Expenses
  for (const m of manualExpenses) {
    const amount = Number(m.amount) || 0
    totalManual += amount
    const dateStr = m.expenseDate.toISOString().split('T')[0]
    const outletName = m.outlet?.name || 'Kantor Pusat / Global'
    const categoryLabel = MARCOM_EXPENSE_CATEGORIES[m.category] || m.category

    items.push({
      id: `manual-${m.id}`,
      source: 'MANUAL',
      sourceId: m.id.toString(),
      date: dateStr,
      category: m.category,
      categoryLabel,
      description: m.description,
      outletId: m.outletId ? m.outletId.toString() : null,
      outletName,
      amount,
      paymentSource: m.paymentSource || 'transfer_pusat',
      paymentStatus: 'PAID',
      receiptUrl: m.receiptUrl || null,
      isEditable: true,
    })
  }

  // Urutkan item berdasarkan tanggal descending
  items.sort((a, b) => b.date.localeCompare(a.date))

  const totalOpex = totalEndorsement + totalAds + totalManual
  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.targetBudget || 0), 0)
  const remainingBudget = totalBudget - totalOpex

  return {
    periodMonth: month,
    periodYear: year,
    totalOpex,
    totalEndorsement,
    totalAds,
    totalManual,
    totalBudget,
    remainingBudget,
    items,
  }
}

/**
 * Menambahkan pengeluaran manual baru
 */
export async function createMarcomExpense(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const expenseDateStr = formData.get('expenseDate') as string
  const outletIdStr = formData.get('outletId') as string
  const category = (formData.get('category') as string)?.trim() || 'LAINNYA'
  const amountStr = formData.get('amount') as string
  const description = (formData.get('description') as string)?.trim()
  const paymentSource = (formData.get('paymentSource') as string)?.trim() || 'transfer_pusat'
  const receiptUrl = (formData.get('receiptUrl') as string)?.trim() || null

  if (!expenseDateStr || !description) {
    return { error: 'Tanggal pengeluaran dan deskripsi wajib diisi' }
  }

  const rawAmount = parseFloat(amountStr.replace(/[^0-9.]/g, ''))
  if (isNaN(rawAmount) || rawAmount <= 0) {
    return { error: 'Nominal pengeluaran harus lebih besar dari 0' }
  }

  try {
    const expenseDate = new Date(expenseDateStr)
    const outletId = outletIdStr && outletIdStr !== 'GLOBAL' && outletIdStr !== ''
      ? BigInt(outletIdStr)
      : null

    const created = await prisma.marcomExpense.create({
      data: {
        expenseDate,
        outletId,
        category,
        amount: rawAmount,
        description,
        paymentSource,
        receiptUrl,
      },
    })

    // Sinkronisasi otomatis ke Supabase Finance OPEX
    await syncManualExpenseOpex(created.id)

    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Error in createMarcomExpense:', err)
    return { error: err?.message || 'Gagal menyimpan pengeluaran' }
  }
}

/**
 * Memperbarui pengeluaran manual yang ada
 */
export async function updateMarcomExpense(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const idStr = formData.get('id') as string
  if (!idStr) return { error: 'ID pengeluaran tidak valid' }

  const expenseDateStr = formData.get('expenseDate') as string
  const outletIdStr = formData.get('outletId') as string
  const category = (formData.get('category') as string)?.trim() || 'LAINNYA'
  const amountStr = formData.get('amount') as string
  const description = (formData.get('description') as string)?.trim()
  const paymentSource = (formData.get('paymentSource') as string)?.trim() || 'transfer_pusat'
  const receiptUrl = (formData.get('receiptUrl') as string)?.trim() || null

  if (!expenseDateStr || !description) {
    return { error: 'Tanggal pengeluaran dan deskripsi wajib diisi' }
  }

  const rawAmount = parseFloat(amountStr.replace(/[^0-9.]/g, ''))
  if (isNaN(rawAmount) || rawAmount <= 0) {
    return { error: 'Nominal pengeluaran harus lebih besar dari 0' }
  }

  try {
    const id = BigInt(idStr)
    const expenseDate = new Date(expenseDateStr)
    const outletId = outletIdStr && outletIdStr !== 'GLOBAL' && outletIdStr !== ''
      ? BigInt(outletIdStr)
      : null

    await prisma.marcomExpense.update({
      where: { id },
      data: {
        expenseDate,
        outletId,
        category,
        amount: rawAmount,
        description,
        paymentSource,
        receiptUrl,
      },
    })

    // Sinkronisasi ulang ke Supabase Finance OPEX
    await syncManualExpenseOpex(id)

    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Error in updateMarcomExpense:', err)
    return { error: err?.message || 'Gagal memperbarui pengeluaran' }
  }
}

/**
 * Menghapus pengeluaran manual
 */
export async function deleteMarcomExpense(idStr: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const id = BigInt(idStr)
    const existing = await prisma.marcomExpense.findUnique({
      where: { id },
    })

    if (!existing) return { error: 'Data pengeluaran tidak ditemukan' }

    // Hapus di Supabase Finance OPEX terlebih dahulu jika pernah tersinkron
    if (existing.expenseId) {
      await deleteOpexByExpenseId(existing.expenseId)
    }

    // Hapus di database Marcom
    await prisma.marcomExpense.delete({
      where: { id },
    })

    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Error in deleteMarcomExpense:', err)
    return { error: err?.message || 'Gagal menghapus pengeluaran' }
  }
}
