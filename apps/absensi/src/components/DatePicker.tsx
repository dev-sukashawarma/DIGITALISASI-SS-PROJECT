"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;
const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;
const NAMA_BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
] as const;

export interface SelKalender {
  iso: string;
  tgl: number;
  bulanIni: boolean;
}

export function hariIniIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function uraiIso(iso: string): { tahun: number; bulan0: number; tgl: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const tahun = Number(m[1]);
  const bulan0 = Number(m[2]) - 1;
  const tgl = Number(m[3]);
  if (bulan0 < 0 || bulan0 > 11 || tgl < 1 || tgl > 31) return null;
  const cek = new Date(Date.UTC(tahun, bulan0, tgl));
  if (cek.getUTCFullYear() !== tahun || cek.getUTCMonth() !== bulan0 || cek.getUTCDate() !== tgl) {
    return null;
  }
  return { tahun, bulan0, tgl };
}

function formatIsoUtc(tahun: number, bulan0: number, tgl: number): string {
  const dt = new Date(Date.UTC(tahun, bulan0, tgl));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Menghasilkan 42 sel kalender (6 baris x 7 kolom, dimulai hari Senin) murni berbasis UTC
 * sehingga perbedaan zona waktu di iOS/Android tidak pernah menggeser tanggal.
 */
export function buatGridBulan(tahun: number, bulan0: number): SelKalender[] {
  const awalBulan = new Date(Date.UTC(tahun, bulan0, 1));
  // getUTCDay(): Minggu = 0 .. Sabtu = 6 -> konversi ke Senin = 0 .. Minggu = 6
  const offsetSenin = (awalBulan.getUTCDay() + 6) % 7;
  const jumlahHariBulanIni = new Date(Date.UTC(tahun, bulan0 + 1, 0)).getUTCDate();

  const hasil: SelKalender[] = [];
  for (let i = 0; i < 42; i++) {
    const offsetHari = i - offsetSenin + 1;
    const dt = new Date(Date.UTC(tahun, bulan0, offsetHari));
    hasil.push({
      iso: formatIsoUtc(tahun, bulan0, offsetHari),
      tgl: dt.getUTCDate(),
      bulanIni: offsetHari >= 1 && offsetHari <= jumlahHariBulanIni,
    });
  }
  return hasil;
}

export function formatTanggalPendek(iso: string): string {
  const p = uraiIso(iso);
  if (!p) return iso;
  return `${p.tgl} ${NAMA_BULAN_PENDEK[p.bulan0]} ${p.tahun}`;
}

export interface CalendarPanelProps {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  today?: string;
  accent?: "blue" | "orange";
  onClose?: () => void;
  className?: string;
}

export function CalendarPanel({
  value,
  onChange,
  min,
  max,
  today,
  accent = "blue",
  onClose,
  className = "",
}: CalendarPanelProps) {
  const hariIni = useMemo(() => today ?? hariIniIso(), [today]);
  const awal = uraiIso(value) ?? uraiIso(hariIni) ?? { tahun: 2026, bulan0: 0, tgl: 1 };

  const [tahunLihat, setTahunLihat] = useState(awal.tahun);
  const [bulanLihat, setBulanLihat] = useState(awal.bulan0);
  const [pilihBulanMode, setPilihBulanMode] = useState(false);

  useEffect(() => {
    const p = uraiIso(value);
    if (p) {
      setTahunLihat(p.tahun);
      setBulanLihat(p.bulan0);
    }
  }, [value]);

  const sel = useMemo(() => buatGridBulan(tahunLihat, bulanLihat), [tahunLihat, bulanLihat]);

  const geserBulan = (delta: number) => {
    const dt = new Date(Date.UTC(tahunLihat, bulanLihat + delta, 1));
    setTahunLihat(dt.getUTCFullYear());
    setBulanLihat(dt.getUTCMonth());
  };

  const terlarang = (iso: string) => {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  const warnaAktif = accent === "orange"
    ? "bg-suka-orange text-white font-extrabold shadow-sm"
    : "bg-blue-600 text-white font-extrabold shadow-sm";
  const warnaHariIni = accent === "orange"
    ? "ring-1 ring-suka-orange text-suka-brown font-bold bg-orange-50/70"
    : "ring-1 ring-blue-500 text-blue-700 font-bold bg-blue-50/70";
  const warnaTombolTeks = accent === "orange"
    ? "text-suka-brown hover:bg-orange-50"
    : "text-blue-600 hover:bg-blue-50";

  const hariIniBisaDipilih = !terlarang(hariIni);

  return (
    <div
      data-no-swipe
      className={`select-none rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm ${className}`}
    >
      {/* Navigasi Bulan & Tahun */}
      <div className="mb-3 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => (pilihBulanMode ? setTahunLihat((y) => y - 1) : geserBulan(-1))}
          aria-label={pilihBulanMode ? "Tahun sebelumnya" : "Bulan sebelumnya"}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => setPilihBulanMode((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold text-slate-900 transition-colors hover:bg-slate-100"
        >
          <span>{pilihBulanMode ? `${tahunLihat}` : `${NAMA_BULAN[bulanLihat]} ${tahunLihat}`}</span>
          <ChevronDown
            size={15}
            className={`text-slate-400 transition-transform duration-200 ${pilihBulanMode ? "rotate-180" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={() => (pilihBulanMode ? setTahunLihat((y) => y + 1) : geserBulan(1))}
          aria-label={pilihBulanMode ? "Tahun berikutnya" : "Bulan berikutnya"}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      {pilihBulanMode ? (
        <div className="grid grid-cols-3 gap-2 py-1">
          {NAMA_BULAN_PENDEK.map((nama, idx) => {
            const aktif = idx === bulanLihat;
            return (
              <button
                key={nama}
                type="button"
                onClick={() => {
                  setBulanLihat(idx);
                  setPilihBulanMode(false);
                }}
                className={`h-10 rounded-xl text-xs font-bold transition-colors ${
                  aktif ? warnaAktif : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {nama}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Header Nama Hari */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {NAMA_HARI.map((h, i) => (
              <span
                key={h}
                className={`py-1 text-[11px] font-bold uppercase tracking-wide ${
                  i === 6 ? "text-rose-500" : "text-slate-400"
                }`}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Grid Tanggal */}
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`${NAMA_BULAN[bulanLihat]} ${tahunLihat}`}>
            {sel.map((s) => {
              const dipilih = s.iso === value;
              const iniHariIni = s.iso === hariIni;
              const mati = terlarang(s.iso);

              let kelasSel = "text-slate-700 hover:bg-slate-100 font-semibold";
              if (mati) {
                kelasSel = "text-slate-300 cursor-not-allowed opacity-50";
              } else if (dipilih) {
                kelasSel = warnaAktif;
              } else if (iniHariIni) {
                kelasSel = warnaHariIni;
              } else if (!s.bulanIni) {
                kelasSel = "text-slate-400 hover:bg-slate-50 font-medium";
              }

              return (
                <button
                  key={s.iso}
                  type="button"
                  disabled={mati}
                  aria-selected={dipilih}
                  aria-label={formatTanggalPendek(s.iso)}
                  onClick={() => {
                    onChange(s.iso);
                    onClose?.();
                  }}
                  className={`relative flex h-10 w-full items-center justify-center rounded-xl text-sm tabular-nums transition-colors active:scale-95 ${kelasSel}`}
                >
                  {s.tgl}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Baris Aksi Cepat */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <button
          type="button"
          disabled={!hariIniBisaDipilih}
          onClick={() => {
            if (!hariIniBisaDipilih) return;
            onChange(hariIni);
            onClose?.();
          }}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:text-slate-300 ${warnaTombolTeks}`}
        >
          Hari Ini
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );
}

export interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  label?: string;
  accent?: "blue" | "orange";
  className?: string;
}

/**
 * Pemilih tanggal 100% custom (tanpa <input type="date"> native browser/OS).
 * Di layar ponsel/iOS tampil sebagai bottom-sheet portaled yang nyaman disentuh;
 * di layar desktop tampil sebagai floating popover yang dikunci di dalam viewport.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  label = "Pilih Tanggal",
  accent = "orange",
  className = "",
}: DatePickerProps) {
  const [buka, setBuka] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [posisi, setPosisi] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const hitungPosisi = () => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const lebarPanel = 308;
    const tinggiPanel = 360;
    const batasKanan = window.innerWidth - lebarPanel - 12;
    const left = Math.max(12, Math.min(rect.left, batasKanan));
    const muatDiBawah = rect.bottom + tinggiPanel + 12 <= window.innerHeight;
    const top = muatDiBawah ? rect.bottom + 8 : Math.max(12, rect.top - tinggiPanel - 8);
    setPosisi({ top, left });
  };

  useLayoutEffect(() => {
    if (!buka) return;
    hitungPosisi();
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    const onResizeScroll = () => hitungPosisi();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResizeScroll);
    window.addEventListener("scroll", onResizeScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResizeScroll);
      window.removeEventListener("scroll", onResizeScroll, true);
    };
  }, [buka]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={buka}
        className={`inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-suka-orange/20 ${className}`}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarDays size={15} className="shrink-0 text-slate-400" />
          <span className="truncate tabular-nums">{formatTanggalPendek(value)}</span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${buka ? "rotate-180" : ""}`}
        />
      </button>

      {mounted && buka && createPortal(
        <div className="fixed inset-0 z-[1100]" data-no-swipe>
          {/* Backdrop: gelap di mobile, transparan klik-luar di desktop */}
          <div
            aria-hidden="true"
            onClick={() => setBuka(false)}
            className="absolute inset-0 bg-slate-950/50 sm:bg-transparent"
          />

          {/* Mobile / iOS Bottom Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:hidden"
          >
            <div className="mb-2 flex justify-center" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-base font-extrabold text-slate-900">{label}</span>
              <button
                type="button"
                onClick={() => setBuka(false)}
                aria-label="Tutup kalender"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <CalendarPanel
              value={value}
              onChange={onChange}
              min={min}
              max={max}
              accent={accent}
              onClose={() => setBuka(false)}
              className="border-0 p-0 shadow-none"
            />
          </div>

          {/* Desktop Floating Popover */}
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            style={{ top: posisi.top, left: posisi.left }}
            className="fixed hidden w-[308px] sm:block"
          >
            <CalendarPanel
              value={value}
              onChange={onChange}
              min={min}
              max={max}
              accent={accent}
              onClose={() => setBuka(false)}
              className="shadow-xl ring-1 ring-slate-900/5"
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
