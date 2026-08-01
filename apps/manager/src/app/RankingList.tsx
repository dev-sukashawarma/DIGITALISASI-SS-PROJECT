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

interface OutletRanking {
  id: string;
  name: string;
  amName: string;
  omzet: number;
}

interface RankingListProps {
  outletRanking: OutletRanking[];
  maxOmzet: number;
}

export default function RankingList({ outletRanking, maxOmzet }: RankingListProps) {
  const [showAll, setShowAll] = useState(false);
  
  if (outletRanking.length === 0) {
    return <p className="text-sm text-suka-gray-400">Belum ada data omzet.</p>;
  }

  const displayedOutlets = showAll ? outletRanking : outletRanking.slice(0, 5);

  return (
    <div>
      <div className="space-y-4">
        {displayedOutlets.map((outlet, index) => {
          const percentage = maxOmzet > 0 ? (outlet.omzet / maxOmzet) * 100 : 0;
          return (
            <div key={outlet.id} className="group relative">
              <div className="flex justify-between items-end mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black w-5 h-5 flex items-center justify-center rounded-full ${index < 3 ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-400'}`}>
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-suka-brown">{outlet.name}</span>
                  <span className="text-[10px] text-suka-gray-400 font-medium px-2 py-0.5 bg-suka-gray-50 rounded-full">{outlet.amName}</span>
                </div>
                <span className="text-sm font-black text-suka-brown">{formatRupiah(outlet.omzet)}</span>
              </div>
              <div className="w-full h-2 bg-suka-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${index < 3 ? 'bg-suka-orange' : 'bg-suka-brown/30'}`}
                  style={{ width: `${Math.max(percentage, 1)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {outletRanking.length > 5 && (
        <button 
          onClick={() => setShowAll(!showAll)}
          className="mt-6 w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-suka-orange bg-suka-orange/5 hover:bg-suka-orange/10 rounded-xl transition-colors"
        >
          {showAll ? (
            <>Sembunyikan <ChevronUp size={16} /></>
          ) : (
            <>Tampilkan Semua ({outletRanking.length}) <ChevronDown size={16} /></>
          )}
        </button>
      )}
    </div>
  );
}
