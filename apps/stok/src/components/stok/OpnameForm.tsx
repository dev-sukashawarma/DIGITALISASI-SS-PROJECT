'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@suka/design-system';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useStokBalance } from '@/hooks/useStokBalance';
import { useOpnameActions } from '@/hooks/useOpname';
import { computeSelisih, isSelisihFlagged } from '@/lib/stok/selisih';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Semua',
  protein: 'Protein',
  sayur: 'Sayuran',
  bumbu: 'Bumbu',
  saus: 'Saus & Mayo',
  roti: 'Roti & Karbo',
  kemasan: 'Packaging',
  minuman: 'Minuman',
  lainnya: 'Lainnya',
};

export function OpnameForm({ outletId, createdBy }: { outletId: string; createdBy: string }) {
  const router = useRouter();
  const { bahanBaku, error: bahanError, loading: isBahanLoading } = useBahanBaku();
  const { balances, loading: isBalanceLoading } = useStokBalance(outletId);
  const { createDraft, upsertItems, finalize } = useOpnameActions();

  const [tipe, setTipe] = useState('harian');
  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // Search and Category Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Custom premium toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const saldoOf = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of balances) {
      m[b.bahan_baku_id] = b.saldo;
    }
    return m;
  }, [balances]);

  // Handle Tactile Button Increments/Decrements
  const handleIncrement = (id: string, step: number = 1) => {
    setFisik((prev) => {
      const current = prev[id] === '' || prev[id] === undefined ? 0 : Number(prev[id]);
      const nextVal = Math.max(0, current + step);
      const rounded = Math.round(nextVal * 100) / 100;
      return { ...prev, [id]: rounded.toString() };
    });
  };

  const handleDecrement = (id: string, step: number = 1) => {
    setFisik((prev) => {
      const current = prev[id] === '' || prev[id] === undefined ? 0 : Number(prev[id]);
      const nextVal = Math.max(0, current - step);
      const rounded = Math.round(nextVal * 100) / 100;
      return { ...prev, [id]: rounded.toString() };
    });
  };

  // Filter materials based on search and category
  const filteredBahan = useMemo(() => {
    return bahanBaku.filter((b) => {
      const matchesSearch = b.nama.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || b.kategori === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [bahanBaku, searchTerm, activeCategory]);

  async function handleFinalize() {
    setBusy(true);
    try {
      const opname = await createDraft(outletId, tipe, createdBy, notes);
      const items = bahanBaku
        .filter((b) => fisik[b.id] !== undefined && fisik[b.id] !== '')
        .map((b) => {
          const qtyFisik = Number(fisik[b.id]);
          const qtySystem = saldoOf[b.id] ?? 0;
          const selisih = computeSelisih(qtyFisik, qtySystem);
          return {
            opname_id: opname.id,
            bahan_baku_id: b.id,
            qty_fisik: qtyFisik,
            qty_system: qtySystem,
            flagged: isSelisihFlagged(selisih, qtySystem),
          };
        });

      await upsertItems(items);
      const res = await finalize(opname.id);
      
      const successMsg = res.queued 
        ? '⚠️ Offline: Data disimpan di antrean lokal & akan disinkron saat online!' 
        : '🟢 Berhasil: Formulir opname berhasil disimpan dan difinalisasi!';
      
      showToast(successMsg, res.queued ? 'warning' : 'success');

      // Navigate back after toast plays a bit
      setTimeout(() => {
        router.push('/stok/opname');
      }, 2000);
    } catch (err: any) {
      showToast(`🔴 Gagal memproses opname: ${err.message || err}`, 'warning');
    } finally {
      setBusy(false);
    }
  }

  if (bahanError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center shadow-sm max-w-lg mx-auto">
        <span className="text-3xl">⚠️</span>
        <p className="text-red-700 font-extrabold mt-2">Gagal Muat Bahan Baku</p>
        <p className="text-xs text-red-600/80 mt-1">{bahanError}</p>
      </div>
    );
  }

  const isLoading = isBahanLoading || isBalanceLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-10 h-10 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-[#701604]/70 font-bold uppercase tracking-wider text-xs mt-4">Memuat data inventaris...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-24">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 z-50 animate-bounce font-bold text-sm text-white transition-all ${
          toast.type === 'success' ? 'bg-[#0a7d2c] border-green-500' : 'bg-orange-600 border-orange-500'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '🚨'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Segmented Control for Tipe Opname */}
      <div className="bg-white p-1.5 rounded-2xl border border-[#701604]/10 shadow-sm flex gap-1 w-full max-w-md mx-auto">
        {['harian', 'mingguan', 'ad_hoc'].map((t) => {
          const isActive = tipe === t;
          const label = t === 'ad_hoc' ? 'Ad Hoc' : t.charAt(0).toUpperCase() + t.slice(1);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTipe(t)}
              className={`flex-1 py-3 text-center rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all ${
                isActive
                  ? 'bg-[#701604] text-white shadow-md scale-[1.02]'
                  : 'text-[#701604]/60 hover:bg-[#faf2e9]/50 hover:text-[#701604]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            className="w-full px-5 py-4 pl-12 rounded-2xl border border-[#701604]/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#f29744] focus:border-[#f29744] text-sm text-suka-ink placeholder-gray-400 font-medium shadow-sm transition-all"
            placeholder="Cari nama bahan baku di sini..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
        </div>

        {/* Category horizontal scrolling selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCategory(key)}
                className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap shadow-sm ${
                  isActive
                    ? 'bg-[#f29744] border-[#f29744] text-white'
                    : 'bg-white border-[#701604]/10 text-[#701604]/70 hover:bg-[#faf2e9]/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Materials List (Responsive 2-Column Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBahan.map((b) => {
          const qtySystem = saldoOf[b.id] ?? 0;
          const val = fisik[b.id] ?? '';
          const selisih = val === '' ? null : computeSelisih(Number(val), qtySystem);
          const flagged = selisih !== null && isSelisihFlagged(selisih, qtySystem);

          // Customize step size based on unit
          let step = 1;
          if (b.satuan === 'gram' || b.satuan === 'ml') {
            step = 100;
          } else if (b.satuan === 'kg' || b.satuan === 'liter') {
            step = 0.5; // Fine-grained step for liquids and heavy items
          }

          return (
            <div
              key={b.id}
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between min-h-[140px] ${
                flagged
                  ? 'border-2 border-red-500 bg-white shadow-[0px_6px_20px_rgba(239,68,68,0.12)] ring-2 ring-red-500/5 animate-pulse-subtle'
                  : 'border-[#701604]/10 bg-white shadow-[0px_4px_12px_rgba(112,22,4,0.03)] hover:border-[#f29744]/30'
              }`}
            >
              {/* Card Top: Details */}
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded-md border border-[#701604]/5">
                      {CATEGORY_LABELS[b.kategori] || b.kategori}
                    </span>
                    {flagged && (
                      <span className="text-[9px] font-extrabold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200">
                        ⚠️ Selisih Tinggi
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-[#701604] text-sm tracking-wide mt-1 uppercase">
                    {b.nama}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-semibold">
                    Stok Sistem: <span className="text-gray-700 font-bold">{qtySystem} {b.satuan}</span>
                  </p>
                </div>

                {/* Discrepancy indicator */}
                <div className="text-right min-w-[70px]">
                  {selisih !== null && (
                    <div className="space-y-0.5">
                      <p className={`text-xs font-extrabold ${
                        flagged 
                          ? 'text-red-600' 
                          : selisih === 0 
                            ? 'text-gray-500' 
                            : selisih < 0 
                              ? 'text-orange-600' 
                              : 'text-green-700'
                      }`}>
                        {selisih > 0 ? '+' : ''}{selisih} {b.satuan}
                      </p>
                      <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">
                        Selisih
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Bottom: Input Actions */}
              <div className="mt-4 flex items-center justify-end">
                <div className="flex items-center bg-[#faf2e9]/40 border border-[#701604]/10 rounded-xl overflow-hidden p-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => handleDecrement(b.id, step)}
                    className="w-9 h-9 flex items-center justify-center font-bold text-[#701604] hover:bg-[#faf2e9] active:scale-90 transition-all rounded-lg text-sm"
                  >
                    —
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-16 text-center bg-transparent border-none focus:outline-none focus:ring-0 font-extrabold text-xs text-[#701604]"
                    placeholder="fisik"
                    value={val}
                    onChange={(e) => {
                      const inputVal = e.target.value;
                      setFisik((prev) => ({ ...prev, [b.id]: inputVal }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleIncrement(b.id, step)}
                    className="w-9 h-9 flex items-center justify-center font-bold text-[#701604] hover:bg-[#faf2e9] active:scale-90 transition-all rounded-lg text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredBahan.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-[#701604]/10 p-8 shadow-sm">
            <span className="text-3xl">🔍</span>
            <p className="font-bold text-sm text-[#701604]/80 mt-2">Bahan Baku Tidak Ditemukan</p>
            <p className="text-xs text-gray-500 mt-1">Coba gunakan kata kunci lain atau pilih kategori berbeda.</p>
          </div>
        )}
      </div>

      {/* Footer Notes and Finalize Button */}
      <div className="bg-white border border-[#701604]/10 p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#701604]/60 mb-2">
            Catatan Tambahan
          </label>
          <textarea
            placeholder="Masukkan keterangan atau penyebab selisih di sini (opsional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-[#701604]/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#f29744] focus:border-[#f29744] text-xs font-medium text-suka-ink min-h-[80px] transition-all resize-y"
          />
        </div>

        <Button
          disabled={busy}
          onClick={handleFinalize}
          className="w-full py-4 bg-[#701604] text-white hover:bg-[#591002] transition-colors rounded-xl font-bold uppercase tracking-wider text-xs shadow-md disabled:opacity-50"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Menyimpan Data Opname...
            </span>
          ) : (
            'Finalisasi Opname & Simpan'
          )}
        </Button>
      </div>
    </div>
  );
}
