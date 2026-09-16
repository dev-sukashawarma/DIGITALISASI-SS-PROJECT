'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { scrapeVideoMetrics, ScrapedMetrics } from '@/lib/scraper'

export type AutoFetchResult = {
  success: boolean
  data?: ScrapedMetrics
  error?: string
}

export type SyncReport = {
  success: boolean
  totalProcessed: number
  updatedCount: number
  failedCount: number
  details: Array<{
    type: 'CONTENT' | 'ENDORSEMENT'
    id: string
    title: string
    platform?: string
    status: 'synced' | 'failed' | 'skipped'
    views?: number
    error?: string
  }>
  message?: string
}

/**
 * Auto-fetch metrics for a single video URL on-demand (used by modal buttons)
 */
export async function autoFetchVideoMetrics(url: string): Promise<AutoFetchResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const cleanUrl = url?.trim()
  if (!cleanUrl) {
    return { success: false, error: 'Harap masukkan link URL video terlebih dahulu' }
  }

  try {
    const result = await scrapeVideoMetrics(cleanUrl)
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Gagal mengekstrak data dari URL yang diberikan',
      }
    }

    return {
      success: true,
      data: result,
    }
  } catch (err: any) {
    console.error('Error auto-fetching video metrics:', err)
    return {
      success: false,
      error: err?.message || 'Terjadi kesalahan sistem saat menarik metrik',
    }
  }
}

/**
 * Sync metrics for a single internal content item by ID
 */
export async function syncSingleContentVideo(id: string): Promise<{ success: boolean; error?: string; metrics?: ScrapedMetrics }> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const content = await prisma.internalContent.findUnique({
      where: { id: BigInt(id) },
    })

    if (!content) {
      return { success: false, error: 'Video konten tidak ditemukan' }
    }

    if (!content.postUrl) {
      return { success: false, error: 'Video belum memiliki Link URL postingan' }
    }

    const metrics = await scrapeVideoMetrics(content.postUrl)
    if (!metrics.success) {
      return { success: false, error: metrics.error || 'Gagal mengambil metrik video' }
    }

    // Only update if metrics has actual positive or valid data
    await prisma.internalContent.update({
      where: { id: content.id },
      data: {
        views: metrics.views !== undefined && metrics.views > 0 ? metrics.views : content.views,
        likes: metrics.likes !== undefined && metrics.likes > 0 ? metrics.likes : content.likes,
        comments: metrics.comments !== undefined && metrics.comments > 0 ? metrics.comments : content.comments,
        shares: metrics.shares !== undefined && metrics.shares > 0 ? metrics.shares : content.shares,
        saves: metrics.saves !== undefined && metrics.saves > 0 ? metrics.saves : content.saves,
      },
    })

    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard')
    return { success: true, metrics }
  } catch (err: any) {
    console.error(`Error syncing content video ${id}:`, err)
    return { success: false, error: err?.message || 'Gagal menyinkronkan video' }
  }
}

/**
 * Sync metrics for a single endorsement video item by ID
 */
