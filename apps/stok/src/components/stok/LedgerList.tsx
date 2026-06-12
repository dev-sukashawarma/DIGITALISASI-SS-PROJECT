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
            className="w-full px-4 py-2.5 pl-9 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-medium transition-all shadow-sm"
            placeholder="Cari nama bahan baku atau ID referensi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#544437]/40 text-xs">🔍</span>
        </div>

        {/* Transaction Type Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {Object.entries(FILTER_LABELS).map(([key, label]) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer shadow-sm ${
                  isActive
                    ? 'bg-[#701604] border-[#701604] text-white shadow-sm'
                    : 'bg-white border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-[#fff8f1]/50'
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
          let bgClass = 'bg-[#faf2e9] text-[#701604] border-[#d9c2b2]/40';
          if (l.tipe === 'terima_kiriman' || l.tipe === 'transfer_masuk') {
            icon = '📥';
            bgClass = 'bg-[#93f997]/15 text-[#006e24] border-[#93f997]/25';
          } else if (l.tipe === 'waste' || l.tipe === 'pemakaian') {
            icon = '🗑️';
            bgClass = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10';
          } else if (l.tipe === 'transfer_keluar') {
            icon = '📤';
            bgClass = 'bg-[#ffdcc2] text-[#904d00] border-[#ffdcc2]/10';
          }

          return (
            <Link key={l.id} href={`/stok/ledger/${l.id}`}>
              <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 flex justify-between items-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer mb-2.5">
                {/* Left Section: Icon and Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg flex-shrink-0 ${bgClass}`}>
                    {icon}
                  </span>
                  <div className="truncate space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                        {LABEL[l.tipe] ?? l.tipe}
                      </span>
                      <span className="text-[10px] text-[#544437]/50 font-medium">{relativeTime}</span>
                    </div>
                    <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide truncate">
                      {name}
                    </h4>
                    {l.catatan && (
                      <p className="text-[9px] text-[#544437]/60 font-medium truncate mt-0.5">
                        📝 {l.catatan}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Section: Quantity and Balance */}
                <div className="text-right flex-shrink-0 space-y-0.5 pl-4">
                  <p className={`font-bold text-sm ${isPositive ? 'text-[#0a7d2c]' : 'text-[#ba1a1a]'}`}>
                    {isPositive ? '+' : ''}{l.qty} <span className="text-[10px] font-medium text-[#544437]/50">{unit}</span>
                  </p>
                  <p className="text-[9px] text-[#544437]/60 font-bold bg-[#faf2e9]/50 px-2 py-0.5 rounded border border-[#d9c2b2]/20 inline-block mt-1">
                    Saldo: {l.saldo_sesudah} {unit}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#d9c2b2]/40 p-8 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-3xl">📭</span>
            <p className="font-bold text-sm text-[#701604]/80 mt-2">Belum Ada Catatan Pergerakan</p>
            <p className="text-xs text-gray-500 mt-1">Tidak ada transaksi yang cocok dengan pencarian atau filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
