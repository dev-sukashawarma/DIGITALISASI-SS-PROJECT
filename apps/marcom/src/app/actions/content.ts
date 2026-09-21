'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
}

const DEFAULT_CONTENT_TYPES = [
  'Sidak Outlet',
  'Info promo',
  'Asthetic menu',
  'Info event',
  'UGC',
  'POV',
  'Recap',
  'Info menu',
  'Interview',
]

export interface SerializedContentType {
  id: string
  name: string
  createdAt: string
  contentCount?: number
}

export async function getContentTypes(): Promise<SerializedContentType[]> {
  try {
    let types = await prisma.contentType.findMany({
      orderBy: { name: 'asc' },
    })

    if (types.length === 0) {
      await prisma.contentType.createMany({
        data: DEFAULT_CONTENT_TYPES.map((name) => ({ name })),
        skipDuplicates: true,
      })
      types = await prisma.contentType.findMany({
        orderBy: { name: 'asc' },
      })
    }

    return types.map((t) => ({
      id: t.id.toString(),
      name: t.name,
      createdAt: t.createdAt.toISOString(),
    }))
  } catch (err) {
    console.error('Failed to get content types:', err)
    return DEFAULT_CONTENT_TYPES.map((name, index) => ({
      id: String(index + 1),
      name,
      createdAt: new Date().toISOString(),
    }))
  }
}

export async function getContentTypesWithCounts(): Promise<SerializedContentType[]> {
  try {
    const types = await getContentTypes()
    
    const counts = await prisma.internalContent.groupBy({
      by: ['contentType'],
      _count: {
        id: true,
      },
    })

    const countMap = new Map<string, number>()
    counts.forEach((c) => {
      if (c.contentType) {
        countMap.set(c.contentType.toLowerCase(), c._count.id)
      }
    })

    return types.map((t) => ({
      ...t,
      contentCount: countMap.get(t.name.toLowerCase()) || 0,
    }))
  } catch (err) {
    console.error('Failed to get content types with counts:', err)
    return getContentTypes()
  }
}

export async function createContentType(name: string): Promise<ActionState & { data?: SerializedContentType }> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const trimmed = name?.trim()
  if (!trimmed) {
    return { error: 'Nama tipe konten tidak boleh kosong' }
  }

  try {
    const existing = await prisma.contentType.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    })

    if (existing) {
      return { error: `Tipe konten "${trimmed}" sudah ada` }
    }

    const created = await prisma.contentType.create({
      data: { name: trimmed },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard/content-planner/pengaturan')
    return {
      success: true,
      data: {
        id: created.id.toString(),
        name: created.name,
        createdAt: created.createdAt.toISOString(),
        contentCount: 0,
      },
    }
  } catch (err: any) {
    console.error('Failed to create content type:', err)
    return { error: err?.message || 'Gagal menambahkan tipe konten' }
  }
}

export async function updateContentType(id: string, newName: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const trimmed = newName?.trim()
  if (!trimmed) {
    return { error: 'Nama tipe konten tidak boleh kosong' }
  }

  try {
    const typeId = BigInt(id)
    const existing = await prisma.contentType.findUnique({
      where: { id: typeId },
    })

    if (!existing) {
      return { error: 'Tipe konten tidak ditemukan' }
    }

    const oldName = existing.name

    const duplicate = await prisma.contentType.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
        NOT: { id: typeId },
      },
    })

    if (duplicate) {
      return { error: `Tipe konten "${trimmed}" sudah ada` }
    }

    await prisma.$transaction([
      prisma.contentType.update({
        where: { id: typeId },
        data: { name: trimmed },
      }),
      prisma.internalContent.updateMany({
        where: { contentType: oldName },
        data: { contentType: trimmed },
      }),
    ])

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard/content-planner/pengaturan')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update content type:', err)
    return { error: err?.message || 'Gagal memperbarui tipe konten' }
  }
}

export async function deleteContentType(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const typeId = BigInt(id)
    const existing = await prisma.contentType.findUnique({
      where: { id: typeId },
    })

    if (!existing) {
      return { error: 'Tipe konten tidak ditemukan' }
    }

    const usageCount = await prisma.internalContent.count({
      where: { contentType: existing.name },
    })

    if (usageCount > 0) {
      return {
        error: `Tipe konten "${existing.name}" tidak dapat dihapus karena masih digunakan oleh ${usageCount} konten.`,
      }
    }

    await prisma.contentType.delete({
      where: { id: typeId },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard/content-planner/pengaturan')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete content type:', err)
    return { error: err?.message || 'Gagal menghapus tipe konten' }
  }
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
  const pillar = (formData.get('pillar') as string) || 'Promo'
  const contentType = (formData.get('contentType') as string)?.trim() || null
  const format = (formData.get('format') as string)?.trim() || 'VIDEO'
  const goal = (formData.get('goal') as string)?.trim() || null
  const status = (formData.get('status') as string)?.trim() || 'POSTED'
  const isAds = formData.get('isAds') === 'true' || formData.get('isAds') === 'on'
  const creator = (formData.get('creator') as string)?.trim() || null
  const outletIdStr = (formData.get('outletId') as string)?.trim() || null
  const postDateStr = formData.get('postDate') as string
  const postTime = (formData.get('postTime') as string)?.trim() || null

  const reachStr = formData.get('reach') as string
  const viewsStr = formData.get('views') as string
  const likesStr = formData.get('likes') as string
  const commentsStr = formData.get('comments') as string
  const sharesStr = formData.get('shares') as string
  const savesStr = formData.get('saves') as string
  const followersBaselineStr = formData.get('followersBaseline') as string

  // Handle multi-platform selection
  const rawPlatforms = formData.getAll('platforms').map((p) => p.toString().trim()).filter(Boolean)
  let selectedPlatforms: string[] = []
  if (rawPlatforms.length > 0) {
    selectedPlatforms = Array.from(new Set(rawPlatforms))
  } else {
    const singlePlatform = (formData.get('platform') as string)?.trim()
    selectedPlatforms = [singlePlatform || 'TIKTOK']
  }

  if (!title || !postDateStr) {
    return { error: 'Judul konten dan tanggal tayang wajib diisi' }
  }

  // Validate postUrl per selected platform
  const platformUrls: Record<string, string> = {}
  for (const plat of selectedPlatforms) {
    const specificUrl = (formData.get(`postUrl_${plat}`) as string)?.trim()
    const fallbackUrl = (formData.get('postUrl') as string)?.trim()
    const resolvedUrl = specificUrl || fallbackUrl
    if (!resolvedUrl) {
      const platLabel = plat === 'TIKTOK' ? 'TikTok' : plat === 'INSTAGRAM' ? 'Instagram' : plat === 'YOUTUBE_SHORTS' ? 'YouTube Shorts' : plat
      return { error: `Link URL postingan untuk ${platLabel} wajib diisi` }
    }
    platformUrls[plat] = resolvedUrl
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

    // Generate shared groupId if multiple platforms are selected
    const groupId = selectedPlatforms.length > 1 ? crypto.randomUUID() : null

    const createOperations = selectedPlatforms.map((plat) =>
      prisma.internalContent.create({
        data: {
          title,
          platform: plat,
          pillar,
          contentType,
          format,
          goal,
          status,
          isAds,
          creator,
          outletId,
          postUrl: platformUrls[plat],
          postDate,
          postTime,
          reach,
          views,
          likes,
          comments,
          shares,
          saves,
          followersBaseline,
          groupId,
        },
      })
    )

    await prisma.$transaction(createOperations)

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard/content-planner/referensi-data')
    revalidatePath('/dashboard/content-planner/pengaturan')
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
