'use client';

import { useMemo, useState } from 'react';
import { X, Search, BookOpen } from 'lucide-react';
import type { BahanBaku } from '@/types/stok';

/**
 * Baris konversi satuan yang gampang dibaca crew, mis:
 * "1 Dus = 24 Pack = 240 Lembar" atau "1 Kg = 1000 Gram".
 * Tak menyentuh saldo/stok sama sekali -- murni konfigurasi konversi
 * bahan_baku, jadi tak ada isu saldo_is_gram di sini.
 */
function formatKonversi(b: BahanBaku): string {
  const parts = [`1 ${b.satuan}`];
  if (b.satuan_tengah && b.faktor_tengah) {
    parts.push(`${b.faktor_tengah} ${b.satuan_tengah}`);
  }
  if (b.satuan_kecil && b.faktor_tampilan) {
    parts.push(`${b.faktor_tampilan} ${b.satuan_kecil}`);
  }
  if (parts.length === 1) return `1 ${b.satuan} (tanpa pecahan satuan)`;
  return parts.join(' = ');
}

export function GlosariumSatuanModal({ bahanBaku, onClose }: { bahanBaku: BahanBaku[]; onClose: () => void }) {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const filtered = bahanBaku.filter(b => b.nama.toLowerCase().includes(q.toLowerCase()));
    return filtered.slice().sort((a, b) => a.nama.localeCompare(b.nama));
  }, [bahanBaku, q]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 border border-[#d9c2b2]/40 space-y-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glosarium-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#f29744] shrink-0" />
            <div>
              <h2 id="glosarium-title" className="text-base font-bold text-[#701604]">Glosarium Satuan Bahan Baku</h2>
              <p className="text-[11px] text-[#544437]/60">Konversi satuan besar → kecil, biar tidak salah hitung.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-[#544437]/60 hover:bg-[#f7f0ea] transition"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative shrink-0">
          <input
            type="text"
            className="w-full px-4 py-2.5 pl-9 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-gray-900 placeholder-gray-400 font-medium"
            placeholder="Cari nama bahan..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        <div className="overflow-y-auto space-y-1.5 -mx-1 px-1">
          {rows.length === 0 ? (
            <p className="text-xs text-[#544437]/60 text-center py-6">Tidak ada bahan yang cocok.</p>
          ) : (
            rows.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 bg-[#fff8f1] rounded-xl px-3.5 py-2.5 border border-[#d9c2b2]/20">
                <span className="font-bold text-[#1e1b15] text-xs uppercase truncate">{b.nama}</span>
                <span className="text-xs font-semibold text-[#701604] text-right shrink-0">{formatKonversi(b)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
