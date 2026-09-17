'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { syncAdOpex, deleteOpexByExpenseId } from '@/lib/sync-finance-opex'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function createAd(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const outletIdStr = formData.get('outletId') as string
  const category = (formData.get('category') as string) || 'MITRA'
  const platform = (formData.get('platform') as string) || 'TIKTOK'
  const accountName = (formData.get('accountName') as string)?.trim() || null
  const scheduleDateStr = formData.get('scheduleDate') as string
  const budgetStr = (formData.get('budget') as string) || '0'
  const spentStr = (formData.get('spent') as string) || '0'
  const adUrl = (formData.get('adUrl') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const status = (formData.get('status') as string) || 'OFF'

  if (!scheduleDateStr) {
    return { error: 'Tanggal Jadwal iklan wajib diisi' }
  }

  try {
    const outletId = outletIdStr ? BigInt(outletIdStr) : null
    const scheduleDate = new Date(scheduleDateStr)
    const budget = parseFloat(budgetStr.replace(/[^0-9.]/g, '')) || 0
    const spent = parseFloat(spentStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null

    const newAd = await prisma.ad.create({
      data: {
        outletId,
        category,
        platform,
        accountName,
        scheduleDate,
        budget,
        spent,
        adUrl,
        initialViews,
        finalViews,
        status,
      },
    })

    // Sinkronisasi otomatis ke OPEX Finance & Admin Dashboard
    await syncAdOpex(newAd.id)

    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create Ad:', err)
    return { error: err?.message || 'Gagal menambahkan data Ads' }
  }
}

export async function updateAd(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const outletIdStr = formData.get('outletId') as string
  const category = (formData.get('category') as string) || 'MITRA'
  const platform = (formData.get('platform') as string) || 'TIKTOK'
  const accountName = (formData.get('accountName') as string)?.trim() || null
  const scheduleDateStr = formData.get('scheduleDate') as string
  const budgetStr = (formData.get('budget') as string) || '0'
  const spentStr = (formData.get('spent') as string) || '0'
  const adUrl = (formData.get('adUrl') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const status = (formData.get('status') as string) || 'OFF'

  if (!scheduleDateStr) {
    return { error: 'Tanggal Jadwal iklan wajib diisi' }
  }

  try {
    const adId = BigInt(id)
    const outletId = outletIdStr ? BigInt(outletIdStr) : null
    const scheduleDate = new Date(scheduleDateStr)
    const budget = parseFloat(budgetStr.replace(/[^0-9.]/g, '')) || 0
    const spent = parseFloat(spentStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null

    await prisma.ad.update({
      where: { id: adId },
      data: {
        outletId,
        category,
        platform,
        accountName,
        scheduleDate,
        budget,
        spent,
        adUrl,
        initialViews,
        finalViews,
        status,
      },
    })

    // Sinkronisasi otomatis ke OPEX Finance & Admin Dashboard
    await syncAdOpex(adId)

    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update Ad:', err)
    return { error: err?.message || 'Gagal mengubah data Ads' }
  }
}

export async function updateAdStatus(
  id: string,
  status: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const adId = BigInt(id)
    await prisma.ad.update({
      where: { id: adId },
      data: { status },
    })

    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update Ad status:', err)
    return { error: err?.message || 'Gagal mengubah status Ads' }
  }
}

export async function deleteAd(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const adId = BigInt(id)

    // Ambil referensi expense ID untuk dihapus dari OPEX Supabase
    const existing = await prisma.ad.findUnique({
      where: { id: adId },
      select: { expenseId: true },
    })

    if (existing?.expenseId) {
      await deleteOpexByExpenseId(existing.expenseId)
    }

    await prisma.ad.delete({
      where: { id: adId },
    })

    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete Ad:', err)
    return { error: err?.message || 'Gagal menghapus data Ads' }
  }
}
