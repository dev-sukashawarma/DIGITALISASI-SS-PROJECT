# Webapp Bot — `bot.sukashawarma.com` (fase 1: Bot CEO)

**Tanggal:** 2026-10-07
**Status:** Disetujui (brainstorming 2026-10-07), belum dibangun
**Folder:** `apps/bot` · Branch kerja: `feat/webapp-bot`
**Bergantung pada:** `docs/superpowers/specs/2026-10-07-hermes-api-design.md` (API MCP baca-saja,
sudah live) dan `docs/RUNBOOK-HERMES-VPS.md` (profil `ceo` di VPS, sudah live).

## 1. Tujuan

Bos bisa **bertanya langsung** ke Bot CEO dari HP/laptop lewat browser, dengan angka yang sama
dengan dashboard. Webapp = "meja depan": login, memilih profil Hermes sesuai role, menyimpan &
menampilkan percakapan. Kecerdasan & data tetap di Hermes + MCP Suka Shawarma.

## 2. Keputusan

| # | Keputusan |
|---|---|
| W1 | App baru **di monorepo** `apps/bot` (Next.js app router, TS, Tailwind), Coolify → `bot.sukashawarma.com`. Bukan `hermes dashboard` bawaan (panel admin mesin). |
| W2 | Login **SSO Suka Shawarma** (`@suka/auth`, cookie `.sukashawarma.com`). Gerbang = sesi valid + RPC `is_owner_or_admin()` + `outlet_staff.status = 'active'` (pola `sesiSukaBot`), dicek **di server** (route & halaman). |
| W3 | **Fase 1 hanya owner, admin, developer → profil `ceo`.** Role lain ditolak (bukan halaman "segera hadir"). Peta role → profil di satu modul; profil divisi ditambah saat agennya ada. |
| W4 | Coolify & Hermes **satu VPS**: server webapp memanggil **API server Hermes lewat jaringan internal** (`/p/<profil>/v1/chat/completions`). API server **tidak dibuka ke internet**. |
| W5 | Satu `API_SERVER_KEY` **per profil**, disimpan sebagai env **server-only** webapp (`HERMES_KEY_CEO`), tak pernah dikirim ke browser. |
| W6 | Riwayat disimpan di **Supabase per user** (RLS milik sendiri), maks **50 percakapan/orang** (terlama dihapus otomatis). Hermes menerima `X-Hermes-Session-Id` per percakapan → konteks dijaga Hermes, webapp cukup kirim pesan terbaru. |
| W7 | Memory, skills/self-improvement, session_search Hermes **mati** di profil bisnis. Toolset platform `api_server` profil `ceo` **wajib dikunci** (hanya `clarify` + `suka`). |
| W8 | Batas pemakaian **60 pesan/orang/jam**. Hermes gagal/timeout **120 dtk** → pesan galat jelas, tak pernah jawaban kosong/karangan. |
| W9 | Webapp **terpisah dari SUKA Bot** (avatar chef di portal). Tile portal bernama **"Bot CEO"**. |

## 3. Lingkup fase 1

**Masuk:** chat dengan streaming jawaban; daftar percakapan (baru, buka, hapus); tombol
pertanyaan cepat (*Omzet kemarin*, *Peringkat outlet minggu ini*, *Menu terlaris bulan ini*,
*Laporan pagi*); indikator "sedang mengambil data…"; tampilan HP-first dengan
`@suka/design-system`; tile "Bot CEO" di portal launcher.

**Tidak masuk (dipikirkan nanti):** ingat preferensi per orang, pemilih bot multi-profil,
unggah file/foto, suara, ekspor PDF, akses role divisi.

## 4. Arsitektur

```
Browser (HP)
  │ HTTPS (Cloudflare)
  ▼
apps/bot (Coolify, container)          ─── Supabase (bot_percakapan, bot_pesan; RLS milik sendiri)
  ├─ middleware: sesi SSO wajib (else → login portal)
  ├─ app/page.tsx              UI chat (server cek gerbang W2)
  ├─ app/api/chat/route.ts     POST: gerbang → simpan pesan → Hermes (stream) → simpan jawaban
  ├─ app/api/percakapan/...    GET daftar/isi, DELETE (via Supabase sesi user, RLS)
  └─ lib/
      ├─ peran.ts              role → profil (+ test)
      ├─ hermes.ts             klien API server: URL /p/<profil>/, kunci, SSE parse (+ test)
      ├─ batas.ts              cek 60 pesan/jam & 50 percakapan (+ test)
      └─ sesi.ts               gerbang W2 (pola sesiSukaBot)
  │ jaringan internal VPS (IP gateway Docker / host), port 8643
  ▼
Hermes API server (user suka-hermes, host gateway multiplex) → /p/ceo/ → 9Router + MCP "suka"
```

Port dev lokal: **3050**.

## 5. Alur satu pertanyaan

