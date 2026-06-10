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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-suka-cream w-full max-w-md rounded-lg border border-suka-brown/20 p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-suka-brown/10 pb-3">
          <h2 className="text-lg font-bold text-suka-brown">Transfer Stok Bahan Baku</h2>
          <button onClick={onClose} className="text-suka-brown hover:text-suka-orange transition-colors">
            ✕
          </button>
        </div>

        <div className="bg-white p-3 rounded-md border border-suka-brown/10 space-y-1">
          <p className="text-xs text-suka-brown/60 uppercase font-semibold">Tujuan Transfer</p>
          <p className="font-bold text-suka-ink">{item.outlet_name}</p>
          <p className="text-sm text-suka-brown">
            Bahan: <span className="font-medium text-suka-ink">{item.item_name}</span> (Stok Saat Ini: {item.current_qty})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-suka-brown">PILIH OUTLET ASAL (SUMBER)</label>
            <select
              value={sourceOutletId}
              onChange={(e) => {
                setSourceOutletId(e.target.value);
                setErrorMsg('');
              }}
              className="w-full border border-suka-brown/20 rounded p-2 text-sm bg-white text-suka-ink focus:outline-none focus:ring-1 focus:ring-suka-orange"
              required
            >
              <option value="">— Pilih Outlet Asal —</option>
              {otherOutletsStock.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  {o.outlet_name} (Tersedia: {o.qty})
                </option>
              ))}
            </select>
            {otherOutletsStock.length === 0 && (
              <p className="text-xs text-red-600 mt-1">
                Tidak ada outlet lain yang memiliki stok bahan ini.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-suka-brown">JUMLAH TRANSFER</label>
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
                className="flex-1 border border-suka-brown/20 rounded p-2 text-sm bg-white text-suka-ink focus:outline-none focus:ring-1 focus:ring-suka-orange"
                required
              />
              <span className="text-sm font-semibold text-suka-brown">
                {item.item_name.includes('GAS') || item.item_name.includes('KULIT') ? 'pcs' : 'kg'}
              </span>
            </div>
          </div>

          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-suka-brown/20 rounded text-sm font-medium text-suka-brown hover:bg-white transition-colors"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={`px-4 py-2 rounded text-sm font-bold text-white transition-colors ${
                isValid
                  ? 'bg-suka-orange hover:bg-suka-orange/90'
                  : 'bg-suka-orange/40 cursor-not-allowed'
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
