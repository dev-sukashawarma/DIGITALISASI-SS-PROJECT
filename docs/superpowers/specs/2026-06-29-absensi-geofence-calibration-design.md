# Absensi — Kalibrasi Lokasi Outlet via Peta (SPV-only)

**Tanggal:** 2026-06-29
**App:** `apps/absensi`
**Status:** Design — disetujui, siap dibuatkan plan

---

## 1. Masalah

Absensi menolak crew yang **benar-benar berada di outlet** karena dianggap "terlalu jauh" (meleset s/d ~1 km).

### Akar masalah (terbukti via query DB)

Koordinat di tabel `outlets` adalah **nilai seed/placeholder kasar**, bukan titik gedung sebenarnya:

| Outlet | lat, lng | Desimal | Error maksimal |
|---|---|---|---|
| CIBINONG | `-6.46, 106.895` | 2–3 desimal | **±1,1 km** |
| EMPANG | `-6.5850, 106.8020` | 4 desimal | ±11 m |
| KITCHEN PUSAT | `-6.634070, 106.790099` | 6 desimal | ±0,1 m ✅ |

Aturan presisi: **0,01° ≈ 1,11 km**. Koordinat 2 desimal secara matematis bisa meleset ~1 km dari gedung asli. Mayoritas dari 18 outlet ber-koordinat hanya 2–4 desimal; hanya KITCHEN PUSAT yang benar-benar terkalibrasi. HQ & CIBUBUR ber-`lat/lng` NULL (dikecualikan dari geofence — perilaku ini dipertahankan).

Geofence radius saat ini `150 m` (`src/lib/gps.ts`). Karena pusat geofence salah, GPS crew yang akurat membaca posisi >150 m dari titik salah → ditolak. Meleset **konsisten ~1 km** (bukan jitter acak 30–100 m) = tanda pasti koordinat tersimpan yang salah, **bukan** masalah hardware GPS.

### Perbandingan dengan `suka-shawarma-hris`

Repo pembanding (`github.com/irsyadtawakal-ssn/suka-shawarma-hris`) memakai stack berbeda (Next 16 + Prisma/Postgres) tetapi **rumus geofence-nya identik**: haversine + toleransi akurasi, sumber GPS `getCurrentPosition` `enableHighAccuracy`. Perbedaan: ia punya kolom `radius_meters` per-outlet dan mode `is_mobile` (cari outlet terdekat). **Kesimpulan: presisi BUKAN dari teknologi** — sama-sama bergantung pada kualitas koordinat outlet. Tidak ada "teknologi rahasia"; data koordinat yang akurat-lah penentunya.

### Konteks perangkat

Absen dilakukan dari **HP Android crew masing-masing** → chip GPS tersedia, akurasi 5–30 m bila izin "Lokasi Akurat/Precise" aktif. Hardware mampu presisi; data koordinat dan radius yang perlu dibetulkan.

---

## 2. Tujuan & non-tujuan

**Tujuan:**
- SPV bisa mengoreksi koordinat tiap outlet ke titik gedung asli lewat **peta visual** (tanpa perlu datang ke lokasi).
- Geofence cukup ketat (**30 m**) agar absen hanya valid saat crew benar-benar di outlet.
- Crew dengan sinyal GPS sangat buruk ditolak dengan instruksi jelas, bukan diam-diam diloloskan.
- Endpoint kalibrasi hanya bisa dipakai SPV (tutup celah keamanan).

**Non-tujuan (YAGNI):**
- Radius per-outlet (diputuskan: global 30 m).
- Mode "cari outlet terdekat" / `is_mobile`.
- Mengubah/menghapus tombol kalibrasi lama "Jadikan Ini Lokasi Outlet" (`calibrateLocation` di `useClockKiosk`) — dibiarkan apa adanya.
- Perubahan flow face-recognition / liveness.

---

## 3. Tension yang sudah diputuskan: radius 30 m

Radius 30 m itu ketat untuk GPS HP. Yang membuatnya tetap pakai-able adalah logika toleransi **yang sudah ada**: `jarak − akurasiGPS ≤ radius`. Konsekuensi: radius efektif = `30 m + akurasi GPS`. Bila akurasi HP jelek (mis. 80 m), toleransi ini bisa "menelan" geofence dan orang jauh pun lolos.

