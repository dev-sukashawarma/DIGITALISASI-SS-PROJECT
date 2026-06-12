# Remote Realtime Kiosk Logout — Design Spec

**Tanggal:** 2026-06-07
**Status:** Disetujui (siap implementasi)

## Latar Belakang

Sistem POS multi-outlet (19 cabang). Tiap cabang punya tablet **kasir** (login/logout normal) dan
satu atau lebih tablet **kiosk** self-ordering (login sekali, sesi permanen, dikunci Kiosk Mode).

Kebutuhan: **kasir dapat me-logout tablet kiosk dari jarak jauh, secara realtime**, tanpa harus
menyentuh tablet kiosk-nya. Dipakai saat tablet error, mau tutup toko, atau perlu ganti akun.

## Keputusan Desain (sudah dikonfirmasi)

1. **Target logout:** keduanya — daftar kiosk online (logout per-device) **dan** tombol "Logout Semua".
2. **Tingkat logout:** *hard* — sinyal realtime **plus** cabut sesi di server (bukan hanya sinyal klien).
3. **Identitas device:** **1 akun per tablet** (`kiosk_sudirman1`, `kiosk_sudirman2`, …). Cabut sesi
   server jadi bersih per-device — logout 1 tablet tidak mengganggu tablet lain.
4. **Pendekatan realtime:** **A — Supabase Realtime Presence + Broadcast + API revoke.** Tanpa tabel
   heartbeat; beban DB minimal; native Supabase.

## Arsitektur

Tanpa perubahan skema database (presence & broadcast bersifat ephemeral). Empat komponen:

| Komponen | Lokasi | Tugas |
|---|---|---|
| Hook kiosk `useKioskControl` | `app/page.tsx` / `components/KioskUI.tsx` | Join channel `kiosk-control:<outlet_id>`, track presence (id akun + nama device), dengar event `force_logout` → `signOut({scope:'global'})` + redirect `/login` |
| Panel kasir `KioskControlPanel` | section baru di dashboard kasir (`/kasir/orders` atau halaman `/kasir/kiosk`) | Subscribe channel sama (read-only presence), tampilkan daftar kiosk online + tombol "Logout" per device & "Logout Semua" |
| API `POST /api/kiosk/logout` | route baru (service role) | Validasi requester & outlet → cabut sesi server akun target → broadcast `force_logout` |
| Realtime Authorization | konfigurasi Supabase | Hanya user outlet terkait yang boleh subscribe channel-nya |

### Channel

- Nama: `kiosk-control:<outlet_id>`.
- **Presence (dari kiosk):** key = `user.id` akun kiosk; state = `{ username, device_label, online_at }`.
- **Presence (kasir):** subscribe tanpa `.track()` — kasir tidak muncul di daftar kiosk.
- **Broadcast event:** `force_logout`, payload `{ target: 'all' | <user_id> }`.

## Alur Data

```
KIOSK (tablet)                 KASIR (dashboard)              API /kiosk/logout
   join channel ───┐               │                              │
   track presence  ├─ presence ──► lihat daftar kiosk online      │
   listen force_logout             │                              │
                                   ├─ klik Logout(target) ───────►│ validasi role=kasir & outlet sama
                                   │                              ├─ revoke sesi akun target (GoTrue admin)
   terima broadcast ◄──────────────┼──────── broadcast force_logout
   signOut() + ke /login           │
```

Kasir **tidak** broadcast langsung. Semua lewat API agar tervalidasi (instan **dan** aman). Server
yang melakukan broadcast.

### Mekanisme cabut sesi server

- Memakai service role memanggil endpoint admin GoTrue:
  `POST {SUPABASE_URL}/auth/v1/admin/users/{user_id}/logout`
  (header `apikey` + `Authorization: Bearer <service_role_key>`). Ini mencabut seluruh sesi akun
  tersebut. Karena 1 akun = 1 tablet, efeknya per-device.
- Broadcast `force_logout` membuat tablet yang online langsung `signOut()` (instan).
- Jika tablet offline/abai sinyal: sesi sudah dicabut → saat refresh token berikutnya, tertendang
  ke `/login`. Inilah nilai "hard logout".

### Mekanisme broadcast dari server

API route mengirim broadcast via HTTP broadcast endpoint Supabase Realtime
(`POST {SUPABASE_URL}/realtime/v1/api/broadcast`, header `apikey` + `Authorization`), body berisi
`{ messages: [{ topic: "kiosk-control:<outlet_id>", event: "force_logout", payload: {...} }] }`.
Tidak perlu membuka koneksi websocket dari serverless function.

## Keamanan

- API verifikasi requester via cookie → `getUser()` → profil; harus `role = 'kasir'` atau `'admin'`.
- Target kiosk **wajib** ber-`outlet_id` sama dengan kasir. Kasir cabang A tak bisa logout kiosk
  cabang B (dicek di server, bukan hanya UI).
- "Logout Semua" = query `profiles` where `role='kiosk' AND outlet_id = <outlet kasir>`.
- Realtime Authorization (RLS pada `realtime.messages`) agar channel per-outlet tak bisa diintip /
  di-broadcast oleh user cabang lain.

## Error Handling & Edge Case

- **Kiosk offline saat di-logout:** tak terima broadcast; sesi tetap dicabut server → tertendang
  saat online berikutnya.
- **Logout saat pelanggan checkout:** diterima; kasir lihat dialog konfirmasi dulu. Sesudah logout,
  tablet ke `/login`, perlu staf login ulang.
- **Revoke sebagian gagal (logout semua):** API kembalikan daftar sukses/gagal; UI tampilkan toast.
- **Nama device:** disimpan di `localStorage` tablet (diisi sekali saat setup); default ke username.
- **Reconnect:** presence otomatis re-track saat channel re-subscribe; daftar kasir selalu sinkron.

## UX (harus user-friendly)

- Panel kasir: kartu per kiosk dengan indikator hijau "Online", nama device, tombol "Logout" jelas.
- Tombol "Logout Semua Kiosk" terpisah, warna peringatan, dengan dialog konfirmasi.
- Status kosong: "Tidak ada kiosk online di cabang ini."
- Feedback instan: toast sukses/gagal; kartu kiosk hilang dari daftar begitu presence leave.
- Sisi kiosk: transisi halus ke layar login (bukan error mentah).

## Scope

- Fitur ini berdiri sendiri; mengandalkan `outlet_id` pada profil kasir & kiosk yang **sudah ada**.
- **Di luar scope:** perbaikan isolasi tampilan order kasir per outlet (bug terpisah, dikerjakan sendiri).

## Kriteria Sukses

1. Kiosk yang online muncul di panel kasir cabang yang sama dalam < 3 detik setelah join.
2. Klik "Logout" pada satu kiosk → tablet itu ke `/login` < 2 detik; tablet kiosk lain tak terganggu.
3. "Logout Semua" → seluruh kiosk cabang itu ke `/login`.
4. Kasir cabang lain tidak melihat / tidak bisa logout kiosk bukan cabangnya.
5. Kiosk yang offline saat di-logout tetap tertendang saat online kembali.
