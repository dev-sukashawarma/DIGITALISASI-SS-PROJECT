'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function createInternalContent(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const title = (formData.get('title') as string)?.trim()
  const platform = (formData.get('platform') as string) || 'TIKTOK'
  const pillar = (formData.get('pillar') as string) || 'Promo'
  const contentType = (formData.get('contentType') as string)?.trim() || null
  const format = (formData.get('format') as string)?.trim() || 'VIDEO'
  const goal = (formData.get('goal') as string)?.trim() || null
  const status = (formData.get('status') as string)?.trim() || 'POSTED'
  const isAds = formData.get('isAds') === 'true' || formData.get('isAds') === 'on'
  const creator = (formData.get('creator') as string)?.trim() || null
  const outletIdStr = (formData.get('outletId') as string)?.trim() || null
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const postDateStr = formData.get('postDate') as string
  const postTime = (formData.get('postTime') as string)?.trim() || null

  const reachStr = formData.get('reach') as string
  const viewsStr = formData.get('views') as string
  const likesStr = formData.get('likes') as string
  const commentsStr = formData.get('comments') as string
  const sharesStr = formData.get('shares') as string
  const savesStr = formData.get('saves') as string
  const followersBaselineStr = formData.get('followersBaseline') as string

  if (!title || !postDateStr || !postUrl) {
    return { error: 'Judul konten, tanggal tayang, dan link URL postingan wajib diisi' }
  }

  try {
    const postDate = new Date(postDateStr)
    const outletId = outletIdStr && outletIdStr !== 'ALL' ? BigInt(outletIdStr) : null
    const reach = reachStr ? parseInt(reachStr, 10) : 0
    const views = viewsStr ? parseInt(viewsStr, 10) : 0
    const likes = likesStr ? parseInt(likesStr, 10) : 0
    const comments = commentsStr ? parseInt(commentsStr, 10) : 0
    const shares = sharesStr ? parseInt(sharesStr, 10) : 0
    const saves = savesStr ? parseInt(savesStr, 10) : 0
    const followersBaseline = followersBaselineStr ? parseInt(followersBaselineStr, 10) : null

    await prisma.internalContent.create({
      data: {
        title,
        platform,
        pillar,
        contentType,
        format,
        goal,
        status,
        isAds,
        creator,
        outletId,
        postUrl,
        postDate,
        postTime,
        reach,
        views,
        likes,
        comments,
        shares,
        saves,
        followersBaseline,
      },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create internal content:', err)
    return { error: err?.message || 'Gagal menambahkan video internal' }
  }
}

export async function updateInternalContent(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const title = (formData.get('title') as string)?.trim()
  const platform = (formData.get('platform') as string) || 'TIKTOK'
  const pillar = (formData.get('pillar') as string) || 'Promo'
  const contentType = (formData.get('contentType') as string)?.trim() || null
  const format = (formData.get('format') as string)?.trim() || 'VIDEO'
  const goal = (formData.get('goal') as string)?.trim() || null
  const status = (formData.get('status') as string)?.trim() || 'POSTED'
  const isAds = formData.get('isAds') === 'true' || formData.get('isAds') === 'on'
  const creator = (formData.get('creator') as string)?.trim() || null
  const outletIdStr = (formData.get('outletId') as string)?.trim() || null
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const postDateStr = formData.get('postDate') as string
  const postTime = (formData.get('postTime') as string)?.trim() || null

  const reachStr = formData.get('reach') as string
  const viewsStr = formData.get('views') as string
  const likesStr = formData.get('likes') as string
  const commentsStr = formData.get('comments') as string
  const sharesStr = formData.get('shares') as string
  const savesStr = formData.get('saves') as string
  const followersBaselineStr = formData.get('followersBaseline') as string

  if (!title || !postDateStr || !postUrl) {
    return { error: 'Judul konten, tanggal tayang, dan link URL postingan wajib diisi' }
  }

  try {
    const contentId = BigInt(id)
    const postDate = new Date(postDateStr)
    const outletId = outletIdStr && outletIdStr !== 'ALL' ? BigInt(outletIdStr) : null
    const reach = reachStr ? parseInt(reachStr, 10) : 0
    const views = viewsStr ? parseInt(viewsStr, 10) : 0
    const likes = likesStr ? parseInt(likesStr, 10) : 0
    const comments = commentsStr ? parseInt(commentsStr, 10) : 0
    const shares = sharesStr ? parseInt(sharesStr, 10) : 0
    const saves = savesStr ? parseInt(savesStr, 10) : 0
    const followersBaseline = followersBaselineStr ? parseInt(followersBaselineStr, 10) : null

    await prisma.internalContent.update({
      where: { id: contentId },
      data: {
        title,
        platform,
        pillar,
        contentType,
        format,
        goal,
        status,
        isAds,
        creator,
        outletId,
        postUrl,
        postDate,
        postTime,
        reach,
        views,
        likes,
        comments,
        shares,
        saves,
        followersBaseline,
      },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update internal content:', err)
    return { error: err?.message || 'Gagal memperbarui video internal' }
  }
}

export async function toggleContentAdsStatus(
  id: string,
  isAds: boolean
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const contentId = BigInt(id)
    await prisma.internalContent.update({
      where: { id: contentId },
      data: { isAds },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to toggle ads status:', err)
    return { error: err?.message || 'Gagal mengubah status iklan video' }
  }
}

export async function updateContentStatus(
  id: string,
  newStatus: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const contentId = BigInt(id)
    await prisma.internalContent.update({
      where: { id: contentId },
      data: { status: newStatus },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update content status:', err)
    return { error: err?.message || 'Gagal mengubah status konten' }
  }
}

export async function updateContentMetrics(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const reachStr = formData.get('reach') as string
  const viewsStr = formData.get('views') as string
  const likesStr = formData.get('likes') as string
  const commentsStr = formData.get('comments') as string
  const sharesStr = formData.get('shares') as string
  const savesStr = formData.get('saves') as string
  const postUrl = (formData.get('postUrl') as string)?.trim() || null

  try {
    const contentId = BigInt(id)
    const reach = reachStr !== null && reachStr !== undefined ? parseInt(reachStr, 10) : undefined
    const views = viewsStr ? parseInt(viewsStr, 10) : 0
    const likes = likesStr ? parseInt(likesStr, 10) : 0
    const comments = commentsStr ? parseInt(commentsStr, 10) : 0
    const shares = sharesStr ? parseInt(sharesStr, 10) : 0
    const saves = savesStr ? parseInt(savesStr, 10) : 0

    await prisma.internalContent.update({
      where: { id: contentId },
      data: {
        ...(reach !== undefined && !isNaN(reach) ? { reach } : {}),
        views,
        likes,
        comments,
        shares,
        saves,
        ...(postUrl ? { postUrl } : {}),
      },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update content metrics:', err)
    return { error: err?.message || 'Gagal memperbarui metrik video internal' }
  }
}

export async function deleteInternalContent(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const contentId = BigInt(id)
    await prisma.internalContent.delete({
      where: { id: contentId },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete internal content:', err)
    return { error: err?.message || 'Gagal menghapus video internal' }
  }
}
