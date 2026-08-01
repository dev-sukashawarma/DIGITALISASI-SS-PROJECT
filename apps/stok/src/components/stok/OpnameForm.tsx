'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useStokBalance } from '@/hooks/useStokBalance';
import { useOpnameActions } from '@/hooks/useOpname';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';
import { getBahanBakuSource } from '@suka/design-system/src/utils/bahanBaku';
import { computeSelisih, isSelisihFlagged } from '@/lib/stok/selisih';
import { combineOpnameInput } from '@/lib/format/compositeUnit';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Semua',
  'item core': 'Item Core',
  bumbu: 'Bumbu',
  minuman: 'Minuman',
  kemasan: 'Packaging',
  lainnya: 'Lainnya',
};

// Map of Kitchen-specific unit overrides
const KITCHEN_UNIT_OVERRIDES: Record<string, { largeLabel: string, smallLabel: string, factor: number, toBaseUnit: (large: number, small: number) => number }> = {
  'SAOS CABE': { largeLabel: 'Dus', smallLabel: 'kg', factor: 16.5, toBaseUnit: (l, s) => l + s / 16.5 },
  'SAOS TOMAT': { largeLabel: 'Dus', smallLabel: 'kg', factor: 16.5, toBaseUnit: (l, s) => l + s / 16.5 },
  'SAOS SAMYANG': { largeLabel: 'Dus', smallLabel: 'gram', factor: 20000, toBaseUnit: (l, s) => l + s / 20000 },
  'MAYONES': { largeLabel: 'Dus', smallLabel: 'kg', factor: 12, toBaseUnit: (l, s) => l + s / 12 },
  'KULIT 25': { largeLabel: 'pack', smallLabel: 'lembar', factor: 20, toBaseUnit: (l, s) => l + s / 20 },
  'KULIT 28': { largeLabel: 'pack', smallLabel: 'lembar', factor: 20, toBaseUnit: (l, s) => l + s / 20 },
  'KULIT 32': { largeLabel: 'pack', smallLabel: 'lembar', factor: 20, toBaseUnit: (l, s) => l + s / 20 },
  'AYAM': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'SAPI': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l * 1000 + s) / 2000 }, 
  'KENTANG': { largeLabel: 'dus', smallLabel: 'kg', factor: 4, toBaseUnit: (l, s) => l + s / 4 }, 
  'KEJU': { largeLabel: 'dus', smallLabel: 'pack', factor: 24, toBaseUnit: (l, s) => l + s / 24 },
  'MIE': { largeLabel: 'dus', smallLabel: 'bungkus', factor: 40, toBaseUnit: (l, s) => l + s / 40 },
  'TUM': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'BAWANG': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l * 1000 + s) / 20000 }, 
  'TEPUNG': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'MINYAK SAYUR': { largeLabel: 'kompan', smallLabel: 'liter', factor: 18, toBaseUnit: (l, s) => l + s / 18 },
  'PAPER WRAP': { largeLabel: 'pack', smallLabel: 'lembar', factor: 500, toBaseUnit: (l, s) => l + s / 500 },
  'FOIL': { largeLabel: 'roll', smallLabel: 'cm', factor: 760, toBaseUnit: (l, s) => (l * 760 + s) / 18240 }, 
  'SARUNG TANGAN BENING': { largeLabel: 'box', smallLabel: 'lembar', factor: 100, toBaseUnit: (l, s) => l + s / 100 },
  'KERTAS STRUK': { largeLabel: 'pack', smallLabel: 'roll', factor: 10, toBaseUnit: (l, s) => l + s / 10 },
  'PLASTIK BESAR': { largeLabel: 'ikat', smallLabel: 'pack', factor: 5, toBaseUnit: (l, s) => l + s / 5 },
  'PLASTIK KECIL': { largeLabel: 'ikat', smallLabel: 'pack', factor: 5, toBaseUnit: (l, s) => l + s / 5 },
  'PLASTIK MERAH': { largeLabel: 'bal', smallLabel: 'pack', factor: 5, toBaseUnit: (l, s) => l + s / 5 },
  'POLYBAG': { largeLabel: 'bal', smallLabel: 'pack', factor: 5, toBaseUnit: (l, s) => l + s / 5 },
  'POWDER TEH': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'POWDER JERUK': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'CUP': { largeLabel: 'pack', smallLabel: 'pcs', factor: 25, toBaseUnit: (l, s) => l + s / 25 }, 
  'TUTUP': { largeLabel: 'pack', smallLabel: 'pcs', factor: 25, toBaseUnit: (l, s) => l + s / 25 }, 
  'JINTEN': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l * 1000 + s) / 1000 }, 
  'CENGKEH': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'KETUMBAR': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l * 1000 + s) / 1000 }, 
  'KUNYIT': { largeLabel: 'dus', smallLabel: 'sachet', factor: 216, toBaseUnit: (l, s) => l + s / 216 },
  'GARAM': { largeLabel: 'bal', smallLabel: 'pack', factor: 20, toBaseUnit: (l, s) => l + s / 20 }
};

