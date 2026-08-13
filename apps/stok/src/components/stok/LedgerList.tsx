'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { LedgerTransaksiSummary } from '@/types/stok';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useLedgerTransaksiDetail, useOrderDetails } from '@/hooks/useLedger';
import { useOutletScope } from '@/hooks/useOutletScope';
import { createClient } from '@/lib/supabase';
import { formatCompositeSaldoAdaptive, formatCompositeDeltaAdaptive } from '@/lib/format/compositeUnit';
import {
  Search, Download, Upload, Receipt, Trash2, Scale, FileText,
  Clock, Package, PackageOpen, ChevronDown, ChevronUp, CheckCircle2, BookOpen
} from 'lucide-react';
import { GlosariumSatuanModal } from './GlosariumSatuanModal';

const DELIVERY_UNITS: Record<string, { label: string; factorFromLarge: number }> = {
  'SAOS CABE': { label: 'kg', factorFromLarge: 16.5 },
  'SAOS TOMAT': { label: 'kg', factorFromLarge: 16.5 },
  'SAOS SAMYANG': { label: 'kg', factorFromLarge: 20 },
  'MAYONAISE': { label: 'kg', factorFromLarge: 12 },
  'MAYONES': { label: 'kg', factorFromLarge: 12 },
  'KULIT 25': { label: 'pack', factorFromLarge: 1 },
  'KULIT 28': { label: 'pack', factorFromLarge: 1 },
  'KULIT 32': { label: 'pack', factorFromLarge: 1 },
  'AYAM': { label: 'kg', factorFromLarge: 1 },
  'SAPI': { label: 'pcs', factorFromLarge: 1 },
  'KENTANG': { label: 'kg', factorFromLarge: 4 },
  'KEJU': { label: 'pack', factorFromLarge: 24 },
  'TUM': { label: 'kg', factorFromLarge: 1 },
  'BAWANG': { label: 'kg', factorFromLarge: 1 },
  'TEPUNG': { label: 'kg', factorFromLarge: 1 },
  'MINYAK SAYUR': { label: 'kompan', factorFromLarge: 1 },
  'MINYAK': { label: 'kompan', factorFromLarge: 1 },
  'FOIL': { label: 'roll', factorFromLarge: 24 },
  'FOIL (48)': { label: 'roll', factorFromLarge: 48 },
  'SARUNG TANGAN BENING': { label: 'pack', factorFromLarge: 1 },
  'HAND GLOVE': { label: 'pack', factorFromLarge: 1 },
  'KERTAS STRUK': { label: 'roll', factorFromLarge: 1 },
  'THERMAL STRUK': { label: 'roll', factorFromLarge: 1 },
  'PLASTIK BENING': { label: 'pack', factorFromLarge: 5 },
  'PLASTIK BESAR': { label: 'pack', factorFromLarge: 5 },
  'PLASTIK KECIL': { label: 'pack', factorFromLarge: 5 },
  'POLYBAG': { label: 'pack', factorFromLarge: 5 },
  'PLASTIK MERAH': { label: 'pack', factorFromLarge: 5 },
  'PAPER WRAP': { label: 'pack', factorFromLarge: 1 },
  'POWDER TEH': { label: 'kg', factorFromLarge: 1 },
  'POWDER JERUK': { label: 'kg', factorFromLarge: 1 },
  'CUP': { label: 'pcs', factorFromLarge: 1 },
  'TUTUP': { label: 'pcs', factorFromLarge: 1 },
  'SEDOTAN': { label: 'pack', factorFromLarge: 1 },
  'STIKER': { label: 'lembar', factorFromLarge: 100 },
  'MIE': { label: 'bungkus', factorFromLarge: 40 },
  'SAYUR': { label: 'kg', factorFromLarge: 1 },
  'ES BATU CRYSTAL': { label: 'bal', factorFromLarge: 1 },
  'ES BATU': { label: 'bal', factorFromLarge: 1 }
};

function formatDeliveryUnit(qty: number, bahanName: string, isSaldo: boolean = false): string | null {
  const mapping = DELIVERY_UNITS[bahanName.toUpperCase()];
  if (!mapping) return null;
  const converted = Math.round(qty * mapping.factorFromLarge * 100) / 100;
  const sign = (!isSaldo && converted > 0) ? '+' : '';
  return `${sign}${converted} ${mapping.label}`;
}

