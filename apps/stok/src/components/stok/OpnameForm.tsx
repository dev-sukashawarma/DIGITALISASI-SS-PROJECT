'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useStokBalance } from '@/hooks/useStokBalance';
import { useOpnameActions } from '@/hooks/useOpname';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';
import { getBahanBakuSource } from '@suka/design-system';
import { computeSelisih, isSelisihFlagged } from '@/lib/stok/selisih';
import { isSuspiciousZero } from '@/lib/stok/zeroGuard';
import { totalSubVendor, singleVendorBesar, filterResumableInputs, type SubVendorInput } from '@/lib/stok/opnameVendor';
import { convertBesarToGram, formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit';
import { createClient } from '@/lib/supabase';
import type { BahanBaku } from '@/types/stok';

/** Baris vendor untuk satu bahan multi-vendor, dari RPC `saldo_vendor_gudang`. */
interface VendorInfo {
  vendor_id: string;
  vendor_nama: string;
}

const TIMEOUT_MS = 60000;
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
  return formatTriUnitSaldoFromGram(
    totalSmallestQty,
    b.satuan,
    b.satuan_tengah,
    b.faktor_tengah,
    b.satuan_kecil,
    b.faktor_tampilan
  );
}

export function OpnameForm({ outletId, createdBy, role }: { outletId: string; createdBy: string; role?: string }) {
  const isKitchen = role === 'kitchen' || role === 'purchasing';
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

  /**
   * Hitung fisik per vendor untuk bahan multi-vendor di Gudang Pusat (spec
   * §4.5). Kunci luar = bahan_baku_id, kunci dalam = vendor_id (vendor
   * induk, sama seperti yang dikembalikan `saldo_vendor_gudang`).
   *
   * Draft lama (sebelum fitur ini ada) tidak punya field `vendor` sama
   * sekali -- `JSON.parse(saved).vendor` jatuh ke `undefined` lalu `|| {}`,
   * jadi tetap terbaca tanpa error.
   */
  const [subInputs, setSubInputs] = useState<Record<string, Record<string, SubVendorInput>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`opname_draft_${outletId}`);
        if (saved) return JSON.parse(saved).vendor || {};
      } catch {}
    }
    return {};
  });

  // Auto-save ke localStorage tiap kali input berubah
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`opname_draft_${outletId}`, JSON.stringify({ inputs, targets, notes, vendor: subInputs }));
    }
  }, [inputs, targets, notes, subInputs, outletId]);
  const [busy, setBusy] = useState(false);
  const [showUnfilledModal, setShowUnfilledModal] = useState(false);
  /**
   * Bahan yang hitungan fisiknya turun drastis dari catatan sistem.
   * Diisi tepat sebelum finalisasi; selama tidak kosong, modal konfirmasi
   * tampil dan finalisasi ditahan.
   *
   * Latar: 4 September 2026 di BNR, 24 bahan difinalisasi dengan angka 0 yang
   * memang diketik crew (bukan baris kosong) -- Rp1,2 juta stok terhapus dalam
   * satu klik. 16 di antaranya sudah ditandai `flagged`, tapi penanda itu dulu
   * cuma mengganti bunyi notifikasi, tidak menahan apa pun.
   */
  const [penurunanDrastis, setPenurunanDrastis] = useState<
    { id: string; nama: string; sistemText: string; fisikText: string; habisTotal: boolean; bolehLewati: boolean }[]
  >([]);

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

  /**
   * Hasil resume yang sudah didapat dari server tapi BELUM diterapkan ke
   * `inputs` -- ditahan sampai daftar bahan multi-vendor (`vendorsByBahan`)
   * diketahui pasti (`vendorsLoaded`). Lihat efek "Terapkan resumedInputs..."
   * di bawah untuk alasannya (Task 8 fix round 1, temuan Penting).
   */
  const [pendingResumedInputs, setPendingResumedInputs] = useState<Record<string, { besar?: string; tengah?: string; kecil?: string }> | null>(null);

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
            // JANGAN setInputs langsung di sini -- lihat efek di bawah.
            // Resume server-side belum memulihkan sub-baris per vendor, jadi
            // menerapkan angka gabungan lama untuk bahan yang (ternyata)
            // multi-vendor akan menjebak angka itu tanpa rincian di baliknya.
            setPendingResumedInputs(resumedInputs);
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

  const balanceDataOf = useMemo(() => {
    const m: Record<string, { saldo: number, saldo_is_gram: boolean }> = {};
    for (const b of balances) {
      m[b.bahan_baku_id] = { saldo: b.saldo, saldo_is_gram: b.saldo_is_gram };
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

  const handleSubVendorChange = (bahanId: string, vendorId: string, level: 'besar' | 'tengah' | 'kecil', value: string) => {
    setSubInputs(prev => ({
      ...prev,
      [bahanId]: {
        ...(prev[bahanId] || {}),
        [vendorId]: {
          ...(prev[bahanId]?.[vendorId] || {}),
          [level]: value,
        },
      },
    }));
  };

  const relevantBahan = useMemo(() => {
    return bahanBaku.filter((b) => {
      const kat = b.kategori?.toUpperCase();
      const nama = b.nama?.toUpperCase();
      // Aset hardware & atribut perlengkapan tidak di-opname pada opname bahan baku harian
      if (kat === 'ASET' || kat === 'PERLENGKAPAN') return false;
      if (nama === 'PRINTER THERMAL' || nama === 'ID CARD') return false;

      const source = getBahanBakuSource(b.nama);
      if (source === 'GUDANG_PUSAT' && !isGudang) return false;
      return true;
    });
  }, [bahanBaku, isGudang]);

  const relevantBahanIdsKey = useMemo(() => relevantBahan.map((b) => b.id).sort().join(','), [relevantBahan]);

  // Vendor per bahan multi-vendor di Gudang Pusat -- SENGAJA tanpa `sisa`:
  // opname adalah hitung buta, angka sistem tidak boleh terlihat sebelum
  // dihitung (lihat brief Task 8 & isSuspiciousZero di atas). Hanya bahan
  // dengan >=2 vendor induk yang dikelompokkan di sini; bahan 1-vendor tak
  // masuk map ini sama sekali, sehingga jadi penanda "bukan multi-vendor".
  const [vendorsByBahan, setVendorsByBahan] = useState<Record<string, VendorInfo[]>>({});
  /**
   * True hanya setelah `vendorsByBahan` DIKETAHUI PASTI benar (RPC selesai
   * tanpa galat, atau memang tidak relevan -- outlet non-Gudang / tak ada
   * bahan). Selama false, `vendorsByBahan` tetap `{}` yang AMBIGU: bisa
   * berarti "sudah dicek, memang tak ada bahan multi-vendor" atau "belum
   * dicek sama sekali". Dua konsumen bergantung pada bedanya:
   * 1. Efek "Terapkan resumedInputs..." di bawah -- menahan resume draft
   *    sampai daftar ini pasti, supaya bahan multi-vendor tak kejebak angka
   *    gabungan lama tanpa sub-baris (Task 8 fix round 1, temuan Penting).
   * 2. `handleSaveDraft`/`handleFinalizeClick` -- menahan Simpan/Finalisasi
   *    selama `isGudang && !vendorsLoaded`, supaya bahan yang "akan ketahuan"
   *    multi-vendor tak sempat tersimpan lewat jalur biasa di jendela waktu
   *    sebelum RPC selesai (temuan Minor).
   */
  const [vendorsLoaded, setVendorsLoaded] = useState(false);

  useEffect(() => {
    if (!isGudang) {
      setVendorsByBahan({});
      setVendorsLoaded(true); // tak relevan untuk outlet non-Gudang
      return;
    }
    const ids = relevantBahan.map((b) => b.id);
    if (ids.length === 0) {
      setVendorsByBahan({});
      setVendorsLoaded(true); // tak ada bahan untuk dicek
      return;
    }
    let active = true;
    setVendorsLoaded(false);
    const supabase = createClient();
    supabase
      .rpc('saldo_vendor_gudang', { p_bahan_ids: ids })
      .then(({ data, error }: { data: any[] | null; error: any }) => {
        if (!active) return;
        if (error) {
          console.error('Gagal memuat vendor bahan multi-vendor', error);
          return; // vendorsLoaded TETAP false -> gerbang Simpan/Finalisasi tetap menahan
        }
        const grouped: Record<string, VendorInfo[]> = {};
        for (const row of data || []) {
          if (!row.multi) continue; // bahan 1-vendor tidak perlu sub-baris
          const list = grouped[row.bahan_baku_id] || (grouped[row.bahan_baku_id] = []);
          list.push({ vendor_id: row.vendor_id, vendor_nama: row.vendor_nama });
        }
        setVendorsByBahan(grouped);
        setVendorsLoaded(true);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGudang, relevantBahanIdsKey]);

  /**
   * Terapkan resumedInputs HANYA setelah `vendorsLoaded` -- lihat komentar di
   * `pendingResumedInputs`/`vendorsLoaded` di atas. Bahan yang ternyata
   * multi-vendor di-strip lewat `filterResumableInputs` (bukan diterapkan lalu
   * dikoreksi): resume server-side tak membawa sub-baris per vendor sama
   * sekali, jadi bahan itu harus mulai dari nol saat resume, bukan dari total
   * lama yang tak punya rincian di baliknya.
   */
  useEffect(() => {
    if (!pendingResumedInputs || !vendorsLoaded) return;
    const filtered = filterResumableInputs(pendingResumedInputs, Object.keys(vendorsByBahan));
    if (Object.keys(filtered).length > 0) {
      setInputs(prev => Object.keys(prev).length > 0 ? prev : filtered);
    }
    setPendingResumedInputs(null);
  }, [pendingResumedInputs, vendorsLoaded, vendorsByBahan]);

  // Pastikan setiap vendor bahan multi-vendor punya kunci di subInputs (biar
  // "kosong semua" vs "sebagian" bisa dibedakan sebelum user mengetik apa
  // pun), tanpa menimpa isian yang sudah ada (mis. dari draft localStorage).
  useEffect(() => {
    setSubInputs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [bahanId, vendors] of Object.entries(vendorsByBahan)) {
        const current = next[bahanId] || {};
        let bahanChanged = false;
        const merged = { ...current };
        for (const v of vendors) {
          if (!(v.vendor_id in merged)) {
            merged[v.vendor_id] = {};
            bahanChanged = true;
          }
        }
        if (bahanChanged) {
          next[bahanId] = merged;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [vendorsByBahan]);

  // Baris utama bahan multi-vendor = jumlah sub-baris (read-only). Disinkron
  // ke `inputs` supaya seluruh pipa lama (buildItemsToSave, calculateTotalFisik,
  // filledCount, dst) tetap jalan tanpa diduplikasi -- lihat singleVendorBesar:
  // total (satuan besar, pecahan) dikali faktor_tampilan == totalKecilSum yang
  // sama persis dipakai simpan_hitung_vendor per vendor.
  useEffect(() => {
    setInputs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const bahanId of Object.keys(vendorsByBahan)) {
        const b = bahanBaku.find((x) => x.id === bahanId);
        if (!b) continue;
        const sub = subInputs[bahanId] || {};
        const { total } = totalSubVendor(sub, b);
        if (total !== null) {
          const val = String(total);
          if (next[bahanId]?.besar !== val || next[bahanId]?.tengah !== undefined || next[bahanId]?.kecil !== undefined) {
            next[bahanId] = { besar: val };
            changed = true;
          }
        } else if (next[bahanId] !== undefined) {
          delete next[bahanId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorsByBahan, subInputs, bahanBaku]);

  /**
   * Bahan multi-vendor yang sebagian vendornya terisi, sebagian belum --
   * keadaan yang WAJIB diblokir (spec §4.5): RPC `simpan_hitung_vendor` pun
   * menolak kiriman yang tak memuat semua vendor induk sebuah bahan.
   */
  const sebagianVendorIds = useMemo(() => {
    const ids: string[] = [];
    for (const bahanId of Object.keys(vendorsByBahan)) {
      const b = bahanBaku.find((x) => x.id === bahanId);
      if (!b) continue;
      const sub = subInputs[bahanId] || {};
      if (totalSubVendor(sub, b).sebagian) ids.push(bahanId);
    }
    return ids;
  }, [vendorsByBahan, subInputs, bahanBaku]);

  const filledCount = useMemo(() => {
    return relevantBahan.filter((b) => {
      const inp = inputs[b.id];
      return inp && (inp.besar !== undefined || inp.tengah !== undefined || inp.kecil !== undefined);
    }).length;
  }, [relevantBahan, inputs]);

  const unfilledCount = relevantBahan.length - filledCount;

  const filteredBahan = useMemo(() => {
    return relevantBahan.filter((b) => {
      const matchesSearch = b.nama.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesCategory = true;
      if (activeCategory === 'unfilled') {
        const inp = inputs[b.id];
        const isFilled = inp && (inp.besar !== undefined || inp.tengah !== undefined || inp.kecil !== undefined);
        matchesCategory = !isFilled;
      } else if (activeCategory !== 'all') {
        matchesCategory = b.kategori === activeCategory;
      }

      return matchesSearch && matchesCategory;
    });
  }, [relevantBahan, searchTerm, activeCategory, inputs]);

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
        
        const balanceData = balanceDataOf[b.id] ?? { saldo: 0, saldo_is_gram: true };
        let qtySystem = balanceData.saldo;
        if (!balanceData.saldo_is_gram) {
          qtySystem = convertBesarToGram(qtySystem, b);
        }

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

  /**
   * Payload untuk RPC `simpan_hitung_vendor`: satu baris per (bahan, vendor)
   * bahan multi-vendor yang SUDAH lengkap (semua vendornya terisi). Bahan
   * kosong-semua atau sebagian sengaja tak masuk sini -- yang kosong berarti
   * "belum dihitung, lewati" (perilaku lama); yang sebagian sudah diblokir
   * lebih dulu oleh `sebagianVendorIds` sebelum fungsi ini dipanggil.
   */
  function buildVendorItemsToSave(): { bahan_baku_id: string; vendor_id: string; qty_besar: number }[] {
    const items: { bahan_baku_id: string; vendor_id: string; qty_besar: number }[] = [];
    for (const [bahanId, vendors] of Object.entries(vendorsByBahan)) {
      const b = bahanBaku.find((x) => x.id === bahanId);
      if (!b) continue;
      const sub = subInputs[bahanId] || {};
      const { total } = totalSubVendor(sub, b);
      if (total === null) continue;
      for (const v of vendors) {
        const inp = sub[v.vendor_id] || {};
        items.push({ bahan_baku_id: bahanId, vendor_id: v.vendor_id, qty_besar: singleVendorBesar(inp, b) });
      }
    }
    return items;
  }

  /**
   * Simpan hitungan per vendor ke `opname_item_vendor` (RPC
   * `simpan_hitung_vendor`, Task 4) -- trigger di DB yang mengubahnya jadi
   * mutasi `hitung_fisik` per vendor baru jalan SAAT FINALISASI, jadi ini
   * WAJIB dipanggil sebelum `finalize()`. Gagal (mis. RPC menolak karena
   * sebagian vendor belum lengkap, atau bukan staff Gudang Pusat) harus
   * melempar supaya pemanggilnya menghentikan proses & menampilkan pesan RPC
   * apa adanya -- bukan ditelan di sini.
   */
  async function saveVendorHitung(opnameId: string) {
    if (!isGudang || Object.keys(vendorsByBahan).length === 0) return;
    const items = buildVendorItemsToSave();
    const supabase = createClient();
    const { error } = await supabase.rpc('simpan_hitung_vendor', { p_opname_id: opnameId, p_items: items });
    if (error) throw new Error(error.message || 'Gagal menyimpan hitungan per vendor');
  }

  async function handleSaveDraft() {
    if (isGudang && !vendorsLoaded) {
      showToast('🔴 Sedang memuat daftar vendor Gudang Pusat. Tunggu sebentar lalu coba lagi.', 'warning');
      return;
    }
    if (sebagianVendorIds.length > 0) {
      showToast(`🔴 ${sebagianVendorIds.length} bahan multi-vendor belum diisi lengkap. Isi semua vendornya atau kosongkan semuanya.`, 'warning');
      return;
    }
    setBusy(true);
    try {
      const opname = await withTimeout(createOrReuseDraft(outletId, 'harian', createdBy, notes), TIMEOUT_MS, 'membuat draft');
      await withTimeout(saveVendorHitung(opname.id), TIMEOUT_MS, 'menyimpan hitungan vendor');
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

  /**
   * Daftar bahan yang hitungan fisiknya turun drastis dari catatan sistem.
   *
   * Sengaja memakai `buildItemsToSave` — sumber angka yang SAMA dengan yang
   * nanti benar-benar disimpan. Kalau perhitungannya disalin ulang di sini,
   * suatu saat peringatan dan data yang tersimpan akan bercerita beda.
   *
   * Hanya penurunan yang diperingatkan, bukan kenaikan: stok yang naik memang
   * janggal juga, tapi tidak menghapus apa pun — dan memperingatkan segalanya
   * membuat orang berhenti membaca peringatan.
   */
  function hitungPenurunanDrastis() {
    return buildItemsToSave('')
      .filter((i) => i.flagged && i.qty_fisik < i.qty_system)
      .map((i) => {
        const b = bahanBaku.find((x) => x.id === i.bahan_baku_id);
        return {
          id: i.bahan_baku_id,
          nama: b?.nama ?? '(bahan tidak dikenal)',
          sistemText: b ? formatSystemQty(b, i.qty_system) : String(i.qty_system),
          fisikText: b ? formatSystemQty(b, i.qty_fisik) : String(i.qty_fisik),
          habisTotal: i.qty_fisik === 0 && i.qty_system > 0,
          // Bahan yang ditandai habis padahal sistem masih mencatat stok berarti
          // boleh dikembalikan ke status "belum dihitung" -- lihat skipItem.
          bolehLewati: isSuspiciousZero(i.qty_fisik, i.qty_system, b?.faktor_konversi),
        };
      })
      .sort((a, b) => Number(b.habisTotal) - Number(a.habisTotal));
  }

  /**
   * Mengembalikan bahan ke status "belum dihitung": isiannya dihapus sehingga
   * item dilewati opname dan saldo sistemnya tidak diubah sama sekali.
   *
   * Definisi yang berlaku (keputusan owner, 8 September 2026): kolom kosong =
   * belum dihitung (saldo aman), kolom 0 = sudah dihitung dan fisiknya habis
   * (saldo dinolkan). Crew terbiasa memakai 0 untuk keduanya, jadi peringatan
   * saja tidak cukup -- perlu jalan keluar yang benar di tempat peringatan itu
   * muncul.
   */
  function skipItem(bahanId: string) {
    setInputs((prev) => {
      const next = { ...prev };
      delete next[bahanId];
      return next;
    });
    setTargets((prev) => {
      const next = { ...prev };
      delete next[bahanId];
      return next;
    });
    setPenurunanDrastis((prev) => prev.filter((x) => x.id !== bahanId));
  }

  /** Gerbang terakhir sebelum finalisasi, dipakai dua jalur masuk. */
  function lanjutkanKeFinalisasi() {
    const turun = hitungPenurunanDrastis();
    if (turun.length > 0) {
      setPenurunanDrastis(turun);
      return;
    }
    executeFinalize();
  }

  function handleFinalizeClick() {
    if (isGudang && !vendorsLoaded) {
      showToast('🔴 Sedang memuat daftar vendor Gudang Pusat. Tunggu sebentar lalu coba lagi.', 'warning');
      return;
    }
    if (sebagianVendorIds.length > 0) {
      showToast(`🔴 ${sebagianVendorIds.length} bahan multi-vendor belum diisi lengkap. Isi semua vendornya atau kosongkan semuanya.`, 'warning');
      return;
    }
    if (filledCount === 0) {
      showToast('🔴 Belum ada item yang diinput.', 'warning');
      return;
    }
    if (unfilledCount > 0) {
      setShowUnfilledModal(true);
      return;
    }
    lanjutkanKeFinalisasi();
  }

  async function executeFinalize() {
    setBusy(true);
    try {
      const opname = await withTimeout(createOrReuseDraft(outletId, 'harian', createdBy, notes), TIMEOUT_MS, 'membuat draft');
      await withTimeout(saveVendorHitung(opname.id), TIMEOUT_MS, 'menyimpan hitungan vendor');
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
         // Dulu bercentang hijau 'success' — terbaca seperti keberhasilan biasa,
         // padahal justru menandai selisih besar yang baru saja memotong stok.
         const jml = itemsToSave.filter(i => i.flagged).length;
         showToast(`⚠️ Opname difinalisasi dengan ${jml} selisih besar — stok sudah dipotong.`, 'warning');
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
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 z-50 animate-toast-in font-bold text-sm text-white transition-all ${
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

      {/* Progress Widget */}
      <div className="bg-white border border-[#d9c2b2]/45 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#701604]">📊 Progres Opname</span>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#f29744]/15 text-[#701604] border border-[#f29744]/30">
              {filledCount} dari {relevantBahan.length} Bahan Terisi
            </span>
            {unfilledCount === 0 && relevantBahan.length > 0 && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#e8f5e9] text-[#0a7d2c] border border-[#0a7d2c]/20">
                ✅ Lengkap
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#544437]/70">
            {unfilledCount > 0
              ? `${unfilledCount} bahan belum diisi (akan dilewati jika tidak diisi)`
              : 'Semua bahan baku telah dihitung'}
          </p>
        </div>
        <div className="w-full sm:w-48 bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200/60 flex-shrink-0">
          <div
            className={`h-full transition-all duration-300 ${filledCount === relevantBahan.length && relevantBahan.length > 0 ? 'bg-[#0a7d2c]' : 'bg-[#f29744]'}`}
            style={{ width: `${relevantBahan.length > 0 ? (filledCount / relevantBahan.length) * 100 : 0}%` }}
          />
        </div>
      </div>

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

          {unfilledCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveCategory('unfilled')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer shadow-sm flex items-center gap-1 ${
                activeCategory === 'unfilled'
                  ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <span>Belum Terisi</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-black ${
                activeCategory === 'unfilled' ? 'bg-white text-amber-700' : 'bg-amber-200 text-amber-900'
              }`}>
                {unfilledCount}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filteredBahan.map((b) => {
          const inp = inputs[b.id] || {};
          const tgt = targets[b.id] || {};
          const isSaved = inp.besar !== undefined || inp.tengah !== undefined || inp.kecil !== undefined;
          const hasTarget = isKitchen && (tgt.besar !== undefined || tgt.tengah !== undefined || tgt.kecil !== undefined);

          // Bahan multi-vendor (>=2 vendor induk) di Gudang Pusat -- hitung
          // PER VENDOR, bukan satu angka gabungan (spec §4.5). `sisa`/stok
          // sistem TIDAK ditampilkan di sini -- hitung buta dipertahankan.
          const vendorList = vendorsByBahan[b.id];
          const isMultiVendor = !!vendorList && vendorList.length >= 2;
          const sub = subInputs[b.id] || {};
          const vendorTotal = isMultiVendor ? totalSubVendor(sub, b) : null;

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
              {isMultiVendor ? (
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-[#544437]/50 uppercase tracking-wider">
                      Hitung Fisik per Vendor
                    </span>
                    <span className="text-xs font-black text-[#701604] flex-shrink-0">
                      {vendorTotal?.total !== null && vendorTotal?.total !== undefined
                        ? `Total: ${vendorTotal.total.toFixed(2)} ${b.satuan}`
                        : vendorTotal?.sebagian
                          ? '⚠️ belum lengkap'
                          : 'Total: —'}
                    </span>
                  </div>

                  {vendorTotal?.sebagian && (
                    <p className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
                      ⚠️ Isi hitungan untuk SEMUA vendor bahan ini, atau kosongkan semuanya kalau belum dihitung.
                    </p>
                  )}

                  {(vendorList || []).map((v) => {
                    const vInp = sub[v.vendor_id] || {};
                    return (
                      <div key={v.vendor_id} className="border border-[#d9c2b2]/40 rounded-lg p-2.5 bg-[#faf2e9]/25">
                        <p className="text-[10px] font-bold text-[#701604]/80 mb-1.5 truncate" title={v.vendor_nama}>
                          {v.vendor_nama}
                        </p>
                        <div className="flex flex-wrap gap-2 items-center justify-end">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-[#544437]/60 uppercase mb-1">{b.satuan}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              className="w-14 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-xs text-[#701604] py-1 shadow-inner focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
                              placeholder="0"
                              value={vInp.besar ?? ''}
                              onChange={(e) => handleSubVendorChange(b.id, v.vendor_id, 'besar', e.target.value)}
                            />
                          </div>

                          {b.satuan_tengah && (
                            <>
                              <span className="text-[10px] font-bold text-[#544437]/40 mt-3">+</span>
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-[#544437]/60 uppercase mb-1">{b.satuan_tengah}</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  className="w-14 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-xs text-[#701604] py-1 shadow-inner focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
                                  placeholder="0"
                                  value={vInp.tengah ?? ''}
                                  onChange={(e) => handleSubVendorChange(b.id, v.vendor_id, 'tengah', e.target.value)}
                                />
                              </div>
                            </>
                          )}

                          {b.satuan_kecil && (
                            <>
                              <span className="text-[10px] font-bold text-[#544437]/40 mt-3">+</span>
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-[#544437]/60 uppercase mb-1">{b.satuan_kecil}</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  className="w-14 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-xs text-[#701604] py-1 shadow-inner focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
                                  placeholder="0"
                                  value={vInp.kecil ?? ''}
                                  onChange={(e) => handleSubVendorChange(b.id, v.vendor_id, 'kecil', e.target.value)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
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
              )}

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
            onClick={handleFinalizeClick}
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

      {/* Confirmation Modal when there are unfilled items */}
      {showUnfilledModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-[#d9c2b2]/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300/60 flex items-center justify-center text-xl flex-shrink-0">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-[#701604]">
                  Ada {unfilledCount} Bahan Belum Diisi
                </h3>
                <p className="text-xs text-[#544437]/80">
                  {filledCount} dari {relevantBahan.length} bahan terisi.
                </p>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed space-y-1">
              <p className="font-bold">⚠️ Perhatian Stok Sistem:</p>
              <p>
                Bahan yang dikosongkan <strong>tidak akan di-opname (dilewati)</strong>. Saldo sistem untuk bahan tersebut tetap aman dan tidak akan berubah.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnfilledModal(false);
                  setActiveCategory('unfilled');
                }}
                className="flex-1 py-2.5 px-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-[0.99]"
              >
                🔍 Periksa Bahan
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnfilledModal(false);
                  // Lewat gerbang penurunan drastis, bukan langsung finalisasi —
                  // kalau langsung, jalur "ada bahan belum diisi" akan melewati
                  // peringatan yang justru paling perlu di kasus BNR.
                  lanjutkanKeFinalisasi();
                }}
                className="flex-1 py-2.5 px-3 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-md active:scale-[0.99]"
              >
                Lanjutkan ({filledCount} Item)
              </button>
            </div>
          </div>
        </div>
      )}

      {penurunanDrastis.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-[#d9c2b2]/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-300/60 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-[#701604]">
                  {penurunanDrastis.length} Bahan Turun Drastis
                </h3>
                <p className="text-xs text-[#544437]/80">
                  Hitungan fisik jauh di bawah catatan sistem.
                </p>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-red-200 bg-red-50/60 divide-y divide-red-200/70">
              {penurunanDrastis.map((it) => (
                <div key={it.id} className="px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-xs text-[#701604]">{it.nama}</span>
                    {it.habisTotal && (
                      <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        habis total
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-red-900/90 leading-relaxed">
                    Sistem <strong>{it.sistemText}</strong> → fisik{' '}
                    <strong>{it.fisikText}</strong>
                  </p>
                  {it.bolehLewati && (
                    <button
                      type="button"
                      onClick={() => skipItem(it.id)}
                      className="mt-1.5 py-1 px-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-bold text-[10px] cursor-pointer transition-all active:scale-[0.99]"
                    >
                      Belum dihitung — lewati
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed">
              Pastikan bahan-bahan di atas memang benar-benar sudah dihitung dan
              jumlahnya sesegitu. Setelah difinalisasi, selisihnya langsung
              memotong stok dan <strong>tidak bisa dibatalkan</strong>.
              <span className="mt-1.5 block">
                Kalau bahannya <strong>belum sempat dihitung</strong>, tekan
                &quot;Belum dihitung&quot; — bahan itu dilewati dan stoknya tetap aman.
                Mengisi <strong>0</strong> berarti fisiknya benar-benar habis.
              </span>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPenurunanDrastis([])}
                className="flex-1 py-2.5 px-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-[0.99]"
              >
                🔍 Periksa Lagi
              </button>
              <button
                type="button"
                onClick={() => {
                  setPenurunanDrastis([]);
                  executeFinalize();
                }}
                className="flex-1 py-2.5 px-3 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-md active:scale-[0.99]"
              >
                Ya, Sudah Saya Hitung
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
