# Bot Marcom — Asisten Marketing Communication Suka Shawarma

**Tanggal:** 2026-10-08  
**Status:** Disetujui (Brainstorming 2026-10-08)  
**Bergantung pada:** `docs/superpowers/specs/2026-10-07-hermes-api-design.md` (Fondasi MCP Hermes), `docs/RUNBOOK-HERMES-VPS.md` (Profil Bot VPS).

---

## 1. Tujuan

Membangun **Bot Marcom** sebagai asisten cerdas tim Marketing Communication (Melani, Putri Hambali), Owner, dan Admin untuk:
1. **Endorsement & KOL**: Memantau status kunjungan (visit/delivery), review draft video konten, jadwal tayang/posting, dan status pembayaran rate card.
2. **Content Planner & Kalender**: Mengetahui jadwal publikasi konten harian & mingguan (TikTok, Instagram Reels/Story, dll), pilar konten, serta metrik performa (views, likes, engagement).
3. **Ads & Budget Marketing**: Melacak realisasi biaya iklan (Meta Ads & TikTok Ads) terhadap alokasi target budget bulanan per outlet.
4. **Promo & Event**: Mengetahui promo yang sedang berjalan aktif di outlet serta promo yang akan datang.

Bot hadir dalam dua wujud:
- **Widget Chat Melayang** di dalam aplikasi `apps/marcom` (untuk tim Marcom sehari-hari).
- **Paket Alat MCP Hermes** (`/api/hermes/mcp` di `apps/marcom`) yang bisa diakses oleh profil Hermes `marcom` maupun Bot CEO (`ceo`) via Telegram & Webapp.

---

## 2. Keputusan Desain

| # | Keputusan | Rationale |
|---|---|---|
| M1 | **Database Langsung via Prisma**: Sumber data Marcom berada di PostgreSQL Coolify (`marcom_db`) yang dikelola oleh Prisma di `apps/marcom`. MCP endpoint diletakkan langsung di `apps/marcom` (`/api/hermes/mcp`) agar tidak perlu membuka koneksi database silang ke `apps/admin-dashboard`. |
| M2 | **Hermes MCP Standar SS**: Mengikuti protokol MCP Suka Shawarma: autentikasi Bearer API Key, scope `marcom`, logging ke tabel log jika diperlukan, dan membawa metadata sumber (`meta.sumber`, `meta.dihitung_pada`). |
| M3 | **Widget Chat di `apps/marcom`**: Mengadopsi pola sukses Bot HRD (`apps/HR`): tombol melayang di pojok kanan bawah, panel chat interaktif dengan dukungan format kartu & tabel suka-ui, serta tombol saran pertanyaan (quick prompts). |
| M4 | **Akses & Otorisasi**: Widget chat dapat diakses oleh semua pengguna terautentikasi di dashboard marcom (Melani, Putri Hambali, Admin, Owner, Developer). Di sisi server, permintaan chat memvalidasi sesi SSO Supabase. |
| M5 | **Larangan Data (Pagar Rem)**: Data pribadi sensitif tidak boleh dibocorkan: nomor rekening KOL (hanya status bayar & nominal rate card), password/token, dan nomor HP pribadi KOL jika tidak diminta untuk operasional mendesak. |
| M6 | **Otak AI**: Menggunakan API Server Hermes di VPS Hostinger (`/p/marcom/v1/chat/completions`), dengan fallback format respons OpenAI-compatible jika menggunakan model direct API. |

---

## 3. Daftar Alat MCP Domain `marcom`

Semua alat bersifat **read-only**, mengembalikan angka dan data faktual dari database Prisma `apps/marcom`.

