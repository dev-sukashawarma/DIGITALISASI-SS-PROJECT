'use client';

import React, { useEffect, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { fetchItemDetail } from '@/lib/queries/monitoring';
import type { MonitoringItem, DetailItem } from '@/lib/types/monitoring';
import { formatCompositeSaldoAdaptive, formatCompositeDeltaAdaptive, formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit';

interface MonitoringDetailModalProps {
  item: MonitoringItem;
  onClose: () => void;
  isOpen: boolean;
}

export function MonitoringDetailModal({ item, onClose, isOpen }: MonitoringDetailModalProps) {
  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    fetchItemDetail(item.outlet_id, item.bahan_baku_id)
      .then(setDetail)
      .catch((err) => setError(err?.message || 'Gagal memuat rincian stok'))
      .finally(() => setIsLoading(false));
  }, [isOpen, item.outlet_id, item.bahan_baku_id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-[#fff8f1] rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-[#d9c2b2]/35 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-suka-brown to-[#a43c26] p-5 text-white flex justify-between items-center border-b border-suka-brown/10 z-10 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold uppercase tracking-tight">{item.item_name}</h2>
            </div>
            <p className="text-[11px] font-semibold opacity-85 mt-0.5 uppercase tracking-wider">{item.outlet_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-all active:scale-90 cursor-pointer"
            aria-label="Tutup modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 flex-1">
          {isLoading ? (
            <div className="text-center py-8 text-sm font-semibold text-suka-brown/70 animate-pulse">Memuat rincian stok...</div>
          ) : error ? (
            <div className="bg-[#ffdad6] text-[#ba1a1a] p-4 rounded-xl border border-[#ba1a1a]/25 text-xs font-bold">
              Error: {error}
            </div>
          ) : detail ? (
            <>
              {/* Unit Info */}
              {(detail.satuan_kecil || detail.satuan_tengah) && (
                <div className="bg-white border border-[#d9c2b2]/50 p-2.5 rounded-xl text-suka-brown text-xs font-semibold flex items-center gap-2 shadow-xs">
                  <span className="text-sm">ℹ️</span>
                  <span>
                    Keterangan: 1 <span className="capitalize">{detail.satuan}</span> 
                    {detail.satuan_tengah && detail.faktor_tengah ? ` = ${detail.faktor_tengah} ` : ''}
                    {detail.satuan_tengah && detail.faktor_tengah ? <span className="capitalize">{detail.satuan_tengah}</span> : ''}
                    {detail.satuan_kecil && detail.faktor_tampilan ? ` = ${detail.faktor_tampilan} ` : ''}
                    {detail.satuan_kecil && detail.faktor_tampilan ? <span className="capitalize">{detail.satuan_kecil}</span> : ''}
                    {detail.satuan_tengah && detail.faktor_tengah && detail.satuan_kecil && detail.faktor_tampilan && (
                      <span className="ml-1 text-suka-brown/80">
                        (1 <span className="capitalize">{detail.satuan_tengah}</span> = {detail.faktor_tampilan / detail.faktor_tengah} <span className="capitalize">{detail.satuan_kecil}</span>)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Current Status */}
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-[#d9c2b2]/40 shadow-xs">
                <div>
                  <p className="text-[10px] font-bold text-suka-brown/70 uppercase tracking-wider">Stok Aktual</p>
                  <p className="text-2xl font-black text-suka-orange mt-1">
                    {formatCompositeSaldoAdaptive(detail.current_qty, detail.saldo_is_gram, detail.satuan ?? '', detail.satuan_kecil, detail.faktor_tampilan)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-suka-brown/70 uppercase tracking-wider">Batas Minimum</p>
                  <p className="text-2xl font-black text-suka-brown mt-1">
                    {detail.threshold} <span className="text-xs font-bold text-suka-brown/50 capitalize">{detail.satuan}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-suka-brown/70 uppercase tracking-wider">Status Stok</p>
                  <div className="mt-1.5">
                    <StatusBadge status={detail.status} isFlagged={detail.is_flagged} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-suka-brown/70 uppercase tracking-wider">Opname Terakhir</p>
                  <p className="text-sm font-bold text-suka-brown mt-1.5">
                    {detail.last_opname_date
                      ? new Date(detail.last_opname_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Belum pernah'}
                  </p>
                </div>
              </div>

              {/* Discrepancy Details */}
              {detail.discrepancy_details && (() => {
                let parsedRaw: { f?: string; s?: string; d?: string; t?: string } | null = null;
                let manualCatatan: string | null = null;

                if (detail.discrepancy_details.catatan) {
                  const rawCatatan = detail.discrepancy_details.catatan;
                  if (rawCatatan.startsWith('[RAW]')) {
                    try {
                      parsedRaw = JSON.parse(rawCatatan.replace(/^\[RAW\]\s*/, ''));
                    } catch {
                      manualCatatan = rawCatatan;
                    }
                  } else {
                    manualCatatan = rawCatatan;
                  }
                }

                const formatDiscrepancyQty = (qty: number) => {
                  return formatTriUnitSaldoFromGram(
                    qty,
                    detail.satuan ?? '',
                    detail.satuan_tengah,
                    detail.faktor_tengah,
                    detail.satuan_kecil,
                    detail.faktor_tampilan
                  );
                };

                const formattedPemakaian = detail.discrepancy_details.pemakaian_bom
                  ? formatDiscrepancyQty(detail.discrepancy_details.pemakaian_bom)
                  : null;
                const formattedSystem = parsedRaw?.s || formatDiscrepancyQty(detail.discrepancy_details.qty_system);
                const formattedFisik = parsedRaw?.f || formatDiscrepancyQty(detail.discrepancy_details.qty_fisik);
                const deltaQty = detail.discrepancy_details.qty_fisik - detail.discrepancy_details.qty_system;
                const formattedDelta = parsedRaw?.d || formatDiscrepancyQty(deltaQty);

                return (
                  <div className="bg-[#ffdcc2]/20 border border-suka-orange/35 p-4 rounded-xl space-y-2.5">
                    <h3 className="font-bold text-xs text-[#a43c26] uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚠️</span> Selisih Opname Fisik (Flagged)
                    </h3>
                    <dl className="space-y-1.5 text-xs text-suka-brown font-medium">
                      <div className="flex justify-between border-b border-suka-orange/15 pb-1">
                        <dt className="text-suka-brown/70">Jenis Selisih:</dt>
                        <dd className="font-bold text-[#a43c26] capitalize">{detail.discrepancy_details.type.replace('_', ' ')}</dd>
                      </div>
                      {formattedPemakaian && (
                        <div className="flex justify-between border-b border-suka-orange/15 pb-1 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          <dt className="text-suka-brown font-semibold flex items-center gap-1">
                            <span>🍽️</span> Terpakai Penjualan (BOM):
                          </dt>
                          <dd className="font-bold text-[#a43c26]">
                            {formattedPemakaian}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-suka-orange/15 pb-1">
                        <dt className="text-suka-brown/70">Stok Sistem:</dt>
                        <dd className="font-bold text-gray-900">
                          {formattedSystem}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-suka-orange/15 pb-1">
                        <dt className="text-suka-brown/70">Stok Fisik:</dt>
                        <dd className="font-bold text-[#ba1a1a]">
                          {formattedFisik}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-suka-orange/15 pb-1">
                        <dt className="text-suka-brown/70">Selisih:</dt>
                        <dd className={`font-black ${deltaQty < 0 ? 'text-[#ba1a1a]' : 'text-[#006e24]'}`}>
                          {deltaQty > 0 && !formattedDelta.startsWith('+') && !formattedDelta.startsWith('-') ? `+${formattedDelta}` : formattedDelta}
                        </dd>
                      </div>
                      {parsedRaw?.t && (
                        <div className="flex justify-between border-b border-suka-orange/15 pb-1">
                          <dt className="text-[#0a7d2c] font-bold">🎯 Target Kitchen:</dt>
                          <dd className="font-bold text-[#0a7d2c]">
                            {parsedRaw.t}
                          </dd>
                        </div>
                      )}
                      {manualCatatan && (
                        <div className="pt-1">
                          <dt className="text-suka-brown/70 font-semibold mb-1">Catatan Opname:</dt>
                          <dd className="font-bold text-gray-900 bg-white/60 p-2 rounded-lg border border-suka-orange/15 italic">
                            {manualCatatan}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                );
              })()}

              {/* Recent Ledger */}
              {detail.recent_ledger && detail.recent_ledger.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-suka-brown/80 uppercase tracking-wider">Pergerakan Stok Terakhir</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {detail.recent_ledger.map((ledger, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-start p-3 bg-white border border-[#d9c2b2]/30 rounded-xl shadow-xs"
                      >
                        <div className="flex-1 space-y-0.5">
                          <p className="font-bold text-xs text-gray-900 capitalize">{ledger.type.replace('_', ' ')}</p>
                          {ledger.notes && (
                            <p className="text-xs text-suka-brown/80 italic">{ledger.notes}</p>
                          )}
                          <p className="text-[10px] text-suka-brown/60 font-semibold pt-1">
                            {new Date(ledger.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        <p className={`font-black text-sm ml-4 whitespace-nowrap ${ledger.qty > 0 ? 'text-[#006e24]' : 'text-[#ba1a1a]'}`}>
                          {formatCompositeDeltaAdaptive(ledger.qty, detail.saldo_is_gram, detail.satuan ?? '', detail.satuan_kecil, detail.faktor_tampilan)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="border-t border-[#d9c2b2]/20 pt-4 text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider">
                <p>Terakhir diperbarui: {new Date(detail.last_updated).toLocaleString('id-ID')}</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-[#faf2e9]/50 p-4 border-t border-[#d9c2b2]/25 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#d9c2b2]/50 text-suka-brown bg-white rounded-xl text-xs font-bold hover:bg-[#faf2e9] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
