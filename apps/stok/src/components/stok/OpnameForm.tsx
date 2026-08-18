'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useStokBalance } from '@/hooks/useStokBalance';
import { useOpnameActions } from '@/hooks/useOpname';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';
import { getBahanBakuSource } from '@suka/design-system/src/utils/bahanBaku';
import { computeSelisih, isSelisihFlagged } from '@/lib/stok/selisih';
import type { BahanBaku } from '@/types/stok';

const TIMEOUT_MS = 15000;
async function withTimeout<T>(promise: Promise<T>, ms: number, actionName: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Koneksi lambat/terputus (${actionName} melebihi batas waktu ${ms/1000}s). Silakan periksa jaringan Anda.`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Semua',
  'FOOD & BEVERAGE': 'Food & Beverage',
  'BUMBU': 'Bumbu',
  'PACKAGING': 'Packaging',
  'OPERASIONAL': 'Operasional',
};

function calculateTotalFisik(b: BahanBaku, input: { besar?: string; tengah?: string; kecil?: string }) {
  const besar = Number(input.besar || 0);
  const tengah = Number(input.tengah || 0);
  const kecil = Number(input.kecil || 0);
  
  const unitBesarInKecil = b.faktor_tampilan || 1;
  const unitTengahInKecil = b.faktor_tengah ? unitBesarInKecil / b.faktor_tengah : 1;

  if (b.satuan_tengah && b.satuan_kecil) {
    return (besar * unitBesarInKecil) + (tengah * unitTengahInKecil) + kecil;
  } else if (b.satuan_kecil) {
    return (besar * unitBesarInKecil) + kecil;
  }
  return besar;
}

function formatRawInput(b: BahanBaku, input: { besar?: string; tengah?: string; kecil?: string }) {
  const parts = [];
  if (input.besar && Number(input.besar) > 0) parts.push(`${input.besar} ${b.satuan}`);
  if (b.satuan_tengah && input.tengah && Number(input.tengah) > 0) parts.push(`${input.tengah} ${b.satuan_tengah}`);
  if (b.satuan_kecil && input.kecil && Number(input.kecil) > 0) parts.push(`${input.kecil} ${b.satuan_kecil}`);
  return parts.length > 0 ? parts.join(' + ') : `0 ${b.satuan}`;
}

function formatSystemQty(b: BahanBaku, totalSmallestQty: number) {
  let remaining = Math.abs(totalSmallestQty);
  let besar = 0, tengah = 0, kecil = 0;

  const unitBesarInKecil = b.faktor_tampilan || 1;

  if (b.satuan_tengah && b.satuan_kecil) {
    const unitTengahInKecil = b.faktor_tengah ? unitBesarInKecil / b.faktor_tengah : 1;

    besar = Math.floor(remaining / unitBesarInKecil);
    remaining = remaining % unitBesarInKecil;

    tengah = Math.floor(remaining / unitTengahInKecil);
    kecil = remaining % unitTengahInKecil;
    
    // Round to handle floating point issues
    kecil = Math.round(kecil * 100) / 100;
  } else if (b.satuan_kecil) {
    besar = Math.floor(remaining / unitBesarInKecil);
    kecil = remaining % unitBesarInKecil;
    
    kecil = Math.round(kecil * 100) / 100;
  } else {
    besar = remaining;
    besar = Math.round(besar * 100) / 100;
  }

  const parts = [];
  if (besar > 0) parts.push(`${besar} ${b.satuan}`);
  if (tengah > 0 && b.satuan_tengah) parts.push(`${tengah} ${b.satuan_tengah}`);
  if (kecil > 0 && b.satuan_kecil) parts.push(`${kecil} ${b.satuan_kecil}`);

  const formattedStr = parts.length > 0 ? parts.join(' + ') : `0 ${b.satuan}`;
  return totalSmallestQty < 0 ? `-${formattedStr}` : formattedStr;
}

export function OpnameForm({ outletId, createdBy, role }: { outletId: string; createdBy: string; role?: string }) {
  const isKitchen = role === 'kitchen';
  const router = useRouter();
  const { bahanBaku, error: bahanError, loading: isBahanLoading } = useBahanBaku();
  const { balances, loading: isBalanceLoading } = useStokBalance(outletId);
  const { createOrReuseDraft, fetchTodayDraft, upsertItems, finalize } = useOpnameActions();

  const { data: outlets } = useQuery({
    queryKey: ['monitoring', 'outlets'],
    queryFn: fetchOutletsList,
  });
  const isGudang = outlets?.find(o => o.id === outletId)?.nama?.toUpperCase().includes('GUDANG') ?? false;

  const [inputs, setInputs] = useState<Record<string, { besar?: string; tengah?: string; kecil?: string }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`opname_draft_${outletId}`);
        if (saved) return JSON.parse(saved).inputs || {};
      } catch {}
    }
    return {};
  });
  // State target khusus kitchen: menggantikan qty_fisik saat finalisasi
  const [targets, setTargets] = useState<Record<string, { besar?: string; tengah?: string; kecil?: string }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`opname_draft_${outletId}`);
        if (saved) return JSON.parse(saved).targets || {};
      } catch {}
    }
    return {};
  }); 

  const [notes, setNotes] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`opname_draft_${outletId}`);
        if (saved) return JSON.parse(saved).notes || '';
      } catch {}
    }
    return '';
  });

  // Auto-save ke localStorage tiap kali input berubah
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`opname_draft_${outletId}`, JSON.stringify({ inputs, targets, notes }));
    }
  }, [inputs, targets, notes, outletId]);
  const [busy, setBusy] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Resume draft yang sudah tersimpan (via "Simpan Draft") saat form dibuka
  // ulang, supaya crew tidak harus mulai dari nol lagi.
  const [draftChecked, setDraftChecked] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (draftChecked || isBahanLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await fetchTodayDraft(outletId);
        if (!cancelled && draft) {
          const resumedInputs: Record<string, { besar?: string; tengah?: string; kecil?: string }> = {};
          const resumedTargets: Record<string, { besar?: string; tengah?: string; kecil?: string }> = {};
          for (const item of draft.opname_item || []) {
            try {
              const parsed = JSON.parse(String(item.catatan || '').replace(/^\[RAW\]\s*/, ''));
              if (parsed?.raw) {
                resumedInputs[item.bahan_baku_id] = {
                  besar: parsed.raw.besar,
                  tengah: parsed.raw.tengah,
                  kecil: parsed.raw.kecil,
                };
              }
              if (parsed?.traw) {
                resumedTargets[item.bahan_baku_id] = {
                  besar: parsed.traw.besar,
                  tengah: parsed.traw.tengah,
                  kecil: parsed.traw.kecil,
                };
              }
            } catch {
              // item lama dari sebelum fitur draft ada — tak bisa di-resume otomatis, lewati
            }
          }
          if (Object.keys(resumedInputs).length > 0) {
            setInputs(prev => Object.keys(prev).length > 0 ? prev : resumedInputs);
            if (Object.keys(resumedTargets).length > 0) {
              setTargets(prev => Object.keys(prev).length > 0 ? prev : resumedTargets);
            }
            setLastDraftSavedAt(draft.updated_at || draft.created_at);
            showToast('📝 Draft opname sebelumnya dilanjutkan.', 'success');
          }
          if (draft.notes) setNotes((prev: string) => prev || draft.notes);
        }
      } catch {
        // gagal ambil draft (mis. offline) — biarkan form kosong seperti biasa
      } finally {
        if (!cancelled) setDraftChecked(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, isBahanLoading, draftChecked]);

  const saldoOf = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of balances) {
      m[b.bahan_baku_id] = b.saldo;
    }
    return m;
  }, [balances]);

  const handleInputChange = (bahanId: string, level: 'besar' | 'tengah' | 'kecil', value: string) => {
    setInputs(prev => ({
      ...prev,
      [bahanId]: {
        ...(prev[bahanId] || {}),
        [level]: value
      }
    }));
  };

  const handleTargetChange = (bahanId: string, level: 'besar' | 'tengah' | 'kecil', value: string) => {
    setTargets(prev => ({
      ...prev,
      [bahanId]: {
        ...(prev[bahanId] || {}),
        [level]: value
      }
    }));
  };

  const filteredBahan = useMemo(() => {
    return bahanBaku.filter((b) => {
      const source = getBahanBakuSource(b.nama);
      if (source === 'GUDANG_PUSAT' && !isGudang) return false;

      const matchesSearch = b.nama.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || b.kategori === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [bahanBaku, searchTerm, activeCategory, isGudang]);

  function buildItemsToSave(opnameId: string) {
    return bahanBaku
      .filter((b) => {
         const inp = inputs[b.id];
         return inp && (inp.besar !== undefined || inp.tengah !== undefined || inp.kecil !== undefined);
      })
      .map((b) => {
        const inp = inputs[b.id] || {};
        const tgt = targets[b.id];
        const hasTarget = isKitchen && tgt && (tgt.besar !== undefined || tgt.tengah !== undefined || tgt.kecil !== undefined);

        // Jika kitchen mengisi target → target menggantikan qty_fisik (Opsi A)
        const effectiveInp = hasTarget ? tgt! : inp;
        const qtyFisik = calculateTotalFisik(b, effectiveInp);
        const qtySystem = saldoOf[b.id] ?? 0;
        const selisih = computeSelisih(qtyFisik, qtySystem);

        const rawInputText = formatRawInput(b, inp);
        const rawSystemText = formatSystemQty(b, qtySystem);
        const rawSelisihText = formatSystemQty(b, selisih);

        // `raw` (besar/tengah/kecil mentah) disimpan supaya "Simpan Draft" bisa
        // di-resume persis seperti input aslinya, bukan cuma teks berformat.
        // `t` dan `traw` disimpan jika kitchen mengisi target.
        const rawData: Record<string, unknown> = { f: rawInputText, s: rawSystemText, d: rawSelisihText, raw: inp };
        if (hasTarget) {
          rawData.t = formatRawInput(b, tgt!);
          rawData.traw = tgt;
        }

        return {
          opname_id: opnameId,
          bahan_baku_id: b.id,
          qty_fisik: qtyFisik,
          qty_system: qtySystem,
          flagged: isSelisihFlagged(selisih, qtySystem, b.satuan, b.satuan_kecil),
          catatan: `[RAW] ${JSON.stringify(rawData)}`,
        };
      });
  }

  async function handleSaveDraft() {
    setBusy(true);
    try {
      const opname = await withTimeout(createOrReuseDraft(outletId, 'harian', createdBy, notes), TIMEOUT_MS, 'membuat draft');
      const itemsToSave = buildItemsToSave(opname.id);

      if (itemsToSave.length === 0) {
        showToast('🔴 Belum ada item yang diinput.', 'warning');
        setBusy(false);
        return;
      }

      await withTimeout(upsertItems(itemsToSave), TIMEOUT_MS, 'menyimpan data');
      setLastDraftSavedAt(new Date().toISOString());
      showToast('💾 Draft opname tersimpan. Bisa dilanjutkan nanti sebelum finalisasi.', 'success');
    } catch (err: any) {
      showToast(`🔴 Gagal menyimpan draft: ${err.message || err}`, 'warning');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    setBusy(true);
    try {
      const opname = await withTimeout(createOrReuseDraft(outletId, 'harian', createdBy, notes), TIMEOUT_MS, 'membuat draft');
      const itemsToSave = buildItemsToSave(opname.id);

      if (itemsToSave.length === 0) {
        showToast('🔴 Tidak ada item yang diinput.', 'warning');
        setBusy(false);
        return;
      }

      await withTimeout(upsertItems(itemsToSave), TIMEOUT_MS, 'menyimpan data item');
      const hasFlagged = itemsToSave.some(i => i.flagged);
      // finalize uses offline queue internally, so a timeout here is mostly to catch local hang,
      // but if the queue adds synchronously, the rpc hangs inside finalize.
      const res = await withTimeout(finalize(opname.id), TIMEOUT_MS, 'finalisasi opname');

      if (hasFlagged) {
         showToast('✅ Opname difinalisasi (Selisih dicatat).', 'success');
      } else {
         const successMsg = res.queued
           ? '⚠️ Offline: Data disimpan di antrean lokal & akan disinkron saat online!'
           : '🟢 Berhasil: Formulir opname berhasil disimpan dan difinalisasi!';
         showToast(successMsg, res.queued ? 'warning' : 'success');
      }
      
      // Bersihkan local storage karena sudah berhasil difinalisasi
      localStorage.removeItem(`opname_draft_${outletId}`);

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

  if (isBahanLoading || isBalanceLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-10 h-10 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-[#701604]/70 font-bold uppercase tracking-wider text-xs mt-4 animate-pulse">Memuat data inventaris...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 relative pb-24">
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 z-50 animate-bounce font-bold text-sm text-white transition-all ${
          toast.type === 'success' ? 'bg-[#0a7d2c] border-[#93f997]/30 shadow-[0px_8px_24px_rgba(10,125,44,0.15)]' : 'bg-[#ba1a1a] border-[#ffdad6]/30 shadow-[0px_8px_24px_rgba(186,26,26,0.15)]'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '🚨'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {lastDraftSavedAt && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fff4e5] border border-[#f29744]/30 text-[#701604] text-[10px] font-bold uppercase tracking-wider">
          <span>📝</span>
          <span>
            Draft — terakhir update{' '}
            {new Date(lastDraftSavedAt).toLocaleString('id-ID', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
      )}

      <div className="space-y-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filteredBahan.map((b) => {
          const inp = inputs[b.id] || {};
          const tgt = targets[b.id] || {};
          const isSaved = inp.besar !== undefined || inp.tengah !== undefined || inp.kecil !== undefined;
          const hasTarget = isKitchen && (tgt.besar !== undefined || tgt.tengah !== undefined || tgt.kecil !== undefined);

          return (
            <div
              key={b.id}
              className={`p-5 rounded-xl border flex flex-col justify-between transition-all duration-200 bg-white shadow-[0px_4px_12px_rgba(144,77,0,0.03)] ${
                hasTarget
                  ? 'border-[#0a7d2c]/40 shadow-[0px_4px_12px_rgba(10,125,44,0.06)]'
                  : 'border-[#d9c2b2]/45 hover:border-[#f29744]/45'
              }`}
            >
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
                    Satuan: <span className="text-gray-700 font-bold">{b.satuan}</span>
                    {b.satuan_tengah && ` ➜ ${b.satuan_tengah}`}
                    {b.satuan_kecil && ` ➜ ${b.satuan_kecil}`}
                  </p>
                </div>

                <div className="text-right min-w-[65px] flex-shrink-0">
                  {hasTarget ? (
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black text-[#0a7d2c] uppercase tracking-wider">🎯 Target</p>
                    </div>
                  ) : isSaved ? (
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-[#0a7d2c]">✓ Diisi</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Input Fisik Crew */}
              <div className="mt-4">
                <span className="text-[9px] font-bold text-[#544437]/50 uppercase tracking-wider">
                  Stok Fisik Crew
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2 items-center justify-end">
                  {/* Input untuk Satuan Besar */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-[#544437]/60 uppercase mb-1">{b.satuan}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      className="w-16 text-center bg-[#faf2e9]/30 border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-1.5 shadow-inner focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
                      placeholder="0"
                      value={inp.besar ?? ''}
                      onChange={(e) => handleInputChange(b.id, 'besar', e.target.value)}
                    />
                  </div>
                  
                  {/* Input untuk Satuan Tengah */}
                  {b.satuan_tengah && (
                    <>
                      <span className="text-[10px] font-bold text-[#544437]/40 mt-3">+</span>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-[#544437]/60 uppercase mb-1">{b.satuan_tengah}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          className="w-16 text-center bg-[#faf2e9]/30 border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-1.5 shadow-inner focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
                          placeholder="0"
                          value={inp.tengah ?? ''}
                          onChange={(e) => handleInputChange(b.id, 'tengah', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Input untuk Satuan Kecil */}
                  {b.satuan_kecil && (
                    <>
                      <span className="text-[10px] font-bold text-[#544437]/40 mt-3">+</span>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-[#544437]/60 uppercase mb-1">{b.satuan_kecil}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          className="w-16 text-center bg-[#faf2e9]/30 border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-1.5 shadow-inner focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
                          placeholder="0"
                          value={inp.kecil ?? ''}
                          onChange={(e) => handleInputChange(b.id, 'kecil', e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Input Target — hanya untuk role kitchen */}
              {isKitchen && (
                <div className="mt-3 pt-3 border-t border-[#0a7d2c]/15">
                  <span className="text-[9px] font-bold text-[#0a7d2c]/70 uppercase tracking-wider">
                    🎯 Target Kitchen <span className="font-normal text-[#544437]/50">(opsional — override fisik)</span>
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2 items-center justify-end">
                    {/* Target Satuan Besar */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-[#0a7d2c]/60 uppercase mb-1">{b.satuan}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        className="w-16 text-center bg-[#e8f5e9]/40 border border-[#0a7d2c]/30 rounded-lg font-extrabold text-sm text-[#0a7d2c] py-1.5 shadow-inner focus:ring-1 focus:ring-[#0a7d2c]/50 focus:border-[#0a7d2c]/60 placeholder-[#0a7d2c]/30"
                        placeholder="–"
                        value={tgt.besar ?? ''}
                        onChange={(e) => handleTargetChange(b.id, 'besar', e.target.value)}
                      />
                    </div>

                    {/* Target Satuan Tengah */}
                    {b.satuan_tengah && (
                      <>
                        <span className="text-[10px] font-bold text-[#0a7d2c]/30 mt-3">+</span>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-[#0a7d2c]/60 uppercase mb-1">{b.satuan_tengah}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            className="w-16 text-center bg-[#e8f5e9]/40 border border-[#0a7d2c]/30 rounded-lg font-extrabold text-sm text-[#0a7d2c] py-1.5 shadow-inner focus:ring-1 focus:ring-[#0a7d2c]/50 focus:border-[#0a7d2c]/60 placeholder-[#0a7d2c]/30"
                            placeholder="–"
                            value={tgt.tengah ?? ''}
                            onChange={(e) => handleTargetChange(b.id, 'tengah', e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {/* Target Satuan Kecil */}
                    {b.satuan_kecil && (
                      <>
                        <span className="text-[10px] font-bold text-[#0a7d2c]/30 mt-3">+</span>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-[#0a7d2c]/60 uppercase mb-1">{b.satuan_kecil}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            className="w-16 text-center bg-[#e8f5e9]/40 border border-[#0a7d2c]/30 rounded-lg font-extrabold text-sm text-[#0a7d2c] py-1.5 shadow-inner focus:ring-1 focus:ring-[#0a7d2c]/50 focus:border-[#0a7d2c]/60 placeholder-[#0a7d2c]/30"
                            placeholder="–"
                            value={tgt.kecil ?? ''}
                            onChange={(e) => handleTargetChange(b.id, 'kecil', e.target.value)}
                          />
                        </div>
                      </>
                    )}
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

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            disabled={busy}
            onClick={handleSaveDraft}
            className="w-full sm:w-auto sm:flex-1 py-3 px-4 bg-white hover:bg-[#faf2e9] active:bg-[#f5e9db] text-[#701604] border border-[#d9c2b2]/60 transition-all rounded-xl font-bold uppercase tracking-wider text-xs shadow-sm disabled:opacity-50 active:scale-[0.99] cursor-pointer"
          >
            💾 Simpan Draft
          </button>

          <button
            disabled={busy}
            onClick={handleFinalize}
            className="w-full sm:w-auto sm:flex-[2] py-3 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white transition-all rounded-xl font-bold uppercase tracking-wider text-xs shadow-md disabled:opacity-50 disabled:hover:bg-[#701604] active:scale-[0.99] cursor-pointer"
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
    </div>
  );
}
