import type { KontenData, KonteksMarcom } from './tipe'
import { tentukanRentangTanggal } from './konten'

export interface ParameterAnalisisKonten {
  periode?: 'hari_ini' | 'kemarin' | 'minggu_ini' | 'minggu_depan' | 'bulan_ini' | 'custom' | string
  dari?: string
  sampai?: string
  platform?: string
  outlet?: string
  limit_top?: number
}

export interface RingkasanAnalisis {
  total_konten: number
  total_video: number
  total_feed: number
  total_views: number
  total_reach: number
  total_likes: number
  total_comments: number
  total_shares: number
  total_saves: number
  total_engagement: number
  avg_er: number
  avg_ebr: number
}

export interface KontenTopDetail {
  id: string
  title: string
  platform: string
  pillar: string
  contentType: string | null
  outletName: string
  postDate: string
  views: number
  reach: number
  engagement: number
  er: number
  postUrl?: string | null
}

export interface PilarAnalisis {
  pilar: string
  count: number
  views: number
  reach: number
  engagement: number
  er: number
  ebr: number
}

export interface TipeKontenAnalisis {
  tipe: string
  count: number
  views: number
  avg_views: number
  engagement: number
  er: number
}

export interface OrganikVsAdsAnalisis {
  organik: {
    count: number
    views: number
    engagement: number
    er: number
  }
  ads: {
    count: number
    views: number
    engagement: number
    er: number
    budget: number
  }
}

export interface HasilAnalisisKonten {
  ringkasan: RingkasanAnalisis
  top_konten: KontenTopDetail[]
  per_pilar: PilarAnalisis[]
  per_tipe_konten: TipeKontenAnalisis[]
  organik_vs_ads: OrganikVsAdsAnalisis
  meta: {
    sumber: string
    periode: string
    dari: string
    sampai: string
    dihitung_pada: string
  }
}

