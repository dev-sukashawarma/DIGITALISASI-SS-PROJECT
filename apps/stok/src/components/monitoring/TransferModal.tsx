'use client';

import React, { useState, useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';

interface TransferModalProps {
  item: MonitoringItem | null;
  allInventory: MonitoringItem[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sourceOutletId: string, qty: number) => void;
}

export function TransferModal({
  item,
  allInventory,
  isOpen,
  onClose,
  onConfirm,
}: TransferModalProps) {
  const [sourceOutletId, setSourceOutletId] = useState('');
  const [qty, setQty] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Find other outlets that have this item
  const otherOutletsStock = useMemo(() => {
    if (!item) return [];
    return allInventory
      .filter((inv) => inv.bahan_baku_id === item.bahan_baku_id && inv.outlet_id !== item.outlet_id)
      .map((inv) => ({
        outlet_id: inv.outlet_id,
        outlet_name: inv.outlet_name,
        qty: inv.current_qty,
      }))
      .filter((inv) => inv.qty > 0); // Only suggest outlets with stock
  }, [item, allInventory]);

  if (!isOpen || !item) return null;

  const selectedSource = otherOutletsStock.find((o) => o.outlet_id === sourceOutletId);
  const isValid = sourceOutletId && qty && !isNaN(Number(qty)) && Number(qty) > 0 && (!selectedSource || Number(qty) <= selectedSource.qty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      if (selectedSource && Number(qty) > selectedSource.qty) {
        setErrorMsg(`Stok tidak mencukupi (Maksimal: ${selectedSource.qty})`);
      } else {
        setErrorMsg('Harap masukkan data transfer dengan benar');
      }
      return;
    }
    setErrorMsg('');
    onConfirm(sourceOutletId, Number(qty));
    setSourceOutletId('');
    setQty('');
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#fff8f1] w-full max-w-md rounded-2xl border border-[#d9c2b2]/35 p-5 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-[#d9c2b2]/20 pb-3">
          <h2 className="text-base font-bold text-[#701604] uppercase tracking-tight">Transfer Stok Bahan Baku</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#544437] hover:bg-[#faf2e9] text-base transition-colors"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#d9c2b2]/35 space-y-1 shadow-xs">
          <p className="text-[10px] text-[#544437]/60 uppercase font-bold tracking-wider">Tujuan Transfer</p>
          <p className="font-bold text-[#1e1b15] text-sm uppercase">{item.outlet_name}</p>
          <p className="text-xs text-[#544437]">
            Bahan: <span className="font-bold text-[#904d00]">{item.item_name}</span> (Stok Saat Ini: {item.current_qty} {item.satuan})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-[#544437] uppercase tracking-wider">PILIH OUTLET ASAL (SUMBER)</label>
            <select
              value={sourceOutletId}
              onChange={(e) => {
                setSourceOutletId(e.target.value);
                setErrorMsg('');
              }}
              className="w-full border border-[#d9c2b2]/45 rounded-xl p-2.5 text-sm bg-white text-[#1e1b15] focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] shadow-xs"
              required
            >
              <option value="">— Pilih Outlet Asal —</option>
              {otherOutletsStock.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  {o.outlet_name.replace('SUKA SHAWARMA ', '')} (Tersedia: {o.qty} {item.satuan})
                </option>
              ))}
            </select>
            {otherOutletsStock.length === 0 && (
              <p className="text-xs text-[#ba1a1a] font-semibold mt-1">
                ⚠️ Tidak ada outlet lain yang memiliki stok bahan ini.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-[#544437] uppercase tracking-wider">JUMLAH TRANSFER</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="0.00"
                className="flex-1 border border-[#d9c2b2]/45 rounded-xl p-2.5 text-sm bg-white text-[#1e1b15] focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] shadow-xs"
                required
              />
              <span className="text-sm font-bold text-[#544437]/70 bg-[#faf2e9] px-3 py-2 rounded-xl border border-[#d9c2b2]/30 capitalize">
                {item.satuan || 'kg'}
              </span>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-[#ba1a1a] bg-[#ffdad6]/40 p-2.5 rounded-xl border border-[#ba1a1a]/20 font-bold">
              ⚠️ {errorMsg}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#d9c2b2]/50 rounded-xl text-xs font-bold text-[#544437] bg-white hover:bg-[#faf2e9] active:scale-95 transition-all shadow-xs"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm active:scale-95 ${
                isValid
                  ? 'bg-[#f29744] hover:bg-[#d97c2b] text-[#643400]'
                  : 'bg-gray-300 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
            >
              Kirim Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
