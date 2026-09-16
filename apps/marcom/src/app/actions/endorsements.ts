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
  const menuGiven = (formData.get('menuGiven') as string)?.trim() || null
  const hppMenuStr = (formData.get('hppMenu') as string) || '0'
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const postUrlIg = (formData.get('postUrlIg') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const visitStatus = (formData.get('visitStatus') as string) || 'PENDING'
  const postStatus = (formData.get('postStatus') as string) || 'OFF'
  const draftStatus = (formData.get('draftStatus') as string) || 'PENDING'
  const paymentStatus = (formData.get('paymentStatus') as string) || 'UNPAID'
  const paymentDateStr = formData.get('paymentDate') as string
  const paymentNotes = (formData.get('paymentNotes') as string)?.trim() || null
  const bankAccountCustom = (formData.get('bankAccountCustom') as string)?.trim() || null
  const type = (formData.get('type') as string) || 'VISIT'
  const shippingAddress = (formData.get('shippingAddress') as string)?.trim() || null
  const recipientName = (formData.get('recipientName') as string)?.trim() || null
  const courierResi = (formData.get('courierResi') as string)?.trim() || null
  const shippingCostStr = (formData.get('shippingCost') as string) || '0'
  const isShipped = formData.get('isShipped') === 'true'
  const shippingDateStr = formData.get('shippingDate') as string

  if (!kolIdStr || !outletIdStr || !scheduleDateStr) {
    return { error: 'KOL, Outlet, dan Tanggal Jadwal wajib diisi' }
  }

  try {
    const kolId = BigInt(kolIdStr)
    const outletId = BigInt(outletIdStr)
    const scheduleDate = new Date(scheduleDateStr)
    const rateCard = parseFloat(rateCardStr.replace(/[^0-9.]/g, '')) || 0
    const hppMenu = parseFloat(hppMenuStr.replace(/[^0-9.]/g, '')) || 0
    const shippingCost = parseFloat(shippingCostStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null
    const shippingDate = shippingDateStr ? new Date(shippingDateStr) : (isShipped ? new Date() : null)

    const endorsement = await prisma.endorsement.create({
      data: {
        kolId,
        outletId,
        scheduleDate,
        rateCard,
        menuGiven,
        hppMenu,
        postUrl: postUrl || postUrlIg || null,
        initialViews,
        finalViews,
        visitStatus,
        postStatus,
        draftStatus,
        paymentStatus,
        paymentDate,
        paymentNotes,
        bankAccountCustom,
        type,
        shippingAddress,
        recipientName,
        courierResi,
        shippingCost,
        isShipped,
        shippingDate,
      },
    })

    // Create post links if provided
    if (postUrl) {
      await prisma.endorsementPost.create({
        data: {
          endorsementId: endorsement.id,
          platform: 'TIKTOK',
          postUrl,
          status: 'POSTED',
          postedAt: scheduleDate,
        },
      })
    }

    if (postUrlIg) {
      await prisma.endorsementPost.create({
        data: {
          endorsementId: endorsement.id,
          platform: 'IG_REEL',
          postUrl: postUrlIg,
          status: 'POSTED',
          postedAt: scheduleDate,
        },
      })
    }

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
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
  const menuGiven = (formData.get('menuGiven') as string)?.trim() || null
  const hppMenuStr = (formData.get('hppMenu') as string) || '0'
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const visitStatus = (formData.get('visitStatus') as string) || 'PENDING'
  const postStatus = (formData.get('postStatus') as string) || 'OFF'
  const draftStatus = (formData.get('draftStatus') as string) || 'PENDING'
  const paymentStatus = (formData.get('paymentStatus') as string) || 'UNPAID'
  const paymentDateStr = formData.get('paymentDate') as string
  const paymentNotes = (formData.get('paymentNotes') as string)?.trim() || null
  const bankAccountCustom = (formData.get('bankAccountCustom') as string)?.trim() || null
  const type = (formData.get('type') as string) || 'VISIT'
  const shippingAddress = (formData.get('shippingAddress') as string)?.trim() || null
  const recipientName = (formData.get('recipientName') as string)?.trim() || null
  const courierResi = (formData.get('courierResi') as string)?.trim() || null
  const shippingCostStr = (formData.get('shippingCost') as string) || '0'
  const isShipped = formData.get('isShipped') === 'true'
  const shippingDateStr = formData.get('shippingDate') as string

  if (!kolIdStr || !outletIdStr || !scheduleDateStr) {
    return { error: 'KOL, Outlet, dan Tanggal Jadwal wajib diisi' }
  }

  try {
    const endorsementId = BigInt(id)
    const kolId = BigInt(kolIdStr)
    const outletId = BigInt(outletIdStr)
    const scheduleDate = new Date(scheduleDateStr)
    const rateCard = parseFloat(rateCardStr.replace(/[^0-9.]/g, '')) || 0
    const hppMenu = parseFloat(hppMenuStr.replace(/[^0-9.]/g, '')) || 0
    const shippingCost = parseFloat(shippingCostStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null
    const shippingDate = shippingDateStr ? new Date(shippingDateStr) : (isShipped ? new Date() : null)

    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        kolId,
        outletId,
        scheduleDate,
        rateCard,
        menuGiven,
        hppMenu,
        ...(postUrl !== null ? { postUrl } : {}),
        initialViews,
        finalViews,
        visitStatus,
        postStatus,
        draftStatus,
        paymentStatus,
        paymentDate,
        paymentNotes,
        bankAccountCustom,
        type,
        shippingAddress,
        recipientName,
        courierResi,
        shippingCost,
        isShipped,
        ...(shippingDate !== null ? { shippingDate } : {}),
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update endorsement:', err)
    return { error: err?.message || 'Gagal mengubah endorsement' }
  }
}

export async function updateShippingStatus(
  id: string,
  isShipped: boolean,
  courierResi?: string,
  shippingCost?: number
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(id)
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        isShipped,
        shippingDate: isShipped ? new Date() : null,
        ...(courierResi !== undefined ? { courierResi } : {}),
        ...(shippingCost !== undefined ? { shippingCost } : {}),
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update shipping status:', err)
    return { error: err?.message || 'Gagal mengubah status ekspedisi' }
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
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update endorsement status:', err)
    return { error: err?.message || 'Gagal mengubah status' }
  }
}

export async function updatePaymentStatus(
  id: string,
  paymentStatus: string,
  paymentDateStr?: string | null,
  paymentNotes?: string | null,
  bankAccountCustom?: string | null
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const endorsementId = BigInt(id)
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null

    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        paymentStatus,
        paymentDate,
        ...(paymentNotes !== undefined ? { paymentNotes } : {}),
        ...(bankAccountCustom !== undefined ? { bankAccountCustom } : {}),
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update payment status:', err)
    return { error: err?.message || 'Gagal memperbarui status pembayaran' }
  }
}

export async function updateDraftStatus(
  id: string,
  draftStatus: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(id)
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: { draftStatus },
    })

    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update draft status:', err)
    return { error: err?.message || 'Gagal memperbarui status draft' }
  }
}

