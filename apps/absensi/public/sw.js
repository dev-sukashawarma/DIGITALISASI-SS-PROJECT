/*
 * Service worker minimal — TUJUAN TUNGGAL: cache file model face recognition
 * (@vladmandic/human) dari CDN jsdelivr, agar model ~15MB hanya di-download SEKALI
 * lalu tersaji instan dari cache di kunjungan berikutnya.
 *
 * PENTING (kenapa ini aman):
 *  - HANYA menangani GET ke URL model jsdelivr. SEMUA request lain (halaman, API,
 *    auth, Supabase, storage) dibiarkan lewat NORMAL — SW tidak memanggil
 *    respondWith untuk request lain, jadi tak ada perubahan perilaku app.
 *  - Model = file AI statis yang identik untuk semua orang. Meng-cache-nya TIDAK
 *    mengubah embedding/descriptor wajah maupun akurasi pencocokan sedikit pun.
 *  - Bump CACHE_VERSION bila ingin memaksa unduh ulang model (mis. ganti versi Human).
 */

const CACHE_VERSION = "human-models-v1";

// Hanya URL model wajah dari CDN yang di-cache. Cek ketat: host jsdelivr + path model Human.
function isFaceModelRequest(url) {
  return (
    url.hostname === "cdn.jsdelivr.net" &&
    url.pathname.includes("/@vladmandic/human/models/")
  );
}

self.addEventListener("install", (event) => {
  // Aktif segera tanpa menunggu tab lama tertutup.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Bersihkan cache versi lama milik SW ini saja.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("human-models-") && k !== CACHE_VERSION)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // biarkan non-GET lewat

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Request selain model wajah → JANGAN intervensi, biarkan browser tangani normal.
  if (!isFaceModelRequest(url)) return;

  // Cache-first: sajikan dari cache bila ada; kalau tidak, ambil dari jaringan lalu simpan.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      // Hanya cache respons sukses (hindari menyimpan error/redirect).
      if (res && res.ok) {
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});
