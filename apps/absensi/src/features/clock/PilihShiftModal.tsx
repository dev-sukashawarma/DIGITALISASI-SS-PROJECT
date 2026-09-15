"use client";

import { Sun, Sunset, Moon, ChevronRight } from "lucide-react";
import { namaShift, type ShiftKe, type ShiftOption } from "@/lib/attendance/shift";

type Props = {
  choices: ShiftOption[];
  staffName?: string | null;
  onPilih: (ke: ShiftKe) => void;
  onBatal: () => void;
};

function IkonShift({ jamMasuk }: { jamMasuk: string }) {
  const h = Number(jamMasuk.slice(0, 2));
  if (h < 11) return <Sun size={26} strokeWidth={2.4} />;
  if (h < 15) return <Sunset size={26} strokeWidth={2.4} />;
  return <Moon size={26} strokeWidth={2.4} />;
}

/**
 * Modal wajib sebelum absen masuk di outlet dua shift. Tidak bisa ditutup
 * dengan klik latar — crew harus memilih shift, atau menekan Batal.
 */
export function PilihShiftModal({ choices, staffName, onPilih, onBatal }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pilih-shift-judul"
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="px-6 pt-6 pb-4 text-center">
          {staffName && (
            <p className="text-sm font-semibold text-gray-500">Halo, {staffName}</p>
          )}
          <h2 id="pilih-shift-judul" className="mt-1 text-2xl font-extrabold text-suka-ink">
            Kamu shift yang mana?
          </h2>
          <p className="mt-1 text-sm text-gray-500">Pilih jam kerja kamu hari ini</p>
        </div>

        <div className="px-4 space-y-3">
          {choices.map((c) => (
            <button
              key={c.ke}
              type="button"
              onClick={() => onPilih(c.ke)}
              className="group w-full flex items-center gap-4 rounded-2xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-suka-orange hover:bg-orange-50/60 active:scale-[0.98] focus:outline-none focus-visible:border-suka-orange focus-visible:ring-4 focus-visible:ring-suka-orange/20"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-suka-cream text-suka-orange group-hover:bg-suka-orange group-hover:text-white transition-colors">
                <IkonShift jamMasuk={c.jam_masuk} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  {namaShift(c.jam_masuk)}
                </span>
                <span className="block text-[28px] leading-tight font-black tabular-nums text-suka-ink">
                  {c.jam_masuk} – {c.jam_keluar}
                </span>
                <span className="block text-xs font-semibold text-gray-500">
                  Masuk {c.jam_masuk} · Pulang {c.jam_keluar}
                </span>
              </span>
              <ChevronRight size={22} className="shrink-0 text-gray-300 group-hover:text-suka-orange transition-colors" />
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-5">
          <button
            type="button"
            onClick={onBatal}
            className="w-full py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
