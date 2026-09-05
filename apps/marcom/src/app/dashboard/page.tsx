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
  ShieldCheck,
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

  // Get recent 5 endorsements
  const recentEndorsements = await prisma.endorsement.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      outlet: true,
      kol: true,
    },
  })

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-xs mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Role: {user?.role || 'MARCOM'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Selamat Datang, {user?.name || user?.email}!
          </h1>
          <p className="mt-2 text-sm sm:text-base text-orange-100 leading-relaxed">
            Sistem Digitalisasi Marcom Suka Shawarma. Pantau jadwal tayang KOL/Influencer, performa view, dan efektivitas budget Ads Mitra di seluruh cabang.
          </p>
        </div>

        {/* Decorative background shape */}
        <div className="absolute right-0 -bottom-10 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outlets */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-orange-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Cabang
            </span>
            <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{outletCount}</span>
            <span className="text-xs text-slate-400 ml-2">lokasi</span>
          </div>
          <Link
            href="/dashboard/outlets"
            className="mt-4 inline-flex items-center text-xs font-semibold text-orange-600 hover:text-orange-700 gap-1 group"
          >
            <span>Kelola Outlet</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* KOLs */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total KOL
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{kolCount}</span>
            <span className="text-xs text-slate-400 ml-2">influencer</span>
          </div>
          <Link
            href="/dashboard/kols"
            className="mt-4 inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 gap-1 group"
          >
            <span>Kelola KOL</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Endorsements */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Endorsements
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{endorsementCount}</span>
            <span className="text-xs text-slate-400 ml-2">konten</span>
          </div>
          <Link
            href="/dashboard/endorsements"
            className="mt-4 inline-flex items-center text-xs font-semibold text-amber-600 hover:text-amber-700 gap-1 group"
          >
            <span>Lihat Tracking</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Ads Mitra */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-purple-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ads Mitra
            </span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{adCount}</span>
            <span className="text-xs text-slate-400 ml-2">campaign</span>
          </div>
          <Link
            href="/dashboard/ads"
            className="mt-4 inline-flex items-center text-xs font-semibold text-purple-600 hover:text-purple-700 gap-1 group"
          >
            <span>Lihat Ads</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Quick Action Buttons & Status Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            Aksi Cepat (Quick Actions)
          </h2>
          <div className="space-y-2.5">
            <Link
              href="/dashboard/outlets"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-orange-500 hover:bg-orange-50/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-slate-500 group-hover:text-orange-600" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800">Daftarkan Cabang Baru</div>
                  <div className="text-xs text-slate-400">Tambah outlet Suka Shawarma</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-slate-400 group-hover:text-orange-600" />
            </Link>

            <Link
              href="/dashboard/kols"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800">Tambah Profil KOL</div>
                  <div className="text-xs text-slate-400">Simpan kontak & medsos influencer</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </Link>

            <Link
              href="/dashboard/endorsements"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-slate-500 group-hover:text-amber-600" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800">Jadwalkan Endorsement</div>
                  <div className="text-xs text-slate-400">Input visit date & rate card</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
            </Link>

            <Link
              href="/dashboard/ads"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Megaphone className="w-5 h-5 text-slate-500 group-hover:text-purple-600" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800">Input Budget Ads</div>
                  <div className="text-xs text-slate-400">Catat campaign iklan berbayar</div>
                </div>
              </div>
              <PlusCircle className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
            </Link>
          </div>
        </div>

        {/* Recent Endorsements List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Video className="w-5 h-5 text-orange-500" />
              Endorsement Terbaru
            </h2>
            <Link
              href="/dashboard/endorsements"
              className="text-xs font-semibold text-orange-600 hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          {recentEndorsements.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-lg text-slate-400">
              <p className="text-sm font-medium">Belum ada aktivitas endorsement yang dicatat.</p>
              <p className="text-xs mt-1">Gunakan tombol &apos;Jadwalkan Endorsement&apos; untuk memulai pencatatan.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentEndorsements.map((item: any) => (
                <div key={item.id.toString()} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 text-sm">{item.kol.name}</span>
                    <span className="text-xs text-slate-400 ml-2">@{item.outlet.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        item.postStatus === 'ON'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.postStatus}
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
