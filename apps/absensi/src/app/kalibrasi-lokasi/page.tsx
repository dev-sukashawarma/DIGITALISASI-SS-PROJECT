"use client";

import React, { useState } from "react";
import { MapPin, Navigation, AlertTriangle, CheckCircle } from "lucide-react";

export default function GlobalKalibrasiPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [matchedOutlet, setMatchedOutlet] = useState("");

  const recordLocation = () => {
    setStatus("loading");
    setErrorMessage("");

    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMessage("Browser Anda tidak mendukung GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        
        try {
          const res = await fetch(`/api/kalibrasi-lokasi/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: latitude,
              lng: longitude,
              accuracy
            })
          });
          
          const json = await res.json();
          if (json.ok) {
            setMatchedOutlet(json.matched);
            setStatus("success");
          } else {
            setStatus("error");
            setErrorMessage(json.error || "Gagal merekam lokasi.");
          }
        } catch (e) {
          setStatus("error");
          setErrorMessage("Terjadi kesalahan jaringan.");
        }
      },
      (err) => {
        setStatus("error");
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage("Akses lokasi ditolak. Tolong izinkan GPS di browser Anda.");
        } else {
          setErrorMessage("Gagal mendapatkan lokasi GPS. Pastikan GPS HP Anda menyala.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-suka-orange p-6 text-center text-white">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
            <MapPin size={32} />
          </div>
          <h1 className="text-xl font-black">Kalibrasi Lokasi Outlet</h1>
          <p className="text-white/80 text-sm mt-2 font-medium">
            Sistem Pembaruan Koordinat GPS Global
          </p>
        </div>

        <div className="p-8 text-center space-y-6">
          {status === "idle" && (
            <>
              <p className="text-gray-600 text-sm leading-relaxed">
                Pastikan Anda sedang berdiri **tepat di area outlet**. Sistem akan otomatis mendeteksi dari outlet mana Anda mengirimkan koordinat ini.
              </p>
              <button 
                onClick={recordLocation}
                className="w-full py-4 bg-suka-ink hover:bg-black text-white font-black text-lg rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Navigation size={24} />
                Rekam Lokasi Saat Ini
              </button>
            </>
          )}

          {status === "loading" && (
            <div className="py-8 space-y-4">
              <div className="w-12 h-12 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-suka-orange font-bold animate-pulse">Mendeteksi koordinat dan mencocokkan outlet...</p>
            </div>
          )}

          {status === "success" && (
            <div className="py-4 space-y-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={40} />
              </div>
              <div>
                <h3 className="font-black text-xl text-suka-ink">Berhasil Terdeteksi!</h3>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  Lokasi Anda berhasil dicocokkan dengan outlet <strong>{matchedOutlet}</strong> dan telah diteruskan ke SPV Pusat. Anda boleh menutup halaman ini.
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="py-4 space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="font-black text-lg text-suka-ink">Terjadi Kesalahan</h3>
                <p className="text-red-500 font-medium mt-2 text-sm">
                  {errorMessage}
                </p>
              </div>
              <button 
                onClick={() => setStatus("idle")}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors mt-4"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
