# Animasi face mesh dinamis di kiosk absen

## Latar belakang
Kiosk absen ([AttendanceKioskPanel.tsx](../../../apps/absensi/src/features/clock/AttendanceKioskPanel.tsx))
saat ini menampilkan overlay statis "face-id-corners" (bracket sudut) + garis laser
scan saat fase idle/identified/liveness. User minta animasi scan ala Face ID yang
interaktif: titik + garis mengikuti struktur wajah secara dinamis (lihat referensi
gambar — mesh holografik biru/cyan di atas wajah), dan harus ringan.

## Tujuan
- Overlay mesh wajah (titik + garis) yang mengikuti posisi wajah real-time.
- Gaya visual holografik biru/cyan, menggantikan bracket sudut statis.
- Tidak menambah beban inferensi ML — pakai data landmark yang sudah dihitung.

## Perubahan

### 1. `useClockKiosk.ts` — expose landmark terbaru
- Tambah `const landmarksRef = useRef<faceapi.FaceLandmarks68 | null>(null)`.
- Di `tick()`: set `landmarksRef.current = det?.landmarks ?? null` (null saat tidak ada
  wajah terdeteksi atau saat masuk fase `result`/reset).
- Di `runLiveness()`: update `landmarksRef.current = det?.landmarks ?? null` setiap
  deteksi (cadence ~40ms saat liveness).
- Di `scheduleReset()`: set `landmarksRef.current = null` agar mesh hilang saat hasil
  ditampilkan.
- Return `landmarksRef` dari hook (tanpa mengubah signature lain).

### 2. `FaceMeshOverlay.tsx` (baru) — `src/features/clock/FaceMeshOverlay.tsx`
Komponen canvas overlay:
- Props: `videoRef: RefObject<HTMLVideoElement>`, `landmarksRef: RefObject<faceapi.FaceLandmarks68 | null>`, `active: boolean` (true saat phase idle/identified/liveness, false saat result/outlet tutup).
- `<canvas>` absolute, `inset-0`, `transform: scaleX(-1)` (samakan mirroring dengan video), `pointer-events-none`.
- `ResizeObserver` pada container untuk set `canvas.width/height` = `clientWidth/clientHeight` (tanpa devicePixelRatio, demi ringan).
- Loop `requestAnimationFrame`:
  - Baca `landmarksRef.current`. Jika ada → simpan sebagai `lastLandmarks` + `lastSeenAt = now`.
  - Jika `now - lastSeenAt > 800ms` atau `!active` → fade out (turunkan alpha bertahap ke 0) lalu skip gambar.
  - Hitung skala: `scaleX = canvas.width / video.videoWidth`, `scaleY = canvas.height / video.videoHeight`.
  - Gambar 68 titik (lingkaran kecil, radius ~2px, fill cyan dengan `shadowBlur`).
  - Gambar edge list (lihat di bawah) sebagai garis tipis cyan/biru dengan glow tipis.
  - Fade in saat landmark baru muncul setelah sebelumnya kosong (alpha naik bertahap).
- Cleanup: `cancelAnimationFrame` + disconnect `ResizeObserver` saat unmount.

### 3. Edge list (mesh statis berbasis index 68-titik)
Hardcode array `[number, number][]` di `FaceMeshOverlay.tsx` (atau file konstanta
terpisah `faceMeshEdges.ts`):
- Outline standar: jaw (0-16), alis kanan (17-21), alis kiri (22-26), batang hidung
  (27-30), bawah hidung (31-35), mata kanan (36-41 loop), mata kiri (42-47 loop), bibir
  luar (48-59 loop), bibir dalam (60-67 loop).
- Cross-link tambahan untuk kesan "mesh" lebih padat: alis→mata (mis. 19-37, 24-44),
  hidung→mulut (mis. 33-51), jaw→alis (mis. 1-17, 15-26), dan beberapa titik lain agar
  area pipi/dahi ikut "terhubung" secara visual.
- Total ~90 garis — drawing per frame tetap murah (loop sederhana + `moveTo`/`lineTo`).

### 4. Integrasi di `AttendanceKioskPanel.tsx`
- Ganti div `face-id-corners` dengan `<FaceMeshOverlay videoRef={videoRef} landmarksRef={kiosk.landmarksRef} active={kiosk.phase !== "result" && isOutletOpen} />`.
- Laser scan line tetap dipertahankan apa adanya, tetap di-render di atas mesh
  (urutan elemen tidak berubah selain penggantian bracket).
- Hapus CSS class `.face-id-corners` dan animasi `pulse-glow` jika sudah tidak dipakai
  di tempat lain (cek penggunaan sebelum hapus).

## Di luar scope
- Tidak mengubah cadence deteksi (tetap 500ms idle / 40ms liveness).
- Tidak menambah model/landmark baru (tetap 68 titik dari face-api.js).
- Tidak menyentuh logika identifikasi/liveness/submit attendance.
