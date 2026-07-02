---
name: absensi-face-model-config-gotcha
description: Mengubah sumber/config model @vladmandic/human di apps/absensi bisa membatalkan data enroll wajah yang sudah ada
metadata:
  type: project
---

Di `apps/absensi`, mengubah **sumber model** (CDN jsdelivr → self-host `/models/`) atau **config face** (mis. mematikan `iris`, split `detect()` gesture-only) berisiko membuat embedding wajah live **tak lagi kompatibel** dengan `face_descriptor` hasil enroll yang tersimpan di DB. Gejalanya: `identifyStaff` men-skip semua kandidat karena beda dimensi → skor **`-1.0000`** (nilai awal `maxSimilarity`), semua wajah ditolak ("Wajah tidak cocok dengan akun ini"). Ini bukan false-reject biasa — angka `-1.0000` = tak ada perbandingan sama sekali.

**Aturan aman:** jangan sentuh pipeline pengenalan (modelBasePath, model set, iris, description, metrik/threshold) tanpa uji kamera di device nyata + rencana re-enroll. Untuk sekadar **meringankan loading**, pakai cara yang tak mengubah embedding: service worker `public/sw.js` (cache-first HANYA URL model jsdelivr). Config wajah kerja: CDN, `iris` on, full `detect()` di liveness, threshold 0.65. (Terjadi & di-revert sesi 2026-07-02, commit fix `7c30e6b`.)

`sw.js` di absensi ditulis tangan (bukan artefak serwist) → ada negasi `!apps/absensi/public/sw.js` di `.gitignore` root, dan nama `sw.js` sudah masuk exclusion middleware matcher agar tak dicegat auth.
