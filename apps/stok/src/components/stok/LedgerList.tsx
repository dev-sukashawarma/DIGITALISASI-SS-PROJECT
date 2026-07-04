'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LedgerTransaksiSummary } from '@/types/stok';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useLedgerTransaksiDetail } from '@/hooks/useLedger';
import { useOutletScope } from '@/hooks/useOutletScope';
import { formatCompositeSaldo, formatCompositeDelta } from '@/lib/format/compositeUnit';

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

export function transaksiLabel(t: LedgerTransaksiSummary): { title: string; subtitle: string | null } {
  if (t.ref_order_id) {
    return { title: 'Order Selesai', subtitle: t.order_number ? `Order #${t.order_number}` : null };
  }
  if (t.ref_opname_id) {
    const tanggal = t.opname_tanggal
      ? new Date(t.opname_tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    return { title: 'Opname', subtitle: tanggal ? `${t.opname_tipe ?? ''} — ${tanggal}` : null };
  }
  if (t.ref_shipment_id) {
    return { title: 'Terima Kiriman', subtitle: null };
  }
  if (t.ref_transfer_id) {
    return { title: 'Transfer Stok', subtitle: null };
  }
  return { title: LABEL[t.single_tipe ?? ''] ?? (t.single_tipe ?? 'Manual'), subtitle: null };
}

const DEFAULT_ICON = '⚖️';
const DEFAULT_BG_CLASS = 'bg-[#faf2e9] text-[#701604] border-[#d9c2b2]/40';

/**
 * Single source of truth for transaction display classification (icon + background style),
 * layered on top of transaksiLabel's ref/tipe checks so the two never drift apart.
 */
export function transaksiVisual(t: LedgerTransaksiSummary): { icon: string; bgClass: string } {
  if (t.ref_order_id) {
    return { icon: '🧾', bgClass: 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10' };
  }
  if (t.ref_opname_id) {
    return { icon: '📋', bgClass: DEFAULT_BG_CLASS };
  }
  if (t.ref_shipment_id) {
    return { icon: '📥', bgClass: 'bg-[#93f997]/15 text-[#006e24] border-[#93f997]/25' };
  }
  if (t.ref_transfer_id) {
    return { icon: '📤', bgClass: 'bg-[#ffdcc2] text-[#904d00] border-[#ffdcc2]/10' };
  }
  if (t.single_tipe === 'terima_kiriman' || t.single_tipe === 'transfer_masuk') {
    return { icon: '📥', bgClass: 'bg-[#93f997]/15 text-[#006e24] border-[#93f997]/25' };
  }
  if (t.single_tipe === 'waste' || t.single_tipe === 'pemakaian') {
    return { icon: '🗑️', bgClass: 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10' };
  }
  if (t.single_tipe === 'transfer_keluar') {
    return { icon: '📤', bgClass: 'bg-[#ffdcc2] text-[#904d00] border-[#ffdcc2]/10' };
  }
  // adjustment / opname_selisih intentionally fall through to the default styling below.
  if (t.single_tipe === 'adjustment' || t.single_tipe === 'opname_selisih') {
    return { icon: DEFAULT_ICON, bgClass: DEFAULT_BG_CLASS };
  }
  return { icon: DEFAULT_ICON, bgClass: DEFAULT_BG_CLASS };
}

function getRelativeTimeString(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins <= 0 ? 1 : diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TransaksiExpandedDetail({ outletId, transaksiKey }: { outletId: string; transaksiKey: string }) {
  const { rows, loading, error } = useLedgerTransaksiDetail(outletId, transaksiKey, true);

  if (loading) return <p className="text-[10px] font-bold text-[#544437]/50 py-2 animate-pulse">Memuat detail...</p>;
  if (error) return <p className="text-[10px] font-bold text-[#ba1a1a] py-2">Gagal memuat: {error}</p>;

  return (
    <div className="mt-3 pt-3 border-t border-[#d9c2b2]/25 space-y-2">
      {rows.map((r) => {
        const bahan = r.bahan_baku;
        const satuan = bahan?.satuan ?? '';
        return (
          <div key={r.id} className="flex justify-between items-center text-[10px]">
            <span className="font-bold text-[#1e1b15] uppercase truncate pr-2">{bahan?.nama ?? 'Bahan'}</span>
            <span className="text-right flex-shrink-0">
              <span className={r.qty > 0 ? 'text-[#0a7d2c] font-bold' : 'text-[#ba1a1a] font-bold'}>
                {formatCompositeDelta(r.qty, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)}
              </span>
              <span className="text-[#544437]/50 font-medium">
                {' '}→ sisa {formatCompositeSaldo(r.saldo_sesudah, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LedgerList({ items }: { items: LedgerTransaksiSummary[] }) {
  const { bahanBaku } = useBahanBaku();
  const { selectedOutletId } = useOutletScope();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const bahanMap = useMemo(() => {
    const map: Record<string, { nama: string; satuan: string; satuanKecil: string | null; faktorTampilan: number | null }> = {};
    for (const b of bahanBaku) {
      map[b.id] = { nama: b.nama, satuan: b.satuan, satuanKecil: b.satuan_kecil, faktorTampilan: b.faktor_tampilan };
    }
    return map;
  }, [bahanBaku]);

  const filteredItems = useMemo(() => {
    return items.filter((t) => {
      const { title, subtitle } = transaksiLabel(t);
      const singleBahan = t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id] : undefined;
      const nameMatch = singleBahan ? singleBahan.nama.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const refMatch = `${title} ${subtitle ?? ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = searchTerm === '' || nameMatch || refMatch;

      let matchesFilter = false;
      const tipe = t.jumlah_bahan === 1 ? t.single_tipe : null;
      if (activeFilter === 'all') {
        matchesFilter = true;
      } else if (activeFilter === 'inbound') {
        matchesFilter = !!t.ref_order_id === false && (tipe ? ['terima_kiriman', 'transfer_masuk'].includes(tipe) : !!t.ref_shipment_id);
      } else if (activeFilter === 'outbound') {
        matchesFilter = !!t.ref_order_id || (tipe ? ['pemakaian', 'waste', 'transfer_keluar'].includes(tipe) : false);
      } else if (activeFilter === 'adjustment') {
        matchesFilter = !!t.ref_opname_id || (tipe ? ['adjustment', 'opname_selisih'].includes(tipe) : false);
      }

      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter, bahanMap]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-2.5 pl-9 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-medium transition-all shadow-sm"
            placeholder="Cari nama bahan baku atau nomor order/opname..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#544437]/40 text-xs">🔍</span>
        </div>

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

      <div className="space-y-3">
        {filteredItems.map((t) => {
          const { title, subtitle } = transaksiLabel(t);
          const isManual = t.jumlah_bahan === 1 && !t.ref_order_id && !t.ref_opname_id && !t.ref_shipment_id && !t.ref_transfer_id;
          const relativeTime = getRelativeTimeString(t.created_at);
          const isExpanded = expandedKey === t.transaksi_key;
          const detailId = `transaksi-detail-${t.transaksi_key}`;

          const { icon, bgClass } = transaksiVisual(t);
          const bahan = t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id] : undefined;
          const satuan = bahan?.satuan ?? '';

          const headerRow = (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg flex-shrink-0 ${bgClass}`}>
                  {icon}
                </span>
                <div className="truncate space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                      {title}
                    </span>
                    <span className="text-[10px] text-[#544437]/50 font-medium">{relativeTime}</span>
                  </div>
                  <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide truncate">
                    {isManual
                      ? (t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id]?.nama ?? 'Bahan Baku' : 'Bahan Baku')
                      : subtitle ?? `${t.jumlah_bahan} bahan`}
                  </h4>
                  {isManual && t.single_catatan && (
                    <p className="text-[9px] text-[#544437]/60 font-medium truncate mt-0.5">📝 {t.single_catatan}</p>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0 space-y-0.5 pl-4">
                {isManual ? (
                  <>
                    <p className={`font-bold text-sm ${(t.single_qty ?? 0) > 0 ? 'text-[#0a7d2c]' : 'text-[#ba1a1a]'}`}>
                      {formatCompositeDelta(t.single_qty ?? 0, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null)}
                    </p>
                    <p className="text-[9px] text-[#544437]/60 font-bold bg-[#faf2e9]/50 px-2 py-0.5 rounded border border-[#d9c2b2]/20 inline-block mt-1">
                      Saldo: {formatCompositeSaldo(t.single_saldo_sesudah ?? 0, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null)}
                    </p>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-[#701604]/70">
                    {isExpanded ? '▲ Tutup' : '▼ Lihat Detail'}
                  </span>
                )}
              </div>
            </div>
          );

          if (isManual) {
            return (
              <Link key={t.transaksi_key} href={`/stok/ledger/${t.transaksi_key}`}>
                <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md transition-all duration-200 mb-2.5 cursor-pointer active:scale-[0.98]">
                  {headerRow}
                </div>
              </Link>
            );
          }

          return (
            <div
              key={t.transaksi_key}
              className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md transition-all duration-200 mb-2.5"
            >
              <button
                type="button"
                className="w-full text-left cursor-pointer active:scale-[0.99] transition-all"
                onClick={() => setExpandedKey(isExpanded ? null : t.transaksi_key)}
                aria-expanded={isExpanded}
                aria-controls={detailId}
              >
                {headerRow}
              </button>

              {isExpanded && selectedOutletId && (
                <div id={detailId}>
                  <TransaksiExpandedDetail outletId={selectedOutletId} transaksiKey={t.transaksi_key} />
                </div>
              )}
            </div>
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
