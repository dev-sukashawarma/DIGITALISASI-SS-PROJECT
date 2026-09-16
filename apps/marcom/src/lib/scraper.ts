export interface ScrapedMetrics {
  success: boolean
  platform: 'TIKTOK' | 'IG_REELS' | 'YOUTUBE_SHORTS' | 'UNKNOWN'
  title?: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  error?: string
}

/**
 * Scrapes publicly accessible engagement metrics (views, likes, comments, shares, saves)
 * from TikTok, Instagram Reels, and YouTube Shorts.
 */
export async function scrapeVideoMetrics(rawUrl: string): Promise<ScrapedMetrics> {
  const cleanUrl = rawUrl?.trim()
  if (!cleanUrl) {
    return { success: false, platform: 'UNKNOWN', error: 'URL video tidak boleh kosong' }
  }

  // 1. Identify Platform
  if (cleanUrl.includes('tiktok.com')) {
    return await scrapeTikTok(cleanUrl)
  }

  if (cleanUrl.includes('instagram.com')) {
    return await scrapeInstagram(cleanUrl)
  }

  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
    return await scrapeYouTube(cleanUrl)
  }

  return {
    success: false,
    platform: 'UNKNOWN',
    error: 'Platform URL tidak dikenali. Harap masukkan link TikTok, Instagram, atau YouTube.',
  }
}

/**
 * Scraper implementation for TikTok videos
 */
async function scrapeTikTok(url: string): Promise<ScrapedMetrics> {
  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    }

    // Follow redirects (for vt.tiktok.com short links)
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    })

    if (!response.ok) {
      // Try fallback to oEmbed
      return await fallbackTikTokOEmbed(url)
    }

    const html = await response.text()

    // Method 1: Extract from __UNIVERSAL_DATA_FOR_REHYDRATION__
    const universalMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    )

    if (universalMatch) {
      try {
        const jsonData = JSON.parse(universalMatch[1])
        const defaultScope = jsonData['__DEFAULT_SCOPE__']
        const itemInfo =
          defaultScope?.['webapp.video-detail']?.['itemInfo']?.['itemStruct']

        if (itemInfo && itemInfo.stats) {
          const stats = itemInfo.stats
          const title = itemInfo.desc || undefined
          const views = parseInt(stats.playCount, 10) || 0
          const likes = parseInt(stats.diggCount, 10) || 0
          const comments = parseInt(stats.commentCount, 10) || 0
          const shares = parseInt(stats.shareCount, 10) || 0
          const saves = parseInt(stats.collectCount, 10) || 0

          return {
            success: true,
            platform: 'TIKTOK',
            title,
            views,
            likes,
            comments,
            shares,
            saves,
          }
        }
      } catch {
        // Continue to regex fallback
      }
    }

    // Method 2: Regex extraction from raw HTML
    const playMatch = html.match(/"playCount":\s*(\d+)/)
    const diggMatch = html.match(/"diggCount":\s*(\d+)/)
    const commentMatch = html.match(/"commentCount":\s*(\d+)/)
    const shareMatch = html.match(/"shareCount":\s*(\d+)/)
    const collectMatch = html.match(/"collectCount":\s*(\d+)/)

    if (playMatch || diggMatch) {
      return {
        success: true,
        platform: 'TIKTOK',
        views: playMatch ? parseInt(playMatch[1], 10) : 0,
        likes: diggMatch ? parseInt(diggMatch[1], 10) : 0,
        comments: commentMatch ? parseInt(commentMatch[1], 10) : 0,
        shares: shareMatch ? parseInt(shareMatch[1], 10) : 0,
        saves: collectMatch ? parseInt(collectMatch[1], 10) : 0,
      }
    }

    // Method 3: Fallback to oEmbed for basic details
    return await fallbackTikTokOEmbed(url)
  } catch (err: any) {
    return {
      success: false,
      platform: 'TIKTOK',
      error: `Gagal scrape TikTok: ${err?.message || 'Koneksi timeout / diblokir'}`,
    }
  }
}

