"use client";

import React, { useState } from "react";
import { Ban } from "lucide-react";

/** Tombol "Batalkan pengajuan" dua langkah: ketuk sekali memunculkan konfirmasi di tempat,
 *  supaya pengajuan tidak terhapus karena salah sentuh. */
export function TombolBatalkan({
  onConfirm,
  loading,
}: {
  onConfirm: () => void;
  loading: boolean;
}) {
  const [yakin, setYakin] = useState(false);

  if (!yakin) {
    return (
      <button
        type="button"
        onClick={() => setYakin(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors"
      >
        <Ban size={14} /> Batalkan
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-600">Batalkan pengajuan ini?</span>
      <button
        type="button"
        disabled={loading}
        onClick={() => setYakin(false)}
        className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
      >
        Tidak
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={onConfirm}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Membatalkan..." : "Ya, batalkan"}
      </button>
    </div>
  );
}
