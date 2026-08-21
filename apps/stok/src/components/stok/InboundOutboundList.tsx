'use client';

import React, { useMemo } from 'react';
import { InboundOutbound } from '@/types/stok';
import { format, isToday, isYesterday } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar, ArrowDownCircle, ArrowUpCircle, PackageOpen, Store } from 'lucide-react';

interface Props {
  items: InboundOutbound[];
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return `Hari Ini — ${format(date, 'EEEE, dd MMMM yyyy', { locale: id })}`;
  }
  if (isYesterday(date)) {
    return `Kemarin — ${format(date, 'EEEE, dd MMMM yyyy', { locale: id })}`;
  }
  return format(date, 'EEEE, dd MMMM yyyy', { locale: id });
}

const DELIVERY_UNITS_FALLBACK: Record<string, { label: string; factorFromLarge: number }> = {
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

function getEffectivePrice(item: InboundOutbound): number | null {
  if (item.harga_satuan !== null && item.harga_satuan !== undefined) {
    return Number(item.harga_satuan);
  }
  const liveHarga = (item.bahan_baku as any)?.bahan_baku_harga;
  if (Array.isArray(liveHarga) && liveHarga.length > 0) {
    const p = liveHarga[0].harga_beli_display ?? liveHarga[0].harga_beli;
    return p ? Number(p) : null;
  }
  if (liveHarga && typeof liveHarga === 'object') {
    const p = liveHarga.harga_beli_display ?? liveHarga.harga_beli;
    return p ? Number(p) : null;
  }
  return null;
}

function getDistribusiCalculation(item: InboundOutbound): { qtyNumber: number; unitLabel: string; displayText: string; totalNilai: number | null } {
  const bahan = item.bahan_baku;
  const numQty = Number(item.qty);
  const effectivePrice = getEffectivePrice(item);

  if (!bahan) {
    return {
      qtyNumber: numQty,
      unitLabel: 'satuan',
      displayText: numQty.toLocaleString('id-ID'),
      totalNilai: effectivePrice ? Math.round(numQty * effectivePrice) : null
    };
  }

  const rawDistUnit = bahan.satuan_distribusi?.trim() || DELIVERY_UNITS_FALLBACK[bahan.nama.toUpperCase()]?.label || bahan.satuan || 'satuan';
  const satuanKecil = bahan.satuan_kecil?.toLowerCase();
  const satuanTengah = bahan.satuan_tengah?.toLowerCase();
  const satuanBesar = bahan.satuan?.toLowerCase();
  const targetDist = rawDistUnit.toLowerCase();

  let convertedQty = numQty;

  // Konversi kuantitas dari skala basis (small unit / gram) ke satuan distribusi
  if (bahan.faktor_tampilan && bahan.faktor_tampilan > 1) {
    if (targetDist === 'kg' && (satuanKecil === 'gram' || satuanKecil === 'gr')) {
      convertedQty = numQty / 1000;
    } else if (satuanTengah && targetDist === satuanTengah && bahan.faktor_tengah) {
      const perTengah = bahan.faktor_tampilan / bahan.faktor_tengah;
      convertedQty = numQty / perTengah;
    } else if (targetDist === satuanBesar) {
      convertedQty = numQty / bahan.faktor_tampilan;
    } else if (targetDist === satuanKecil) {
      convertedQty = numQty;
    } else if (DELIVERY_UNITS_FALLBACK[bahan.nama.toUpperCase()]) {
      const fallback = DELIVERY_UNITS_FALLBACK[bahan.nama.toUpperCase()];
      const largeQty = numQty / bahan.faktor_tampilan;
      convertedQty = largeQty * fallback.factorFromLarge;
    } else {
      convertedQty = numQty / bahan.faktor_tampilan;
    }
  }

  const roundedQty = Math.round(convertedQty * 100) / 100;
  const totalNilai = effectivePrice ? Math.round(roundedQty * effectivePrice) : null;

  return {
    qtyNumber: roundedQty,
    unitLabel: rawDistUnit,
    displayText: `${roundedQty.toLocaleString('id-ID')} ${rawDistUnit}`,
    totalNilai
  };
}

interface BatchGroup {
  batchKey: string;
  catatan: string | null;
  isShipment: boolean;
  totalNominal: number;
  items: InboundOutbound[];
}

interface DateGroup {
  dateStr: string;
  inCount: number;
  outCount: number;
  inTotalNominal: number;
  outTotalNominal: number;
  batches: BatchGroup[];
}

export function InboundOutboundList({ items }: Props) {
  const groupedByDate = useMemo<DateGroup[]>(() => {
    const groups: Record<string, {
      dateStr: string;
      inCount: number;
      outCount: number;
      inTotalNominal: number;
      outTotalNominal: number;
      batchesMap: Record<string, BatchGroup>;
      batchOrder: string[];
    }> = {};

    items.forEach((item) => {
      const dateKey = format(new Date(item.created_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateStr: item.created_at,
          inCount: 0,
          outCount: 0,
          inTotalNominal: 0,
          outTotalNominal: 0,
          batchesMap: {},
          batchOrder: [],
        };
      }

      const calc = getDistribusiCalculation(item);
      if (item.tipe === 'IN') {
        groups[dateKey].inCount += 1;
        if (calc.totalNilai) groups[dateKey].inTotalNominal += calc.totalNilai;
      }
      if (item.tipe === 'OUT') {
        groups[dateKey].outCount += 1;
        if (calc.totalNilai) groups[dateKey].outTotalNominal += calc.totalNilai;
      }

      const isShipment = Boolean(item.catatan && item.catatan.startsWith('Kirim ke '));
      const batchKey = isShipment ? `sj_${item.catatan}` : `item_${item.id}`;

      if (!groups[dateKey].batchesMap[batchKey]) {
        groups[dateKey].batchesMap[batchKey] = {
          batchKey,
          catatan: item.catatan || null,
          isShipment,
          totalNominal: 0,
          items: [],
        };
        groups[dateKey].batchOrder.push(batchKey);
      }

      groups[dateKey].batchesMap[batchKey].items.push(item);
      if (calc.totalNilai) {
        groups[dateKey].batchesMap[batchKey].totalNominal += calc.totalNilai;
      }
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, group]) => ({
        dateStr: group.dateStr,
        inCount: group.inCount,
        outCount: group.outCount,
        inTotalNominal: group.inTotalNominal,
        outTotalNominal: group.outTotalNominal,
        batches: group.batchOrder.map((key) => group.batchesMap[key]),
      }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-12 text-center shadow-xs flex flex-col items-center justify-center">
        <div className="w-14 h-14 bg-suka-cream/50 rounded-2xl flex items-center justify-center mb-3">
          <PackageOpen className="w-7 h-7 text-suka-brown/40" />
        </div>
        <p className="text-suka-brown font-bold text-sm">Belum ada riwayat pergerakan stok</p>
        <p className="text-suka-brown/50 text-xs mt-1">Tidak ada transaksi yang cocok dengan filter atau pencarian saat ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedByDate.map((group, gIdx) => {
        return (
          <div key={gIdx} className="space-y-2.5">
            {/* Date Group Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-suka-brown/10 flex items-center justify-center text-suka-brown">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-extrabold text-suka-brown tracking-tight">
                  {formatDateHeader(group.dateStr)}
                </h3>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-black uppercase flex-wrap">
                {group.inCount > 0 && (
                  <span className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <ArrowDownCircle className="w-3.5 h-3.5" /> {group.inCount} Masuk {group.inTotalNominal > 0 && `(Rp ${group.inTotalNominal.toLocaleString('id-ID')})`}
                  </span>
                )}
                {group.outCount > 0 && (
                  <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <ArrowUpCircle className="w-3.5 h-3.5" /> {group.outCount} Keluar {group.outTotalNominal > 0 && `(Rp ${group.outTotalNominal.toLocaleString('id-ID')})`}
                  </span>
                )}
              </div>
            </div>

            {/* Table Container for the Date Group */}
            <div className="bg-white border border-suka-brown/10 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                  <thead className="bg-[#fcfaf8] border-b border-suka-brown/10 text-suka-brown/70 font-bold tracking-wider uppercase text-[10px]">
                    <tr>
                      <th className="px-5 py-3 w-20">Waktu</th>
                      <th className="px-5 py-3">Bahan Baku</th>
                      <th className="px-5 py-3">Tipe & Kategori</th>
                      <th className="px-5 py-3 text-right">Jumlah Satuan</th>
                      <th className="px-5 py-3 text-right">Harga Beli / Satuan</th>
                      <th className="px-5 py-3 text-right">Total Nilai (Rp)</th>
                      <th className="px-5 py-3">Catatan / Tujuan</th>
                      <th className="px-5 py-3">Pencatat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-brown/5 text-suka-brown/80 font-medium">
                    {group.batches.map((batch, bIdx) => {
                      return batch.items.map((item, itemIdx) => {
                        const isOut = item.tipe === 'OUT';
                        const sign = isOut ? '-' : '+';
                        const colorClass = isOut ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200';
                        const calc = getDistribusiCalculation(item);
                        const effectivePrice = getEffectivePrice(item);
                        const isFirstInBatch = itemIdx === 0;
                        const isNewBatch = isFirstInBatch && bIdx > 0;
                        const batchBorderClass = isNewBatch ? 'border-t-2 border-suka-brown/30' : 'border-t border-suka-brown/5';
                        const rowSpan = batch.items.length;

                        return (
                          <tr key={item.id} className={`hover:bg-[#fcfaf8] transition-colors ${batchBorderClass}`}>
                            <td className="px-5 py-3.5 text-xs font-bold text-suka-brown/60">
                              {format(new Date(item.created_at), 'HH:mm')}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-suka-brown text-sm">
                                {item.bahan_baku?.nama || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded border uppercase text-[10px] font-black ${colorClass}`}>
                                  {item.tipe}
                                </span>
                                <span className="text-xs font-semibold text-suka-brown/80">
                                  {item.kategori}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <span className={`font-black text-sm ${isOut ? 'text-red-600' : 'text-green-700'}`}>
                                {sign} {calc.displayText}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              {effectivePrice ? (
                                <span className="text-xs font-bold text-suka-brown">
                                  Rp {effectivePrice.toLocaleString('id-ID')} <span className="text-[11px] font-medium text-suka-brown/60">/ {calc.unitLabel.toLowerCase()}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-suka-brown/30">-</span>
                              )}
                            </td>

                            {/* MERGED TOTAL NILAI (DIJUMLAHKAN LANGSUNG PER PENGIRIMAN) */}
                            {batch.isShipment ? (
                              isFirstInBatch && (
                                <td 
                                  rowSpan={rowSpan} 
                                  className="px-5 py-3.5 text-right whitespace-nowrap align-middle border-l border-r border-suka-brown/10 bg-red-50/20"
                                >
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-sm font-black text-red-700 bg-red-100/80 border border-red-200 px-3 py-1.5 rounded-xl shadow-2xs">
                                      Rp {batch.totalNominal.toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-[10px] font-bold text-suka-brown/60 pr-1">
                                      ({batch.items.length} item kirim)
                                    </span>
                                  </div>
                                </td>
                              )
                            ) : (
                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                {calc.totalNilai !== null ? (
                                  <span className={`text-xs font-extrabold ${isOut ? 'text-red-700' : 'text-green-800'}`}>
                                    Rp {calc.totalNilai.toLocaleString('id-ID')}
                                  </span>
                                ) : (
                                  <span className="text-xs text-suka-brown/30">-</span>
                                )}
                              </td>
                            )}

                            {/* MERGED CATATAN / TUJUAN */}
                            {batch.isShipment ? (
                              isFirstInBatch && (
                                <td 
                                  rowSpan={rowSpan} 
                                  className="px-5 py-3.5 text-xs align-middle border-r border-suka-brown/10 bg-[#fffaf5]"
                                >
                                  <div className="flex items-center gap-1.5 font-extrabold text-suka-brown" title={batch.catatan || ''}>
                                    <Store className="w-4 h-4 text-suka-orange shrink-0" />
                                    <span className="text-xs">{batch.catatan}</span>
                                  </div>
                                </td>
                              )
                            ) : (
                              <td className="px-5 py-3.5 text-xs">
                                {item.catatan ? (
                                  <span className="text-suka-brown/70 block" title={item.catatan}>
                                    {item.catatan}
                                  </span>
                                ) : (
                                  <span className="text-suka-brown/30">-</span>
                                )}
                              </td>
                            )}

                            {/* MERGED PENCATAT */}
                            {batch.isShipment ? (
                              isFirstInBatch && (
                                <td 
                                  rowSpan={rowSpan} 
                                  className="px-5 py-3.5 text-xs font-bold text-suka-brown/80 align-middle bg-[#fcfaf8]"
                                >
                                  {item.outlet_staff?.name || 'Sistem'}
                                </td>
                              )
                            ) : (
                              <td className="px-5 py-3.5 text-xs font-medium text-suka-brown/70">
                                {item.outlet_staff?.name || 'Sistem'}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
