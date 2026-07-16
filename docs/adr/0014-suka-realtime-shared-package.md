# 14. `@suka/realtime` sebagai paket bersama untuk abstraksi realtime kanonik

Tanggal: 2026-07-16
Status: Diterima

## Konteks
Util realtime scoped diduplikasi di `apps/absensi/src/lib/realtime` dan
`apps/stok/src/lib/realtime`. Dua copy sudah divergen diam-diam (absensi memakai
nama channel `Math.random()`, stok memakai nama stabil) tanpa niat — bug yang
menyebar tak terlacak. Rencana konsolidasi menambah distribusi & pos-kasir sebagai
konsumen (jadi 4+ copy).

## Keputusan
Angkat util realtime jadi paket workspace `@suka/realtime` (mirror `@suka/auth`:
ekspor `src` langsung, di-transpile Next via `transpilePackages`). Semua app
meng-import dari `@suka/realtime`; copy lokal dihapus. Client Supabase diambil
dari `@suka/auth`. Nama channel stabil per-scope jadi kanonik.

## Konsekuensi
- Satu sumber kebenaran; perbaikan bug sekali untuk semua app.
- Tiap app konsumen wajib mencantumkan `@suka/realtime` di `dependencies` +
  `transpilePackages`.
- Preseden lawan: keputusan printLayout (CLAUDE.md) sengaja MENOLAK paket bersama
  demi "hindari friksi build/deploy dist". Perbedaan yang membenarkan arah berbeda
  di sini: printLayout = logika stabil jarang berubah; util realtime = infrastruktur
  yang bug-nya menyebar ke semua app, sehingga nilai satu-sumber jauh lebih tinggi.
  (Catatan: karena `@suka/*` mengekspor `src` + `transpilePackages`, "friksi build
  dist" yang dikhawatirkan printLayout tak berlaku untuk pola paket ini.)