**Keputusan:** radius ketat hanya bermakna bila dipasangkan dengan **penolakan akurasi buruk**. Maka clock-in dengan `accuracy > 75 m` ditolak dan crew diminta mengaktifkan "Lokasi Akurat". Tiga hal bersama membuat sistem presisi:
1. Koordinat outlet benar (via peta).
2. Radius 150 → 30 m.
3. Tolak GPS akurasi > 75 m.

---

## 4. Arsitektur & komponen

### 4.1 Halaman kalibrasi `/dashboard/pengaturan-lokasi` (baru)

- **Akses:** SPV-only — role ∈ {`spv`, `admin`, `owner`}. Page-level guard + `router.replace` bila bukan SPV, meniru pola `src/app/dashboard/layout.tsx:60-70`. Ditambahkan juga sebagai item nav SPV.
- **Peta:** **Leaflet** + tile **OpenStreetMap** (gratis, tanpa API key) dengan **layer Satelit Esri World Imagery** (gratis, tanpa key) sebagai base layer agar SPV dapat melihat atap gedung. Toggle OSM/Satelit.
- **Interaksi:**
  1. Dropdown pilih outlet (default: outlet milik SPV bila `spv`/`leader`).
  2. Peta terbang (`flyTo`) ke koordinat outlet saat ini; bila NULL, ke pusat Jabodetabek.
  3. **Marker draggable** = posisi pin. SPV geser ke gedung asli.
  4. **Lingkaran radius 30 m** (`L.circle`) mengelilingi pin sebagai panduan visual (read-only — radius global, tak diatur di sini).
  5. Tampilkan lat/lng terpilih (6 desimal) + tombol **Simpan**.
  6. Tombol opsional "Gunakan lokasi saya" (geolocation) untuk SPV yang kebetulan di outlet.
- **Simpan:** POST ke endpoint aman (§4.2). Sukses → toast + marker tetap.
- **Komponen dipecah:**
  - `pengaturan-lokasi/page.tsx` — guard, state, data-fetch, simpan.
  - `OutletMapPicker.tsx` (`"use client"`, dynamic import `ssr:false`) — Leaflet murni: props `{ value:{lat,lng}|null, radiusM, onChange(lat,lng) }`. Tidak tahu Supabase. Bisa diuji/diganti independen.

### 4.2 Endpoint aman `/api/calibrate-outlet` (hardening)

Endpoint sekarang **TIDAK punya auth sama sekali** — siapa pun bisa menggeser koordinat outlet. Diperketat:
1. Baca bearer token dari header `Authorization`.
2. `admin.auth.getUser(token)` → dapat `user.id`. Bila gagal → 401.
3. Query `outlet_staff` role berdasarkan `user.id`. Bila role ∉ {`spv`,`admin`,`owner`} → 403.
4. (Untuk `spv`/`leader`) opsional: pastikan `outlet_id` termasuk outlet yang dia bina (`accessible_outlet_ids`). `admin`/`owner` bebas. *(Bila helper sulit dipanggil dari sini, minimal kunci ke role; catat sebagai follow-up.)*
5. Baru `update outlets set lat,lng`. Validasi `lat ∈ [-90,90]`, `lng ∈ [-180,180]`.

Client mengirim token ambil dari `localStorage('supabase-auth-token')` (pola sama dengan `useClockKiosk.doSubmit`).

### 4.3 Radius global 30 m

- `src/lib/gps.ts`: `GEOFENCE_RADIUS_M` `150` → `30`. Komentar diperbarui (alasan: koordinat kini terkalibrasi via peta, indoor-drift dikompensasi toleransi akurasi + penolakan akurasi buruk).
- Tidak ada kolom DB baru; tidak ada migration untuk radius.

### 4.4 Tolak akurasi GPS buruk (ambang 75 m)

Konstanta baru `MAX_GPS_ACCURACY_M = 75` di `src/lib/gps.ts`.

- **Client (`useClockKiosk.checkLocation`):** dalam callback `watchPosition`, bila `accuracy > 75` → set `location_invalid` dengan pesan "Akurasi GPS terlalu rendah (X m). Aktifkan 'Lokasi Akurat/Precise' & nyalakan GPS." Jangan loloskan ke `idle`. (Saat ini hanya warning bila ≥80; jadikan penolakan tegas pada >75.)
- **Server (`/api/submit-attendance`):** sebelum cek jarak, bila outlet punya koordinat dan `body.gps_accuracy > 75` → `{ ok:false, reason:"gps_accuracy_low" }` (403). Pesan dipetakan di `gagalText`.

