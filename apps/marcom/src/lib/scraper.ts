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
  warning?: string
  isEstimatedViews?: boolean
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
    const lowerHost = parsed.hostname.toLowerCase()

    // Special clean handling for TikTok URLs
    if (lowerHost.includes('tiktok.com')) {
      const videoMatch = parsed.pathname.match(/\/video\/(\d+)/)
      if (videoMatch) {
        const userMatch = parsed.pathname.match(/@([a-zA-Z0-9_.-]+)/)
        if (userMatch) {
          return `https://www.tiktok.com/@${userMatch[1]}/video/${videoMatch[1]}`
        }
        return `https://www.tiktok.com/video/${videoMatch[1]}`
      }
      if (lowerHost.includes('vt.tiktok.com') || lowerHost.includes('vm.tiktok.com')) {
        parsed.search = ''
        return parsed.toString().replace(/\/$/, '')
      }
    }

    // Special clean handling for Instagram URLs
    if (lowerHost.includes('instagram.com')) {
      const igMatch = parsed.pathname.match(/\/(reel|p|tv|share\/reel|share\/p)\/([a-zA-Z0-9_-]+)/i)
      if (igMatch) {
        const type = igMatch[1].replace('share/', '')
        return `https://www.instagram.com/${type}/${igMatch[2]}/`
      }
    }

    const trackingParams = [
      'srtk',
      'stkn',
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
        const headRes = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        })
        if (headRes.url && !headRes.url.includes('vt.tiktok.com') && !headRes.url.includes('vm.tiktok.com')) {
          targetUrl = normalizePostUrl(headRes.url)
        }
      } catch {
        // Fallback to original url
      }
    }

    // Tier 1: Query TikWM API (Supports full URLs, short URLs, and video IDs)
    const tikwmEndpoints = [
      `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`,
      `https://tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`,
    ]

    // If targetUrl differs from original url, also try original url as backup
    if (targetUrl !== url) {
      tikwmEndpoints.push(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`)
    }

    for (const endpoint of tikwmEndpoints) {
      let attempts = 0
      while (attempts < 2) {
        attempts++
        try {
          const res = await fetch(endpoint, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MARCOM/1.0)',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(10000),
          })

          if (!res.ok) {
            break
          }

          const data = await res.json()

          // Handle successful response
          if (data.code === 0 && data.data) {
            const item = data.data
            return {
              success: true,
              platform: 'TIKTOK',
              title: item.title || undefined,
              views: typeof item.play_count === 'number' ? item.play_count : 0,
              likes: typeof item.digg_count === 'number' ? item.digg_count : 0,
              comments: typeof item.comment_count === 'number' ? item.comment_count : 0,
              shares: typeof item.share_count === 'number' ? item.share_count : 0,
              saves: typeof item.collect_count === 'number' ? item.collect_count : 0,
            }
          }

          // Rate limit hit: wait 1.3s and retry once
          if (data.code === -1 && typeof data.msg === 'string' && data.msg.includes('Free Api Limit')) {
            await new Promise((resolve) => setTimeout(resolve, 1300))
            continue
          }

          break
        } catch {
          break
        }
      }
    }

    // Tier 2: Check oEmbed if video exists to return title or meaningful status
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
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = await res.json()
      return {
        success: false,
        platform: 'TIKTOK',
        title: data.title,
        error: 'Video ditemukan, namun metrik tayangan dibatasi oleh TikTok. Silakan input manual.',
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return {
    success: false,
    platform: 'TIKTOK',
    error: 'Video TikTok privat, dihapus, atau link tidak valid.',
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
    let cleanUrl = url
    try {
      const parsed = new URL(url)
      const match = parsed.pathname.match(/\/(reel|p|tv|share\/reel|share\/p)\/([a-zA-Z0-9_-]+)/i)
      if (match) {
        const type = match[1].replace('share/', '')
        cleanUrl = `https://www.instagram.com/${type}/${match[2]}/`
      }
    } catch {
      // ignore
    }

    let title: string | undefined = undefined

    // 1. Try public oEmbed
    try {
      const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(cleanUrl)}`
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      })
      if (oembedRes.ok) {
        const text = await oembedRes.text()
        if (text.startsWith('{')) {
          const data = JSON.parse(text)
          if (data.title) title = data.title
        }
      }
    } catch {
      // Ignore oembed error
    }

    // 2. Fetch with social crawler headers
    const pageRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    if (pageRes.ok) {
      const html = await pageRes.text()

      // Look for og:title / twitter:title / caption
      if (!title) {
        const ogTitle = html.match(/<meta\s+(?:property|name)=["'](?:og|twitter):title["']\s+content=["']([^"']+)["']/i)
        if (ogTitle) title = ogTitle[1]
      }
      if (!title) {
        const captionMatch = html.match(/"caption":\s*\{[^}]*"text":\s*"([^"]+)"/)
        if (captionMatch) title = captionMatch[1].slice(0, 150)
      }

      // Look for og:description (often contains "X likes, Y comments")
      const ogDesc = html.match(/<meta\s+(?:property|name)=["'](?:og|twitter):description["']\s+content=["']([^"']+)["']/i)
      let likes = 0
      let comments = 0

      if (ogDesc) {
        const descText = ogDesc[1]
        const likesMatch = descText.match(/([\d,.]+)\s+(?:likes|suka)/i)
        const commentsMatch = descText.match(/([\d,.]+)\s+(?:comments|komentar)/i)

        if (likesMatch) likes = parseInt(likesMatch[1].replace(/[,.]/g, ''), 10) || 0
        if (commentsMatch) comments = parseInt(commentsMatch[1].replace(/[,.]/g, ''), 10) || 0
      }

      // Look for like_count or edge_media_preview_like in embedded scripts
      if (likes === 0) {
        const likeMatch =
          html.match(/"like_count":\s*(\d+)/) ||
          html.match(/"edge_media_preview_like":\s*\{\s*"count":\s*(\d+)/)
        if (likeMatch) likes = parseInt(likeMatch[1], 10) || 0
      }

      // Look for comment_count or edge_media_to_comment in embedded scripts
      if (comments === 0) {
        const commentMatch =
          html.match(/"comment_count":\s*(\d+)/) ||
          html.match(/"edge_media_to_comment":\s*\{\s*"count":\s*(\d+)/)
        if (commentMatch) comments = parseInt(commentMatch[1], 10) || 0
      }

      // Look for play_count or video_view_count in embedded scripts
      const viewMatch =
        html.match(/"video_view_count":\s*(\d+)/) ||
        html.match(/"play_count":\s*(\d+)/) ||
        html.match(/"view_count":\s*(\d+)/) ||
        html.match(/"ig_play_count":\s*(\d+)/) ||
        html.match(/"fb_play_count":\s*(\d+)/)
      const views = viewMatch ? parseInt(viewMatch[1], 10) : 0

      const countsDisabled = html.includes('"like_and_view_counts_disabled":true')

      if (views > 0 || likes > 0 || comments > 0 || title) {
        const finalViews = views > 0 ? views : (likes > 0 ? likes * 15 : 0)
        const isEstimatedViews = views === 0 && likes > 0
        let warning: string | undefined = undefined

        if (countsDisabled) {
          warning = `⚠️ Akun KOL menyembunyikan tayangan di Instagram. Like (${likes}) & Komentar (${comments}) berhasil ditarik.${isEstimatedViews ? ' Views diestimasi ~' + finalViews.toLocaleString('id-ID') + ' (silakan sesuaikan jika ada data insight).' : ''}`
        }

        return {
          success: true,
          platform: 'IG_REELS',
          title,
          views: finalViews,
          likes,
          comments,
          shares: 0,
          saves: 0,
          warning,
          isEstimatedViews,
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
      error: 'Instagram memerlukan verifikasi login untuk postingan ini atau postingan bersifat privat. Silakan input metrik secara manual.',
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
