"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clock, X } from "lucide-react";

const DAFTAR_JAM = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const DAFTAR_MENIT = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const MENIT_CEPAT = ["00", "15", "30", "45"] as const;

export function uraiJamMenit(hhmm: string): { jam: string; menit: string } {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm || "");
  if (!m) return { jam: "09", menit: "00" };
  const j = Math.min(23, Math.max(0, Number(m[1])));
  const mn = Math.min(59, Math.max(0, Number(m[2])));
  return {
    jam: String(j).padStart(2, "0"),
    menit: String(mn).padStart(2, "0"),
  };
}

interface PanelJamProps {
  jam: string;
  menit: string;
  onPilihJam: (jam: string) => void;
  onPilihMenit: (menit: string) => void;
  onSelesai: () => void;
}

function PanelJam({ jam, menit, onPilihJam, onPilihMenit, onSelesai }: PanelJamProps) {
  const jamListRef = useRef<HTMLDivElement>(null);
  const menitListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elJam = jamListRef.current?.querySelector<HTMLElement>(`[data-val="${jam}"]`);
    const elMenit = menitListRef.current?.querySelector<HTMLElement>(`[data-val="${menit}"]`);
    elJam?.scrollIntoView({ block: "center" });
    elMenit?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div data-no-swipe className="select-none space-y-3">
      {/* Pratinjau jam terpilih + pintasan menit */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Clock size={15} className="text-orange-500" />
          <span className="text-lg font-black tabular-nums text-slate-900">
            {jam}:{menit}
          </span>
          <span className="text-[11px] font-bold text-slate-400">WIB</span>
        </div>
        <div className="flex items-center gap-1">
          {MENIT_CEPAT.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPilihMenit(m)}
              className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums transition-colors ${
                menit === m
                  ? "bg-orange-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-orange-300 hover:text-orange-700"
              }`}
            >
              :{m}
            </button>
          ))}
        </div>
      </div>

      {/* Dua kolom gulir: Jam (00-23) & Menit (00-59) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-1.5">
          <p className="pb-1 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Jam (24h)
          </p>
          <div
            ref={jamListRef}
            className="max-h-48 overflow-y-auto overscroll-contain space-y-1 pr-0.5"
          >
            {DAFTAR_JAM.map((j) => {
              const aktif = j === jam;
              return (
                <button
                  key={j}
                  type="button"
                  data-val={j}
                  onClick={() => onPilihJam(j)}
                  className={`flex h-9 w-full items-center justify-center rounded-xl text-sm font-extrabold tabular-nums transition-colors ${
                    aktif
                      ? "bg-orange-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {j}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-1.5">
          <p className="pb-1 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Menit
          </p>
          <div
            ref={menitListRef}
            className="max-h-48 overflow-y-auto overscroll-contain space-y-1 pr-0.5"
          >
            {DAFTAR_MENIT.map((m) => {
              const aktif = m === menit;
              return (
                <button
                  key={m}
                  type="button"
                  data-val={m}
                  onClick={() => onPilihMenit(m)}
                  className={`flex h-9 w-full items-center justify-center rounded-xl text-sm font-extrabold tabular-nums transition-colors ${
                    aktif
                      ? "bg-orange-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSelesai}
        className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-slate-800"
      >
        Selesai
      </button>
    </div>
  );
}

export interface TimePickerProps {
  value: string;
  onChange: (hhmm: string) => void;
  name?: string;
  id?: string;
  label?: string;
  size?: "lg" | "md";
  className?: string;
}

/**
 * Pemilih waktu 24-jam 100% custom (tanpa <input type="time"> native browser/OS).
 * Kebal terhadap format AM/PM bawaan iOS Safari dan tombol Reset yang mengosongkan nilai.
 */
export function TimePicker({
  value,
  onChange,
  name,
  id,
  label = "Pilih Jam (WIB)",
  size = "lg",
  className = "",
}: TimePickerProps) {
  const [buka, setBuka] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [posisi, setPosisi] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const { jam, menit } = useMemo(() => uraiJamMenit(value), [value]);
  const nilaiTerformat = `${jam}:${menit}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  const hitungPosisi = () => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const lebarPanel = 288;
    const tinggiPanel = 340;
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

  const kelasTeks = size === "lg"
    ? "text-xl sm:text-2xl font-black"
    : "text-lg font-black";

  return (
    <>
      {name && <input type="hidden" name={name} value={nilaiTerformat} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={buka}
        aria-label={`${label}: ${nilaiTerformat}`}
        className={`flex w-full items-center justify-between gap-2 bg-transparent text-left text-slate-900 outline-none transition-colors hover:text-orange-600 ${kelasTeks} ${className}`}
      >
        <span className="tabular-nums tracking-tight">{nilaiTerformat}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${buka ? "rotate-180 text-orange-500" : ""}`}
        />
      </button>

      {mounted && buka && createPortal(
        <div className="fixed inset-0 z-[1100]" data-no-swipe>
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
                aria-label="Tutup pemilih jam"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <PanelJam
              jam={jam}
              menit={menit}
              onPilihJam={(j) => onChange(`${j}:${menit}`)}
              onPilihMenit={(m) => onChange(`${jam}:${m}`)}
              onSelesai={() => setBuka(false)}
            />
          </div>

          {/* Desktop Floating Popover */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            style={{ top: posisi.top, left: posisi.left }}
            className="fixed hidden w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl ring-1 ring-slate-900/5 sm:block"
          >
            <PanelJam
              jam={jam}
              menit={menit}
              onPilihJam={(j) => onChange(`${j}:${menit}`)}
              onPilihMenit={(m) => onChange(`${jam}:${m}`)}
              onSelesai={() => setBuka(false)}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
