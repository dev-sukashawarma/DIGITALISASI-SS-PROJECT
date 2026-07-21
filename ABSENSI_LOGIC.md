# Dokumentasi Logika Sistem Absensi (M1)

Dokumen ini berisi 100% logika bisnis (business logic) dari sistem absensi (Outlet + Face Recognition). Tujuannya adalah sebagai panduan utama (Single Source of Truth) bagi pengembang (developer) yang akan memigrasikan atau membuat versi *mobile app* (iOS/Android) dari sistem ini.

> **Penting**: Semua perhitungan krusial (seperti validasi jarak dan validasi waktu) **harus difinalisasi dan ditegakkan (enforced) di sisi Server (Backend/Edge Function)**. Client (Mobile/Web) hanya melakukan pre-validasi untuk kebutuhan UI/UX.

---

## 1. Alur & State Machine Kiosk Absensi

Alur absensi pada mesin Kiosk/Client diatur melalui *state machine* dengan fase-fase berikut:

1. **`locating`** (Pre-check):
   - Aplikasi mengambil koordinat (lat/lng) dari database untuk outlet yang bersangkutan.
   - Aplikasi terus-menerus memantau GPS perangkat (misal: `watchPosition`).
   - Apabila akurasi GPS terlalu rendah (Akurasi > 150m), sistem *menolak* keras dan meminta pengguna untuk menyalakan mode "Lokasi Akurat/Precise".
   - Jika jarak pengguna ke outlet <= 20m (setelah dikompensasi dengan nilai akurasi), maka masuk ke fase `idle`.
2. **`idle`** (Standby / Menunggu Wajah):
   - Kamera aktif dan melakukan deteksi wajah per-*frame*.
   - Jika wajah terdeteksi, ekstrak vektor/descriptor (128 dimensi) dan cari kecocokan tertinggi di *database* (`outlet_staff`).
   - Jika kecocokan (Cosine Similarity) < 0.65, tolak ("Wajah tidak dikenal").
   - Jika cocok, periksa jenis absen (Masuk/Pulang) yang harus dilakukan oleh staf tersebut hari ini.
3. **Pengecekan Gerbang (Gates) Absen Pulang**:
   - Jika jenis absen adalah "Pulang" (`out`), sistem wajib memvalidasi dua hal di database:
     - Apakah **Checklist Penutupan** (fase "tutup") untuk outlet tersebut hari ini sudah dicentang semua (hanya *items* yang `is_required = true`)?
     - Apakah **Shift Kasir** (Petty Cash) di outlet ini sudah *ditutup* (tidak ada yang statusnya `open`)?
   - Jika salah satu kondisi di atas gagal, **absen pulang diblokir** ("Tidak bisa absen pulang").
4. **`identified`**:
   - Wajah berhasil dikenali dan gerbang lolos. Kiosk menyapa pengguna dan memberikan instruksi Liveness (Tantangan acak).
5. **`liveness`**:
   - Kiosk meminta pengguna melakukan gerakan (Kedip, Toleh Kiri, Toleh Kanan, Angguk).
   - *Fase 0*: Menunggu gerakan dilakukan.
   - *Fase 1*: Menunggu wajah kembali menghadap ke depan (Frontal).
   - Begitu wajah menghadap depan kembali, descriptor *dievaluasi ulang* untuk memastikan wajah yang lulus Liveness adalah orang yang sama dengan yang diidentifikasi di fase `idle`. Jika sama, lanjut submit.
6. **`submitting`**:
   - Mengambil foto (Selfie).
   - Jika *Offline*, simpan data absen dan foto ke IndexedDB/Lokal, set flag `from_queue = true`.
   - Jika *Online*, upload Selfie ke Storage, dan panggil API Submit Server.
7. **`result`**:
   - Tampilkan hasil berhasil atau gagal beserta pesan *error* terkait. Kembali ke `locating` setelah beberapa detik.

---

## 2. Logika Face Recognition & Liveness

- **Model & Ekstraksi (Client-Side)**:
  - Menggunakan model dari `@vladmandic/human`.
  - Descriptor wajah berupa *vektor float* sejumlah 128 dimensi (`Array.from(res.face[0].embedding)`).
- **Face Matching**:
  - Menggunakan fungsi **Cosine Similarity**.
  - Rumus: $\frac{A \cdot B}{||A|| \times ||B||}$
  - **Threshold**: **`0.65`**. Jika *Cosine Similarity* $\ge 0.65$, dianggap cocok/match (wajah yang sama). Di bawah itu, ditolak.
- **Deteksi Liveness Dua-Fase**:
  - **Masalah**: Vektor/descriptor dari wajah yang sedang menoleh (kiri/kanan) memiliki tingkat kemiripan yang buruk jika dibandingkan dengan wajah *frontal* saat *enrollment*.
  - **Solusi Logika**:
    1. Kiosk mendeteksi gerakan (misal: "facing left").
    2. Kiosk *tidak langsung meluluskan*, melainkan menunggu status pendeteksian kembali ke "frontal" (tidak menoleh).
    3. Tepat pada *frame* saat wajah kembali frontal, *liveness* dinyatakan lulus **DAN** descriptor pada frame frontal tersebut diambil lagi untuk memverifikasi ulang identitas secara 1:1.

---

## 3. Logika GPS & Geofencing (Location)

