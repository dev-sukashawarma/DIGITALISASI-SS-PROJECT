# ADR-003 — Face matching client-side (face-api.js) + GPS/selfie

- Status: Accepted
- Tanggal: 2026-06-09

## Konteks
Absensi staff outlet butuh anti titip-absen. Tim = 2 developer vibe-coding, tanpa infra ML khusus. Outlet bisa bersinyal jelek. POC OpenCV existing hanya deteksi (haarcascade), bukan recognition.

## Keputusan
Gunakan **face matching 1:1 client-side dengan face-api.js** di device outlet (descriptor vektor, threshold euclidean ~<0.5, kalibratable). Enroll wajah oleh SPV/Kepala Outlet (1–3 foto). Anti-curang MVP berlapis: **GPS radius outlet + selfie audit + timestamp server**. Descriptor di-cache lokal untuk **offline tolerance** (absen masuk queue, sinkron saat online). **Liveness aktif (kedip/gerak) ditunda** ke fase lanjut.

## Alternatif yang ditolak
- **Pipeline ML server-side** (embedding 1:N + liveness) — ditolak: butuh infra & effort besar, berlebihan untuk kebutuhan anti titip-absen dengan tim kecil.
- **GPS+selfie saja tanpa face matching** — ditolak: tidak mencegah titip-absen secara teknis.

## Konsekuensi
- (+) Tanpa server ML; ringan; jalan di browser device outlet; toleran offline.
- (+) Berlapis (wajah + GPS + selfie audit) cukup untuk MVP.
- (−) Tanpa liveness, rentan foto-dari-foto → dimitigasi kamera live + GPS + selfie audit untuk spot-check SPV; liveness menyusul.
- (−) Akurasi tergantung kualitas kamera & pencahayaan outlet (perlu kalibrasi threshold).
