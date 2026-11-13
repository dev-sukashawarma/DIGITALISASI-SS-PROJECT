"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sun, Sunset, Moon } from "lucide-react";
import type { ShiftKe, ShiftOption } from "@/lib/attendance/shift";

type Props = {
  choices: ShiftOption[];
  staffName?: string | null;
  onPilih: (ke: ShiftKe) => void;
  /** Tanpa onBatal, modal benar-benar wajib (tak ada tombol tutup). */
  onBatal?: () => void;
  /** Judul & keterangan khusus (mis. mode ganti shift setelah absen masuk). */
  judul?: string;
  deskripsi?: string;
  /** Shift yang sedang aktif — ditandai di daftar (mode ganti shift). */
  aktifKe?: ShiftKe | null;
  /** Sedang menyimpan: semua pilihan dinonaktifkan. */
  menyimpan?: boolean;
  /** Pesan galat (mis. gagal menyimpan) ditampilkan di atas daftar. */
  galat?: string | null;
};

function IkonShift({ jamMasuk }: { jamMasuk: string }) {
  const h = Number(jamMasuk.slice(0, 2));
  if (h < 11) return <Sun size={20} strokeWidth={2.5} />;
  if (h < 15) return <Sunset size={20} strokeWidth={2.5} />;
  return <Moon size={20} strokeWidth={2.5} />;
}

/**
 * Pilih shift sebelum absen masuk, untuk outlet berpilihan shift (2–12 shift, plus
 * Shift Driver untuk role driver). Nama tampil = nama khusus dari pengaturan atau
 * sebutan otomatis dari jam masuk.
 * Mobile-first: panel dari bawah selebar layar di HP, kartu di tengah pada layar lebar.
 * Dirender lewat portal ke <body> agar tak terpotong kontainer halaman yang overflow-hidden.
 */
export function PilihShiftModal({ choices, staffName, onPilih, onBatal, judul, deskripsi, aktifKe, menyimpan, galat }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (!mounted) return null;

  // Banyak shift: kartu dibuat lebih ringkas agar pilihan tetap terlihat tanpa banyak gulir.
  const ringkas = choices.length > 4;

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
            {judul ?? "Pilih shift kamu hari ini"}
          </h2>
          <p className="mt-1 text-sm leading-snug text-gray-500">
            {deskripsi ?? "Jam telat dan jam pulang dihitung dari shift yang kamu pilih."}
          </p>
          {galat && (
            <p role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {galat}
            </p>
          )}
        </div>

        <div className="px-5 space-y-3">
          {choices.map((c) => {
            const aktif = aktifKe === c.ke;
            return (
            <button
              key={c.ke}
              type="button"
              disabled={menyimpan}
              onClick={() => onPilih(c.ke)}
              className={`w-full ${ringkas ? "min-h-[72px] py-2.5" : "min-h-[96px] py-3.5"} rounded-2xl border-2 ${aktif ? "border-suka-orange bg-orange-50" : "border-gray-200 bg-white"} px-4 text-left transition-colors active:bg-orange-50 active:border-suka-orange hover:border-suka-orange focus:outline-none focus-visible:border-suka-orange focus-visible:ring-4 focus-visible:ring-suka-orange/20 disabled:opacity-60 disabled:pointer-events-none`}
            >
              <span className="flex items-center gap-2 text-suka-orange">
                <IkonShift jamMasuk={c.jam_masuk} />
                <span className="text-sm font-bold text-suka-brown truncate">{c.nama}</span>
                {aktif && (
                  <span className="ml-auto shrink-0 rounded-full bg-suka-orange px-2 py-0.5 text-[10px] font-bold text-white">
                    Dipakai sekarang
                  </span>
                )}
              </span>
              <span className={`mt-1 block ${ringkas ? "text-2xl" : "text-3xl"} font-black leading-none tabular-nums tracking-tight text-suka-ink`}>
                {c.jam_masuk}<span className="mx-1.5 text-gray-300">–</span>{c.jam_keluar}
              </span>
              {!ringkas && (
                <span className="mt-1.5 block text-xs font-semibold text-gray-500">
                  Masuk {c.jam_masuk} · Pulang {c.jam_keluar}
                </span>
              )}
            </button>
            );
          })}
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
