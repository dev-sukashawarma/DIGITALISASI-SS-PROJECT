'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutasiActions } from '@/hooks/useMutasi';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { createClient } from '@/lib/supabase';

export function MutasiForm({ outletId }: { outletId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ajukan } = useMutasiActions();
  const { bahanBaku, loading: loadingBahan } = useBahanBaku();
  
  const [outlets, setOutlets] = useState<{ id: string, name: string }[]>([]);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  
  const initialTujuan = searchParams.get('tujuan') || '';
  const initialBahan = searchParams.get('bahan') || '';
  const initialQty = Number(searchParams.get('qty')) || 0;

  const [outletTujuanId, setOutletTujuanId] = useState(initialTujuan);
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState<Record<string, number>>(
    initialBahan && initialQty > 0 ? { [initialBahan]: initialQty } : {}
  );
  
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOutlets() {
      const supabase = createClient();
      const { data } = await supabase.from('outlets').select('id, name').order('name');
      if (data) {
        setOutlets(data.filter(o => o.id !== outletId));
      }
      setLoadingOutlets(false);
    }
    fetchOutlets();
  }, [outletId]);

  const filteredBahan = useMemo(() => {
    if (!searchQuery) return bahanBaku;
    return bahanBaku.filter(b => b.nama.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [bahanBaku, searchQuery]);

  const cartItemsCount = Object.keys(items).length;

  function updateQty(id: string, delta: number) {
    setItems(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function handleSubmit() {
    if (!outletTujuanId) {
      setErrorMsg('Pilih outlet tujuan');
      return;
    }
    if (cartItemsCount === 0) {
      setErrorMsg('Pilih minimal 1 bahan baku');
      return;
    }
    
    setBusy(true);
    setErrorMsg(null);
    
    try {
      const itemsPayload = Object.entries(items).map(([id, qty]) => ({
        bahan_baku_id: id,
        qty_diajukan: qty
      }));
      
      const newId = await ajukan(outletId, outletTujuanId, catatan, itemsPayload);
      if (newId) {
        router.push(`/stok/mutasi/${newId}`);
      } else {
        router.push('/stok/mutasi');
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengajukan mutasi');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-sm font-bold flex justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* Target Outlet */}
      <div className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/40 shadow-sm">
        <h2 className="font-bold text-[#701604] mb-3">Tujuan Mutasi</h2>
        {loadingOutlets ? (
          <p className="text-xs text-[#544437]/60">Memuat outlet...</p>
        ) : (
          <select
            value={outletTujuanId}
            onChange={(e) => setOutletTujuanId(e.target.value)}
            className="w-full bg-[#f9f5f1] border border-[#d9c2b2]/50 text-[#1e1b15] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#f29744] outline-none transition-all font-medium"
          >
            <option value="">-- Pilih Outlet Tujuan --</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>
      
      {/* Catatan */}
      <div className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/40 shadow-sm">
        <h2 className="font-bold text-[#701604] mb-3">Catatan (Opsional)</h2>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Misal: Urgent untuk operasional besok"
          className="w-full bg-[#f9f5f1] border border-[#d9c2b2]/50 text-[#1e1b15] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#f29744] outline-none transition-all resize-none font-medium h-24"
        />
      </div>

      {/* Item Selection */}
      <div className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/40 shadow-sm">
        <h2 className="font-bold text-[#701604] mb-3">Pilih Item Mutasi</h2>
        
        <input
          type="text"
          placeholder="Cari bahan baku..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#f9f5f1] border border-[#d9c2b2]/50 text-[#1e1b15] rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-[#f29744] outline-none transition-all font-medium"
        />

        {loadingBahan ? (
          <p className="text-xs text-[#544437]/60 text-center py-4">Memuat bahan baku...</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {filteredBahan.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 border border-[#d9c2b2]/30 rounded-xl hover:bg-orange-50/30 transition-colors">
                <div>
                  <h3 className="font-bold text-sm text-[#1e1b15]">{b.nama}</h3>
                  <p className="text-xs text-[#544437]/60">{b.satuan_distribusi || b.satuan}</p>
                </div>
                
                <div className="flex items-center bg-[#f9f5f1] rounded-lg p-1 border border-[#d9c2b2]/50">
                  <button onClick={() => updateQty(b.id, -1)} className="w-8 h-8 flex items-center justify-center text-[#701604] font-bold rounded-md hover:bg-white transition-colors">-</button>
                  <input 
                    type="number"
                    min="0"
                    value={items[b.id] || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setItems(prev => {
                        const copy = { ...prev };
                        if (val <= 0) delete copy[b.id];
                        else copy[b.id] = val;
                        return copy;
                      });
                    }}
                    className="w-12 text-center bg-transparent border-none p-0 font-bold text-sm text-[#1e1b15] focus:ring-0"
                  />
                  <button onClick={() => updateQty(b.id, 1)} className="w-8 h-8 flex items-center justify-center text-[#701604] font-bold rounded-md hover:bg-white transition-colors">+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 pb-8">
        <button
          onClick={handleSubmit}
          disabled={busy || cartItemsCount === 0 || !outletTujuanId}
          className="w-full bg-[#f29744] hover:bg-orange-600 disabled:bg-gray-300 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-sm uppercase tracking-wider text-sm"
        >
          {busy ? 'Mengajukan...' : `Ajukan ${cartItemsCount} Item Mutasi`}
        </button>
      </div>
    </div>
  );
}
