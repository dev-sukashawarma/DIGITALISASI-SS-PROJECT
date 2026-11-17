'use server'

import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { getServiceSupabase } from '@/lib/supabase-service'

export interface TikTokSettlementSummary {
  outletId: string
  omzetKotor: number
  promoMerchant: number
  commission: number
  totalSettlement: number
}

export interface PlatformSettlementAggregate {
  promoMerchant: number
  commission: number
  omzetKotor: number
}

export interface AllPlatformSettlementsResult {
  tiktokSummaries: Record<string, TikTokSettlementSummary>
  byOutletPlatform: Record<string, PlatformSettlementAggregate>
}

export async function getAllPlatformSettlementSummaries(
  from: string,
  to: string
): Promise<{ success: boolean; data?: AllPlatformSettlementsResult; error?: string }> {
  try {
    await requireRole(PERAN_KEUANGAN)
    const supabase = getServiceSupabase()

    const PAGE_SIZE = 1000
    const allRows: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('platform_settlements')
        .select('outlet_id, platform, omzet_kotor, promo_merchant, commission')
        .gte('tanggal', from)
        .lte('tanggal', to)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw error
      const page = data ?? []
      allRows.push(...page)
      if (page.length < PAGE_SIZE) break
    }

    const tiktokSummaries: Record<string, TikTokSettlementSummary> = {}
    const byOutletPlatform: Record<string, PlatformSettlementAggregate> = {}

    for (const row of allRows) {
      const oId = row.outlet_id
      if (!oId) continue
      const plat = (row.platform || '').toLowerCase()
      const omzet = Number(row.omzet_kotor) || 0
      const promo = Number(row.promo_merchant) || 0
      const comm = Number(row.commission) || 0

      const key = `${oId}|${plat}`
      if (!byOutletPlatform[key]) {
        byOutletPlatform[key] = { promoMerchant: 0, commission: 0, omzetKotor: 0 }
      }
      byOutletPlatform[key].omzetKotor += omzet
      byOutletPlatform[key].promoMerchant += promo
      byOutletPlatform[key].commission += comm

      if (plat === 'tiktokgo' || plat === 'tiktok' || plat === 'tiktok_go') {
        if (!tiktokSummaries[oId]) {
          tiktokSummaries[oId] = {
            outletId: oId,
            omzetKotor: 0,
            promoMerchant: 0,
            commission: 0,
            totalSettlement: 0,
          }
        }
        tiktokSummaries[oId].omzetKotor += omzet
        tiktokSummaries[oId].promoMerchant += promo
        tiktokSummaries[oId].commission += comm
        tiktokSummaries[oId].totalSettlement += omzet - promo - comm
      }
    }

    return {
      success: true,
      data: {
        tiktokSummaries,
        byOutletPlatform,
      },
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memuat ringkasan settlement platform' }
  }
}

export async function getTikTokSettlementSummaries(
  from: string,
  to: string
): Promise<{ success: boolean; data?: Record<string, TikTokSettlementSummary>; error?: string }> {
  const res = await getAllPlatformSettlementSummaries(from, to)
  if (!res.success || !res.data) {
    return { success: false, error: res.error }
  }
  return { success: true, data: res.data.tiktokSummaries }
}
