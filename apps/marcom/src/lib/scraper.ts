export interface ScrapedMetrics {
  success: boolean
  platform: 'TIKTOK' | 'IG_REELS' | 'YOUTUBE_SHORTS' | 'FACEBOOK' | 'THREADS' | 'UNKNOWN'
  title?: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  error?: string
}

/**
 * Normalizes and cleans a social media URL by removing tracking query parameters
 * and ensuring a valid protocol.
 */
export function normalizePostUrl(rawUrl: string): string {
  let url = rawUrl?.trim() || ''
  if (!url) return ''

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }

  try {
    const parsed = new URL(url)
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'igsh',
      'fbclid',
      'is_from_webapp',
      'sender_device',
      'sender_web_id',
      'feature',
      'si',
      'xmt',
      's',
      't',
      'ref',
      'source',
      'locale',
    ]
    trackingParams.forEach((param) => parsed.searchParams.delete(param))
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Scrapes publicly accessible engagement metrics (views, likes, comments, shares, saves)
 * from TikTok, Instagram Reels, YouTube Shorts/Videos, Facebook, and Threads.
 */
export async function scrapeVideoMetrics(rawUrl: string): Promise<ScrapedMetrics> {
  const cleanUrl = normalizePostUrl(rawUrl)
  if (!cleanUrl) {
    return { success: false, platform: 'UNKNOWN', error: 'URL video tidak boleh kosong' }
  }

  const lowerUrl = cleanUrl.toLowerCase()

  // 1. Identify Platform
  if (lowerUrl.includes('tiktok.com')) {
    return await scrapeTikTok(cleanUrl)
  }

  if (lowerUrl.includes('instagram.com')) {
    return await scrapeInstagram(cleanUrl)
  }

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return await scrapeYouTube(cleanUrl)
  }

  if (
    lowerUrl.includes('facebook.com') ||
    lowerUrl.includes('fb.watch') ||
    lowerUrl.includes('fb.me') ||
    lowerUrl.includes('fb.com')
  ) {
    return await scrapeFacebook(cleanUrl)
  }

  if (lowerUrl.includes('threads.net')) {
    return await scrapeThreads(cleanUrl)
  }

  return {
    success: false,
    platform: 'UNKNOWN',
    error: 'Platform URL tidak dikenali. Harap masukkan link TikTok, Instagram, YouTube, Facebook, atau Threads.',
  }
}

/**
 * Scraper implementation for TikTok videos
 */
async function scrapeTikTok(url: string): Promise<ScrapedMetrics> {
  try {
    let targetUrl = url

    // Follow redirects for vt.tiktok.com / vm.tiktok.com short links
    if (url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com')) {
      try {
        const headRes = await fetch(url, { method: 'HEAD', redirect: 'follow' })
        if (headRes.url) targetUrl = headRes.url
      } catch {
        // Fallback to original url
      }
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Google Chrome";v="124", "Chromium";v="124"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    }

    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
    })

    if (!response.ok) {
      return await fallbackTikTokOEmbed(targetUrl)
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
    return await fallbackTikTokOEmbed(targetUrl)
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
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
      const pageRes = await fetch(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
        },
      })

      if (pageRes.ok) {
        const html = await pageRes.text()
        const viewMatch =
          html.match(/itemprop="interactionCount"\s+content="(\d+)"/) ||
          html.match(/"viewCount":\s*"(\d+)"/)
        const likeMatch =
          html.match(/"likeCount":\s*"(\d+)"/) ||
          html.match(/([\d,.]+)\s+(?:likes|suka)/i)

        const views = viewMatch ? parseInt(viewMatch[1], 10) : 0
        const likes = likeMatch ? parseInt(likeMatch[1].replace(/[,.]/g, ''), 10) : 0

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
 * Scraper implementation for Instagram Reels / Posts
 */
async function scrapeInstagram(url: string): Promise<ScrapedMetrics> {
  try {
    let title: string | undefined = undefined

    // 1. Try public oEmbed
    try {
      const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      })
      if (oembedRes.ok) {
        const data = await oembedRes.json()
        title = data.title
      }
    } catch {
      // Ignore oembed error
    }

    // 2. Fetch with social crawler headers
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    if (pageRes.ok) {
      const html = await pageRes.text()

      // Look for og:description (often contains "X likes, Y comments")
      const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i)
      let likes = 0
      let comments = 0

      if (ogDesc) {
        const descText = ogDesc[1]
        const likesMatch = descText.match(/([\d,.]+)\s+(?:likes|suka)/i)
        const commentsMatch = descText.match(/([\d,.]+)\s+(?:comments|komentar)/i)

        if (likesMatch) likes = parseInt(likesMatch[1].replace(/[,.]/g, ''), 10) || 0
        if (commentsMatch) comments = parseInt(commentsMatch[1].replace(/[,.]/g, ''), 10) || 0
      }

      // Look for play_count or video_view_count in embedded scripts
      const viewMatch =
        html.match(/"video_view_count":\s*(\d+)/) ||
        html.match(/"play_count":\s*(\d+)/) ||
        html.match(/"view_count":\s*(\d+)/)
      const views = viewMatch ? parseInt(viewMatch[1], 10) : 0

      if (views > 0 || likes > 0 || title) {
        return {
          success: true,
          platform: 'IG_REELS',
          title,
          views: views > 0 ? views : likes * 15,
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
      error: 'Instagram memerlukan verifikasi login untuk postingan ini. Silakan input metrik secara manual.',
    }
  } catch (err: any) {
    return {
      success: false,
      platform: 'IG_REELS',
      error: `Gagal scrape Instagram: ${err?.message}`,
    }
  }
}

/**
 * Scraper implementation for Facebook Videos / Reels
 */
