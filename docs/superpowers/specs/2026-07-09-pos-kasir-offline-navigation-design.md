# POS Kasir — Smart Offline Navigation & App Shell

**Tanggal:** 2026-07-09
**Status:** Design (menunggu review user)
**App:** `apps/pos-kasir`
**Prasyarat:** Lapisan data offline IndexedDB (commit `b659e687`) sudah ada.

---

## 1. Masalah

Setelah lapisan data offline (IndexedDB) dipasang, kasir masih **tidak bisa berpindah halaman saat offline**:

- **Klik menu nav (navigasi halus)** → stuck selamanya di skeleton `app/kasir/loading.tsx`.
- **Reload / ketik URL (navigasi keras)** → layar Chrome **"This site can't be reached / DNS_PROBE_FINISHED_NXDOMAIN"**.

Transaksi offline yang sudah dibangun tak berguna karena user tak pernah sampai ke halaman yang me-render komponennya.

## 2. Akar Masalah

Navigasi Next.js App Router **selalu** butuh round-trip ke server (dokumen HTML pada hard-nav, atau payload RSC pada soft-nav). Dua halaman inti bahkan Server Component `force-dynamic` yang me-render di server:

| Halaman | Tipe | `force-dynamic` |
|---|---|---|
| `/kasir` (papan order) | Server Component | ya |
| `/kasir/menu` | Server Component | ya |
| `/kasir/order-manual`, `/histori`, `/reports`, `/shift`, `/settings` | Client Component | tidak (tetap butuh RSC nav) |

Saat offline, server tak terjangkau → navigasi menggantung (`loading.tsx`) atau gagal total (DNS). Lapisan data client-side (IndexedDB) tak pernah kejalan.

**Yang hilang:** Service Worker yang menyajikan shell halaman + payload RSC dari cache saat offline. Serwist `defaultCache` **sebenarnya sudah** menangani ini (cek `headers.get("RSC")`, punya cache `pages` / `pages-rsc` / `pages-rsc-prefetch` strategi NetworkFirst). Jadi penyebab konkret di produksi kemungkinan besar salah satu:

1. **SW belum benar-benar aktif/terkendali** di device produksi (deploy/registrasi), atau
2. Halaman **belum sempat ter-cache** (hanya `/kasir` yang pernah dibuka online), atau
3. Respons `force-dynamic` (`Cache-Control: no-store`) menghalangi caching.

Tidak ada `manifest.webmanifest` → PWA tidak andal.

## 3. Tujuan

Semua halaman operasional kasir bisa dibuka & dipakai penuh saat **offline total**. Perilaku **auto-switch**:

- **Online** → tetap Server Rendering (cepat, seperti sekarang). Transparan.
- **Offline** → otomatis sajikan shell dari cache + data dari IndexedDB. Tanpa aksi user.

## 4. Pendekatan Terpilih — A: Service Worker sebagai saklar + warm-up

Service Worker jadi perantara pintar. Online: teruskan ke server (SSR normal) sambil menyimpan salinan. Offline: sadar network gagal → sajikan salinan terakhir → komponen client hidup & baca IndexedDB.

**Ditolak:**
- **B (semua halaman client-render / SPA):** membunuh SSR walau online. User eksplisit menolak.
- **C (rute ganda SSR + SPA offline):** dobel perawatan, rawan pecah.

## 5. Desain Detail

### 5.1 Keraskan & pastikan Service Worker aktif (prioritas #1)
- Verifikasi `public/sw.js` ter-generate (prebuild esbuild) **dan** teregistrasi + mengambil kendali (`clients.claim`) di produksi. Ini kemungkinan besar biang DNS error sekarang.
- Pertahankan serwist `defaultCache` (penanganan navigasi App Router).
- Pastikan respons halaman `force-dynamic` tetap masuk cache (tambah strategi NetworkFirst eksplisit untuk navigasi same-origin dengan `CacheableResponse` status `[200]` bila `defaultCache` melewatkan no-store).
- `skipWaiting` + `clientsClaim` supaya SW versi baru langsung mengambil alih.

### 5.2 Warm-up rute saat online ("pintar")
- Komponen client `OfflineWarmup` di `app/kasir/layout.tsx`. Saat app online & idle (`requestIdleCallback`), fetch di latar belakang rute kasir penting agar SW menyimpannya:
  `/kasir`, `/kasir/order-manual`, `/kasir/histori`, `/kasir/reports`, `/kasir/shift`, `/kasir/menu`.
