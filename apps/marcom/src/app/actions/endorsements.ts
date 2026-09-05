'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function createEndorsement(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const kolIdStr = formData.get('kolId') as string
  const outletIdStr = formData.get('outletId') as string
  const scheduleDateStr = formData.get('scheduleDate') as string
  const rateCardStr = (formData.get('rateCard') as string) || '0'
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const visitStatus = (formData.get('visitStatus') as string) || 'PENDING'
  const postStatus = (formData.get('postStatus') as string) || 'OFF'

  if (!kolIdStr || !outletIdStr || !scheduleDateStr) {
    return { error: 'KOL, Outlet, dan Tanggal Jadwal wajib diisi' }
  }

  try {
    const kolId = BigInt(kolIdStr)
    const outletId = BigInt(outletIdStr)
    const scheduleDate = new Date(scheduleDateStr)
    const rateCard = parseFloat(rateCardStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null

    await prisma.endorsement.create({
      data: {
        kolId,
        outletId,
        scheduleDate,
        rateCard,
        postUrl,
        initialViews,
        finalViews,
        visitStatus,
        postStatus,
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create endorsement:', err)
    return { error: err?.message || 'Gagal menambahkan endorsement' }
  }
}

export async function updateEndorsement(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const kolIdStr = formData.get('kolId') as string
  const outletIdStr = formData.get('outletId') as string
  const scheduleDateStr = formData.get('scheduleDate') as string
  const rateCardStr = (formData.get('rateCard') as string) || '0'
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const visitStatus = (formData.get('visitStatus') as string) || 'PENDING'
  const postStatus = (formData.get('postStatus') as string) || 'OFF'

  if (!kolIdStr || !outletIdStr || !scheduleDateStr) {
    return { error: 'KOL, Outlet, dan Tanggal Jadwal wajib diisi' }
  }

  try {
    const endorsementId = BigInt(id)
    const kolId = BigInt(kolIdStr)
    const outletId = BigInt(outletIdStr)
    const scheduleDate = new Date(scheduleDateStr)
    const rateCard = parseFloat(rateCardStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null

    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        kolId,
        outletId,
        scheduleDate,
        rateCard,
        postUrl,
        initialViews,
        finalViews,
        visitStatus,
        postStatus,
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update endorsement:', err)
    return { error: err?.message || 'Gagal mengubah endorsement' }
  }
}

export async function updateEndorsementStatus(
  id: string,
  visitStatus: string,
  postStatus: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(id)
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: { visitStatus, postStatus },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update endorsement status:', err)
    return { error: err?.message || 'Gagal mengubah status' }
  }
}

export async function deleteEndorsement(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  if (user.role !== 'ADMIN') {
    return { error: 'Hanya role ADMIN yang berhak menghapus data endorsement' }
  }

  try {
    const endorsementId = BigInt(id)
    await prisma.endorsement.delete({
      where: { id: endorsementId },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete endorsement:', err)
    return { error: err?.message || 'Gagal menghapus endorsement' }
  }
}
