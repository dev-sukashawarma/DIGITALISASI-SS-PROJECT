import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import {
  Store,
  Users,
  Video,
  Megaphone,
  ArrowRight,
  PlusCircle,
  TrendingUp,
  Sparkles,
  Calendar,
  Flame,
  CreditCard,
  Eye,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  const [outletCount, kolCount, endorsementCount, adCount] = await Promise.all([
    prisma.outlet.count(),
    prisma.kol.count(),
    prisma.endorsement.count(),
    prisma.ad.count(),
  ])

  // Aggregate total views and spend
  const [endorsements, ads] = await Promise.all([
    prisma.endorsement.findMany({
      select: { rateCard: true, initialViews: true, finalViews: true },
    }),
    prisma.ad.findMany({
      select: { budget: true, initialViews: true, finalViews: true },
    }),
  ])

  const totalEndorseSpend = endorsements.reduce((sum, e) => sum + Number(e.rateCard), 0)
  const totalAdsSpend = ads.reduce((sum, a) => sum + Number(a.budget), 0)
  const totalCombinedBudget = totalEndorseSpend + totalAdsSpend

  const totalViews =
    endorsements.reduce((sum, e) => sum + (e.finalViews || e.initialViews || 0), 0) +
    ads.reduce((sum, a) => sum + (a.finalViews || a.initialViews || 0), 0)

  // Get recent 5 endorsements
  const recentEndorsements = await prisma.endorsement.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      outlet: true,
      kol: true,
    },
  })

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 fill-[#D9480F]" />
            <span>Operations Desk · Suka Shawarma</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Dashboard Marketing & Promosi
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-[#EFE8DE] text-xs font-semibold text-stone-700 shadow-2xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database: PostgreSQL Active</span>
          </div>
        </div>
      </div>

      {/* Asymmetric Bento Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        {/* Bento Hero Card (Span 7) */}
        <div className="lg:col-span-7 bg-gradient-to-br from-[#1C1917] via-[#292524] to-[#1C1917] rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden flex flex-col justify-between border border-stone-800">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-semibold backdrop-blur-xs border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Role Akses: {user?.role || 'MARCOM'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-snug">
              Halo, {user?.name || user?.email?.split('@')[0]}!
            </h2>
            <p className="text-sm text-stone-300 max-w-xl leading-relaxed">
              Monitoring jadwal visit KOL, status tayang konten TikTok & IG, efisiensi ads mitra, dan utilisasi budget promosi di 18 cabang Suka Shawarma.
            </p>
          </div>

          <div className="relative z-10 pt-6 mt-4 border-t border-stone-800/80 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-[11px] text-stone-400 uppercase font-semibold tracking-wider block">
                Total Alokasi
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-amber-200">
                {formatRupiah(totalCombinedBudget)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-stone-400 uppercase font-semibold tracking-wider block">
                Total Views Didapat
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-white">
                {totalViews.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] text-stone-400 uppercase font-semibold tracking-wider block">
                Jangkauan Cabang
              </span>
              <span className="text-base sm:text-lg font-bold text-white">
                {outletCount} Lokasi Aktif
              </span>
            </div>
          </div>

          {/* Decorative Warm Glow */}
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#D9480F]/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Bento Stat 1: Outlets (Span 5) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-[#EFE8DE] shadow-xs flex flex-col justify-between hover:border-[#D9480F]/40 transition-all duration-150">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center font-black">
              <Store className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
              18 Terdaftar
            </span>
          </div>
          <div className="my-4">
            <span className="text-4xl font-extrabold text-[#1A1715] tracking-tight">{outletCount}</span>
            <span className="text-xs text-stone-500 font-semibold ml-2">Cabang Aktif</span>
            <p className="text-xs text-stone-500 mt-1.5">
              Cibinong, Cimanggu, Pajajaran, Pekayon, dan 14 cabang lainnya.
            </p>
          </div>
          <Link
            href="/dashboard/outlets"
            className="inline-flex items-center justify-between w-full pt-3 border-t border-[#EFE8DE] text-xs font-bold text-[#D9480F] hover:text-[#B83808] group"
          >
            <span>Buka Direktori Cabang</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Bento Stat 2: Database KOL (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-[#EFE8DE] shadow-xs flex flex-col justify-between hover:border-[#D9480F]/40 transition-all duration-150">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
              Influencer
            </span>
          </div>
          <div className="my-3">
            <span className="text-3xl font-extrabold text-[#1A1715] tracking-tight">{kolCount}</span>
            <span className="text-xs text-stone-500 font-semibold ml-2">KOL Terdata</span>
            <p className="text-xs text-stone-500 mt-1">
              Lengkap dengan link medsos, nomor WA, dan rekening pembayaran.
            </p>
          </div>
          <Link
            href="/dashboard/kols"
            className="inline-flex items-center justify-between text-xs font-bold text-[#D9480F] hover:underline pt-2 border-t border-[#EFE8DE]"
          >
            <span>Kelola Profil KOL</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Bento Stat 3: Endorsement Campaigns (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-[#EFE8DE] shadow-xs flex flex-col justify-between hover:border-[#D9480F]/40 transition-all duration-150">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-orange-50 text-[#D9480F] flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#D9480F] bg-[#FFF4ED] px-2.5 py-0.5 rounded-full">
              TikTok & Reels
            </span>
          </div>
          <div className="my-3">
            <span className="text-3xl font-extrabold text-[#1A1715] tracking-tight">
              {endorsementCount}
            </span>
            <span className="text-xs text-stone-500 font-semibold ml-2">Jadwal Konten</span>
            <p className="text-xs text-stone-500 mt-1">
              Tracking jadwal visit, rate card, dan link hasil posting.
            </p>
          </div>
          <Link
            href="/dashboard/endorsements"
            className="inline-flex items-center justify-between text-xs font-bold text-[#D9480F] hover:underline pt-2 border-t border-[#EFE8DE]"
          >
            <span>Buka Tracking Endorse</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Bento Stat 4: Ads Mitra (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-[#EFE8DE] shadow-xs flex flex-col justify-between hover:border-[#D9480F]/40 transition-all duration-150">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-stone-700 bg-stone-200/70 px-2.5 py-0.5 rounded-full">
              Iklan Digital
            </span>
          </div>
          <div className="my-3">
            <span className="text-3xl font-extrabold text-[#1A1715] tracking-tight">{adCount}</span>
            <span className="text-xs text-stone-500 font-semibold ml-2">Campaign Ads</span>
            <p className="text-xs text-stone-500 mt-1">
              Monitor alokasi budget ads dan efisiensi biaya per view (CPV).
            </p>
          </div>
          <Link
            href="/dashboard/ads"
            className="inline-flex items-center justify-between text-xs font-bold text-[#D9480F] hover:underline pt-2 border-t border-[#EFE8DE]"
          >
            <span>Buka Tracking Ads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Action Row & Recent Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Quick Action Dock (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-[#EFE8DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE8DE]">
            <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#D9480F]" />
              <span>Aksi Cepat Operasional</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/dashboard/endorsements"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] hover:border-[#D9480F] hover:bg-[#FFF4ED]/60 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#EFE8DE] flex items-center justify-center text-[#D9480F] shadow-2xs group-hover:scale-105 transition-transform">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A1715]">Jadwalkan Endorsement</div>
                  <div className="text-[11px] text-stone-500">Input visit & rate card KOL</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-stone-400 group-hover:text-[#D9480F]" />
            </Link>

            <Link
              href="/dashboard/kols"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] hover:border-[#D9480F] hover:bg-[#FFF4ED]/60 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#EFE8DE] flex items-center justify-center text-amber-700 shadow-2xs group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A1715]">Tambah Profil KOL</div>
                  <div className="text-[11px] text-stone-500">Medsos, kontak & no rekening</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-stone-400 group-hover:text-[#D9480F]" />
            </Link>

            <Link
              href="/dashboard/ads"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] hover:border-[#D9480F] hover:bg-[#FFF4ED]/60 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#EFE8DE] flex items-center justify-center text-stone-700 shadow-2xs group-hover:scale-105 transition-transform">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A1715]">Input Budget Ads</div>
                  <div className="text-[11px] text-stone-500">Catat iklan cabang mitra</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-stone-400 group-hover:text-[#D9480F]" />
            </Link>

            <Link
              href="/dashboard/outlets"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] hover:border-[#D9480F] hover:bg-[#FFF4ED]/60 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#EFE8DE] flex items-center justify-center text-stone-700 shadow-2xs group-hover:scale-105 transition-transform">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A1715]">Tambah Cabang Baru</div>
                  <div className="text-[11px] text-stone-500">Daftarkan outlet baru</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-stone-400 group-hover:text-[#D9480F]" />
            </Link>
          </div>
        </div>

        {/* Recent Endorsements Feed (Span 8) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-[#EFE8DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE8DE]">
            <div>
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Video className="w-4 h-4 text-[#D9480F]" />
                <span>Endorsement Terbaru</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                5 aktivitas visit & posting influencer paling akhir
              </p>
            </div>
            <Link
              href="/dashboard/endorsements"
              className="text-xs font-bold text-[#D9480F] hover:underline"
            >
              Lihat Seluruh Data →
            </Link>
          </div>

          {recentEndorsements.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border-2 border-dashed border-[#EFE8DE] text-stone-400">
              <Video className="w-10 h-10 mx-auto mb-2 text-stone-300" />
              <p className="text-sm font-semibold text-stone-600">Belum ada endorsement yang tercatat.</p>
              <p className="text-xs mt-1">Gunakan tombol &apos;Jadwalkan Endorsement&apos; untuk input data pertama.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#EFE8DE]">
              {recentEndorsements.map((item: any) => (
                <div key={item.id.toString()} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {item.kol.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#1A1715] truncate">
                        {item.kol.name}
                      </div>
                      <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                        <span className="font-medium text-stone-700">@{item.outlet.name}</span>
                        <span>•</span>
                        <span className="font-mono text-stone-600">
                          {formatRupiah(Number(item.rateCard))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        item.visitStatus === 'VISITED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.visitStatus}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        item.postStatus === 'ON'
                          ? 'bg-[#D9480F]/10 text-[#D9480F] border border-[#D9480F]/20'
                          : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}
                    >
                      Post: {item.postStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