1. `POST /api/chat { percakapanId?, pesan }` (pesan 1–2.000 karakter).
2. Gerbang W2 → profil dari `peran.ts`; tolak 403 bila role tak terpetakan.
3. Cek batas W8 (hitung pesan `user` milik staf 60 menit terakhir) → 429 bila lewat.
4. Bila `percakapanId` kosong: buat `bot_percakapan` (judul = 60 karakter pertama pesan,
   `hermes_session_id` = UUID baru), lalu pangkas ke 50 terbaru.
5. Simpan `bot_pesan` peran `user`.
6. Panggil `POST {HERMES_API_URL}/p/{profil}/v1/chat/completions` dengan
   `Authorization: Bearer {HERMES_KEY_<PROFIL>}`, `X-Hermes-Session-Id`, `stream: true`,
   `messages: [{ role: 'user', content: pesan }]`, timeout 120 dtk.
7. Teruskan potongan teks ke browser sebagai stream; kumpulkan seluruh jawaban.
8. Selesai → simpan `bot_pesan` peran `bot` (+ `meta`: durasi, status). Gagal → simpan pesan
   peran `bot` berisi teks galat standar + `meta.status = 'galat'` + alasan; stream ke browser
   pesan galat yang sama.

## 6. Data

```sql
bot_percakapan (
  id uuid pk default gen_random_uuid(),
  staff_id uuid not null default auth.uid() references outlet_staff(id) on delete cascade,
  profil text not null check (profil in ('ceo','gudang','hrd','finance')),
  judul text not null,
  hermes_session_id uuid not null default gen_random_uuid(),
  dibuat_at timestamptz not null default now(),
  diperbarui_at timestamptz not null default now()
)
bot_pesan (
  id bigint generated always as identity pk,
  percakapan_id uuid not null references bot_percakapan(id) on delete cascade,
  peran text not null check (peran in ('user','bot')),
  isi text not null,
  meta jsonb not null default '{}',
  dibuat_at timestamptz not null default now()
)
```
RLS: SELECT/INSERT/UPDATE/DELETE hanya baris dengan `staff_id = auth.uid()` (pesan lewat
percakapan miliknya). `REVOKE ALL FROM anon`. Indeks `(staff_id, diperbarui_at desc)`,
`(percakapan_id, dibuat_at)`. Uji RLS: user A tak bisa membaca/menghapus milik user B.

## 7. Keamanan & ketahanan

- API server Hermes bind ke IP jaringan internal (bukan `0.0.0.0` publik) + firewall menutup
  port 8643 dari luar. Langkah pasti ditentukan di plan setelah memeriksa jaringan Docker Coolify.
- `HERMES_API_URL`, `HERMES_KEY_CEO`, `SUPABASE_SERVICE_ROLE_KEY` (bila dipakai) = env
  server-only → **wajib** `ARG`+`ENV` di stage **runner** Dockerfile + diisi di panel Coolify.
- Toolset `api_server` profil `ceo` dikunci sebelum API server dinyalakan; verifikasi
  `ceo tools --summary` menampilkan `api_server` 2/28.
- Kunci tak pernah muncul di respons/HTML/log browser (test).
- Galat standar: "Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi." Tidak pernah
  menampilkan jawaban kosong atau angka tanpa alat.

## 8. Tampilan

HP-first, satu kolom: header (nama bot + tombol laci), laci daftar percakapan (baru/hapus),
gelembung chat (Markdown sederhana: tebal, daftar), tombol pertanyaan cepat saat percakapan
kosong, indikator "sedang mengambil data…" sampai potongan pertama tiba, kotak input di bawah.
Desktop: laci jadi panel kiri tetap. Komponen & token dari `@suka/design-system`.

## 9. Pengujian

- **Unit (vitest):** `peran.ts` (owner/admin/developer → ceo; role lain → null);
  `hermes.ts` (bangun URL `/p/ceo/v1/...`, header sesi, parser SSE termasuk potongan terbelah &
  `[DONE]`, galat HTTP/timeout → galat terstandar); `batas.ts` (60/jam, pangkas 50).
- **Route:** gerbang menolak tanpa sesi (401) & role lain (403); kunci tak ada di respons.
- **SQL:** `supabase/verifikasi/bot/t1_rls.sql` (A vs B, anon ditolak) + kontrol negatif.
- **Manual:** login owner → "omzet kemarin" = dashboard; refresh → riwayat tetap; matikan
  gateway Hermes → pesan galat standar; role lain → ditolak; HP & desktop.

## 10. Kewajiban di sisi VPS (runbook)

1. Aktifkan multiplex profil + API server di host gateway; `API_SERVER_KEY` di
   `~/.hermes/profiles/ceo/.env`; bind IP internal; firewall 8643.
2. `ceo tools disable --platform api_server <daftar standar>`.
3. Uji dari container webapp: `GET /p/ceo/v1/models` dengan kunci → 200, tanpa kunci → 401;
   dari luar VPS → tak terjangkau.

## 11. Terbuka

- IP/rute internal persis antara container Coolify dan host (diperiksa di plan).
- Format event SSE Hermes untuk pemanggilan alat (bila tersedia → indikator "memanggil
  penjualan_ringkasan…"; bila tidak → indikator umum).
