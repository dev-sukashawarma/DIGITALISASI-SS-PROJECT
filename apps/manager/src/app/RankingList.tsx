'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export interface OutletRanking {
  id: string;
  name: string;
  amName: string;
  omzet: number;
  adminFee?: number;
  hpp?: number;
  net?: number;
}

interface RankingListProps {
  outletRanking: OutletRanking[];
  maxOmzet: number;
  showFinancialDetails?: boolean;
}

export default function RankingList({ outletRanking, maxOmzet, showFinancialDetails = true }: RankingListProps) {
  const [showAll, setShowAll] = useState(false);

  if (outletRanking.length === 0) {
    return (
      <div className="py-8 text-center text-suka-gray-400 text-xs">
        Belum ada data omzet untuk periode ini.
      </div>
    );
  }

  const displayedOutlets = showAll ? outletRanking : outletRanking.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="space-y-3.5">
        {displayedOutlets.map((outlet, index) => {
          const percentage = maxOmzet > 0 ? (outlet.omzet / maxOmzet) * 100 : 0;
          
          let rankBadge = "bg-suka-brown/5 text-suka-brown/60 border-suka-brown/10";
          if (index === 0) rankBadge = "bg-amber-500 text-white font-black shadow-xs border-amber-600";
          if (index === 1) rankBadge = "bg-slate-700 text-white font-black border-slate-800";
          if (index === 2) rankBadge = "bg-amber-800/80 text-white font-black border-amber-900";

          return (
            <div key={outlet.id} className="group relative p-2.5 rounded-xl hover:bg-suka-brown/[0.02] transition-all duration-150">
              <div className="flex justify-between items-center mb-1.5 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full shrink-0 border ${rankBadge}`}>
                    #{index + 1}
                  </span>
                  <span className="text-sm font-extrabold text-suka-brown truncate group-hover:text-suka-orange transition-colors">
                    {outlet.name}
                  </span>
                  {outlet.amName && (
                    <span className="text-[10px] text-suka-brown/60 font-black px-2 py-0.5 bg-suka-brown/5 rounded-full shrink-0">
                      {outlet.amName}
                    </span>
                  )}
                </div>
                <span className="text-sm font-black text-suka-brown shrink-0">
                  {formatRupiah(outlet.omzet)}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-suka-brown/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    index < 3
                      ? 'bg-gradient-to-r from-suka-orange to-amber-500'
                      : 'bg-suka-brown/30'
                  }`}
                  style={{ width: `${Math.max(percentage, 1.5)}%` }}
                />
              </div>

              {/* Keterangan kecil di bawah: Potongan Admin, HPP, & Net (Khusus RM & Developer) */}
              {showFinancialDetails && (outlet.adminFee !== undefined || outlet.hpp !== undefined) && (
                <div className="flex flex-wrap items-center justify-between text-[11px] mt-1.5 px-0.5 text-suka-brown/70 gap-x-3 gap-y-0.5">
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-suka-gray-400 text-[10px]">Pot. Admin:</span>
                      <span className="font-bold text-rose-600">
                        {outlet.adminFee ? `-${formatRupiah(outlet.adminFee)}` : 'Rp 0'}
                      </span>
                    </span>
                    <span className="text-suka-brown/20">•</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-suka-gray-400 text-[10px]">HPP:</span>
                      <span className="font-bold text-amber-700">
                        {outlet.hpp ? formatRupiah(outlet.hpp) : 'Rp 0'}
                      </span>
                    </span>
                  </div>
                  {outlet.net !== undefined && (
                    <div className="inline-flex items-center gap-1 text-[11px]">
                      <span className="text-suka-gray-400 text-[10px]">Net:</span>
                      <span className="font-extrabold text-emerald-700">
                        {formatRupiah(outlet.net)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {outletRanking.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-xs font-black text-suka-orange bg-suka-orange/10 hover:bg-suka-orange/15 rounded-xl transition-all active:scale-[0.99] shadow-xs"
        >
          {showAll ? (
            <>Sembunyikan Ranking <ChevronUp size={14} /></>
          ) : (
            <>Tampilkan Semua ({outletRanking.length} Outlet) <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </div>
  );
}
