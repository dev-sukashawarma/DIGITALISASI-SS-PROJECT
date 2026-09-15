"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sun, Sunset, Moon } from "lucide-react";
import { namaShift, type ShiftKe, type ShiftOption } from "@/lib/attendance/shift";

type Props = {
  choices: ShiftOption[];
  staffName?: string | null;
  onPilih: (ke: ShiftKe) => void;
  /** Tanpa onBatal, modal benar-benar wajib (tak ada tombol tutup). */
  onBatal?: () => void;
};

function IkonShift({ jamMasuk }: { jamMasuk: string }) {
  const h = Number(jamMasuk.slice(0, 2));
  if (h < 11) return <Sun size={20} strokeWidth={2.5} />;
  if (h < 15) return <Sunset size={20} strokeWidth={2.5} />;
  return <Moon size={20} strokeWidth={2.5} />;
}

/**
 * Pilih shift sebelum absen masuk, untuk outlet dua shift.
 * Mobile-first: panel dari bawah selebar layar di HP, kartu di tengah pada layar lebar.
 * Dirender lewat portal ke <body> agar tak terpotong kontainer halaman yang overflow-hidden.
 */
export function PilihShiftModal({ choices, staffName, onPilih, onBatal }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pilih-shift-judul"
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-6">
        {/* Pegangan panel (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-4 sm:pt-6 pb-4">
          {staffName && (
            <p className="text-sm font-semibold text-gray-500 truncate">Halo, {staffName} 👋</p>
          )}
          <h2 id="pilih-shift-judul" className="mt-0.5 text-xl font-extrabold leading-tight text-suka-ink">
            Pilih shift kamu hari ini
          </h2>
          <p className="mt-1 text-sm leading-snug text-gray-500">
            Jam telat dan jam pulang dihitung dari shift yang kamu pilih.
          </p>
        </div>

        <div className="px-5 space-y-3">
          {choices.map((c) => (
            <button
              key={c.ke}
              type="button"
              onClick={() => onPilih(c.ke)}
              className="w-full min-h-[96px] rounded-2xl border-2 border-gray-200 bg-white px-4 py-3.5 text-left transition-colors active:bg-orange-50 active:border-suka-orange hover:border-suka-orange focus:outline-none focus-visible:border-suka-orange focus-visible:ring-4 focus-visible:ring-suka-orange/20"
            >
              <span className="flex items-center gap-2 text-suka-orange">
                <IkonShift jamMasuk={c.jam_masuk} />
                <span className="text-sm font-bold text-suka-brown">{namaShift(c.jam_masuk)}</span>
              </span>
              <span className="mt-1 block text-3xl font-black leading-none tabular-nums tracking-tight text-suka-ink">
                {c.jam_masuk}<span className="mx-1.5 text-gray-300">–</span>{c.jam_keluar}
              </span>
              <span className="mt-1.5 block text-xs font-semibold text-gray-500">
                Masuk {c.jam_masuk} · Pulang {c.jam_keluar}
              </span>
            </button>
          ))}
        </div>

        {onBatal && (
          <div className="px-5 pt-2">
            <button
              type="button"
              onClick={onBatal}
              className="w-full min-h-[48px] rounded-xl text-sm font-bold text-gray-500 active:bg-gray-100 hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