| Alat | Argumen | Keluaran | Sumber Layar |
|---|---|---|---|
| `marcom_endorsement` | `status?: string` (ALL, PENDING_VISIT, PENDING_DRAFT, PENDING_POST, UNPAID), `outlet?: string`, `kol?: string` | `ringkasan`: `{ total, visit_pending, draft_pending, belum_posting, belum_bayar }`<br>`daftar[]`: `{ id, kol, outlet, schedule_date, visit_status, draft_status, post_status, payment_status, rate_card, tipe }` | `/dashboard/endorsements` |
| `marcom_konten_jadwal` | `periode?: 'hari_ini' \| 'kemarin' \| 'minggu_ini' \| 'minggu_depan' \| 'bulan_ini'`, `platform?: string` (TIKTOK, IG, dll), `outlet?: string` | `ringkasan`: `{ total, sudah_posting, belum_posting }`<br>`konten[]`: `{ id, judul, platform, pilar, format, status, tanggal_posting, jam_posting, creator, outlet, views, likes }` | `/dashboard/content-planner` |
| `marcom_ads_budget` | `bulan?: number` (1-12), `tahun?: number`, `outlet?: string` | `ringkasan`: `{ total_target_budget, total_spent, sisa_budget, persentase_terpakai }`<br>`per_outlet[]`: `{ outlet, target_budget, spent, target_kol, kol_tercapai }`<br>`ads_aktif[]`: `{ platform, outlet, budget, spent, status }` | `/dashboard/budget` & `/dashboard/ads` |
| `marcom_promo_aktif` | `tanggal?: string` (YYYY-MM-DD, default hari ini), `outlet?: string` | `promo_aktif[]`: `{ id, judul, deskripsi, outlet, tanggal_mulai, tanggal_selesai, tipe }`<br>`promo_akan_datang[]`: `{ id, judul, outlet, tanggal_mulai, tanggal_selesai }` | `/dashboard/menu/promo` |
| `marcom_analisis_konten` | `periode?: 'minggu_ini' \| 'bulan_ini' \| 'bulan_lalu' \| 'rentang'`, `dari?: string`, `sampai?: string`, `platform?: string` | `ringkasan_performa`: `{ total_konten, total_views, total_reach, total_engagement, avg_er, organik_vs_ads }`<br>`top_konten[]`: `{ id, judul, platform, views, likes, er }`<br>`per_pilar[]`: `{ pilar, jumlah, total_views, avg_er }`<br>`per_tipe_konten[]`: `{ tipe, jumlah, total_views, avg_views }`<br>`insight_singkat`: string | `/dashboard/content-planner` (Tab Metrik Data) |

---

## 4. Arsitektur Komponen

```
[ Pengguna di apps/marcom ]           [ Telegram / Webapp Bot CEO ]
          │                                        │
          ▼ (Sesi SSO)                             ▼
[ Widget Chat Melayang ]             [ VPS Hermes Gateway (ceo/marcom) ]
          │ POST /api/bot-marcom/chat              │
          ▼                                        │
[ Server apps/marcom ] ──► [ Hermes VPS ] ─────────┘
          │ (bila mode internal)  │
          │                       ▼
          │         [ MCP apps/marcom /api/hermes/mcp ]
          │                       │ (Bearer Key: scope 'marcom')
          ▼                       ▼
    [ Prisma Client @/lib/prisma (marcom_db) ]
          │
          ├── kols & endorsements
          ├── internal_contents & content_types
          ├── ads & outlet_budgets
          └── promo_events & outlets
```

---

## 5. Widget Chat Dashboard Marcom

1. **Komponen UI**:
   - `BotMarcomWidget.tsx`: Tombol launcher melayang dengan ikon robot/chat dan badge status.
   - `PanelBotMarcom.tsx`: Jendela percakapan dengan header, riwayat chat, indikator mengetik (typing indicator), dan input teks.
   - `BlokUi`: Mendukung render format kartu ringkasan dan tabel untuk menampilkan data endorsement atau konten secara rapi.
2. **Pintasan Pertanyaan Cepat (Quick Chips)**:
   - "📅 Konten apa saja yang tayang hari ini?"
   - "⭐ Endorsement mana yang draft videonya butuh review?"
   - "💰 Berapa sisa budget iklan outlet bulan ini?"
   - "🏷️ Promo apa yang sedang aktif saat ini?"
3. **Penyimpanan Sesi Percakapan**:
   - Sesi disimpan secara lokal di `localStorage` per user per hari agar chat tidak hilang saat pindah halaman di dashboard, serta dikirim dengan `X-Hermes-Session-Id` ke Hermes.

---

## 6. Rencana Implementasi Bertahap

- **Tahap 1 (Fondasi Data & Alat MCP)**:
  - Bangun modul service loader data Marcom di `apps/marcom/src/lib/hermes/`.
  - Buat 4 fungsi kalkulasi murni + unit test (TDD).
  - Buat route endpoint MCP `/api/hermes/mcp` di `apps/marcom`.
- **Tahap 2 (Widget Chat UI)**:
  - Buat server action `POST /api/bot-marcom/chat`.
  - Implementasikan komponen `BotMarcomWidget`, `PanelBotMarcom`, dan parser UI.
  - Pasang widget di layout dashboard marcom (`apps/marcom/src/app/dashboard/layout.tsx`).
- **Tahap 3 (Integrasi Hermes VPS & Uji Gerbang)**:
  - Daftarkan profil `marcom` di VPS / sambungkan MCP URL ke config Hermes.
  - Buat lembar verifikasi gerbang paritas angka dengan layar Marcom.
