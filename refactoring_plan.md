# Rencana Refactoring Code (Rencana Esok Hari)

Rencana ini disusun untuk memandu proses refactoring kode pasca penghapusan PWA, guna mengoptimalkan kinerja aplikasi web standar saat berjalan di dalam **React Native WebView (Superapp)**, serta merapikan arsitektur *offline support* tanpa bergantung pada Service Worker.

---

## 1. Refactoring `@suka/offline-queue` (Sinkronisasi Murni Client-Side)

> [!IMPORTANT]
> Sebelumnya, antrean offline mengandalkan **Service Worker Background Sync** (melalui event `sync`). Karena Service Worker telah dihapus, kita harus merefaktorisasi `@suka/offline-queue` agar berjalan murni di sisi client menggunakan **React Context & React Query**.

### Langkah Refactoring:
* **IndexedDB-based Queue**: Tetap pertahankan penyimpanan antrean mutasi di IndexedDB (menggunakan `idb-keyval`) karena kapasitasnya jauh lebih besar dan aman dibandingkan `localStorage`.
* **React Offline Provider**:
  - Buat provider baru `OfflineQueueProvider` di dalam `@suka/offline-queue`.
  - Gunakan event listener window (`online` & `offline`) untuk mendeteksi status koneksi browser secara dinamis.
  - Ketika koneksi kembali `online`, trigger fungsi `flushQueue()` secara otomatis di background untuk mengirimkan seluruh antrean transaksi yang tertunda ke database Supabase.
* **Optimistic UI Updates**: Pastikan status transaksi (misalnya pengisian absensi atau pesanan kasir) langsung ter-update di layar secara lokal (optimistic), lalu disinkronkan secara silent saat internet aktif.

---

## 2. Integrasi WebView Bridge (Komunikasi Web & Mobile Native)

Untuk membuat aplikasi web terasa seperti aplikasi native ketika dibuka di dalam Superapp, kita perlu membangun *bridge* (jembatan komunikasi) antara Next.js dan React Native.

### Langkah Refactoring:
* **Deteksi Lingkungan WebView**:
  - Buat utility function di `@suka/auth` atau `@suka/design-system` untuk mendeteksi apakah aplikasi sedang dibuka di dalam WebView:
    ```typescript
    export const isRunningInWebView = () => {
      return typeof window !== 'undefined' && !!window.ReactNativeWebView;
    };
    ```
* **UI Kustom untuk WebView**:
  - Jika `isRunningInWebView()` bernilai `true`, sembunyikan elemen-elemen web yang tidak diperlukan (seperti header portal utama, tombol navigasi ganda, atau footer informasi web).
  - Tambahkan padding safe-area (`pb-safe`, `pt-safe`) secara dinamis untuk menghindari benturan konten dengan *notch* atau kamera punch-hole pada layar smartphone.
* **WebView Message Bridge**:
  - Implementasikan pengiriman pesan dari Next.js ke React Native menggunakan `window.ReactNativeWebView.postMessage(JSON.stringify(data))`.
  - Contoh kasus: Mengirim pesan ke aplikasi mobile untuk memutar suara alarm pesanan masuk (`sound-pesanan.mp3`) atau memicu getaran (*haptic feedback*) ketika staf berhasil clock-in absensi.

---

## 3. Pembersihan Dependensi & Pruning Monorepo

Setelah penghapusan paket `@suka/pwa`, kita perlu memastikan *lockfile* dan struktur monorepo bersih dari sisa-sisa pustaka yang tidak digunakan.

### Langkah Refactoring:
* **Prune yarn.lock**:
  - Jalankan proses pembersihan yarn di root directory untuk membuang paket `@serwist/next` dan `serwist` yang sudah tidak digunakan di sub-aplikasi mana pun.
* **Format & Linting**:
  - Jalankan `yarn format` untuk merapikan kembali struktur indentasi di layout-layout utama (`layout.tsx`) yang sempat mengalami penyesuaian baris akibat penghapusan tag komponen PWA.
  - Bersihkan file-file cache build lama seperti folder `.next/` di setiap sub-aplikasi untuk memastikan build berikutnya benar-benar bersih (*clean build*).

---

## 4. Rencana Verifikasi & Pengujian Besok

Untuk memastikan hasil refactoring berjalan dengan baik, pengujian berikut akan dilakukan esok hari:
1. **Simulasi Offline Manual**:
   - Mematikan koneksi internet (Airplane Mode) pada browser/WebView, melakukan transaksi (misalnya membuat order di POS Kasir), lalu menyalakan kembali koneksi untuk melihat apakah `OfflineQueueProvider` berhasil mengirimkan data otomatis tanpa reload.
2. **Pengujian Tampilan WebView**:
   - Membuka aplikasi menggunakan emulator Android / perangkat fisik melalui Expo, serta memverifikasi kesesuaian tata letak (layout) bebas dari gangguan notch layar.
