import type { PrismaClient } from '@prisma/client'
import { getPosSupabase } from '@/lib/supabase-pos'
import type {
  AdData,
  AnalisisVideoData,
  IklanData,
  KolData,
  MenuData,
  PengeluaranData,
  PromoMenuData,
  TargetOutletData,
  TipeKontenData,
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

function rentangTanggal(dari: string, sampai: string) {
  return {
    gte: new Date(`${dari}T00:00:00.000Z`),
    lte: new Date(`${sampai}T23:59:59.999Z`),
  }
}

function teksDaftar(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : []
}

function adaIsi(v: string | null | undefined): boolean {
  return !!v && v.trim().length > 0
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

    async daftarKol(): Promise<KolData[]> {
      const records = await prismaClient.kol.findMany({
        include: {
          endorsements: {
            where: { outlet: filterOutletBukanTes },
            include: { outlet: true, posts: true },
          },
        },
        orderBy: { name: 'asc' },
      })
      return records.map((k) => {
        const ends = k.endorsements
        const tanggal = ends.map((e) => konversiTanggalWIB(e.scheduleDate)).sort()
        return {
          id: k.id.toString(),
          nama: k.name,
          akun: {
            tiktok: k.tiktokUrl || null,
            instagram: k.instagramUrl || null,
            youtube: k.youtubeUrl || null,
            facebook: k.facebookUrl || null,
            threads: k.threadsUrl || null,
          },
          // Nomor HP & rekening sengaja tidak dibawa ke bot, hanya penandanya.
          punya_kontak: adaIsi(k.phoneNumber),
          punya_rekening: adaIsi(k.bankAccount),
          endorsement: {
            total: ends.length,
            sudah_posting: ends.filter((e) => e.postStatus === 'POSTED').length,
            total_rate_card: ends.reduce((s, e) => s + Number(e.rateCard || 0), 0),
            total_views: ends.reduce(
              (s, e) =>
                s + (e.finalViews || e.initialViews || e.posts.reduce((a, p) => a + (p.views || 0), 0)),
              0
            ),
            terakhir: tanggal.length ? tanggal[tanggal.length - 1] : null,
            outlet: Array.from(new Set(ends.map((e) => e.outlet.name))),
          },
        }
      })
    },

    async daftarPengeluaran(dari: string, sampai: string): Promise<PengeluaranData[]> {
      const records = await prismaClient.marcomExpense.findMany({
        where: {
          expenseDate: rentangTanggal(dari, sampai),
          OR: [{ outletId: null }, { outlet: filterOutletBukanTes }],
        },
        include: { outlet: true },
        orderBy: { expenseDate: 'desc' },
      })
      return records.map((e) => ({
        id: e.id.toString(),
        outlet_nama: e.outlet?.name || 'Pusat (Brand)',
        kategori: e.category,
        jumlah: Number(e.amount || 0),
        keterangan: e.description,
        tanggal: konversiTanggalWIB(e.expenseDate),
        sumber_dana: e.paymentSource,
        ada_kuitansi: adaIsi(e.receiptUrl),
      }))
    },

    async daftarIklan(dari: string, sampai: string): Promise<IklanData[]> {
      const records = await prismaClient.ad.findMany({
        where: {
          scheduleDate: rentangTanggal(dari, sampai),
          OR: [{ outletId: null }, { outlet: filterOutletBukanTes }],
        },
        include: { outlet: true },
        orderBy: { scheduleDate: 'desc' },
      })
      return records.map((a) => ({
        id: a.id.toString(),
        kategori: a.category,
        platform: a.platform,
        akun: a.accountName || null,
        outlet_nama: a.outlet?.name || 'Pusat (Brand)',
        tanggal: konversiTanggalWIB(a.scheduleDate),
        budget: Number(a.budget || 0),
        spent: Number(a.spent || 0),
        views_awal: a.initialViews ?? null,
        views_akhir: a.finalViews ?? null,
        status: a.status,
        ad_url: a.adUrl || null,
      }))
    },

    async daftarAnalisisVideo(): Promise<AnalisisVideoData[]> {
      const records = await prismaClient.videoAnalysis.findMany({
        include: { internalContent: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
      return records.map((v) => ({
        id: v.id.toString(),
        judul: v.title,
        sumber_video: v.videoSource,
        // Berkas unggahan (FILE) tidak dibagikan tautannya.
        video_url: v.videoSource === 'FILE' ? null : v.videoUrl || null,
        konten_terkait: v.internalContent?.title || null,
        skor_total: v.overallScore,
        verdict: v.verdict,
        skor: {
          hook: v.hookScore,
          food_appeal: v.foodAppealScore,
          audio: v.audioScore,
          pacing: v.pacingScore,
          cta: v.ctaScore,
        },
        kelebihan: teksDaftar(v.pros),
        kekurangan: teksDaftar(v.cons),
        saran: teksDaftar(v.improvements),
        catatan: v.notes || null,
        dibuat: konversiTanggalWIB(v.createdAt),
      }))
    },

    async daftarTargetOutlet(bulan: number, tahun: number): Promise<TargetOutletData[]> {
      const records = await prismaClient.outletBudget.findMany({
        where: { periodMonth: bulan, periodYear: tahun, outlet: filterOutletBukanTes },
        include: { outlet: true },
        orderBy: { outlet: { name: 'asc' } },
      })
      return records.map((b) => ({
        outlet_nama: b.outlet.name,
        bulan: b.periodMonth,
        tahun: b.periodYear,
        target_budget: Number(b.targetBudget || 0),
        target_kol: b.targetKolCount,
        catatan: b.notes || null,
      }))
    },

    async daftarTipeKonten(): Promise<TipeKontenData[]> {
      const [tipe, hitung] = await Promise.all([
        prismaClient.contentType.findMany({ orderBy: { name: 'asc' } }),
        prismaClient.internalContent.groupBy({ by: ['contentType'], _count: { _all: true } }),
      ])
      const peta = new Map(hitung.map((h) => [h.contentType || '', h._count._all]))
      return tipe.map((t) => ({ nama: t.name, jumlah_konten: peta.get(t.name) || 0 }))
    },

    async daftarMenu(): Promise<{ menu: MenuData[]; promo: PromoMenuData[] }> {
      // Kolom dipilih eksplisit: HPP & data penjualan tidak ikut dibaca.
      const supabase = getPosSupabase()
      const [menuRes, katRes, outletRes] = await Promise.all([
        supabase
          .from('menu_items')
          .select(
            'id, name, description, price, strike_price, channel_prices, campaign_price, is_campaign_active, is_available, is_available_online, tampil_di_app, is_package, category_id'
          )
          .order('sort_order'),
        supabase.from('categories').select('id, name'),
        supabase.from('outlets').select('id, name, type').eq('is_active', true),
      ])
      if (menuRes.error) throw new Error(`Gagal membaca menu POS: ${menuRes.error.message}`)
      const kategori = new Map((katRes.data || []).map((c: any) => [c.id, c.name as string]))
      const outletAktif = (outletRes.data || []).filter((o: any) => o.type !== 'test')
      const namaOutlet = new Map(outletAktif.map((o: any) => [o.id, o.name as string]))
      const items = menuRes.data || []
      const namaMenu = new Map(items.map((m: any) => [m.id, m.name as string]))

      let promo: PromoMenuData[] = []
      if (outletAktif.length > 0) {
        const promoRes = await supabase
          .from('outlet_promos')
          .select('scope, menu_item_id, outlet_id, start_date, end_date, daily_start_time, daily_end_time')
          .eq('is_active', true)
          .in(
            'outlet_id',
            outletAktif.map((o: any) => o.id)
          )
        promo = (promoRes.data || []).map((p: any) => ({
          cakupan: p.scope,
          menu_nama: p.menu_item_id ? namaMenu.get(p.menu_item_id) || null : null,
          outlet_nama: namaOutlet.get(p.outlet_id) || '-',
          mulai: p.start_date || null,
          selesai: p.end_date || null,
          jam_mulai: p.daily_start_time || null,
          jam_selesai: p.daily_end_time || null,
        }))
      }

      const menu: MenuData[] = items.map((m: any) => {
        const harga_kanal: Record<string, number> = {}
        for (const [k, v] of Object.entries(m.channel_prices || {})) {
          const n = Number(v)
          if (Number.isFinite(n) && n > 0) harga_kanal[k] = n
        }
        return {
          id: String(m.id),
          nama: m.name,
          kategori: kategori.get(m.category_id) || 'Menu Lainnya',
          deskripsi: m.description || null,
          harga: Number(m.price) || 0,
          harga_coret: m.strike_price ? Number(m.strike_price) : null,
          harga_kanal,
          harga_kampanye: m.campaign_price ? Number(m.campaign_price) : null,
          kampanye_aktif: !!m.is_campaign_active,
          tersedia: !!m.is_available,
          tersedia_online: !!m.is_available_online,
          tampil_di_app: !!m.tampil_di_app,
          paket: !!m.is_package,
        }
      })
      return { menu, promo }
    },
  }
}
