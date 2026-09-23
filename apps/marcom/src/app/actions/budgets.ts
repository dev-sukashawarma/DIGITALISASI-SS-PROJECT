'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
}

export interface OutletBudgetSummary {
  outletId: string
  outletName: string
  outletType: 'INTERNAL' | 'MITRA'
  periodMonth: number
  periodYear: number
  targetBudget: number
  targetKolCount: number
  realizedRateCard: number
  realizedHpp: number
  totalRealizedCost: number
  remainingBudget: number
  actualKolCount: number
  visitedKolCount: number
  postedKolCount: number
  budgetAchievementRate: number // percentage
  kolAchievementRate: number    // percentage
  notes: string | null
}

export interface MonthlyBudgetMatrix {
  periodMonth: number
  periodYear: number
  mitraSummary: {
    targetBudget: number
    totalRealizedCost: number
    remainingBudget: number
    targetKolCount: number
    actualKolCount: number
    outlets: OutletBudgetSummary[]
  }
  internalSummary: {
    targetBudget: number
    totalRealizedCost: number
    remainingBudget: number
    targetKolCount: number
    actualKolCount: number
    outlets: OutletBudgetSummary[]
  }
  grandTotal: {
    targetBudget: number
    totalRealizedCost: number
    remainingBudget: number
    targetKolCount: number
    actualKolCount: number
  }
}

export async function getMonthlyBudgetMatrix(
  month: number = 9,
  year: number = 2026
): Promise<MonthlyBudgetMatrix> {
  // Start and end of the month
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  // Fetch all active outlets with their budget for this period
  const outlets = await prisma.outlet.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      budgets: {
        where: {
          periodMonth: month,
          periodYear: year,
        },
      },
      endorsements: {
        where: {
          scheduleDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          rateCard: true,
          hppMenu: true,
          visitStatus: true,
          postStatus: true,
        },
      },
    },
  })

  const summaries: OutletBudgetSummary[] = outlets.map((ot) => {
    const budgetRecord = ot.budgets[0]
    const targetBudget = budgetRecord ? Number(budgetRecord.targetBudget) : 0
    const targetKolCount = budgetRecord ? budgetRecord.targetKolCount : 0

    let realizedRateCard = 0
    let realizedHpp = 0
    let visitedCount = 0
    let postedCount = 0

    for (const end of ot.endorsements) {
      realizedRateCard += Number(end.rateCard || 0)
      realizedHpp += Number(end.hppMenu || 0)
      if (end.visitStatus === 'VISITED') visitedCount++
      if (end.postStatus === 'ON') postedCount++
    }

    const totalRealized = realizedRateCard + realizedHpp
    const remaining = targetBudget - totalRealized
    const actualKol = ot.endorsements.length

    return {
      outletId: ot.id.toString(),
      outletName: ot.name,
      outletType: (ot.type as 'INTERNAL' | 'MITRA') || 'INTERNAL',
      periodMonth: month,
      periodYear: year,
      targetBudget,
      targetKolCount,
      realizedRateCard,
      realizedHpp,
      totalRealizedCost: totalRealized,
      remainingBudget: remaining,
      actualKolCount: actualKol,
      visitedKolCount: visitedCount,
      postedKolCount: postedCount,
      budgetAchievementRate: targetBudget > 0 ? Math.round((totalRealized / targetBudget) * 100) : 0,
      kolAchievementRate: targetKolCount > 0 ? Math.round((actualKol / targetKolCount) * 100) : 0,
      notes: budgetRecord?.notes || null,
    }
  })

  const mitraOutlets = summaries.filter((s) => s.outletType === 'MITRA')
  const internalOutlets = summaries.filter((s) => s.outletType === 'INTERNAL')

  const calcGroup = (list: OutletBudgetSummary[]) => {
    const targetBudget = list.reduce((acc, curr) => acc + curr.targetBudget, 0)
    const totalRealizedCost = list.reduce((acc, curr) => acc + curr.totalRealizedCost, 0)
    const remainingBudget = targetBudget - totalRealizedCost
    const targetKolCount = list.reduce((acc, curr) => acc + curr.targetKolCount, 0)
    const actualKolCount = list.reduce((acc, curr) => acc + curr.actualKolCount, 0)
    return { targetBudget, totalRealizedCost, remainingBudget, targetKolCount, actualKolCount, outlets: list }
  }

  const mitraSummary = calcGroup(mitraOutlets)
  const internalSummary = calcGroup(internalOutlets)

  const grandTotal = {
    targetBudget: mitraSummary.targetBudget + internalSummary.targetBudget,
    totalRealizedCost: mitraSummary.totalRealizedCost + internalSummary.totalRealizedCost,
    remainingBudget: mitraSummary.remainingBudget + internalSummary.remainingBudget,
    targetKolCount: mitraSummary.targetKolCount + internalSummary.targetKolCount,
    actualKolCount: mitraSummary.actualKolCount + internalSummary.actualKolCount,
  }

  return {
    periodMonth: month,
    periodYear: year,
    mitraSummary,
    internalSummary,
    grandTotal,
  }
}

export async function upsertOutletBudget(
  outletIdStr: string,
  periodMonth: number,
  periodYear: number,
  targetBudget: number,
  targetKolCount: number,
  notes?: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const outletId = BigInt(outletIdStr)

    await prisma.outletBudget.upsert({
      where: {
        idx_outlet_budget_period: {
          outletId,
          periodMonth,
          periodYear,
        },
      },
      update: {
        targetBudget,
        targetKolCount,
        notes: notes || null,
      },
      create: {
        outletId,
        periodMonth,
        periodYear,
        targetBudget,
        targetKolCount,
        notes: notes || null,
      },
    })

    revalidatePath('/dashboard/budget')
    revalidatePath('/dashboard/outlets')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to upsert outlet budget:', err)
    return { error: err?.message || 'Gagal memperbarui budget outlet' }
  }
}

/**
 * Menyalin target budget dan kuota KOL dari bulan sebelumnya ke bulan target
 */
export async function copyPreviousMonthBudgets(
  targetMonth: number,
  targetYear: number
): Promise<{ success?: boolean; copiedCount?: number; error?: string }> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear

    const previousBudgets = await prisma.outletBudget.findMany({
      where: {
        periodMonth: prevMonth,
        periodYear: prevYear,
      },
    })

    if (previousBudgets.length === 0) {
      return {
        error: `Tidak ada data target budget pada bulan sebelumnya (${prevMonth}/${prevYear}) untuk disalin.`,
      }
    }

    let copiedCount = 0
    for (const pb of previousBudgets) {
      // Upsert target ke bulan yang dipilih
      await prisma.outletBudget.upsert({
        where: {
          idx_outlet_budget_period: {
            outletId: pb.outletId,
            periodMonth: targetMonth,
            periodYear: targetYear,
          },
        },
        update: {
          targetBudget: pb.targetBudget,
          targetKolCount: pb.targetKolCount,
          notes: pb.notes || `Disalin dari ${prevMonth}/${prevYear}`,
        },
        create: {
          outletId: pb.outletId,
          periodMonth: targetMonth,
          periodYear: targetYear,
          targetBudget: pb.targetBudget,
          targetKolCount: pb.targetKolCount,
          notes: pb.notes || `Disalin dari ${prevMonth}/${prevYear}`,
        },
      })
      copiedCount++
    }

    revalidatePath('/dashboard/budget')
    return { success: true, copiedCount }
  } catch (err: any) {
    console.error('Failed to copy previous month budgets:', err)
    return { error: err?.message || 'Gagal menyalin target budget dari bulan sebelumnya' }
  }
}

