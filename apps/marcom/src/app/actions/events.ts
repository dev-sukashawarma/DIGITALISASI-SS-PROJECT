'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function createPromoEvent(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const outletIdStr = (formData.get('outletId') as string)?.trim() || null
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string
  const type = (formData.get('type') as string) || 'PROMO'

  if (!title || !startDateStr || !endDateStr) {
    return { error: 'Judul event/promo, tanggal mulai, dan tanggal selesai wajib diisi' }
  }

  try {
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    if (endDate < startDate) {
      return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai' }
    }

    const outletId = outletIdStr && outletIdStr !== 'ALL' ? BigInt(outletIdStr) : null

    await prisma.promoEvent.create({
      data: {
        title,
        description,
        outletId,
        startDate,
        endDate,
        type,
      },
    })

    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create promo event:', err)
    return { error: err?.message || 'Gagal menambahkan event/promo' }
  }
}

export async function updatePromoEvent(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const outletIdStr = (formData.get('outletId') as string)?.trim() || null
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string
  const type = (formData.get('type') as string) || 'PROMO'

  if (!title || !startDateStr || !endDateStr) {
    return { error: 'Judul event/promo, tanggal mulai, dan tanggal selesai wajib diisi' }
  }

  try {
    const eventId = BigInt(id)
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    if (endDate < startDate) {
      return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai' }
    }

    const outletId = outletIdStr && outletIdStr !== 'ALL' ? BigInt(outletIdStr) : null

    await prisma.promoEvent.update({
      where: { id: eventId },
      data: {
        title,
        description,
        outletId,
        startDate,
        endDate,
        type,
      },
    })

    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update promo event:', err)
    return { error: err?.message || 'Gagal memperbarui event/promo' }
  }
}

export async function deletePromoEvent(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const eventId = BigInt(id)
    await prisma.promoEvent.delete({
      where: { id: eventId },
    })

    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete promo event:', err)
    return { error: err?.message || 'Gagal menghapus event/promo' }
  }
}