// Map of Outlet-specific unit overrides
const OUTLET_UNIT_OVERRIDES: Record<string, { largeLabel: string, smallLabel: string, factor: number, toBaseUnit: (large: number, small: number) => number }> = {
  'SAOS CABE': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l + s / 1000) / 16.5 },
  'SAOS TOMAT': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l + s / 1000) / 16.5 },
  'SAOS SAMYANG': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l + s / 1000) / 20 },
  'MAYONES': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l + s / 1000) / 12 },
  'KULIT 25': { largeLabel: 'pack', smallLabel: 'lembar', factor: 20, toBaseUnit: (l, s) => l + s / 20 },
  'KULIT 28': { largeLabel: 'pack', smallLabel: 'lembar', factor: 20, toBaseUnit: (l, s) => l + s / 20 },
  'KULIT 32': { largeLabel: 'pack', smallLabel: 'lembar', factor: 20, toBaseUnit: (l, s) => l + s / 20 },
  'AYAM': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'SAPI': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l * 1000 + s) / 2000 }, 
  'KENTANG': { largeLabel: 'dus', smallLabel: 'kg', factor: 4, toBaseUnit: (l, s) => l + s / 4 }, 
  'KEJU': { largeLabel: 'pack', smallLabel: 'lembar', factor: 10, toBaseUnit: (l, s) => (l * 10 + s) / 240 },
  'MIE': { largeLabel: 'dus', smallLabel: 'bungkus', factor: 40, toBaseUnit: (l, s) => l + s / 40 },
  'TUM': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'BAWANG': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l * 1000 + s) / 20000 }, 
  'TEPUNG': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'MINYAK SAYUR': { largeLabel: 'kompan', smallLabel: 'liter', factor: 18, toBaseUnit: (l, s) => l + s / 18 },
  'PAPER WRAP': { largeLabel: 'pack', smallLabel: 'lembar', factor: 500, toBaseUnit: (l, s) => l + s / 500 },
  'FOIL': { largeLabel: 'roll', smallLabel: 'cm', factor: 760, toBaseUnit: (l, s) => (l * 760 + s) / 18240 }, 
  'SARUNG TANGAN BENING': { largeLabel: 'box', smallLabel: 'lembar', factor: 100, toBaseUnit: (l, s) => l + s / 100 },
  'KERTAS STRUK': { largeLabel: 'pack', smallLabel: 'roll', factor: 10, toBaseUnit: (l, s) => l + s / 10 },
  'PLASTIK BESAR': { largeLabel: 'pack', smallLabel: 'lembar', factor: 25, toBaseUnit: (l, s) => (l * 25 + s) / 125 },
  'PLASTIK KECIL': { largeLabel: 'pack', smallLabel: 'lembar', factor: 50, toBaseUnit: (l, s) => (l * 50 + s) / 250 },
  'PLASTIK MERAH': { largeLabel: 'pack', smallLabel: 'lembar', factor: 20, toBaseUnit: (l, s) => (l * 20 + s) / 100 },
  'POLYBAG': { largeLabel: 'pack', smallLabel: 'lembar', factor: 5, toBaseUnit: (l, s) => (l * 5 + s) / 25 },
  'POWDER TEH': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'POWDER JERUK': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => l + s / 1000 },
  'CUP': { largeLabel: 'pack', smallLabel: 'pcs', factor: 25, toBaseUnit: (l, s) => l + s / 25 }, 
  'TUTUP': { largeLabel: 'pack', smallLabel: 'pcs', factor: 25, toBaseUnit: (l, s) => l + s / 25 }, 
  'ES BATU': { largeLabel: 'kg', smallLabel: 'gram', factor: 1000, toBaseUnit: (l, s) => (l * 1000 + s) / 1000 }
};

