# Suka Monitor

Website monitoring kamera outlet yang hanya membuka media ketika operator menekan **View Camera**.

## Kontrak runtime

- `640x360`, 30 FPS, satu layer VP8, maksimum `700 kbps`, tanpa audio.
- Request kamera dikendalikan manual dari dashboard, maksimum 4 outlet aktif bersamaan.
- Supabase Realtime hanya membawa status/request; video mengalir langsung melalui LiveKit.
- Tutup modal atau keluar halaman akan mengirim perintah stop ke perangkat POS.

## Lokal

Salin nilai `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan cookie domain dari environment aplikasi lain ke `apps/monitoring/.env.local` (jangan commit secret). Jalankan:

```bash
npm run dev --workspace @suka/monitoring
```

Buka `http://localhost:3030`. Middleware tetap mensyaratkan sesi staff aktif dan role yang punya akses `monitoring`.

## Backend rollout

1. Apply migration `supabase/migrations/20260828133000_on_demand_camera_streams.sql`.
2. Deploy ulang Edge Function `livekit-token`.
3. Pastikan secret Edge Function `LIVEKIT_URL`, `LIVEKIT_API_KEY`, dan `LIVEKIT_API_SECRET` menunjuk ke LiveKit VPS yang benar.
4. Uji satu outlet, lalu 4 sesi paralel sebelum membuka akses operasional.
