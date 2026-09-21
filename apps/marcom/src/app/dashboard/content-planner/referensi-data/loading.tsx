import Link from 'next/link'
import {
  CalendarDays,
  BarChart3,
  TrendingUp,
  Settings2,
  Loader2,
} from 'lucide-react'

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Konten Planner • Child Module</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Referensi Data Penjualan POS
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-1">
            Memuat data kompas omzet cabang dan ranking menu POS live...
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#EFE8DE] text-xs font-bold text-stone-600 shadow-2xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D9480F]" />
            <span>Menghubungkan POS...</span>
          </div>
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF8F5] border border-[#EFE8DE] rounded-2xl w-fit flex-wrap">
        <Link
          href="/dashboard/content-planner"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-500 hover:text-[#1A1715]"
        >
          <CalendarDays className="w-4 h-4 text-stone-400" />
          <span>Rencana Konten</span>
        </Link>

        <Link
          href="/dashboard/content-planner/metrik-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-500 hover:text-[#1A1715]"
        >
          <BarChart3 className="w-4 h-4 text-stone-400" />
          <span>Metrik Data</span>
        </Link>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-[#D9480F] text-white shadow-xs">
          <TrendingUp className="w-4 h-4" />
          <span>Referensi Data</span>
        </div>

        <Link
          href="/dashboard/content-planner/pengaturan"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-500 hover:text-[#1A1715]"
        >
          <Settings2 className="w-4 h-4 text-stone-400" />
          <span>Pengaturan Konten</span>
        </Link>
      </div>

      {/* 2 Bento Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs space-y-4">
          <div className="h-4 w-36 bg-stone-200 rounded" />
          <div className="h-9 w-48 bg-stone-200 rounded" />
          <div className="h-3 w-56 bg-stone-100 rounded" />
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs space-y-4">
          <div className="h-4 w-36 bg-stone-200 rounded" />
          <div className="h-9 w-48 bg-stone-200 rounded" />
          <div className="h-3 w-56 bg-stone-100 rounded" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs flex items-center gap-3">
        <div className="h-9 w-48 bg-stone-200 rounded-xl" />
        <div className="h-9 w-64 bg-stone-200 rounded-xl" />
      </div>

      {/* 2 Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs space-y-3">
          <div className="h-5 w-40 bg-stone-200 rounded" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-stone-100 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs space-y-3">
          <div className="h-5 w-40 bg-stone-200 rounded" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-stone-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