export function OpnameForm({ outletId, createdBy, role }: { outletId: string; createdBy: string; role?: string }) {
  const router = useRouter();
  const { bahanBaku, error: bahanError, loading: isBahanLoading } = useBahanBaku();
  const { balances, loading: isBalanceLoading } = useStokBalance(outletId);
  const { createOrReuseDraft, upsertItems, finalize } = useOpnameActions();

  const { data: outlets } = useQuery({
    queryKey: ['monitoring', 'outlets'],
    queryFn: fetchOutletsList,
  });
  const isGudang = outlets?.find(o => o.id === outletId)?.nama?.toUpperCase().includes('GUDANG') ?? false;


  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [containerInput, setContainerInput] = useState<Record<string, string>>({});
  const [pendingApproval] = useState(false);
  const [remainderInput, setRemainderInput] = useState<Record<string, string>>({});
  const [remainderError, setRemainderError] = useState<Record<string, string>>({});
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

  const handleCompositeChange = (
    bahanId: string,
    containers: string,
    remainder: string,
    faktorTampilan: number,
    customToBaseUnit?: (l: number, s: number) => number
  ) => {
    setContainerInput((prev) => ({ ...prev, [bahanId]: containers }));
    setRemainderInput((prev) => ({ ...prev, [bahanId]: remainder }));

    const remainderNum = remainder === '' ? 0 : Number(remainder);
    const containersNum = containers === '' ? 0 : Number(containers);

    if (containersNum < 0) {
      setRemainderError((prev) => ({ ...prev, [bahanId]: 'Jumlah kontainer tidak boleh negatif' }));
      setFisik((prev) => {
        const next = { ...prev };
        delete next[bahanId];
        return next;
      });
      return;
    }
    if (remainderNum < 0) {
      setRemainderError((prev) => ({ ...prev, [bahanId]: 'Sisa tidak boleh negatif' }));
      setFisik((prev) => {
        const next = { ...prev };
        delete next[bahanId];
        return next;
      });
      return;
    }
    setRemainderError((prev) => {
      const next = { ...prev };
      delete next[bahanId];
      return next;
    });

    if (containers === '' && remainder === '') {
      setFisik((prev) => {
        const next = { ...prev };
        delete next[bahanId];
        return next;
      });
      return;
    }
    const combined = customToBaseUnit ? customToBaseUnit(containersNum, remainderNum) : combineOpnameInput(containersNum, remainderNum, faktorTampilan);
    setFisik((prev) => ({ ...prev, [bahanId]: combined.toString() }));
  };

  // Filter materials based on search and category
  const filteredBahan = useMemo(() => {
    return bahanBaku.filter((b) => {
      const source = getBahanBakuSource(b.nama);
      if (source === 'GUDANG_PUSAT' && !isGudang) return false;

      const matchesSearch = b.nama.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || b.kategori === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [bahanBaku, searchTerm, activeCategory, isGudang]);

  async function handleFinalize() {
    if (Object.keys(remainderError).length > 0) {
      showToast('🔴 Perbaiki dulu input sisa yang melebihi batas kontainer.', 'warning');
      return;
    }
    setBusy(true);
    try {
      // Cek apakah sudah ada draft hari ini untuk outlet ini, supaya tidak buat duplikat
      const opname = await createOrReuseDraft(outletId, 'harian', createdBy, notes);
      const items = bahanBaku
        .filter((b) => fisik[b.id] !== undefined && fisik[b.id] !== '')
        .map((b) => {
          const qtyFisik = Number(fisik[b.id]);
          const qtySystem = saldoOf[b.id] ?? 0;
          const selisih = computeSelisih(qtyFisik, qtySystem);
          
          // Generate raw input text for display in dashboard
          let rawInputText = '';
          let useComposite = false;
          let compLabel = '';
          let compLargeLabel = b.satuan;
          
          if (!['gram', 'ml'].includes(b.satuan.toLowerCase())) {
            if (role === 'kitchen') {
              const override = KITCHEN_UNIT_OVERRIDES[b.nama];
              if (override) {
                useComposite = true;
                compLargeLabel = override.largeLabel;
                compLabel = override.smallLabel;
              } else if (b.satuan_tengah && b.faktor_tengah) {
                useComposite = true;
                compLabel = b.satuan_tengah;
              }
            } else {
              const override = OUTLET_UNIT_OVERRIDES[b.nama];
              if (override) {
                useComposite = true;
                compLargeLabel = override.largeLabel;
                compLabel = override.smallLabel;
              } else if (b.satuan_kecil && b.faktor_tampilan) {
                useComposite = true;
                compLabel = b.satuan_kecil;
              }
            }
          }

          if (useComposite) {
            const cont = containerInput[b.id] || '0';
            const rem = remainderInput[b.id] || '0';
            rawInputText = `${cont} ${compLargeLabel} + ${rem} ${compLabel}`;
          } else {
            rawInputText = `${fisik[b.id]} ${b.satuan}`;
          }

          return {
            opname_id: opname.id,
            bahan_baku_id: b.id,
            qty_fisik: qtyFisik,
            qty_system: qtySystem,
            flagged: isSelisihFlagged(selisih, qtySystem, b.satuan, b.satuan_kecil),
            catatan: `[RAW] ${rawInputText}`,
          };
        });

      await upsertItems(items);

      const hasFlagged = items.some(i => i.flagged);
      
      // Semua outlet tidak menggunakan sistem 'Menunggu Leader' (pending_approval),
      // jadi akan selalu langsung ter-finalize meskipun ada selisih.
      const res = await finalize(opname.id);
      
      if (hasFlagged) {
         showToast('✅ Opname difinalisasi (Selisih dicatat).', 'success');
      } else {
         const successMsg = res.queued 
           ? '⚠️ Offline: Data disimpan di antrean lokal & akan disinkron saat online!' 
           : '🟢 Berhasil: Formulir opname berhasil disimpan dan difinalisasi!';
         showToast(successMsg, res.queued ? 'warning' : 'success');
      }

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
        <p className="text-[#701604]/70 font-bold uppercase tracking-wider text-xs mt-4 animate-pulse">Memuat data inventaris...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 relative pb-24">
      {/* Pending Approval Banner */}
      {pendingApproval && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-center space-y-2 shadow-sm">
          <div className="text-3xl">⏳</div>
          <p className="font-bold text-amber-800 text-sm uppercase tracking-wide">Menunggu Persetujuan Leader</p>
          <p className="text-xs text-amber-700/80">
            Opname ini memiliki selisih kritis dan perlu disetujui oleh Leader sebelum dapat difinalisasi.
            Kamu akan mendapat notifikasi setelah Leader memutuskan.
          </p>
          <button
            onClick={() => router.push('/stok/opname')}
            className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Kembali ke Daftar Opname
          </button>
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 z-50 animate-bounce font-bold text-sm text-white transition-all ${
          toast.type === 'success' ? 'bg-[#0a7d2c] border-[#93f997]/30 shadow-[0px_8px_24px_rgba(10,125,44,0.15)]' : 'bg-[#ba1a1a] border-[#ffdad6]/30 shadow-[0px_8px_24px_rgba(186,26,26,0.15)]'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '🚨'}</span>
          <span>{toast.message}</span>
        </div>
      )}



      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-2.5 pl-9 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-medium transition-all shadow-sm"
            placeholder="Cari nama bahan baku di sini..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#544437]/40 text-xs">🔍</span>
        </div>

        {/* Category horizontal scrolling selector */}
        <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 no-scrollbar">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer shadow-sm ${
                  isActive
                    ? 'bg-[#f29744] border-[#f29744] text-white shadow-sm'
                    : 'bg-white border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-[#fff8f1]/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Materials List (Responsive 2-Column Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filteredBahan.map((b) => {
          const val = fisik[b.id] ?? '';

          // Custom step size
          let step = 1;
          if (b.satuan === 'gram' || b.satuan === 'ml') {
            step = 100;
          } else if (b.satuan === 'kg' || b.satuan === 'liter') {
            step = 0.5;
          }

          let useComposite = false;
          let compLabel: string = '';
          let compLargeLabel: string = b.satuan;
          let compFactor = 1;
          let toBaseUnit: ((l: number, s: number) => number) | undefined = undefined;

          if (!['gram', 'ml'].includes(b.satuan.toLowerCase())) {
            if (role === 'kitchen') {
              const override = KITCHEN_UNIT_OVERRIDES[b.nama];
              if (override) {
                useComposite = true;
                compLargeLabel = override.largeLabel;
                compLabel = override.smallLabel;
                compFactor = override.factor;
                toBaseUnit = override.toBaseUnit;
              } else if (b.satuan_tengah && b.faktor_tengah) {
                useComposite = true;
                compLabel = b.satuan_tengah;
                compFactor = b.faktor_tengah;
              } else {
                useComposite = false;
              }
            } else {
              const override = OUTLET_UNIT_OVERRIDES[b.nama];
              if (override) {
                useComposite = true;
                compLargeLabel = override.largeLabel;
                compLabel = override.smallLabel;
                compFactor = override.factor;
                toBaseUnit = override.toBaseUnit;
              } else if (b.satuan_kecil && b.faktor_tampilan) {
                useComposite = true;
                compLabel = b.satuan_kecil;
                compFactor = b.faktor_tampilan;
              }
            }
          }

          return (
            <div
              key={b.id}
              className="p-5 rounded-xl border flex flex-col justify-between min-h-[150px] transition-all duration-200 border-[#d9c2b2]/45 bg-white shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45"
            >
              {/* Card Top: Details */}
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                      {CATEGORY_LABELS[b.kategori] || b.kategori}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#1e1b15] text-sm uppercase tracking-wide mt-2 leading-tight truncate">
                    {b.nama}
                  </h3>
                  <p className="text-[10px] text-[#544437]/60 font-semibold mt-1">
                    Satuan: <span className="text-gray-700 font-bold">{compLargeLabel}</span>
                  </p>
                  {['gram', 'ml', 'kg', 'liter'].includes(b.satuan.toLowerCase()) && (
                    <div className="mt-2 flex items-center gap-1.5 bg-[#fff8f1] border border-[#f29744]/40 px-2 py-1.5 rounded-lg">
                      <span className="text-[10px]">⚖️</span>
                      <span className="text-[9px] font-bold text-[#701604] leading-tight">
                        Pastikan TARE timbangan dgn wadah kosong.
                      </span>
                    </div>
                  )}
                </div>

                {/* Discrepancy indicator hidden for Blind Opname */}
                <div className="text-right min-w-[65px] flex-shrink-0">
                  {val !== '' && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-[#0a7d2c]">
                        ✓ Tersimpan
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Bottom: Input Actions */}
              {useComposite ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="w-20 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-2.5 no-spinner shadow-inner focus:ring-2 focus:ring-[#f29744]/50 focus:border-[#f29744]"
                      placeholder="0"
                      value={containerInput[b.id] ?? ''}
                      onChange={(e) =>
                        handleCompositeChange(b.id, e.target.value, remainderInput[b.id] ?? '', compFactor, toBaseUnit)
                      }
                    />
                    <span className="text-[10px] font-bold text-[#544437]/60">{compLargeLabel} +</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      className="w-20 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-2.5 no-spinner shadow-inner focus:ring-2 focus:ring-[#f29744]/50 focus:border-[#f29744]"
                      placeholder="0"
                      value={remainderInput[b.id] ?? ''}
                      onChange={(e) =>
                        handleCompositeChange(b.id, containerInput[b.id] ?? '', e.target.value, compFactor, toBaseUnit)
                      }
                    />
                    <span className="text-[10px] font-bold text-[#544437]/60">{compLabel}</span>
                  </div>
                  {remainderError[b.id] && (
                    <p className="text-[10px] font-bold text-[#ba1a1a]">{remainderError[b.id]}</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-end">
                  <div className="flex items-center bg-[#faf2e9]/40 border border-[#d9c2b2]/45 rounded-xl overflow-hidden p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => handleDecrement(b.id, step)}
                      className="w-10 h-10 flex items-center justify-center font-bold text-[#701604] hover:bg-[#faf2e9] active:scale-95 transition-all rounded-lg text-sm cursor-pointer bg-white border border-[#d9c2b2]/20 shadow-sm"
                    >
                      —
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-20 text-center bg-transparent border-none focus:outline-none focus:ring-0 font-extrabold text-sm text-[#701604] focus:ring-transparent focus:border-transparent py-2 no-spinner"
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
                      className="w-10 h-10 flex items-center justify-center font-bold text-[#701604] hover:bg-[#faf2e9] active:scale-95 transition-all rounded-lg text-sm cursor-pointer bg-white border border-[#d9c2b2]/20 shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredBahan.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-[#d9c2b2]/40 p-8 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-3xl">🔍</span>
            <p className="font-bold text-sm text-[#701604]/80 mt-2">Bahan Baku Tidak Ditemukan</p>
            <p className="text-xs text-gray-500 mt-1">Coba gunakan kata kunci lain atau pilih kategori berbeda.</p>
          </div>
        )}
      </div>

      {/* Footer Notes and Finalize Button */}
      <div className="bg-white border border-[#d9c2b2]/45 p-5 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] space-y-4">
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#544437]/60 mb-2 pl-1">
            Catatan Tambahan
          </label>
          <textarea
            placeholder="Masukkan keterangan atau penyebab selisih di sini (opsional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-[#d9c2b2]/40 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-medium min-h-[80px] transition-all resize-y"
          />
        </div>

        <button
          disabled={busy}
          onClick={handleFinalize}
          className="w-full py-3 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white transition-all rounded-xl font-bold uppercase tracking-wider text-xs shadow-md disabled:opacity-50 disabled:hover:bg-[#701604] active:scale-[0.99] cursor-pointer"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Menyimpan Data Opname...
            </span>
          ) : (
            'Finalisasi Opname & Simpan'
          )}
        </button>
      </div>
    </div>
  );
}