export async function syncSingleEndorsementVideo(id: string): Promise<{ success: boolean; error?: string; metrics?: ScrapedMetrics }> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const endorsement = await prisma.endorsement.findUnique({
      where: { id: BigInt(id) },
      include: { kol: true, outlet: true },
    })

    if (!endorsement) {
      return { success: false, error: 'Data endorsement tidak ditemukan' }
    }

    if (!endorsement.postUrl) {
      return { success: false, error: 'Endorsement belum memiliki Link URL postingan' }
    }

    const metrics = await scrapeVideoMetrics(endorsement.postUrl)
    if (!metrics.success) {
      return { success: false, error: metrics.error || 'Gagal mengambil metrik video' }
    }

    await prisma.endorsement.update({
      where: { id: endorsement.id },
      data: {
        finalViews: metrics.views !== undefined && metrics.views > 0 ? metrics.views : endorsement.finalViews,
        likes: metrics.likes !== undefined && metrics.likes > 0 ? metrics.likes : endorsement.likes,
        comments: metrics.comments !== undefined && metrics.comments > 0 ? metrics.comments : endorsement.comments,
        shares: metrics.shares !== undefined && metrics.shares > 0 ? metrics.shares : endorsement.shares,
        saves: metrics.saves !== undefined && metrics.saves > 0 ? metrics.saves : endorsement.saves,
        postStatus: 'ON',
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    return { success: true, metrics }
  } catch (err: any) {
    console.error(`Error syncing endorsement video ${id}:`, err)
    return { success: false, error: err?.message || 'Gagal menyinkronkan video' }
  }
}

/**
 * Batch sync all videos (Internal Content + Endorsements) with a postUrl
 * Can be run manually from UI or called by cron API route.
 */
export async function syncAllActiveVideos(isCron: boolean = false): Promise<SyncReport> {
  if (!isCron) {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        totalProcessed: 0,
        updatedCount: 0,
        failedCount: 0,
        details: [],
        message: 'Unauthorized: Harap login terlebih dahulu',
      }
    }
  }

  const details: SyncReport['details'] = []
  let updatedCount = 0
  let failedCount = 0

  try {
    // 1. Fetch all internal contents with a URL
    const internalContents = await prisma.internalContent.findMany({
      where: {
        postUrl: {
          not: null,
        },
      },
    })

    // 2. Fetch all endorsements with a URL
    const endorsements = await prisma.endorsement.findMany({
      where: {
        postUrl: {
          not: null,
        },
      },
      include: {
        kol: { select: { name: true } },
        outlet: { select: { name: true } },
      },
    })

    const totalProcessed = internalContents.length + endorsements.length

    // Helper sleep to prevent rate limiting / throttling from social platforms
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    // Process Internal Contents
    for (const item of internalContents) {
      if (!item.postUrl) continue
      try {
        const metrics = await scrapeVideoMetrics(item.postUrl)
        if (metrics.success) {
          await prisma.internalContent.update({
            where: { id: item.id },
            data: {
              views: metrics.views !== undefined && metrics.views > 0 ? metrics.views : item.views,
              likes: metrics.likes !== undefined && metrics.likes > 0 ? metrics.likes : item.likes,
              comments: metrics.comments !== undefined && metrics.comments > 0 ? metrics.comments : item.comments,
              shares: metrics.shares !== undefined && metrics.shares > 0 ? metrics.shares : item.shares,
              saves: metrics.saves !== undefined && metrics.saves > 0 ? metrics.saves : item.saves,
            },
          })
          updatedCount++
          details.push({
            type: 'CONTENT',
            id: item.id.toString(),
            title: item.title,
            platform: metrics.platform,
            status: 'synced',
            views: metrics.views,
          })
        } else {
          failedCount++
          details.push({
            type: 'CONTENT',
            id: item.id.toString(),
            title: item.title,
            platform: metrics.platform,
            status: 'failed',
            error: metrics.error,
          })
        }
      } catch (err: any) {
        failedCount++
        details.push({
          type: 'CONTENT',
          id: item.id.toString(),
          title: item.title,
          status: 'failed',
          error: err?.message,
        })
      }

      // Small delay between requests
      await sleep(350)
    }

    // Process Endorsements
    for (const item of endorsements) {
      if (!item.postUrl) continue
      try {
        const metrics = await scrapeVideoMetrics(item.postUrl)
        if (metrics.success) {
          await prisma.endorsement.update({
            where: { id: item.id },
            data: {
              finalViews: metrics.views !== undefined && metrics.views > 0 ? metrics.views : item.finalViews,
              likes: metrics.likes !== undefined && metrics.likes > 0 ? metrics.likes : item.likes,
              comments: metrics.comments !== undefined && metrics.comments > 0 ? metrics.comments : item.comments,
              shares: metrics.shares !== undefined && metrics.shares > 0 ? metrics.shares : item.shares,
              saves: metrics.saves !== undefined && metrics.saves > 0 ? metrics.saves : item.saves,
              postStatus: 'ON',
            },
          })
          updatedCount++
          details.push({
            type: 'ENDORSEMENT',
            id: item.id.toString(),
            title: `${item.kol.name} (${item.outlet.name})`,
            platform: metrics.platform,
            status: 'synced',
            views: metrics.views,
          })
        } else {
          failedCount++
          details.push({
            type: 'ENDORSEMENT',
            id: item.id.toString(),
            title: `${item.kol.name} (${item.outlet.name})`,
            platform: metrics.platform,
            status: 'failed',
            error: metrics.error,
          })
        }
      } catch (err: any) {
        failedCount++
        details.push({
          type: 'ENDORSEMENT',
          id: item.id.toString(),
          title: `${item.kol.name} (${item.outlet.name})`,
          status: 'failed',
          error: err?.message,
        })
      }

      // Small delay between requests
      await sleep(350)
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard/content-planner')
    revalidatePath('/dashboard/content-planner/metrik-data')
    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')

    return {
      success: true,
      totalProcessed,
      updatedCount,
      failedCount,
      details,
      message: `Sinkronisasi selesai: ${updatedCount} video berhasil diupdate, ${failedCount} gagal/privat.`,
    }
  } catch (err: any) {
    console.error('Fatal error during batch video sync:', err)
    return {
      success: false,
      totalProcessed: 0,
      updatedCount,
      failedCount,
      details,
      message: `Terjadi kendala saat proses sinkronisasi: ${err?.message}`,
    }
  }
}
