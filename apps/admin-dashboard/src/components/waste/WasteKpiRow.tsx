'use client'

import React from 'react'
import CountUp from 'react-countup'
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Percent,
  Target,
  ClipboardList,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { rupiah } from '@/lib/format'
import { computeDeltaPct, computeWastePctOmzet } from '@/lib/wasteMetrics'
import { computeWasteGap } from '@/lib/wasteGap'

interface WasteKpiRowProps {
  totalNilai: number
  totalPrevious: number
  totalOmzet: number
  totalBudget: number
  totalInsiden: number
  outletCount: number
}

export function WasteKpiRow({
  totalNilai,
  totalPrevious,
  totalOmzet,
  totalBudget,
  totalInsiden,
  outletCount,
}: WasteKpiRowProps) {
  const delta = computeDeltaPct(totalNilai, totalPrevious)
  const pctOmzet = computeWastePctOmzet(totalNilai, totalOmzet)
  const gap = computeWasteGap(totalNilai, totalBudget)
  const rataPerOutlet = outletCount > 0 ? totalInsiden / outletCount : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Kerugian Waste */}
      <div className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
                Total Kerugian Waste
              </span>
              <div className="group relative flex items-center">
                <HelpCircle className="w-3.5 h-3.5 text-suka-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-suka-ink text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed">
                  Total nilai bahan baku yang terbuang dan sudah disetujui (approved) pada periode ini.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-suka-ink" />
                </div>
              </div>
            </div>
            <div
              className={`p-2 rounded-2xl ${
                delta === null || delta === 0
                  ? 'bg-suka-cream text-suka-brown'
                  : delta < 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {delta === null || delta === 0 ? (
                <Minus className="w-5 h-5" />
              ) : delta < 0 ? (
                <TrendingDown className="w-5 h-5" />
              ) : (
                <TrendingUp className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1 text-suka-brown font-extrabold text-2xl sm:text-3xl tracking-tight tabular-nums">
              <span className="text-base sm:text-lg font-bold">Rp</span>
              <CountUp end={totalNilai} duration={1} separator="." />
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {delta === null ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-suka-gray-100 text-suka-gray-500">
                  Data periode lalu tidak tersedia
                </span>
              ) : delta < 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span>▼ {Math.abs(delta).toFixed(1)}%</span>
                  <span className="font-normal text-emerald-600">vs lalu (Turun)</span>
                </span>
              ) : delta > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                  <span>▲ {delta.toFixed(1)}%</span>
                  <span className="font-normal text-rose-600">vs lalu (Naik)</span>
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-suka-gray-100 text-suka-gray-600">
                  Sama dengan periode lalu
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-suka-gray-100 flex items-center justify-between text-[11px] text-suka-gray-400">
          <span>Akumulasi Disetujui</span>
          <span className="font-bold text-suka-gray-600">{totalInsiden} insiden</span>
        </div>
      </div>

      {/* 2. Waste % Omzet */}
      <div className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
                Waste % Omzet
              </span>
              <div className="group relative flex items-center">
                <HelpCircle className="w-3.5 h-3.5 text-suka-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-suka-ink text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed">
                  Rasio pembanding adil antar-outlet berbeda skala. Nilai normal industri F&B adalah &lt; 2.0%.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-suka-ink" />
                </div>
              </div>
            </div>
            <div
              className={`p-2 rounded-2xl ${
                pctOmzet === null
                  ? 'bg-suka-cream text-suka-brown'
                  : pctOmzet <= 2
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Percent className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1 text-suka-brown font-extrabold text-2xl sm:text-3xl tracking-tight tabular-nums">
              {pctOmzet === null ? (
                <span>N/A</span>
              ) : (
                <>
                  <CountUp end={pctOmzet} duration={1} decimals={2} />
                  <span className="text-base sm:text-lg font-bold ml-0.5">%</span>
                </>
              )}
            </div>

            <div className="mt-2.5">
              {pctOmzet === null ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-suka-gray-100 text-suka-gray-500">
                  Belum ada transaksi omzet
                </span>
              ) : pctOmzet <= 1.0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>Sangat Terkendali (&lt; 1%)</span>
                </span>
              ) : pctOmzet <= 2.0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                  <ShieldCheck className="w-3 h-3 text-blue-500" />
                  <span>Wajar / Aman (&lt; 2%)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>Tinggi (&gt; 2% Perlu Cek)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-suka-gray-100 flex items-center justify-between text-[11px] text-suka-gray-400">
          <span>Dari Total Omzet</span>
          <span className="font-bold text-suka-gray-600">{rupiah(totalOmzet)}</span>
        </div>
      </div>

      {/* 3. Gap vs Alokasi BOM */}
      <div className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
                Gap vs Alokasi BOM
              </span>
              <div className="group relative flex items-center">
                <HelpCircle className="w-3.5 h-3.5 text-suka-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-suka-ink text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed">
                  Alokasi = buffer toleransi waste pada resep produk (BOM). Gap minus menandakan aktual waste lebih hemat daripada budget yang dianggarkan.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-suka-ink" />
                </div>
              </div>
            </div>
            <div
              className={`p-2 rounded-2xl ${
                gap.gapPct === null
                  ? 'bg-suka-cream text-suka-brown'
                  : gap.gapPct <= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Target className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1 text-suka-brown font-extrabold text-2xl sm:text-3xl tracking-tight tabular-nums">
              {gap.gapPct === null ? (
                <span>N/A</span>
              ) : (
                <>
                  <CountUp end={gap.gapPct} duration={1} decimals={1} />
                  <span className="text-base sm:text-lg font-bold ml-0.5">%</span>
                </>
              )}
            </div>

            <div className="mt-2.5">
              {gap.gapPct === null ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-suka-gray-100 text-suka-gray-500">
                  Belum ada alokasi BOM
                </span>
              ) : gap.gapPct <= 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>Hemat (Di Bawah Buffer)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>Melebihi Buffer BOM (+{gap.gapPct.toFixed(1)}%)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-suka-gray-100 flex items-center justify-between text-[11px] text-suka-gray-400">
          <span>Budget Toleransi</span>
          <span className="font-bold text-suka-gray-600">{rupiah(totalBudget)}</span>
        </div>
      </div>

      {/* 4. Jumlah Insiden */}
      <div className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
                Jumlah Insiden
              </span>
              <div className="group relative flex items-center">
                <HelpCircle className="w-3.5 h-3.5 text-suka-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-suka-ink text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed">
                  Banyaknya form laporan waste yang disetujui. Membedakan frekuensi insiden kecil berulang dengan satu insiden besar.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-suka-ink" />
                </div>
              </div>
            </div>
            <div className="p-2 rounded-2xl bg-amber-50 text-amber-600">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5 text-suka-brown font-extrabold text-2xl sm:text-3xl tracking-tight tabular-nums">
              <CountUp end={totalInsiden} duration={1} separator="." />
              <span className="text-sm sm:text-base font-bold text-suka-gray-400">Laporan</span>
            </div>

            <div className="mt-2.5">
              {rataPerOutlet === null ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-suka-gray-100 text-suka-gray-500">
                  Belum ada outlet tercatat
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-suka-cream text-suka-brown border border-suka-brown/10">
                  <span>Rata-rata {rataPerOutlet.toFixed(1)} / outlet</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-suka-gray-100 flex items-center justify-between text-[11px] text-suka-gray-400">
          <span>Outlet dengan Waste</span>
          <span className="font-bold text-suka-gray-600">{outletCount} outlet</span>
        </div>
      </div>
    </div>
  )
}
