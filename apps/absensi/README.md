# apps/absensi — M1: Absensi Outlet + Face Matching

**Track:** Dev A · **Prioritas #1** · Spec: [`docs/PRD.md`](../../docs/PRD.md) §M1

- Device: HP/tablet Android per outlet (kamera + GPS)
- Enroll wajah oleh SPV (consent) → face-api.js match 1:1 + GPS radius + selfie audit + timestamp server
- Offline queue, sinkron saat online
- Butuh dari M0: `outlet_staff`, `outlets.lat/lng`, auth/RLS, design-system

Status: belum mulai (menunggu M0 + Supabase project).

## Model face-api.js
Unduh weights ke `public/models/` (tiny_face_detector, face_landmark_68, face_recognition)
dari https://github.com/justadudewhohacks/face-api.js/tree/master/weights