export async function hitungAnalisisKonten(
  konteks: KonteksMarcom,
  params: ParameterAnalisisKonten = {}
): Promise<HasilAnalisisKonten> {
  const rentang = tentukanRentangTanggal(
    konteks.hariIni,
    params.periode,
    params.dari,
    params.sampai
  )

  const semuaKonten = await konteks.daftarKonten(rentang.dari, rentang.sampai)

  // Filter
  const terfilter = semuaKonten.filter((k) => {
    if (params.platform) {
      if (k.platform.toUpperCase() !== params.platform.toUpperCase()) return false
    }
    if (params.outlet) {
      const outletKecil = params.outlet.toLowerCase()
      if (!k.outletName.toLowerCase().includes(outletKecil)) return false
    }
    return true
  })

  // Per-item calculations sesuai ContentMetricsView
  const processed = terfilter.map((k) => {
    const totalEngagement =
      (k.likes || 0) + (k.comments || 0) + (k.shares || 0) + (k.saves || 0)
    const effectiveReach = (k.reach && k.reach > 0) ? k.reach : (k.views || 0)
    const er =
      k.views > 0
        ? Math.round((totalEngagement / k.views) * 10000) / 100
        : 0
    const ebr =
      effectiveReach > 0
        ? Math.round((totalEngagement / effectiveReach) * 10000) / 100
        : er

    return {
      ...k,
      totalEngagement,
      effectiveReach,
      er,
      ebr,
    }
  })

  // Agregasi Ringkasan
  const total_konten = processed.length
  const total_video = processed.filter((k) => k.format === 'VIDEO').length
  const total_feed = processed.filter((k) => k.format === 'FEED').length
  const total_views = processed.reduce((acc, k) => acc + (k.views || 0), 0)
  const total_reach = processed.reduce((acc, k) => acc + k.effectiveReach, 0)
  const total_likes = processed.reduce((acc, k) => acc + (k.likes || 0), 0)
  const total_comments = processed.reduce((acc, k) => acc + (k.comments || 0), 0)
  const total_shares = processed.reduce((acc, k) => acc + (k.shares || 0), 0)
  const total_saves = processed.reduce((acc, k) => acc + (k.saves || 0), 0)
  const total_engagement =
    total_likes + total_comments + total_shares + total_saves

  const avg_er =
    total_views > 0
      ? Math.round((total_engagement / total_views) * 10000) / 100
      : 0
  const avg_ebr =
    total_reach > 0
      ? Math.round((total_engagement / total_reach) * 10000) / 100
      : avg_er

  const ringkasan: RingkasanAnalisis = {
    total_konten,
    total_video,
    total_feed,
    total_views,
    total_reach,
    total_likes,
    total_comments,
    total_shares,
    total_saves,
    total_engagement,
    avg_er,
    avg_ebr,
  }

  // Top Konten
  const limitTop = params.limit_top || 5
  const top_konten: KontenTopDetail[] = [...processed]
    .sort((a, b) => b.views - a.views)
    .slice(0, limitTop)
    .map((k) => ({
      id: k.id,
      title: k.title,
      platform: k.platform,
      pillar: k.pillar,
      contentType: k.contentType,
      outletName: k.outletName,
      postDate: k.postDate,
      views: k.views,
      reach: k.reach,
      engagement: k.totalEngagement,
      er: k.er,
      postUrl: k.postUrl,
    }))

  // Pillar Stats
  const pilarMap = new Map<
    string,
    { count: number; views: number; reach: number; engagement: number }
  >()
  processed.forEach((k) => {
    const p = k.pillar || 'Lainnya'
    const cur = pilarMap.get(p) || { count: 0, views: 0, reach: 0, engagement: 0 }
    cur.count += 1
    cur.views += k.views
    cur.reach += k.effectiveReach
    cur.engagement += k.totalEngagement
    pilarMap.set(p, cur)
  })

  const per_pilar: PilarAnalisis[] = Array.from(pilarMap.entries())
    .map(([pilar, val]) => {
      const er =
        val.views > 0
          ? Math.round((val.engagement / val.views) * 10000) / 100
          : 0
      const ebr =
        val.reach > 0
          ? Math.round((val.engagement / val.reach) * 10000) / 100
          : er
      return {
        pilar,
        count: val.count,
        views: val.views,
        reach: val.reach,
        engagement: val.engagement,
        er,
        ebr,
      }
    })
    .sort((a, b) => b.views - a.views)

  // Content Type Stats
  const tipeMap = new Map<
    string,
    { count: number; views: number; engagement: number }
  >()
  processed.forEach((k) => {
    const ct = k.contentType || 'Lainnya'
    const cur = tipeMap.get(ct) || { count: 0, views: 0, engagement: 0 }
    cur.count += 1
    cur.views += k.views
    cur.engagement += k.totalEngagement
    tipeMap.set(ct, cur)
  })

  const per_tipe_konten: TipeKontenAnalisis[] = Array.from(tipeMap.entries())
    .map(([tipe, val]) => {
      const avg_views = val.count > 0 ? Math.round(val.views / val.count) : 0
      const er =
        val.views > 0
          ? Math.round((val.engagement / val.views) * 10000) / 100
          : 0
      return {
        tipe,
        count: val.count,
        views: val.views,
        avg_views,
        engagement: val.engagement,
        er,
      }
    })
    .sort((a, b) => b.views - a.views)

  // Organik vs Ads
  const organikList = processed.filter(
    (k) => !k.isAds && (!k.adsBudget || k.adsBudget === 0)
  )
  const adsList = processed.filter(
    (k) => k.isAds || (k.adsBudget && k.adsBudget > 0)
  )

  const organikViews = organikList.reduce((acc, k) => acc + (k.views || 0), 0)
  const organikEngagement = organikList.reduce(
    (acc, k) => acc + k.totalEngagement,
    0
  )
  const organikEr =
    organikViews > 0
      ? Math.round((organikEngagement / organikViews) * 10000) / 100
      : 0

  const adsViews = adsList.reduce((acc, k) => acc + (k.views || 0), 0)
  const adsEngagement = adsList.reduce((acc, k) => acc + k.totalEngagement, 0)
  const adsBudget = adsList.reduce((acc, k) => acc + (k.adsBudget || 0), 0)
  const adsEr =
    adsViews > 0 ? Math.round((adsEngagement / adsViews) * 10000) / 100 : 0

  const organik_vs_ads: OrganikVsAdsAnalisis = {
    organik: {
      count: organikList.length,
      views: organikViews,
      engagement: organikEngagement,
      er: organikEr,
    },
    ads: {
      count: adsList.length,
      views: adsViews,
      engagement: adsEngagement,
      er: adsEr,
      budget: adsBudget,
    },
  }

  return {
    ringkasan,
    top_konten,
    per_pilar,
    per_tipe_konten,
    organik_vs_ads,
    meta: {
      sumber: 'apps/marcom (database marcom_db)',
      periode: rentang.namaPeriode,
      dari: rentang.dari,
      sampai: rentang.sampai,
      dihitung_pada: konteks.sekarang.toISOString(),
    },
  }
}