const LABEL: Record<string, string> = {
  terima_kiriman: 'Terima Kiriman',
  pemakaian: 'Pemakaian',
  waste: 'Waste',
  adjustment: 'Penyesuaian',
  opname_selisih: 'Selisih Opname',
  transfer_keluar: 'Transfer Keluar',
  transfer_masuk: 'Transfer Masuk',
  waste_pending: 'Waste (Menunggu Verifikasi)',
};

const FILTER_LABELS: Record<string, { label: string, icon: any }> = {
  all: { label: 'Semua', icon: Package },
  inbound: { label: 'Masuk', icon: Download },
  order: { label: 'Order', icon: Receipt },
  waste: { label: 'Waste', icon: Trash2 },
  outbound: { label: 'Keluar', icon: Upload },
  adjustment: { label: 'Penyesuaian', icon: Scale },
};

function cleanItemNames(text: string | null): string | null {
  if (!text) return null;
  return text.split(',').map(n => n.replace(/\|ID\|[^|]+/g, '').replace(/\|NOTE\|[^|]+/g, '').trim()).filter(Boolean).join(', ');
}

export function transaksiLabel(t: LedgerTransaksiSummary): { title: string; subtitle: string | null } {
  if (t.ref_order_id) {
    return { 
      title: t.order_number ? `Order #${t.order_number}` : 'Order Selesai', 
      subtitle: cleanItemNames(t.order_items_names ?? null) ?? (t.order_number ? `Order #${t.order_number}` : null) 
    };
  }
  if (t.ref_opname_id) {
    const tanggal = t.opname_tanggal
      ? new Date(t.opname_tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    return { title: 'Opname', subtitle: tanggal ? `${t.opname_tipe ?? ''} — ${tanggal}` : null };
  }
  if (t.ref_shipment_id) {
    const shortId = t.ref_shipment_id.split('-')[0].toUpperCase();
    const isKirim = !!(t.single_qty && t.single_qty < 0);
    const dest = isKirim && t.shipment_dest_outlet_name ? ` ke ${t.shipment_dest_outlet_name}` : '';
    return { title: isKirim ? `Kirim SJ${dest}` : 'Terima Kiriman', subtitle: `Surat Jalan #${shortId}` };
  }
  if (t.ref_transfer_id) {
    return { title: 'Transfer Stok', subtitle: null };
  }
  return { title: LABEL[t.single_tipe ?? ''] ?? (t.single_tipe ?? 'Manual'), subtitle: null };
}

export function transaksiVisual(t: LedgerTransaksiSummary) {
  if (t.ref_order_id) {
    return { icon: Receipt, iconColor: 'text-blue-500', bgClass: 'bg-blue-50 border-blue-100 text-blue-700' };
  }
  if (t.ref_opname_id) {
    return { icon: FileText, iconColor: 'text-amber-500', bgClass: 'bg-amber-50 border-amber-100 text-amber-700' };
  }
  if (t.ref_shipment_id) {
    return { icon: Download, iconColor: 'text-emerald-500', bgClass: 'bg-emerald-50 border-emerald-100 text-emerald-700' };
  }
  if (t.ref_transfer_id) {
    return { icon: Upload, iconColor: 'text-orange-500', bgClass: 'bg-orange-50 border-orange-100 text-orange-700' };
  }
  if (t.single_tipe === 'terima_kiriman' || t.single_tipe === 'transfer_masuk') {
    return { icon: Download, iconColor: 'text-emerald-500', bgClass: 'bg-emerald-50 border-emerald-100 text-emerald-700' };
  }
  if (t.single_tipe === 'waste' || t.single_tipe === 'pemakaian') {
    return { icon: Trash2, iconColor: 'text-rose-500', bgClass: 'bg-rose-50 border-rose-100 text-rose-700' };
  }
  if (t.single_tipe === 'waste_pending') {
    return { icon: Clock, iconColor: 'text-amber-500', bgClass: 'bg-amber-50 border-amber-200 text-amber-700' };
  }
  if (t.single_tipe === 'transfer_keluar') {
    return { icon: Upload, iconColor: 'text-orange-500', bgClass: 'bg-orange-50 border-orange-100 text-orange-700' };
  }
  if (t.single_tipe === 'adjustment' || t.single_tipe === 'opname_selisih') {
    return { icon: Scale, iconColor: 'text-slate-500', bgClass: 'bg-slate-50 border-slate-200 text-slate-700' };
  }
  return { icon: Scale, iconColor: 'text-slate-500', bgClass: 'bg-slate-50 border-slate-200 text-slate-700' };
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

function TransaksiExpandedDetail({ outletId, transaksiKey, isDelivery }: { outletId: string; transaksiKey: string; isDelivery: boolean }) {
  const { rows, loading, error } = useLedgerTransaksiDetail(outletId, transaksiKey, true);

  if (loading) return (
    <div className="flex items-center gap-2 py-3 text-xs font-semibold text-gray-400 animate-pulse">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin"></div>
      Memuat detail...
    </div>
  );
  if (error) return <p className="text-xs font-bold text-rose-500 py-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Gagal memuat: {error}</p>;

  const groupedRows: Record<string, typeof rows> = {};
  
  rows.forEach((r) => {
    let groupKey = 'Detail Transaksi';
    if (r.catatan) {
      const match = r.catatan.match(/\((.*?)\)$/);
      if (match && match[1]) {
        groupKey = cleanItemNames(match[1]) || match[1];
      } else {
        groupKey = r.catatan;
      }
    }
    
    if (!groupedRows[groupKey]) groupedRows[groupKey] = [];
    groupedRows[groupKey].push(r);
  });

  const groupKeys = Object.keys(groupedRows);
  const showGroupHeaders = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== 'Detail Transaksi' && !groupKeys[0].startsWith('Penjualan Otomatis #'));

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
      {groupKeys.map((groupName) => (
        <div key={groupName} className="space-y-2.5">
          {showGroupHeaders && (
            <h5 className="text-[10px] font-bold uppercase text-gray-500 tracking-wider bg-gray-50 px-2 py-1 rounded inline-flex items-center gap-1.5 border border-gray-100">
              <PackageOpen className="w-3 h-3" />
              {groupName}
            </h5>
          )}
          <div className="space-y-2">
            {groupedRows[groupName].map((r) => {
              const bahan = r.bahan_baku;
              const satuan = bahan?.satuan ?? '';
              return (
                <div key={r.id} className={`flex justify-between items-center text-xs ${showGroupHeaders ? 'pl-3 border-l-2 border-gray-100' : ''}`}>
                  <span className="font-semibold text-gray-700 uppercase truncate pr-3">{bahan?.nama ?? 'Bahan'}</span>
                  <span className="text-right flex-shrink-0">
                    <span className={r.qty > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                      {(isDelivery && bahan?.nama) ? (formatDeliveryUnit(r.qty, bahan.nama, false) ?? formatCompositeDeltaAdaptive(r.qty, r.saldo_is_gram, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)) : formatCompositeDeltaAdaptive(r.qty, r.saldo_is_gram, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)}
                    </span>
                    <span className="text-gray-400 font-medium ml-1.5">
                      {' '}→ sisa {(isDelivery && bahan?.nama) ? (formatDeliveryUnit(r.saldo_sesudah, bahan.nama, true) ?? formatCompositeSaldoAdaptive(r.saldo_sesudah, r.saldo_is_gram, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)) : formatCompositeSaldoAdaptive(r.saldo_sesudah, r.saldo_is_gram, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderExpandedDetail({ orderId }: { orderId: string }) {
  const { rows, loading, error } = useOrderDetails(orderId, true);

  if (loading) return (
    <div className="flex items-center gap-2 py-3 text-xs font-semibold text-gray-400 animate-pulse">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin"></div>
      Memuat detail pesanan...
    </div>
  );
  if (error) return <p className="text-xs font-bold text-rose-500 py-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Gagal memuat: {error}</p>;
  if (rows.length === 0) return <p className="text-xs font-medium text-gray-400 py-3">Tidak ada rincian pesanan.</p>;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex justify-between items-center text-xs bg-gray-50/50 px-3 py-2 rounded-xl border border-gray-100">
          <span className="font-semibold text-gray-700 uppercase truncate pr-3">{r.menu_item_name}</span>
          <span className="text-right flex-shrink-0 font-bold text-gray-900 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
            {r.quantity} Porsi
          </span>
        </div>
      ))}
    </div>
  );
}

export function LedgerList({ items }: { items: LedgerTransaksiSummary[] }) {
  const { bahanBaku } = useBahanBaku();
  const { selectedOutletId } = useOutletScope();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showGlosarium, setShowGlosarium] = useState(false);

  const bahanMap = useMemo(() => {
    const map: Record<string, { nama: string; satuan: string; satuanKecil: string | null; faktorTampilan: number | null }> = {};
    for (const b of bahanBaku) {
      map[b.id] = { nama: b.nama, satuan: b.satuan, satuanKecil: b.satuan_kecil, faktorTampilan: b.faktor_tampilan };
    }
    return map;
  }, [bahanBaku]);

  // saldo_is_gram per bahan di outlet ini -- ledger_transaksi_ringkas tidak
  // membawa kolom ini (bukan bahan_baku), jadi di-lookup terpisah dari
  // stok_balance untuk baris manual (single_*) di daftar ringkas ini.
  const manualBahanIds = useMemo(
    () => [...new Set(items.map(t => t.single_bahan_baku_id).filter((id): id is string => !!id))],
    [items]
  );
  const { data: gramMap } = useQuery({
    queryKey: ['ledger-list-saldo-is-gram', selectedOutletId, manualBahanIds],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('stok_balance')
        .select('bahan_baku_id, saldo_is_gram')
        .eq('outlet_id', selectedOutletId as string)
        .in('bahan_baku_id', manualBahanIds);
      return new Map((data ?? []).map((b: any) => [b.bahan_baku_id, b.saldo_is_gram as boolean]));
    },
    enabled: !!selectedOutletId && manualBahanIds.length > 0,
    staleTime: 60000,
    gcTime: 5 * 60000,
  });

  const filteredItems = useMemo(() => {
    return items.filter((t) => {
      const { title, subtitle } = transaksiLabel(t);
      const singleBahan = t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id] : undefined;
      const nameMatch = singleBahan ? singleBahan.nama.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const refMatch = `${title} ${subtitle ?? ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = searchTerm === '' || nameMatch || refMatch;

      let matchesFilter = false;
      if (activeFilter === 'all') {
        matchesFilter = true;
      } else if (activeFilter === 'inbound') {
        const isTerima = !!t.ref_shipment_id || t.single_tipe === 'terima_kiriman' || t.single_tipe === 'transfer_masuk';
        matchesFilter = !t.ref_order_id && isTerima;
      } else if (activeFilter === 'order') {
        matchesFilter = !!t.ref_order_id;
      } else if (activeFilter === 'waste') {
        matchesFilter = t.single_tipe === 'waste' || t.single_tipe === 'waste_pending';
      } else if (activeFilter === 'outbound') {
        matchesFilter = !t.ref_order_id && (!!t.ref_transfer_id && t.single_tipe !== 'transfer_masuk' || t.single_tipe === 'pemakaian' || t.single_tipe === 'transfer_keluar');
      } else if (activeFilter === 'adjustment') {
        matchesFilter = !!t.ref_opname_id || t.single_tipe === 'adjustment' || t.single_tipe === 'opname_selisih';
      }

      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter, bahanMap]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-3 pl-10 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-gray-900 placeholder-gray-400 font-medium transition-all shadow-sm"
            placeholder="Cari nama bahan baku atau nomor order/opname..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          {Object.entries(FILTER_LABELS).map(([key, item]) => {
            const isActive = activeFilter === key;
            const Icon = item.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all border whitespace-nowrap cursor-pointer shadow-sm ${
                  isActive
                    ? 'bg-gray-900 border-gray-900 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowGlosarium(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all border whitespace-nowrap cursor-pointer shadow-sm bg-white border-[#f29744]/40 text-[#f29744] hover:bg-orange-50"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Glosarium
          </button>
        </div>
      </div>

      {showGlosarium && (
        <GlosariumSatuanModal bahanBaku={bahanBaku} onClose={() => setShowGlosarium(false)} />
      )}

      <div className="space-y-3">
        {filteredItems.map((t) => {
          const { title, subtitle } = transaksiLabel(t);
          const isManual = t.jumlah_bahan === 1 && !t.ref_order_id && !t.ref_opname_id && !t.ref_shipment_id && !t.ref_transfer_id;
          const isPending = t.single_tipe === 'waste_pending';
          const isDelivery = !!t.ref_shipment_id || t.single_tipe === 'transfer_keluar' || (t.single_catatan?.includes('KIRIM SJ') ?? false);
          const relativeTime = getRelativeTimeString(t.created_at);
          const isExpanded = expandedKey === t.transaksi_key;
          const detailId = `transaksi-detail-${t.transaksi_key}`;
          // waste_pending = baris stok_waste_reports yang BELUM di-approve --
          // qty-nya sengaja masih besar-scale mentah (WasteModal.tsx/
          // ManualEntryForm tak pernah mengonversinya di client; konversi
          // baru terjadi di trigger process_waste_report_approval SAAT
          // approve, lihat migration 20300105000017 §4). Kalau ditampilkan
          // dengan formatter sadar-gram di sini, angka mentah itu disangka
          // sudah gram-scale dan salah tampil (mis. "1 Blok" jadi "1 Gram").
          const isGram = isPending ? false : (t.single_bahan_baku_id ? (gramMap?.get(t.single_bahan_baku_id) ?? false) : false);

          const { icon: TransIcon, iconColor, bgClass } = transaksiVisual(t);
          const bahan = t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id] : undefined;
          const satuan = bahan?.satuan ?? '';

          const headerRow = (
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border ${bgClass}`}>
                  <TransIcon className={`w-5 h-5 ${iconColor}`} />
                </span>
                <div className="truncate space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      {title}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {relativeTime}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm tracking-tight truncate">
                    {isManual
                      ? (t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id]?.nama ?? 'Bahan Baku' : 'Bahan Baku')
                      : subtitle ?? `${t.jumlah_bahan} bahan`}
                  </h4>
                  {isManual && t.single_catatan && (
                    <p className="text-xs text-gray-500 font-medium truncate flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> {t.single_catatan.replace(/\|ID\|[^|)]+/g, '').replace(/\|NOTE\|[^|)]+/g, '').replace(/\s+\)/g, ')').trim()}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0 space-y-1 pl-4">
                {isManual ? (
                  <>
                    <p className={`font-black text-sm ${(t.single_qty ?? 0) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(isDelivery && bahan?.nama) ? (formatDeliveryUnit(t.single_qty ?? 0, bahan.nama, false) ?? formatCompositeDeltaAdaptive(t.single_qty ?? 0, isGram, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null)) : formatCompositeDeltaAdaptive(t.single_qty ?? 0, isGram, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null)}
                    </p>
                    {isPending ? (
                      <p className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                        Menunggu Verifikasi
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-500 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-200 inline-block">
                        Saldo: {(isDelivery && bahan?.nama) ? (formatDeliveryUnit(t.single_saldo_sesudah ?? 0, bahan.nama, true) ?? formatCompositeSaldoAdaptive(t.single_saldo_sesudah ?? 0, isGram, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null)) : formatCompositeSaldoAdaptive(t.single_saldo_sesudah ?? 0, isGram, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null)}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="flex items-center justify-end gap-1 text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200 transition-colors">
                    {isExpanded ? (
                      <>Tutup <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Detail <ChevronDown className="w-3 h-3" /></>
                    )}
                  </span>
                )}
              </div>
            </div>
          );

          if (isManual) {
            const innerClasses = isPending
              ? "bg-white rounded-2xl border border-amber-200 p-4.5 shadow-sm mb-3 opacity-90 block"
              : "bg-white rounded-2xl border border-gray-100 p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-gray-200 hover:shadow-md transition-all duration-200 mb-3 cursor-pointer active:scale-[0.98] block";

            const inner = (
              <div className={innerClasses}>
                {headerRow}
              </div>
            );

            if (isPending) {
              return <div key={t.transaksi_key}>{inner}</div>;
            }

            return (
              <Link key={t.transaksi_key} href={`/stok/ledger/${t.transaksi_key}`}>
                {inner}
              </Link>
            );
          }

          return (
            <div
              key={t.transaksi_key}
              className="bg-white rounded-2xl border border-gray-100 p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-gray-200 hover:shadow-md transition-all duration-200 mb-3"
            >
              <button
                type="button"
                className="w-full text-left cursor-pointer active:scale-[0.99] transition-all focus:outline-none"
                onClick={() => setExpandedKey(isExpanded ? null : t.transaksi_key)}
                aria-expanded={isExpanded}
                aria-controls={detailId}
              >
                {headerRow}
              </button>

              {isExpanded && selectedOutletId && (
                <div id={detailId}>
                  {t.ref_order_id ? (
                    <OrderExpandedDetail orderId={t.ref_order_id} />
                  ) : (
                    <TransaksiExpandedDetail outletId={selectedOutletId} transaksiKey={t.transaksi_key} isDelivery={isDelivery} />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-bold text-base text-gray-900">Belum Ada Catatan Pergerakan</p>
            <p className="text-sm text-gray-500 mt-1 max-w-[250px] text-center">Tidak ada transaksi yang cocok dengan pencarian atau filter Anda saat ini.</p>
          </div>
        )}
      </div>
    </div>
  );
}