export async function batchUpdatePayments(
  ids: string[],
  paymentStatus: string,
  paymentDateStr?: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : new Date()
    const bigIntIds = ids.map((id) => BigInt(id))

    await prisma.endorsement.updateMany({
      where: { id: { in: bigIntIds } },
      data: {
        paymentStatus,
        paymentDate,
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to batch update payments:', err)
    return { error: err?.message || 'Gagal memproses update pembayaran' }
  }
}

export async function addPostLink(
  endorsementIdStr: string,
  platform: string,
  postUrl: string,
  customPlatformName?: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(endorsementIdStr)
    await prisma.endorsementPost.create({
      data: {
        endorsementId,
        platform,
        postUrl: postUrl.trim(),
        customPlatformName: customPlatformName?.trim() || null,
        status: 'POSTED',
      },
    })

    // Update main postUrl on endorsement if not set
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        postUrl: postUrl.trim(),
        postStatus: 'ON',
      },
    })

    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to add post link:', err)
    return { error: err?.message || 'Gagal menambahkan link postingan' }
  }
}

export async function deletePostLink(postIdStr: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const postId = BigInt(postIdStr)
    await prisma.endorsementPost.delete({
      where: { id: postId },
    })

    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete post link:', err)
    return { error: err?.message || 'Gagal menghapus link postingan' }
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
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete endorsement:', err)
    return { error: err?.message || 'Gagal menghapus endorsement' }
  }
}

export async function updateVideoMetrics(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const finalViewsStr = formData.get('finalViews') as string
  const initialViewsStr = formData.get('initialViews') as string
  const likesStr = formData.get('likes') as string
  const commentsStr = formData.get('comments') as string
  const sharesStr = formData.get('shares') as string
  const savesStr = formData.get('saves') as string
  const postUrl = (formData.get('postUrl') as string)?.trim() || null

  try {
    const endorsementId = BigInt(id)
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const likes = likesStr !== '' ? parseInt(likesStr, 10) : 0
    const comments = commentsStr !== '' ? parseInt(commentsStr, 10) : 0
    const shares = sharesStr !== '' ? parseInt(sharesStr, 10) : 0
    const saves = savesStr !== '' ? parseInt(savesStr, 10) : 0

    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        ...(finalViews !== null ? { finalViews } : {}),
        ...(initialViews !== null ? { initialViews } : {}),
        likes,
        comments,
        shares,
        saves,
        ...(postUrl ? { postUrl } : {}),
        ...((finalViews || likes || comments) ? { postStatus: 'ON' } : {}),
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update video metrics:', err)
    return { error: err?.message || 'Gagal memperbarui metrik video' }
  }
}
