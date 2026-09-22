'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { scrapeVideoMetrics, ScrapedMetrics } from '@/lib/scraper'
import { syncAllHistoricalMarcomToOpex } from '@/lib/sync-finance-opex'

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
  lastSyncedAt?: string
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
 * Get the last recorded video sync timestamp from settings or DB
 */
export async function getLastVideoSyncTime(): Promise<string | null> {
  try {
    const res = await prisma.$queryRawUnsafe<Array<{ value: string; updated_at: Date }>>(
      `SELECT "value", "updated_at" FROM "marcom_settings" WHERE "key" = 'last_video_sync_at' LIMIT 1`
    )
    if (res && res.length > 0) {
      return res[0].value || (res[0].updated_at ? res[0].updated_at.toISOString() : null)
    }
  } catch {
    // If table doesn't exist yet, return null
  }
  return null
}

/**
 * Record the last video sync timestamp
 */
export async function recordLastVideoSyncTime(timestamp: string = new Date().toISOString()): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "marcom_settings" ("key", "value", "updated_at")
       VALUES ('last_video_sync_at', $1, NOW())
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED.value, "updated_at" = NOW()`,
      timestamp
    )
  } catch (err) {
    console.error('Failed to record last video sync time:', err)
  }
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

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "internal_contents" SET "last_synced_at" = NOW() WHERE "id" = $1`,
        content.id
      )
      await recordLastVideoSyncTime()
    } catch {}

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
      include: { kol: true, outlet: true, posts: true },
    })

    if (!endorsement) {
      return { success: false, error: 'Data endorsement tidak ditemukan' }
    }

    if (endorsement.posts && endorsement.posts.length > 0) {
      let totalViews = 0
      let totalLikes = 0
      let totalComments = 0
      let totalShares = 0
      let totalSaves = 0
      let anyScraped = false
      let lastMetrics: ScrapedMetrics | undefined

      for (const p of endorsement.posts) {
        if (!p.postUrl) continue
        const metrics = await scrapeVideoMetrics(p.postUrl)
        if (metrics.success) {
          anyScraped = true
          lastMetrics = metrics
          const views = metrics.views !== undefined && metrics.views > 0 ? metrics.views : p.views
          const likes = metrics.likes !== undefined && metrics.likes > 0 ? metrics.likes : p.likes
          const comments = metrics.comments !== undefined && metrics.comments > 0 ? metrics.comments : p.comments
          const shares = metrics.shares !== undefined && metrics.shares > 0 ? metrics.shares : p.shares
          const saves = metrics.saves !== undefined && metrics.saves > 0 ? metrics.saves : p.saves

          totalViews += views
          totalLikes += likes
          totalComments += comments
          totalShares += shares
          totalSaves += saves

          await prisma.endorsementPost.update({
            where: { id: p.id },
            data: { views, likes, comments, shares, saves, status: 'POSTED' },
          })
        } else {
          totalViews += p.views || 0
          totalLikes += p.likes || 0
          totalComments += p.comments || 0
          totalShares += p.shares || 0
          totalSaves += p.saves || 0
        }
      }

      if (!anyScraped && !endorsement.postUrl) {
        return { success: false, error: 'Gagal mengambil metrik video dari platform' }
      }

      await prisma.endorsement.update({
        where: { id: endorsement.id },
        data: {
          finalViews: totalViews,
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          saves: totalSaves,
          postStatus: (totalViews > 0 || totalLikes > 0) ? 'ON' : undefined,
        },
      })

      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "endorsements" SET "last_synced_at" = NOW() WHERE "id" = $1`,
          endorsement.id
        )
        await recordLastVideoSyncTime()
      } catch {}

      revalidatePath('/dashboard/endorsements')
      revalidatePath('/dashboard')
      return {
        success: true,
        metrics: lastMetrics || {
          success: true,
          platform: 'UNKNOWN',
          views: totalViews,
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          saves: totalSaves,
        },
      }
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

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "endorsements" SET "last_synced_at" = NOW() WHERE "id" = $1`,
        endorsement.id
      )
      await recordLastVideoSyncTime()
    } catch {}

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

    // 2. Fetch all endorsements with a URL or posts
    const endorsements = await prisma.endorsement.findMany({
      where: {
        OR: [
          { postUrl: { not: null } },
          { posts: { some: {} } },
        ],
      },
      include: {
        kol: { select: { name: true } },
        outlet: { select: { name: true } },
        posts: true,
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
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE "internal_contents" SET "last_synced_at" = NOW() WHERE "id" = $1`,
              item.id
            )
          } catch {}
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
      try {
        if (item.posts && item.posts.length > 0) {
          let totalViews = 0
          let totalLikes = 0
          let totalComments = 0
          let totalShares = 0
          let totalSaves = 0
          let anySuccess = false
          let lastPlatform: string | undefined

          for (const p of item.posts) {
            if (!p.postUrl) continue
            try {
              const metrics = await scrapeVideoMetrics(p.postUrl)
              if (metrics.success) {
                anySuccess = true
                lastPlatform = metrics.platform
                const views = metrics.views !== undefined && metrics.views > 0 ? metrics.views : p.views
                const likes = metrics.likes !== undefined && metrics.likes > 0 ? metrics.likes : p.likes
                const comments = metrics.comments !== undefined && metrics.comments > 0 ? metrics.comments : p.comments
                const shares = metrics.shares !== undefined && metrics.shares > 0 ? metrics.shares : p.shares
                const saves = metrics.saves !== undefined && metrics.saves > 0 ? metrics.saves : p.saves

                totalViews += views
                totalLikes += likes
                totalComments += comments
                totalShares += shares
                totalSaves += saves

                await prisma.endorsementPost.update({
                  where: { id: p.id },
                  data: { views, likes, comments, shares, saves, status: 'POSTED' },
                })
              } else {
                totalViews += p.views || 0
                totalLikes += p.likes || 0
                totalComments += p.comments || 0
                totalShares += p.shares || 0
                totalSaves += p.saves || 0
              }
            } catch (pErr) {
              totalViews += p.views || 0
              totalLikes += p.likes || 0
              totalComments += p.comments || 0
              totalShares += p.shares || 0
              totalSaves += p.saves || 0
            }
          }

          if (anySuccess) {
            await prisma.endorsement.update({
              where: { id: item.id },
              data: {
                finalViews: totalViews,
                likes: totalLikes,
                comments: totalComments,
                shares: totalShares,
                saves: totalSaves,
                postStatus: (totalViews > 0 || totalLikes > 0) ? 'ON' : undefined,
              },
            })
            try {
              await prisma.$executeRawUnsafe(
                `UPDATE "endorsements" SET "last_synced_at" = NOW() WHERE "id" = $1`,
                item.id
              )
            } catch {}
            updatedCount++
            details.push({
              type: 'ENDORSEMENT',
              id: item.id.toString(),
              title: `${item.kol.name} (${item.outlet.name})`,
              platform: lastPlatform || 'MULTI',
              status: 'synced',
              views: totalViews,
            })
          } else {
            failedCount++
            details.push({
              type: 'ENDORSEMENT',
              id: item.id.toString(),
              title: `${item.kol.name} (${item.outlet.name})`,
              status: 'failed',
              error: 'Gagal sync video postingan',
            })
          }
        } else if (item.postUrl) {
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
            try {
              await prisma.$executeRawUnsafe(
                `UPDATE "endorsements" SET "last_synced_at" = NOW() WHERE "id" = $1`,
                item.id
              )
            } catch {}
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

    // Record last sync timestamp to persistent settings
    const nowIso = new Date().toISOString()
    await recordLastVideoSyncTime(nowIso)

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
      lastSyncedAt: nowIso,
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

/**
 * Trigger manual untuk sinkronisasi seluruh pengeluaran MARCOM ke OPEX Supabase
 */
export async function triggerSyncHistoricalOpex() {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const res = await syncAllHistoricalMarcomToOpex()
  revalidatePath('/dashboard/budget')
  revalidatePath('/dashboard')
  return res
}
