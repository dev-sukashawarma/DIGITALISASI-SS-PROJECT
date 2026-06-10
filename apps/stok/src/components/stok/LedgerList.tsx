'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LedgerStok } from '@/types/stok';
import { useBahanBaku } from '@/hooks/useBahanBaku';

const LABEL: Record<string, string> = {
  terima_kiriman: 'Terima Kiriman',
  pemakaian: 'Pemakaian',
  waste: 'Waste',
  adjustment: 'Penyesuaian',
  opname_selisih: 'Selisih Opname',
  transfer_keluar: 'Transfer Keluar',
  transfer_masuk: 'Transfer Masuk',
};

const FILTER_LABELS: Record<string, string> = {
  all: 'Semua',
  inbound: 'Masuk 📥',
  outbound: 'Keluar / Waste 🗑️',
  adjustment: 'Penyesuaian ⚖️',
};

export function LedgerList({ items }: { items: LedgerStok[] }) {
  const { bahanBaku } = useBahanBaku();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Map bahan_baku_id to name and unit
  const bahanMap = useMemo(() => {
    const map: Record<string, { nama: string; satuan: string }> = {};
    for (const b of bahanBaku) {
      map[b.id] = { nama: b.nama, satuan: b.satuan };
    }
    return map;
  }, [bahanBaku]);

  // Relative Time Formatter
  const getRelativeTimeString = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins <= 0 ? 1 : diffMins} mnt lalu`;
    } else if (diffHours < 24) {
      return `${diffHours} jam lalu`;
    } else if (diffDays === 1) {
      return 'Kemarin';
    } else {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  // Filter items based on search and transaction type
  const filteredItems = useMemo(() => {
    return items.filter((l) => {
      const bahan = bahanMap[l.bahan_baku_id];
      const nameMatch = bahan
        ? bahan.nama.toLowerCase().includes(searchTerm.toLowerCase())
        : false;
      const refMatch =
        l.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.ref_shipment_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.ref_opname_id || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSearch = searchTerm === '' || nameMatch || refMatch;

      // Filter by type
      let matchesFilter = false;
      if (activeFilter === 'all') {
        matchesFilter = true;
      } else if (activeFilter === 'inbound') {
        matchesFilter = ['terima_kiriman', 'transfer_masuk'].includes(l.tipe);
      } else if (activeFilter === 'outbound') {
        matchesFilter = ['pemakaian', 'waste', 'transfer_keluar'].includes(l.tipe);
      } else if (activeFilter === 'adjustment') {
        matchesFilter = ['adjustment', 'opname_selisih'].includes(l.tipe);
      }

      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter, bahanMap]);

  return (
    <div className="space-y-4">
      {/* Search and Filter Row */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            className="w-full px-4.5 py-3.5 pl-11 rounded-xl border border-[#701604]/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#f29744] focus:border-[#f29744] text-xs font-medium text-suka-ink shadow-sm"
            placeholder="Cari berdasarkan nama bahan baku atau ID referensi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
        </div>

        {/* Transaction Type Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-thin">
          {Object.entries(FILTER_LABELS).map(([key, label]) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all border whitespace-nowrap shadow-sm ${
                  isActive
                    ? 'bg-[#701604] border-[#701604] text-white'
                    : 'bg-white border-[#701604]/10 text-[#701604]/70 hover:bg-[#faf2e9]/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ledger Feed */}
      <div className="space-y-3">
        {filteredItems.map((l) => {
          const bahan = bahanMap[l.bahan_baku_id];
          const name = bahan ? bahan.nama : 'Bahan Baku';
          const unit = bahan ? bahan.satuan : '';
          const isPositive = l.qty > 0;
          const relativeTime = getRelativeTimeString(l.created_at);

          // Select icon and border accent
          let icon = '⚖️';
          let bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
          if (l.tipe === 'terima_kiriman' || l.tipe === 'transfer_masuk') {
            icon = '📥';
            bgClass = 'bg-green-50 text-green-700 border-green-200';
          } else if (l.tipe === 'waste' || l.tipe === 'pemakaian') {
            icon = '🗑️';
            bgClass = 'bg-red-50 text-red-700 border-red-200';
          } else if (l.tipe === 'transfer_keluar') {
            icon = '📤';
            bgClass = 'bg-orange-50 text-orange-700 border-orange-200';
          }

          return (
            <Link key={l.id} href={`/stok/ledger/${l.id}`}>
              <div className="bg-white rounded-2xl border border-[#701604]/10 p-4 flex justify-between items-center shadow-[0px_4px_12px_rgba(112,22,4,0.02)] hover:border-[#f29744]/30 hover:scale-[1.005] transition-all duration-200 cursor-pointer mb-2.5">
                {/* Left Section: Icon and Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg shadow-inner flex-shrink-0 ${bgClass}`}>
                    {icon}
                  </span>
                  <div className="truncate space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#701604]/50 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#701604]/5">
                        {LABEL[l.tipe] ?? l.tipe}
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">{relativeTime}</span>
                    </div>
                    <h4 className="font-extrabold text-[#701604] text-sm tracking-wide uppercase truncate">
                      {name}
                    </h4>
                    {l.catatan && (
                      <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        📝 {l.catatan}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Section: Quantity and Balance */}
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className={`font-extrabold text-sm ${isPositive ? 'text-[#0a7d2c]' : 'text-red-650'}`}>
                    {isPositive ? '+' : ''}{l.qty} <span className="text-[10px] font-semibold text-gray-400">{unit}</span>
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold bg-[#faf2e9]/50 px-2 py-0.5 rounded border border-[#701604]/5 inline-block">
                    Saldo: {l.saldo_sesudah} {unit}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#701604]/10 p-8 shadow-sm">
            <span className="text-3xl">📭</span>
            <p className="font-bold text-sm text-[#701604]/80 mt-2">Belum Ada Catatan Pergerakan</p>
            <p className="text-xs text-gray-500 mt-1">Tidak ada transaksi yang cocok dengan pencarian atau filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
