"use client";

import React, { useState } from "react";
import { Camera, MapPin, ShieldCheck, Lock, RefreshCw, ChevronRight, CheckCircle2 } from "lucide-react";
import { Spinner } from "@suka/design-system";

export type PermissionState = "prompt" | "requesting" | "denied" | "granted";

type Props = {
  isOpen: boolean;
  permissionState: PermissionState;
  onRequestPermissions: () => void;
  errorMessage?: string | null;
};

export function PermissionModal({
  isOpen,
  permissionState,
  onRequestPermissions,
  errorMessage,
}: Props) {
  const [activeTab, setActiveTab] = useState<"chrome" | "safari">("chrome");

  if (!isOpen || permissionState === "granted") return null;

  const isDenied = permissionState === "denied";
  const isRequesting = permissionState === "requesting";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-suka-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Gradient */}
        <div className="p-6 bg-gradient-to-br from-suka-orange via-orange-500 to-amber-500 text-white relative overflow-hidden shrink-0">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shrink-0">
              {isDenied ? (
                <Lock size={28} className="text-white animate-bounce" />
              ) : (
                <ShieldCheck size={28} className="text-white" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-100 bg-white/20 px-2 py-0.5 rounded-md">
                Akses Diperlukan
              </span>
              <h2 className="text-lg font-black leading-tight text-white mt-0.5">
                {isDenied ? "Izin Ditolak Browser" : "Izinkan Kamera & Lokasi"}
              </h2>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {!isDenied ? (
            <>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Agar dapat melakukan absensi dengan aman dan tepat, aplikasi memerlukan izin akses <b>Kamera</b> dan <b>Lokasi GPS</b> Anda.
              </p>

              {/* Requirement Cards */}
              <div className="space-y-3">
                {/* Camera Requirement */}
                <div className="p-3.5 bg-orange-50/60 border border-orange-100 rounded-2xl flex items-start gap-3">
                  <div className="p-2.5 bg-suka-orange/10 text-suka-orange rounded-xl shrink-0 mt-0.5">
                    <Camera size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-extrabold text-suka-ink flex items-center gap-1.5">
                      Kamera Depan
                      <span className="text-[9px] bg-suka-orange/15 text-suka-orange font-bold px-1.5 py-0.2 rounded-full">
                        Wajah
                      </span>
                    </h3>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Digunakan untuk verifikasi wajah otomatis & selfie bukti absensi secara real-time.
                    </p>
                  </div>
                </div>

                {/* Location Requirement */}
                <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-2xl flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl shrink-0 mt-0.5">
                    <MapPin size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-extrabold text-suka-ink flex items-center gap-1.5">
                      Lokasi GPS Akurat
                      <span className="text-[9px] bg-amber-500/15 text-amber-700 font-bold px-1.5 py-0.2 rounded-full">
                        Geofence
                      </span>
                    </h3>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Digunakan untuk memverifikasi keberadaan Anda di radius area outlet yang sah.
                    </p>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                  {errorMessage}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Denied / Blocked Instructions */}
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium leading-relaxed">
                  {errorMessage || "Browser Anda memblokir izin kamera atau lokasi. Harap izinkan melalui setelan browser Anda."}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-suka-ink">Cara Mengaktifkan Izin:</p>

                  {/* Browser Selector Tabs */}
                  <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                    <button
                      onClick={() => setActiveTab("chrome")}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                        activeTab === "chrome"
                          ? "bg-white text-suka-ink shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Chrome / Android / PC
                    </button>
                    <button
                      onClick={() => setActiveTab("safari")}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                        activeTab === "safari"
                          ? "bg-white text-suka-ink shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Safari / iPhone (iOS)
                    </button>
                  </div>

                  {/* Step-by-step instructions */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] space-y-2 text-gray-600">
                    {activeTab === "chrome" ? (
                      <ol className="list-decimal list-inside space-y-1.5 font-medium">
                        <li>Klik ikon <b>Gembok 🔒</b> atau <b>Setelan ⚙️</b> di sebelah kiri bilah URL browser Anda.</li>
                        <li>Pilih <b>Izin (Permissions)</b> atau <b>Setelan Situs</b>.</li>
                        <li>Ubah izin <b>Kamera</b> dan <b>Lokasi</b> menjadi <b>"Izinkan" (Allow)</b>.</li>
                        <li>Kembali ke halaman ini lalu tekan tombol <b>Coba Lagi</b> di bawah.</li>
                      </ol>
                    ) : (
                      <ol className="list-decimal list-inside space-y-1.5 font-medium">
                        <li>Buka aplikasi <b>Pengaturan (Settings)</b> di iPhone/iPad Anda.</li>
                        <li>Gulir ke bawah dan pilih browser <b>Safari</b>.</li>
                        <li>Buka menu <b>Kamera</b> & <b>Lokasi</b>, ubah ke <b>"Izinkan" (Allow)</b>.</li>
                        <li>Kembali ke browser dan tekan tombol <b>Coba Lagi</b> di bawah.</li>
                      </ol>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Action Button */}
        <div className="p-4 bg-gray-50 border-t border-suka-gray-200 shrink-0">
          <button
            onClick={onRequestPermissions}
            disabled={isRequesting}
            className={`w-full py-3 px-5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
              isDenied
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/25"
                : "bg-gradient-to-r from-suka-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-suka-orange/30"
            } ${isRequesting ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            {isRequesting ? (
              <>
                <Spinner size={18} />
                <span>Meminta Izin Browser...</span>
              </>
            ) : isDenied ? (
              <>
                <RefreshCw size={18} className="animate-spin-slow" />
                <span>Coba Lagi / Perbarui Izin</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Izinkan Kamera & Lokasi</span>
                <ChevronRight size={18} className="ml-auto" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
