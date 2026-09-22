# Suka Monitor

Peta posisi live staff lapangan (`/lokasi`), dari lokasi yang dikirim aplikasi absensi. Root dan `/dashboard` diarahkan ke `/lokasi`.

Fitur live camera monitoring (LiveKit) sudah dihapus pada 22 Sep 2026 — dari app ini, admin-dashboard, dan POS native.

## Lokal

Salin nilai `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan cookie domain dari environment aplikasi lain ke `apps/monitoring/.env.local` (jangan commit secret). Jalankan:

```bash
npm run dev --workspace @suka/monitoring
```

Buka `http://localhost:3030`. Middleware tetap mensyaratkan sesi staff aktif dan role yang punya akses `monitoring`.