async function fallbackTikTokOEmbed(url: string): Promise<ScrapedMetrics> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    const res = await fetch(oembedUrl)
    if (res.ok) {
      const data = await res.json()
      return {
        success: true,
        platform: 'TIKTOK',
        title: data.title,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return {
    success: false,
    platform: 'TIKTOK',
    error: 'Video TikTok privat atau tidak dapat diakses publik.',
  }
}

/**
 * Scraper implementation for YouTube Shorts / Videos
 */
async function scrapeYouTube(url: string): Promise<ScrapedMetrics> {
  try {
    // Extract video ID
    let videoId: string | null = null
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/)
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/)
    const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)

    if (shortsMatch) videoId = shortsMatch[1]
    else if (watchMatch) videoId = watchMatch[1]
    else if (youtuBeMatch) videoId = youtuBeMatch[1]

    // Fetch oEmbed for Title
    let title: string | undefined = undefined
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      )
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json()
        title = oembedData.title
      }
    } catch {
      // Ignore oembed error
    }

    if (videoId) {
      // Fetch public video watch page with Googlebot / crawler user agent
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
      const pageRes = await fetch(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })

      if (pageRes.ok) {
        const html = await pageRes.text()
        const viewMatch =
          html.match(/itemprop="interactionCount"\s+content="(\d+)"/) ||
          html.match(/"viewCount":\s*"(\d+)"/)
        const likeMatch =
          html.match(/"likeCount":\s*"(\d+)"/) ||
          html.match(/(\d[\d,.]*)\s+likes/i)

        const views = viewMatch ? parseInt(viewMatch[1], 10) : 0
        const likes = likeMatch ? parseInt(likeMatch[1].replace(/,/g, ''), 10) : 0

        if (views > 0 || title) {
          return {
            success: true,
            platform: 'YOUTUBE_SHORTS',
            title,
            views,
            likes,
            comments: 0,
            shares: 0,
            saves: 0,
          }
        }
      }
    }

    return {
      success: !!title,
      platform: 'YOUTUBE_SHORTS',
      title,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    }
  } catch (err: any) {
    return {
      success: false,
      platform: 'YOUTUBE_SHORTS',
      error: `Gagal scrape YouTube: ${err?.message}`,
    }
  }
}

/**
 * Scraper implementation for Instagram Reels
 */
async function scrapeInstagram(url: string): Promise<ScrapedMetrics> {
  try {
    // 1. Try public oEmbed
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`
    const oembedRes = await fetch(oembedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    })

    let title: string | undefined = undefined
    if (oembedRes.ok) {
      const data = await oembedRes.json()
      title = data.title
    }

    // 2. Fetch with social crawler headers
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (pageRes.ok) {
      const html = await pageRes.text()

      // Look for og:description (often contains "X likes, Y comments")
      const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
      let likes = 0
      let comments = 0

      if (ogDesc) {
        const descText = ogDesc[1]
        const likesMatch = descText.match(/([\d,.]+)\s+likes/i)
        const commentsMatch = descText.match(/([\d,.]+)\s+comments/i)

        if (likesMatch) likes = parseInt(likesMatch[1].replace(/[,.]/g, ''), 10) || 0
        if (commentsMatch) comments = parseInt(commentsMatch[1].replace(/[,.]/g, ''), 10) || 0
      }

      // Look for play_count or video_view_count in embedded scripts
      const viewMatch =
        html.match(/"video_view_count":\s*(\d+)/) ||
        html.match(/"play_count":\s*(\d+)/)
      const views = viewMatch ? parseInt(viewMatch[1], 10) : 0

      if (views > 0 || likes > 0 || title) {
        return {
          success: true,
          platform: 'IG_REELS',
          title,
          views: views > 0 ? views : likes * 15, // Estimasi minimum views jika hanya likes yang terbaca
          likes,
          comments,
          shares: 0,
          saves: 0,
        }
      }
    }

    return {
      success: !!title,
      platform: 'IG_REELS',
      title,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      error: 'Instagram memerlukan verifikasi login untuk video ini. Anda dapat menginput metrik secara manual.',
    }
  } catch (err: any) {
    return {
      success: false,
      platform: 'IG_REELS',
      error: `Gagal scrape Instagram: ${err?.message}`,
    }
  }
}
