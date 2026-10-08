import type { PrismaClient } from '@prisma/client'
import type {
  AdData,
  BudgetData,
  EndorsementData,
  KonteksMarcom,
  KontenData,
  PromoData,
} from '../marcom/tipe'

export const filterOutletBukanTes = {
  NOT: {
    OR: [
      { posType: { in: ['test', 'system'] } },
      { name: { contains: 'tes', mode: 'insensitive' as const } },
    ],
  },
}

function konversiTanggalWIB(d: Date): string {
  // Asia/Jakarta adalah UTC+7
  const wibTime = new Date(d.getTime() + 7 * 3600 * 1000)
  return wibTime.toISOString().split('T')[0]
}

export function buatKonteksMarcomPrisma(
  prismaClient: PrismaClient,
  sekarang: Date = new Date()
): KonteksMarcom {
  const hariIni = konversiTanggalWIB(sekarang)

  return {
    sekarang,
    hariIni,

    async daftarEndorsement(): Promise<EndorsementData[]> {
      const records = await prismaClient.endorsement.findMany({
        where: {
          outlet: filterOutletBukanTes,
        },
        include: {
          kol: true,
          outlet: true,
          posts: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { scheduleDate: 'desc' },
      })

      return records.map((e) => {
        const postsViews = e.posts.reduce((acc, p) => acc + (p.views || 0), 0)
        const postsLikes = e.posts.reduce((acc, p) => acc + (p.likes || 0), 0)

        return {
          id: e.id.toString(),
          kol_nama: e.kol.name,
          outlet_nama: e.outlet.name,
          schedule_date: konversiTanggalWIB(e.scheduleDate),
          visit_status: e.visitStatus,
          draft_status: e.draftStatus,
          post_status: e.postStatus,
          payment_status: e.paymentStatus,
          rate_card: Number(e.rateCard || 0),
          tipe: e.type,
          post_url: e.postUrl || e.posts[0]?.postUrl || null,
          views: e.finalViews || e.initialViews || postsViews,
          likes: e.likes || postsLikes,
        }
      })
    },

    async daftarKonten(dari?: string, sampai?: string): Promise<KontenData[]> {
      const where: any = {
        OR: [
          { outletId: null },
          { outlet: filterOutletBukanTes },
        ],
      }

      if (dari || sampai) {
        where.postDate = {}
        if (dari) {
          where.postDate.gte = new Date(`${dari}T00:00:00.000Z`)
        }
        if (sampai) {
          where.postDate.lte = new Date(`${sampai}T23:59:59.999Z`)
        }
      }

      const records = await prismaClient.internalContent.findMany({
        where,
        include: {
          outlet: true,
        },
        orderBy: [{ postDate: 'asc' }, { postTime: 'asc' }],
      })

      return records.map((c) => ({
        id: c.id.toString(),
        title: c.title,
        platform: c.platform,
        pillar: c.pillar,
        contentType: c.contentType,
        format: c.format,
        status: c.status,
        isAds: c.isAds,
        adsBudget: Number(c.adsBudget || 0),
        creator: c.creator,
        outletName: c.outlet?.name || 'Semua Outlet (Pusat)',
        postDate: konversiTanggalWIB(c.postDate),
        postTime: c.postTime,
        reach: c.reach || 0,
        views: c.views || 0,
        likes: c.likes || 0,
        comments: c.comments || 0,
        shares: c.shares || 0,
        saves: c.saves || 0,
        postUrl: c.postUrl,
      }))
    },

    async daftarBudget(bulan: number, tahun: number): Promise<BudgetData[]> {
      const startDate = new Date(Date.UTC(tahun, bulan - 1, 1))
      const endDate = new Date(Date.UTC(tahun, bulan, 0, 23, 59, 59))

      const outlets = await prismaClient.outlet.findMany({
        where: {
          AND: [
            filterOutletBukanTes,
            {
              OR: [
                { isActive: true },
                {
                  budgets: {
                    some: {
                      periodMonth: bulan,
                      periodYear: tahun,
                    },
                  },
                },
                {
                  endorsements: {
                    some: {
                      scheduleDate: {
                        gte: startDate,
                        lte: endDate,
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        include: {
          budgets: {
            where: {
              periodMonth: bulan,
              periodYear: tahun,
            },
          },
          endorsements: {
            where: {
              type: 'VISIT',
              scheduleDate: {
                gte: startDate,
                lte: endDate,
              },
            },
            select: {
              rateCard: true,
              hppMenu: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      return outlets.map((ot) => {
        const budgetRecord = ot.budgets[0]
        const target_budget = budgetRecord ? Number(budgetRecord.targetBudget) : 0
        const target_kol_count = budgetRecord ? budgetRecord.targetKolCount : 0

        let spent = 0
        for (const end of ot.endorsements) {
          spent += Number(end.rateCard || 0) + Number(end.hppMenu || 0)
        }

        return {
          outlet_nama: ot.name,
          period_month: bulan,
          period_year: tahun,
          target_budget,
          target_kol_count,
          spent,
          kol_count: ot.endorsements.length,
        }
      })
    },

    async daftarAds(): Promise<AdData[]> {
      const records = await prismaClient.ad.findMany({
        where: {
          OR: [
            { outletId: null },
            { outlet: filterOutletBukanTes },
          ],
        },
        include: {
          outlet: true,
        },
        orderBy: { scheduleDate: 'desc' },
      })

      return records.map((a) => ({
        id: a.id.toString(),
        platform: a.platform,
        outlet_nama: a.outlet?.name || 'Pusat (Brand)',
        budget: Number(a.budget || 0),
        spent: Number(a.spent || 0),
        status: a.status,
        schedule_date: konversiTanggalWIB(a.scheduleDate),
      }))
    },

    async daftarPromo(tanggal?: string): Promise<PromoData[]> {
      const records = await prismaClient.promoEvent.findMany({
        where: {
          OR: [
            { outletId: null },
            { outlet: filterOutletBukanTes },
          ],
        },
        include: {
          outlet: true,
        },
        orderBy: { startDate: 'asc' },
      })

      const data: PromoData[] = records.map((p) => ({
        id: p.id.toString(),
        title: p.title,
        description: p.description,
        outlet_nama: p.outlet?.name || 'Semua Outlet',
        start_date: konversiTanggalWIB(p.startDate),
        end_date: konversiTanggalWIB(p.endDate),
        type: p.type,
      }))

      if (tanggal) {
        return data.filter(
          (p) => p.start_date <= tanggal && p.end_date >= tanggal
        )
      }

      return data
    },
  }
}
