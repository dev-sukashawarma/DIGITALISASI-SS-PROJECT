'use client';

import React from 'react';
import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface BonusKpiCardProps {
  itemsSoldToday: number;
  itemsSoldYesterday: number;
  userRole?: string;
  userName?: string;
}

export function BonusKpiCard({
  itemsSoldToday,
  itemsSoldYesterday,
  userRole,
}: BonusKpiCardProps) {
  // Perhitungan tarif bonus berdasarkan role pengguna
  const isAM = userRole === 'area_manager';
  const isLeaderOrCrew = userRole === 'leader' || userRole === 'crew';

  let bonusRate = 50; // Default RM & AM rate (Rp 50 / pcs)
  if (isAM) {
    bonusRate = 50;
  } else if (isLeaderOrCrew) {
    bonusRate = 100;
  }

  const bonusToday = itemsSoldToday * bonusRate;
  const bonusYesterday = itemsSoldYesterday * bonusRate;

  let percentageChange = 0;
  if (bonusYesterday === 0) {
    percentageChange = bonusToday > 0 ? 100 : 0;
  } else {
    percentageChange = ((bonusToday - bonusYesterday) / bonusYesterday) * 100;
  }

  const isPositive = percentageChange >= 0;
  const absChange = Math.abs(percentageChange).toFixed(1);

  return (
    <div
      className="bg-gradient-to-br from-[#FFFDF2] via-[#FFF9E5] to-[#FFF2CE] p-6 rounded-3xl shadow-[0_4px_24px_rgba(217,119,6,0.09)] border border-amber-300/80 hover:border-amber-400 hover:shadow-[0_8px_32px_rgba(217,119,6,0.18)] relative overflow-hidden group transition-all duration-300 flex flex-col justify-between"
    >
      {/* Subtle Gold Shimmer Top Accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />

      {/* Ambient Gold Glow Blobs */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br from-amber-300/40 via-yellow-400/20 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
      <div className="absolute -left-8 -bottom-8 w-28 h-28 bg-gradient-to-tr from-amber-400/20 to-transparent rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white px-2 py-0.5 rounded-md shadow-xs shadow-amber-500/20">
              Bonus
            </span>
            <h3 className="text-xs font-black text-amber-950/80 uppercase tracking-wider">
              Estimasi Insentif
            </h3>
          </div>
          <div className="p-2.5 bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-white rounded-2xl shadow-md shadow-amber-500/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
            <Sparkles size={20} className="animate-pulse" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-950 via-amber-900 to-yellow-900 bg-clip-text text-transparent mt-3 tracking-tight">
          {formatRupiah(bonusToday)}
        </p>
      </div>

      <div className="relative z-10 mt-3 pt-2 border-t border-amber-900/10">
        <span
          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
            isPositive
              ? 'text-emerald-900 bg-emerald-100/90 border border-emerald-300/80 shadow-xs'
              : 'text-red-800 bg-red-100/90 border border-red-300/80'
          }`}
        >
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isPositive ? '+' : '-'}
          {absChange}% dari periode sebelumnya
        </span>
      </div>
    </div>
  );
}
