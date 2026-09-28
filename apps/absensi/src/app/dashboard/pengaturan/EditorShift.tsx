"use client";

import { Clock, Moon, Plus, Trash2 } from "lucide-react";
import { MAX_SHIFT, namaShift } from "@/lib/attendance/shift";
import { NAMA_SHIFT_MAKS, usulanShiftBaru, type ShiftDraft } from "@/lib/attendance/jadwalOutlet";

const keMenit = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const lewatTengahMalam = (s: ShiftDraft) =>
  !!s.jam_masuk && !!s.jam_keluar && keMenit(s.jam_keluar) < keMenit(s.jam_masuk);
const namaTampil = (s: ShiftDraft) => s.nama.trim() || namaShift(s.jam_masuk || "00:00");

const PRESET = [
  { masuk: "09:00", pulang: "17:00", label: "09:00 - 17:00 (Kantor/HQ)" },
  { masuk: "10:00", pulang: "22:00", label: "10:00 - 22:00 (Outlet Reguler)" },
  { masuk: "11:00", pulang: "23:00", label: "11:00 - 23:00 (Outlet Malam)" },
];

function CatatanTengahMalam() {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
      <Moon size={12} /> Pulang lewat tengah malam (hari berikutnya)
    </p>
  );
}

/**
 * Editor daftar shift jadwal khusus cabang (1–12 shift; urutan = nomor shift yang
 * dipilih crew). Pilihan shift mati → hanya Shift 1 yang tampil sebagai jam kerja
 * outlet; shift lain tetap disimpan dan dipakai lagi saat pilihan dinyalakan.
 * Menambah shift saat pilihan mati otomatis menyalakannya, karena shift kedua hanya
 * bermakna bila crew memilih; menghapus hingga tersisa satu otomatis mematikannya.
 */
export function EditorShift({
  shifts,
  pilihAktif,
  onChange,
}: {
  shifts: ShiftDraft[];
  pilihAktif: boolean;
  onChange: (shifts: ShiftDraft[], pilihAktif: boolean) => void;
}) {
  const ubah = (i: number, patch: Partial<ShiftDraft>) =>
    onChange(shifts.map((s, j) => (j === i ? { ...s, ...patch } : s)), pilihAktif);
  const hapus = (i: number) => {
    if (shifts.length <= 1) return;
    const sisa = shifts.filter((_, j) => j !== i);
    onChange(sisa, pilihAktif && sisa.length >= 2);
  };
  const tambah = () => {
    if (shifts.length >= MAX_SHIFT) return;
    onChange([...shifts, usulanShiftBaru(shifts)], true);
  };
  const penuh = shifts.length >= MAX_SHIFT;

  const tombolTambah = (
    <button
      type="button"
      onClick={tambah}
      disabled={penuh}
      className="w-full flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-xs font-bold text-slate-600 hover:border-orange-400 hover:bg-orange-50/50 hover:text-orange-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
    >
      <Plus size={14} />
      {penuh ? `Maksimal ${MAX_SHIFT} shift` : pilihAktif ? "Tambah Shift" : "Tambah Shift (cabang dengan lebih dari satu jam kerja)"}
    </button>
  );

  if (!pilihAktif) {
    const s1 = shifts[0] ?? { nama: "", jam_masuk: "", jam_keluar: "" };
    const lainnya = shifts.slice(1);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={14} className="text-orange-500" />
            Rentang Shift Kerja
          </label>
          <span className="text-[11px] text-slate-500 font-medium">Format 24 Jam (WIB)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-slate-200 p-3.5 bg-slate-50/70 focus-within:border-orange-500 focus-within:bg-white transition-all">
            <label htmlFor="shift1-masuk" className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Jam Masuk
            </label>
            <input
              id="shift1-masuk"
              type="time" required
              value={s1.jam_masuk}
              onChange={(e) => ubah(0, { jam_masuk: e.target.value })}
              className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-900 outline-none"
            />
          </div>
          <div className="rounded-2xl border-2 border-slate-200 p-3.5 bg-slate-50/70 focus-within:border-orange-500 focus-within:bg-white transition-all">
            <label htmlFor="shift1-pulang" className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Jam Pulang
            </label>
            <input
              id="shift1-pulang"
              type="time" required
              value={s1.jam_keluar}
              onChange={(e) => ubah(0, { jam_keluar: e.target.value })}
              className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-900 outline-none"
            />
          </div>
        </div>
        {lewatTengahMalam(s1) && <CatatanTengahMalam />}

        {/* Quick Shift Presets (Shift 1) */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Preset:</span>
          {PRESET.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => ubah(0, { jam_masuk: p.masuk, jam_keluar: p.pulang })}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 font-semibold transition-colors shrink-0 text-[11px]"
            >
              {p.label}
            </button>
          ))}
        </div>

        {lainnya.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 leading-snug">
            <strong className="text-slate-700">{lainnya.length} shift lain tersimpan</strong> dan dipakai lagi saat pilihan shift dinyalakan:{" "}
            {lainnya.map((s) => `${namaTampil(s)} ${s.jam_masuk}–${s.jam_keluar}`).join(", ")}
          </div>
        )}

        {tombolTambah}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={14} className="text-orange-500" />
          Daftar Shift
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          {shifts.length}/{MAX_SHIFT} · 24 Jam (WIB)
        </span>
      </div>

      <ol className="space-y-2.5">
        {shifts.map((s, i) => (
          // Indeks sebagai key memang disengaja: urutan baris = nomor shift.
          <li key={i} className="rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-3 focus-within:border-orange-500 focus-within:bg-white transition-all">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-[11px] font-black text-orange-800">
                {i + 1}
              </span>
              <input
                type="text"
                value={s.nama}
                maxLength={NAMA_SHIFT_MAKS}
                onChange={(e) => ubah(i, { nama: e.target.value })}
                placeholder={namaShift(s.jam_masuk || "00:00")}
                aria-label={`Nama shift ${i + 1} (opsional)`}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-400 outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => hapus(i)}
                disabled={shifts.length <= 1}
                aria-label={`Hapus shift ${i + 1}`}
                title={shifts.length <= 1 ? "Minimal satu shift" : "Hapus shift"}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Masuk
                </span>
                <input
                  type="time" required
                  value={s.jam_masuk}
                  onChange={(e) => ubah(i, { jam_masuk: e.target.value })}
                  className="w-full bg-transparent text-lg font-black text-slate-900 outline-none"
                />
              </label>
              <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Pulang
                </span>
                <input
                  type="time" required
                  value={s.jam_keluar}
                  onChange={(e) => ubah(i, { jam_keluar: e.target.value })}
                  className="w-full bg-transparent text-lg font-black text-slate-900 outline-none"
                />
              </label>
            </div>
            {lewatTengahMalam(s) && <CatatanTengahMalam />}
          </li>
        ))}
      </ol>

      {tombolTambah}

      <p className="text-[11px] text-slate-500 leading-snug">
        Crew akan melihat pilihan:{" "}
        {shifts.map((s, i) => (
          <span key={i}>
            {i > 0 && ", "}
            <strong className="text-slate-800">{namaTampil(s)} {s.jam_masuk}–{s.jam_keluar}</strong>
          </span>
        ))}
        . Shift yang pulang paling akhir dianggap penutup outlet (wajib tutup kasir &amp; checklist).
      </p>
    </div>
  );
}
