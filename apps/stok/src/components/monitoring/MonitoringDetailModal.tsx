'use client';

import React, { useEffect, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { fetchItemDetail } from '@/lib/queries/monitoring';
import type { MonitoringItem, DetailItem } from '@/lib/types/monitoring';

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
      .catch((err) => setError(err?.message || 'Failed to load details'))
      .finally(() => setIsLoading(false));
  }, [isOpen, item.outlet_id, item.bahan_baku_id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#fff8f1] rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-[#d9c2b2]/35 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#701604] to-[#a43c26] p-5 text-white flex justify-between items-center border-b border-[#701604]/10 z-10">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tight">{item.item_name}</h2>
            <p className="text-[11px] font-semibold opacity-85 mt-0.5 uppercase tracking-wider">{item.outlet_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-all active:scale-90"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 flex-1">
          {isLoading ? (
            <div className="text-center py-8 text-sm font-semibold text-[#544437]/75 animate-pulse">Loading details...</div>
          ) : error ? (
            <div className="bg-[#ffdad6] text-[#ba1a1a] p-4 rounded-xl border border-[#ba1a1a]/25 text-xs font-bold">
              Error: {error}
            </div>
          ) : detail ? (
            <>
              {/* Current Status */}
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-[#d9c2b2]/40 shadow-sm">
                <div>
                  <p className="text-[10px] font-bold text-[#544437]/70 uppercase tracking-wider">Stok Aktual</p>
                  <p className="text-2xl font-black text-[#904d00] mt-1">
                    {detail.current_qty} <span className="text-xs font-bold text-[#544437]/50 capitalize">{detail.satuan}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#544437]/70 uppercase tracking-wider">Threshold</p>
                  <p className="text-2xl font-black text-[#544437] mt-1">
                    {detail.threshold} <span className="text-xs font-bold text-[#544437]/50 capitalize">{detail.satuan}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#544437]/70 uppercase tracking-wider">Status Stok</p>
                  <div className="mt-1.5">
                    <StatusBadge status={detail.status} isFlagged={detail.is_flagged} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#544437]/70 uppercase tracking-wider">Opname Terakhir</p>
                  <p className="text-sm font-bold text-[#544437] mt-1.5">
                    {detail.last_opname_date
                      ? new Date(detail.last_opname_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Discrepancy Details */}
              {detail.discrepancy_details && (
                <div className="bg-[#ffdcc2]/20 border border-[#f29744]/35 p-4 rounded-xl space-y-2.5">
                  <h3 className="font-bold text-xs text-[#a43c26] uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚠️</span> Flagged Discrepancy
                  </h3>
                  <dl className="space-y-1.5 text-xs text-[#544437] font-medium">
                    <div className="flex justify-between border-b border-[#f29744]/15 pb-1">
                      <dt className="text-[#544437]/70">Jenis Selisih:</dt>
                      <dd className="font-bold text-[#a43c26] capitalize">{detail.discrepancy_details.type.replace('_', ' ')}</dd>
                    </div>
                    <div className="flex justify-between border-b border-[#f29744]/15 pb-1">
                      <dt className="text-[#544437]/70">Stok Sistem:</dt>
                      <dd className="font-bold">
                        <span>{detail.discrepancy_details.qty_system}</span>
                        <span className="text-xs font-normal text-[#544437]/60 ml-1 capitalize">{detail.satuan}</span>
                      </dd>
                    </div>
                    <div className="flex justify-between border-b border-[#f29744]/15 pb-1">
                      <dt className="text-[#544437]/70">Stok Fisik:</dt>
                      <dd className="font-bold text-[#ba1a1a]">
                        <span>{detail.discrepancy_details.qty_fisik}</span>
                        <span className="text-xs font-normal text-[#544437]/60 ml-1 capitalize">{detail.satuan}</span>
                      </dd>
                    </div>
                    {detail.discrepancy_details.catatan && (
                      <div className="pt-1">
                        <dt className="text-[#544437]/70 font-semibold mb-1">Catatan SPV:</dt>
                        <dd className="font-bold text-[#1e1b15] bg-white/60 p-2 rounded-lg border border-[#f29744]/15 italic">
                          {detail.discrepancy_details.catatan}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Recent Ledger */}
              {detail.recent_ledger && detail.recent_ledger.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-[#544437]/80 uppercase tracking-wider">Recent Movements</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 no-scrollbar">
                    {detail.recent_ledger.map((ledger, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-start p-3 bg-white border border-[#d9c2b2]/30 rounded-xl shadow-xs"
                      >
                        <div className="flex-1 space-y-0.5">
                          <p className="font-bold text-xs text-[#1e1b15] capitalize">{ledger.type.replace('_', ' ')}</p>
                          {ledger.notes && (
                            <p className="text-xs text-[#544437]/80 italic">{ledger.notes}</p>
                          )}
                          <p className="text-[10px] text-[#544437]/60 font-semibold pt-1">
                            {new Date(ledger.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        <p className={`font-black text-sm ml-4 whitespace-nowrap ${ledger.qty > 0 ? 'text-[#006e24]' : 'text-[#ba1a1a]'}`}>
                          {ledger.qty > 0 ? '+' : ''}{ledger.qty} {detail.satuan}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="border-t border-[#d9c2b2]/20 pt-4 text-[10px] text-[#544437]/60 font-bold uppercase tracking-wider">
                <p>Last updated: {new Date(detail.last_updated).toLocaleString('id-ID')}</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-[#faf2e9]/50 p-4 border-t border-[#d9c2b2]/25 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#d9c2b2]/50 text-[#544437] bg-white rounded-xl text-xs font-bold hover:bg-[#faf2e9] active:scale-95 transition-all shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
