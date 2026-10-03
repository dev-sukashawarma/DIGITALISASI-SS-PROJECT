"use client";

import React, { useState } from "react";
import { AlertTriangle, Hourglass, Loader2, XCircle } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";

/**
 * Bagian bawah kartu pengajuan yang masih menunggu HR: keterangan bahwa pengajuan masih
 * bisa dibatalkan + tombol lebar "Batalkan Pengajuan". Konfirmasinya lembar dari bawah yang
 * menyebut persis apa yang dibatalkan dan akibatnya, supaya user awam tidak ragu.
 *
 * [onConfirm] melempar galat bila gagal — pesannya ditampilkan di dalam lembar (bukan toast
 * yang cepat hilang) dan lembar tetap terbuka. Berhasil = lembar ditutup.
 */
export function TombolBatalkan({
  jenis,
  judul,
  detail,
  onConfirm,
}: {
  /** "cuti" atau "kasbon" — dipakai di kalimat. */
  jenis: string;
  /** Ringkasan pengajuan, mis. "Cuti Tahunan" / "Rp 500.000". */
  judul: string;
  /** Baris kedua ringkasan, mis. tanggal atau tenor. */
  detail: string;
  onConfirm: () => Promise<void>;
}) {
  const [buka, setBuka] = useState(false);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const tutup = () => {
    if (proses) return; // jangan tertutup di tengah permintaan
    setBuka(false);
    setGalat(null);
  };

  const konfirmasi = async () => {
    setProses(true);
    setGalat(null);
    try {
      await onConfirm();
      setBuka(false);
    } catch (err) {
      setGalat((err as { message?: string })?.message || `Gagal membatalkan ${jenis}. Coba lagi.`);
    } finally {
      setProses(false);
    }
  };

  return (
    <>
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-700">
          <Hourglass size={16} className="shrink-0" />
          Belum diproses HR — masih bisa dibatalkan.
        </p>
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 active:scale-[0.99] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <XCircle size={18} />
          Batalkan Pengajuan
        </button>
      </div>

      <BottomSheet
        open={buka}
        onClose={tutup}
        title="Batalkan Pengajuan"
        footer={
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={proses}
              onClick={konfirmasi}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-70 text-white text-base font-bold transition"
            >
              {proses && <Loader2 size={18} className="animate-spin" />}
              {proses ? "Membatalkan…" : galat ? "Coba Lagi" : "Ya, Batalkan Pengajuan"}
            </button>
            <button
              type="button"
              disabled={proses}
              onClick={tutup}
              className="w-full min-h-[52px] rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-base font-semibold transition"
            >
              Tidak, Biarkan Saja
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center pt-1">
          <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mb-3">
            <AlertTriangle className="text-rose-600" size={28} />
          </div>
          <p className="text-base font-bold text-slate-900">Yakin batalkan pengajuan {jenis} ini?</p>

          <div className="w-full mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
            <p className="font-bold text-slate-800">{judul}</p>
            <p className="text-sm text-slate-500 mt-0.5">{detail}</p>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Pengajuan ini akan <span className="font-semibold text-slate-800">dihapus</span> dan
            tidak akan diproses HR. Kalau nanti masih perlu, Anda bisa mengajukan lagi.
          </p>

          {galat && (
            <p role="alert" className="w-full mt-4 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm font-semibold text-rose-700 text-left">
              {galat}
            </p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