Geofencing diterapkan dengan perhitungan *Haversine Formula* (jarak bumi bulat) dalam satuan meter.

- **Konstanta Jarak Maksimal (Radius)**: `GEOFENCE_RADIUS_M = 50` meter.
- **Konstanta Akurasi Terburuk (Max Accuracy)**: `MAX_GPS_ACCURACY_M = 150` meter.
- **Toleransi Akurasi Indoor (GPS Drift)**:
  Karena perangkat berada di dalam ruangan, GPS sering "melompat" dan akurasinya merosot (misalnya akurasi 15m, jarak terukur 30m). Logika kompensasi yang digunakan:
  `Adjusted Distance = Math.max(0, Distance_Meters - Accuracy_Meters)`
- **Kondisi Lolos**:
  `Adjusted Distance <= 50`
- **Contoh Kasus**:
  - Jarak 60m, Akurasi 20m $\rightarrow$ Adjusted = $60 - 20 = 40m$ ($\le 50m \rightarrow$ **Lolos**)
  - Jarak 5m, Akurasi 160m $\rightarrow$ Ditolak sejak awal karena $160m > 150m$ (MAX\_GPS\_ACCURACY\_M).
- **Server Validates**: 
  Nilai `lat` dan `lng` beserta `accuracy` dikirim ke server. Server melakukan perhitungan ulang dengan tabel `outlets`. Ini wajib ditiru di *backend* agar *client* (mobile app) tidak dapat memanipulasi absensi lewat *Fake GPS* secara naif. Pengecualian: jika `lat/lng` outlet di database *NULL*, maka validasi lokasi *di-bypass* sepenuhnya.

---

## 4. Logika Validasi Waktu dan Penentuan Status

- **Penentuan "Masuk" atau "Pulang"** (`decideAction`):
  Sistem melihat histori tabel `attendance` staf tersebut *hari ini* (berdasarkan timezone `Asia/Jakarta`).
  - Cari baris *TERBARU* untuk `type = 'in'` dan `type = 'out'`.
  - Jika belum ada `in` $\rightarrow$ Absen Masuk.
  - Jika sudah ada `in`, belum ada `out` $\rightarrow$ Absen Pulang.
  - Jika sudah ada dua-duanya $\rightarrow$ Selesai.
- **Time Windows (Batas Jam Absen)**:
  Berdasarkan tabel `outlet_attendance_config` untuk outlet terkait (`jam_masuk`, `jam_keluar`, `toleransi_menit`, `absen_window_mode`).
  Jika `absen_window_mode = 'auto'`:
  - **Absen Masuk**: Tidak boleh dilakukan **lebih dari 60 menit** sebelum `jam_masuk`. (Contoh: Jam masuk 08:00, absen mulai bisa dilakukan 07:00).
  - **Absen Pulang**: Tidak boleh dilakukan **lebih dari 30 menit** sebelum `jam_keluar`.
- **Penentuan Status**:
  Server membandingkan Waktu Eksekusi (*Local Server Time* di Asia/Jakarta) terhadap Konfigurasi.
  - **Masuk (`in`)**:
    - $\le$ `jam_masuk` $\rightarrow$ **`tepat`**
    - $\le$ `jam_masuk` + `toleransi_menit` $\rightarrow$ **`telat`**
    - $\gt$ batas toleransi $\rightarrow$ **`alpha`**
    > **CRITICAL LOGIC**: Jika absen `in` menghasilkan status `alpha`, server akan **MENOLAK (Membatalkan) INSERT database**. Hal ini dilakukan untuk mencegah mesin terkunci karena adanya *record in* yang dihitung *alpha*, sehingga pegawai masih bisa absen masuk susulan (jika di-reset manual atau hal lainnya). Status *alpha* sesungguhnya dikalkulasi secara virtual pada fitur laporan/rekap (tidak disetor ke DB dari mesin kiosk).
  - **Pulang (`out`)**:
    - $\lt$ `jam_keluar` $\rightarrow$ **`lebih_awal`**
    - $\ge$ `jam_keluar` + 1 menit $\rightarrow$ **`pulang_telat`**
    - Selebihnya $\rightarrow$ **`tepat`**

---

## 5. Mode Offline (Queueing)

- Apabila `navigator.onLine == false` saat fase Submit:
  - Payload dan gambar Selfie (dalam format `data:image/jpeg;base64`) disimpan ke *IndexedDB* (menggunakan *library* queue lokal).
  - *Client Time* (`ts_client`) dicatat.
  - Flag `from_queue = true` di-set ke `true`.
- **Sinkronisasi (Sync)**:
  - Saat perangkat kembali Online, *queue* di-flush, mengirimkan gambar ke *Storage* dan mengirimkan data ke `/api/submit-attendance`.
  - **Perbedaan Validasi Waktu oleh Server**:
    Ketika Server menerima payload dengan `from_queue = true`, penentuan status waktu (apakah ia telat atau tepat waktu) **TIDAK MENGGUNAKAN** `ts_server` saat itu, **MELAINKAN** menggunakan `ts_client` (waktu kapan absen tersebut dilakukan secara offline di mesin). Ini agar kru tidak divonis telat hanya karena mesin offline saat itu.

---
*Di-generate dengan 100% presisi berdasarkan source-code Absensi V1.*