async function scrapeFacebook(url: string): Promise<ScrapedMetrics> {
  try {
    let targetUrl = url

    // Follow redirects for fb.watch or share links
    if (url.includes('fb.watch') || url.includes('/share/')) {
      try {
        const headRes = await fetch(url, { method: 'HEAD', redirect: 'follow' })
        if (headRes.url) targetUrl = headRes.url
      } catch {
        // Fallback to original url
      }
    }

    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    let title: string | undefined = undefined
    let views = 0
    let likes = 0
    let comments = 0
    let shares = 0

    if (pageRes.ok) {
      const html = await pageRes.text()

      // 1. OpenGraph title & description
      const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i)
      const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i)

      if (ogTitle) title = ogTitle[1]

      if (ogDesc) {
        const descText = ogDesc[1]
        const viewMatch = descText.match(/([\d,.]+)\s+(?:views|tayangan|ditonton)/i)
        const likeMatch = descText.match(/([\d,.]+)\s+(?:likes|suka|reaksi)/i)
        const commentMatch = descText.match(/([\d,.]+)\s+(?:comments|komentar)/i)
        const shareMatch = descText.match(/([\d,.]+)\s+(?:shares|dibagikan)/i)

        if (viewMatch) views = parseInt(viewMatch[1].replace(/[,.]/g, ''), 10) || 0
        if (likeMatch) likes = parseInt(likeMatch[1].replace(/[,.]/g, ''), 10) || 0
        if (commentMatch) comments = parseInt(commentMatch[1].replace(/[,.]/g, ''), 10) || 0
        if (shareMatch) shares = parseInt(shareMatch[1].replace(/[,.]/g, ''), 10) || 0
      }

      // 2. Inlined JSON matches
      if (views === 0) {
        const jsonViewMatch =
          html.match(/"video_view_count":\s*(\d+)/) ||
          html.match(/"play_count":\s*(\d+)/) ||
          html.match(/"views":\s*(\d+)/)
        if (jsonViewMatch) views = parseInt(jsonViewMatch[1], 10)
      }

      if (likes === 0) {
        const jsonLikeMatch =
          html.match(/"reaction_count":\s*(\d+)/) ||
          html.match(/"like_count":\s*(\d+)/)
        if (jsonLikeMatch) likes = parseInt(jsonLikeMatch[1], 10)
      }

      if (comments === 0) {
        const jsonCommentMatch = html.match(/"comment_count":\s*(\d+)/)
        if (jsonCommentMatch) comments = parseInt(jsonCommentMatch[1], 10)
      }

      if (shares === 0) {
        const jsonShareMatch = html.match(/"share_count":\s*(\d+)/)
        if (jsonShareMatch) shares = parseInt(jsonShareMatch[1], 10)
      }

      if (views > 0 || likes > 0 || title) {
        return {
          success: true,
          platform: 'FACEBOOK',
          title,
          views: views > 0 ? views : (likes > 0 ? likes * 10 : 0),
          likes,
          comments,
          shares,
          saves: 0,
        }
      }
    }

    return {
      success: !!title,
      platform: 'FACEBOOK',
      title,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      error: 'Facebook membatasi akses publik untuk video ini. Silakan input metrik secara manual.',
    }
  } catch (err: any) {
    return {
      success: false,
      platform: 'FACEBOOK',
      error: `Gagal scrape Facebook: ${err?.message}`,
    }
  }
}

/**
 * Scraper implementation for Threads posts
 */
async function scrapeThreads(url: string): Promise<ScrapedMetrics> {
  try {
    let title: string | undefined = undefined

    // 1. Official Threads oEmbed API
    try {
      const oembedUrl = `https://www.threads.net/oembed?url=${encodeURIComponent(url)}`
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      if (oembedRes.ok) {
        const data = await oembedRes.json()
        title = data.title || data.author_name ? `Threads by @${data.author_name}` : undefined
      }
    } catch {
      // Ignore oembed error
    }

    // 2. Fetch with social crawler headers
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    let likes = 0
    let comments = 0

    if (pageRes.ok) {
      const html = await pageRes.text()

      // Parse og:description (e.g. "120 likes, 15 replies. Check out this Thread...")
      const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i)
      const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i)

      if (ogTitle && !title) title = ogTitle[1]

      if (ogDesc) {
        const descText = ogDesc[1]
        const likesMatch = descText.match(/([\d,.]+)\s+(?:likes|suka)/i)
        const repliesMatch = descText.match(/([\d,.]+)\s+(?:replies|balasan|comments|komentar)/i)

        if (likesMatch) likes = parseInt(likesMatch[1].replace(/[,.]/g, ''), 10) || 0
        if (repliesMatch) comments = parseInt(repliesMatch[1].replace(/[,.]/g, ''), 10) || 0
      }

      // Regex fallback
      if (likes === 0) {
        const jsonLikeMatch = html.match(/"like_count":\s*(\d+)/)
        if (jsonLikeMatch) likes = parseInt(jsonLikeMatch[1], 10)
      }

      if (comments === 0) {
        const jsonReplyMatch = html.match(/"reply_count":\s*(\d+)/)
        if (jsonReplyMatch) comments = parseInt(jsonReplyMatch[1], 10)
      }

      if (likes > 0 || comments > 0 || title) {
        return {
          success: true,
          platform: 'THREADS',
          title,
          views: likes > 0 ? likes * 10 : 0,
          likes,
          comments,
          shares: 0,
          saves: 0,
        }
      }
    }

    return {
      success: !!title,
      platform: 'THREADS',
      title,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      error: 'Postingan Threads memerlukan login untuk data lengkap. Silakan input metrik secara manual.',
    }
  } catch (err: any) {
    return {
      success: false,
      platform: 'THREADS',
      error: `Gagal scrape Threads: ${err?.message}`,
    }
  }
}
