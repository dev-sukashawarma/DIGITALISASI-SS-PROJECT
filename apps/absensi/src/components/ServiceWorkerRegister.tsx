"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan service worker (public/sw.js) yang HANYA meng-cache file model face
 * recognition dari CDN. Tujuan: model wajah cukup di-download sekali lalu instan dari
 * cache. Tidak menyentuh request lain, tidak mengubah pipeline/akurasi wajah.
 *
 * Registrasi ditunda sampai window `load` agar tak menyaingi resource kritis saat
 * first paint. Otomatis no-op di lingkungan tanpa service worker (mis. non-HTTPS/dev
 * insecure) — SW hanya aktif di HTTPS & localhost.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Gagal mendaftarkan service worker cache model:", err);
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