---

## 5. Aliran data

```
SPV  →  /dashboard/pengaturan-lokasi
        pilih outlet → geser pin (lihat satelit) → Simpan
        → POST /api/calibrate-outlet  (Bearer token SPV)
            → verifikasi role SPV → UPDATE outlets.lat/lng (6 desimal)

Crew →  kiosk / panel absen
        watchPosition → tolak bila accuracy>75
        → haversine(outlet, device) ; adjusted = max(0, dist - accuracy)
        → lolos bila adjusted ≤ 30
        → submit-attendance (server hitung ulang: tolak accuracy>75, lalu adjusted ≤ 30)
```

---

## 6. Error handling

| Kondisi | Perilaku |
|---|---|
| Bukan SPV buka `/dashboard/pengaturan-lokasi` | redirect `/dashboard/kru` (pola layout) |
| POST kalibrasi tanpa/ token invalid | 401 |
| POST kalibrasi role bukan SPV | 403 |
| lat/lng di luar rentang valid | 400 |
| Crew accuracy > 75 m | ditolak, pesan aktifkan Lokasi Akurat (client & server) |
| Outlet `lat/lng` NULL (HQ/CIBUBUR) | geofence dilewati (perilaku lama dipertahankan) |
| Tile peta gagal dimuat | layer alternatif (OSM↔Satelit); halaman tetap fungsional |

---

## 7. Testing

**Unit (pola `src/lib/gps.test.ts`, runtime node):**
- `haversineMeters` pada koordinat terkalibrasi (6 desimal) → ~0 m.
- `isWithinRadius` dengan radius 30: titik 25 m → true; 45 m → false.
- Toleransi akurasi: `dist=45, accuracy=25` → adjusted 20 ≤ 30 → lolos; `dist=45, accuracy=0` → 45 > 30 → tolak.
- Ambang akurasi: helper penolakan `accuracy>75` → ditolak.

**Smoke manual:**
- SPV pin 1 outlet (mis. CIBINONG) via satelit → simpan → cek DB lat/lng jadi 6 desimal.
- Crew absen dari dalam outlet itu → diterima.
- Uji endpoint kalibrasi tanpa token SPV → 403.

---

## 8. Ringkasan perubahan file

| File | Perubahan |
|---|---|
| `src/app/dashboard/pengaturan-lokasi/page.tsx` | **Baru** — halaman kalibrasi, SPV guard |
| `src/components/OutletMapPicker.tsx` | **Baru** — Leaflet picker (dynamic, ssr:false) |
| `src/app/dashboard/layout.tsx` | Tambah item nav SPV "Lokasi Outlet" |
| `src/app/api/calibrate-outlet/route.ts` | Hardening auth/role SPV + validasi lat/lng |
| `src/lib/gps.ts` | `GEOFENCE_RADIUS_M` 150→30; `MAX_GPS_ACCURACY_M=75` |
| `src/lib/gps.test.ts` | Tambah test radius 30 / toleransi / ambang akurasi |
| `src/features/clock/useClockKiosk.ts` | Tolak `accuracy>75` tegas di `checkLocation` |
| `src/app/api/submit-attendance/route.ts` | Tolak `gps_accuracy>75` server-side |
| `package.json` (absensi) | Tambah dep `leaflet` + `@types/leaflet` |

**Dependency baru:** `leaflet` (+ `@types/leaflet`). Tile gratis tanpa API key (OSM + Esri World Imagery). Tidak ada biaya/billing — cocok untuk hosting cPanel.

---

## 9. Catatan operasional (pasca-implementasi)

Setelah fitur live, SPV **wajib mengkalibrasi ulang 16 outlet** yang koordinatnya masih kasar (semua kecuali KITCHEN PUSAT; HQ & CIBUBUR NULL by design). Tanpa langkah operasional ini, kode saja tidak menyelesaikan masalah — radius 30 m pada koordinat salah justru menolak lebih sering. Urutan: deploy → SPV kalibrasi → baru umumkan ke crew.
