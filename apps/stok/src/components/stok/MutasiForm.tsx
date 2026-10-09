'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutasiActions } from '@/hooks/useMutasi';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { createClient } from '@/lib/supabase';
import { ChevronDown, Search, Plus, Minus, AlertCircle, X } from 'lucide-react';

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
  const [isOutletDropdownOpen, setIsOutletDropdownOpen] = useState(false);
  const [outletSearch, setOutletSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOutletDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOutlets = useMemo(() => {
    if (!outletSearch.trim()) return outlets;
    return outlets.filter(o => o.name.toLowerCase().includes(outletSearch.toLowerCase()));
  }, [outlets, outletSearch]);

  const selectedOutletName = useMemo(() => {
    return outlets.find(o => o.id === outletTujuanId)?.name || '';
  }, [outlets, outletTujuanId]);

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
      setErrorMsg('Pilih outlet tujuan terlebih dahulu');
      return;
    }
    if (cartItemsCount === 0) {
      setErrorMsg('Pilih minimal 1 bahan baku yang akan dimutasi');
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
        <div className="bg-red-50 text-red-800 border border-red-200 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Target Outlet Custom Dropdown */}
      <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-xs" ref={dropdownRef}>
        <label className="block text-xs font-extrabold text-suka-brown uppercase tracking-wider mb-2">
          Outlet Tujuan Mutasi *
        </label>
        {loadingOutlets ? (
          <p className="text-xs text-[#544437]/60">Memuat daftar outlet...</p>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOutletDropdownOpen(!isOutletDropdownOpen)}
              className="w-full bg-[#f9f5f1] border border-suka-brown/20 text-[#1e1b15] rounded-xl px-4 py-3 flex items-center justify-between text-xs font-semibold focus:ring-2 focus:ring-suka-orange outline-none transition-all cursor-pointer text-left"
            >
              <span className={selectedOutletName ? 'text-[#1e1b15]' : 'text-suka-brown/50'}>
                {selectedOutletName || 'Pilih Outlet Tujuan'}
              </span>
              <ChevronDown className={`w-4 h-4 text-suka-brown/60 transition-transform ${isOutletDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOutletDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-suka-brown/15 rounded-2xl shadow-xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-suka-brown/50 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={outletSearch}
                    onChange={(e) => setOutletSearch(e.target.value)}
                    placeholder="Cari outlet..."
                    className="w-full bg-[#f9f5f1] border border-suka-brown/15 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-suka-orange"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filteredOutlets.length === 0 ? (
                    <p className="text-xs text-suka-brown/50 p-2 text-center">Outlet tidak ditemukan</p>
                  ) : (
                    filteredOutlets.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setOutletTujuanId(o.id);
                          setIsOutletDropdownOpen(false);
                          setOutletSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          outletTujuanId === o.id
                            ? 'bg-suka-orange text-white'
                            : 'hover:bg-suka-cream/40 text-suka-brown'
                        }`}
                      >
                        {o.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Catatan Pengajuan */}
      <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-xs">
        <label className="block text-xs font-extrabold text-suka-brown uppercase tracking-wider mb-2">
          Catatan Pengajuan (Opsional)
        </label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Contoh: Darurat untuk operasional malam ini"
          rows={3}
          className="w-full bg-[#f9f5f1] border border-suka-brown/20 text-[#1e1b15] rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-suka-orange outline-none transition-all resize-none"
        />
      </div>

      {/* Item Selection */}
      <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-xs text-suka-brown uppercase tracking-wider">
            Pilih Bahan Baku Mutasi
          </h2>
          <span className="text-[11px] font-bold text-suka-orange bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
            {cartItemsCount} Bahan Dipilih
          </span>
        </div>
        
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-suka-brown/50 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari nama bahan baku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f9f5f1] border border-suka-brown/20 text-[#1e1b15] rounded-xl pl-9 pr-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-suka-orange outline-none transition-all"
          />
        </div>

        {loadingBahan ? (
          <p className="text-xs text-[#544437]/60 text-center py-6">Memuat katalog bahan baku...</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredBahan.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 border border-suka-brown/10 rounded-xl hover:bg-orange-50/20 transition-colors">
                <div>
                  <h3 className="font-bold text-xs text-[#1e1b15]">{b.nama}</h3>
                  <p className="text-[10px] text-[#544437]/60 font-medium">{b.satuan_distribusi || b.satuan}</p>
                </div>
                
                <div className="flex items-center bg-[#f9f5f1] rounded-xl p-1 border border-suka-brown/20">
                  <button 
                    type="button"
                    onClick={() => updateQty(b.id, -1)} 
                    className="w-7 h-7 flex items-center justify-center text-suka-brown hover:bg-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="number"
                    min="0"
                    value={items[b.id] || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setItems(prev => {
                        const copy = { ...prev };
                        if (val <= 0) delete copy[b.id];
                        else copy[b.id] = val;
                        return copy;
                      });
                    }}
                    className="w-12 text-center bg-transparent border-none p-0 font-extrabold text-xs text-[#1e1b15] focus:ring-0 outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => updateQty(b.id, 1)} 
                    className="w-7 h-7 flex items-center justify-center text-suka-brown hover:bg-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2 pb-8">
        <button
          onClick={handleSubmit}
          disabled={busy || cartItemsCount === 0 || !outletTujuanId}
          className="w-full bg-suka-orange hover:bg-orange-600 disabled:bg-gray-300 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-all active:scale-95 shadow-xs uppercase tracking-wider text-xs cursor-pointer"
        >
          {busy ? 'Mengajukan...' : `Ajukan ${cartItemsCount} Bahan Baku Mutasi`}
        </button>
      </div>
    </div>
  );
}