- Fetch **dua bentuk** tiap rute: dokumen (`fetch(path)`) dan RSC (`fetch(path, { headers: { RSC: '1' } })`) supaya soft-nav & hard-nav sama-sama tersedia offline.
- Re-warm saat event `online` dan berkala (mis. tiap 5 menit) untuk menyegarkan salinan.
- Hasil: halaman siap offline walau belum pernah diklik manual.

### 5.3 Fallback offline yang berguna
- Ganti perilaku dead-end `/~offline → /` (yang menuju halaman pelanggan).
- Perbarui `app/~offline/page.tsx`: judul + daftar link ke halaman kasir yang didukung offline (`/kasir`, dst.), bukan link ke `/`.
- Fallback dokumen SW tetap ke `/~offline` hanya bila rute benar-benar belum ter-cache.

### 5.4 Overlay "butuh internet" untuk fitur mustahil offline
- **Kontrol Device Pelanggan** (`/kasir/kiosk`, realtime presence) dan **upload gambar Tampilan Layar** (`/kasir/settings`): saat offline, tampilkan overlay "Fitur ini butuh internet". Halaman tetap kebuka (shell ter-cache), hanya aksi realtime/upload yang dikunci.
- Pakai `useNetworkStatus()` yang sudah ada.

### 5.5 Lengkapi lapisan data offline per halaman
Sudah ✓ (kerja kemarin): Order, Order Manual, Histori, Reports.
Tambahan:
- **`/kasir/menu` (Manajemen Menu):** server component `force-dynamic`. Offline → shell dari cache; komponen client (`KasirMenuClient`) baca menu dari IndexedDB (`db.menu_items`/`categories`). Aksi tulis (edit menu) dikunci overlay "butuh internet" — manajemen menu bukan alur jualan kritis.
- **`/kasir/shift` (Petty Cash):** lihat 5.6.

### 5.6 Petty Cash offline — antre penuh (keputusan user)
- Semua aksi (buka/tutup shift, top-up, catat pengeluaran) boleh saat offline → simpan ke antrean IndexedDB (pola sama `sync_queue_orders`), disinkron `OfflineSyncManager` saat online.
- Data tampilan (saldo, riwayat) dibaca dari cache IndexedDB saat offline.
- **Risiko dicatat:** saldo kas otoritatif di server; antre-offline bisa bikin saldo meleset kalau ada beberapa perangkat / urutan sinkron kacau. **Mitigasi:** saat sinkron, jangan kirim saldo hasil hitung client — kirim delta transaksi & biarkan server menghitung ulang saldo (server sebagai sumber kebenaran). Tampilkan badge "menunggu sinkron" pada entri petty cash offline.

### 5.7 Web manifest
- Tambah `public/manifest.webmanifest` (name, icons dari `logo.png`, `display: standalone`, `start_url: /kasir`, theme color `#f29744`) + `<link rel="manifest">` di `app/layout.tsx`. Membuat SW/PWA andal & bisa di-"Install".

## 6. Data Flow

**Online:** browser → SW (teruskan) → server SSR → render + SW simpan salinan (dokumen+RSC); client hydrate; realtime aktif.

**Offline:** browser → SW (network gagal via NetworkFirst) → sajikan salinan terakhir → client hydrate → data dari IndexedDB → transaksi tulis masuk antrean sinkron → `OfflineSyncManager` kirim saat online.

## 7. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| SW + App Router RSC caching rewel dgn `force-dynamic` | Warm-up dua-bentuk (dokumen+RSC) + strategi NetworkFirst eksplisit + uji tiap rute offline |
| Saldo petty cash meleset (multi-device) | Sinkron kirim delta transaksi, server hitung ulang saldo; badge "menunggu sinkron" |
| SW lama nyangkut di device | `skipWaiting` + `clientsClaim`; bump versi cache |
| First-load setelah deploy belum ter-cache | Warm-up jalan tiap sesi online; dokumentasikan "buka app sekali saat online" |

## 8. Testing

- Build lokal → `next start` → DevTools **Offline**.
- Tiap rute: hard reload + soft nav (klik menu) harus render, bukan DNS/skeleton mati.
- Buat transaksi order + walk-in + petty cash saat offline → muncul di papan/list.
- Kembali online → verifikasi semua tersinkron ke server, saldo petty cash benar.
- Verifikasi `manifest` + SW aktif (Application tab).

## 9. Di Luar Cakupan

- Menu/settings **tulis** offline (dikunci overlay).
- Sinkron dua-arah realtime saat offline (memang mustahil).
- Konversi halaman ke client-render permanen (ditolak — SSR online dipertahankan).
