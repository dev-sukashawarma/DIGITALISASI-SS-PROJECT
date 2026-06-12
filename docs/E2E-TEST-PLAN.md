# E2E Test Plan — Stok & Distribusi (Staging Vercel)

> Disusun berdasarkan flow aktual kedua app. Target = yang harus lolos.
> Critical Point = titik paling rawan yang wajib diawasi.
>
> **Staging URL:**
> - Stok: `digitalisasi-ss-project-stok.vercel.app`
> - Distribusi: (isi setelah deploy)
>
> Branch staging: `feat/transfer-suggestion`

---

## 📌 Catatan Deployment Staging (Vercel)

### Konfigurasi wajib per Vercel project
- **Branch tracking:** Production → `feat/transfer-suggestion` (bukan `main`).
- **Root Directory:** stok = `apps/stok`, distribusi = `apps/distribusi`.
- **Build:** `vercel.json` build `@suka/design-system` dulu (folder `dist/` di-gitignore, jadi harus di-build saat deploy).
- **`output: 'export'`** dikontrol env `STATIC_EXPORT`. Di Vercel **TIDAK** di-set (pakai SSR). Untuk build cPanel production set `STATIC_EXPORT=true` → hasilkan folder `out/`.

### Environment Variables
Set di **kedua** project (Production + Preview):

| Key | Catatan |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | wajib |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | wajib |
| `NEXT_PUBLIC_STOK_URL` | URL domain Vercel app stok, mis. `https://digitalisasi-ss-project-stok.vercel.app` |
| `NEXT_PUBLIC_DISTRIBUSI_URL` | URL domain Vercel app distribusi |

> ⚠️ `NEXT_PUBLIC_*` di-inline saat build → **wajib redeploy** setiap ubah nilainya.

### ⚠️ Isu Cross-App Navigation (`getCrossAppUrl`)
- Link cross-app **stok → `/distribusi/terima`** (di dashboard, ledger, opname, CrewDashboard) dulunya return path **relatif** → 404 di Vercel karena dua app beda domain.
- **Fix:** `getCrossAppUrl` sekarang pakai `NEXT_PUBLIC_STOK_URL` / `NEXT_PUBLIC_DISTRIBUSI_URL` (domain absolut) kalau di-set; fallback ke path relatif untuk cPanel (subdomain + reverse proxy).
- **Konsekuensi:** kalau env var di atas belum di-set di Vercel, tombol "Terima Kiriman" dari app stok akan 404. Lihat test **#9.5**.

### 🐞 Open Item — Dynamic detail routes di cPanel static export
- Route detail UUID dinamis: `/stok/monitoring-live/[outlet-id]`, `/stok/ledger/[id]`, `/stok/opname/[id]`.
- Di **Vercel (SSR)** sudah jalan (dilayani on-demand). `dynamicParams=false` dihapus karena bikin 404 di SSR.
- Di **cPanel (`STATIC_EXPORT=true`)** route ini **belum bisa** — static export tak bisa generate halaman untuk UUID arbitrer tanpa daftar id saat build. Perlu pendekatan lain (mis. query-param `?id=`, atau pre-list id). **Belum dikerjakan.**

### 🔒 Keamanan — JANGAN commit / set di Vercel
- **`SUPABASE_SERVICE_ROLE_KEY` HARUS DIHAPUS** dari env vars Vercel (bypass semua RLS, bahaya di static/client app). Sisakan hanya `anon key`.
- File `.env.local` jangan ke-commit (sudah di `.gitignore`).

---

## 🔐 0. Auth & Akses (kedua app)

| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 0.1 | Login dengan kredensial valid | Redirect ke `/dashboard` sesuai role | Session tersimpan, tidak loop balik ke login |
| 0.2 | Akses `/dashboard` tanpa login | Ditolak → redirect `/login` | **AuthGuard** jalan di semua route |
| 0.3 | Login sebagai **crew** | Hanya lihat outlet sendiri | **RLS `ledger_read`** — crew TIDAK boleh lihat outlet lain |
| 0.4 | Login sebagai **SPV** | Lihat semua 19 outlet | View definer bypass RLS berfungsi |
| 0.5 | Klik **KELUAR** | Session habis, balik login | Token benar-benar di-clear |

---

## 📦 APP STOK

### 1. Dashboard & Monitoring
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 1.1 | Buka dashboard (crew) | Saldo stok real-time tampil, hitungan benar | Angka cocok dengan `stok_balance` |
| 1.2 | Filter status KRITIS/WARNING/READY | Item ter-filter benar | Threshold reorder point akurat |
| 1.3 | Buka `/stok/monitoring-live` (SPV) | Grid 18 outlet + Kitchen panel + Top-3 kritis | Data semua outlet muncul (bukan 1 outlet) |
| 1.4 | Klik card outlet → detail | Route `/monitoring-live/[outlet-id]` buka, breakdown item tampil | **Dynamic route static export** jalan di Vercel |
| 1.5 | Diamkan papan beberapa menit | Auto-refresh data | Polling/refresh tidak bocor memory |

### 2. Opname
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 2.1 | Buat opname baru, isi counted qty | Tersimpan, selisih dihitung | `diff = counted - system` benar |
| 2.2 | Submit opname dengan selisih | Ledger `opname_selisih` terbentuk | **Saldo ter-update sesuai selisih** |
| 2.3 | Buka riwayat opname → detail `[id]` | Breakdown item + selisih tampil | Dynamic route load data client-side OK |

### 3. Ledger
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 3.1 | Entri manual (pemakaian/waste/adjustment) | Ledger signed benar (qty<0 outflow) | **Saldo sebelum→sesudah konsisten** |
| 3.2 | Buka ledger list | Mutasi terbaru tampil, sorted | Pagination/limit jalan |
| 3.3 | Klik baris → detail `[id]` | Detail mutasi lengkap | Referensi shipment/opname ter-link |

### 4. Transfer Suggestion ⭐ (fitur branch ini)
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 4.1 | Outlet A surplus + B kritis item sama | Muncul di TransferSuggestionPanel | **Logika match surplus↔kritis akurat** |
| 4.2 | Buka TransferModal dari suggestion | Form transfer ter-prefill benar | Qty saran masuk akal |
| 4.3 | Eksekusi transfer | Ledger `transfer_keluar` (A) + `transfer_masuk` (B) | **Dua ledger seimbang, saldo dua outlet benar** |

---

## 🚚 APP DISTRIBUSI

### 5. Surat Jalan (Pusat → Outlet)
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 5.1 | Buat surat jalan baru, pilih outlet + item + qty | Tersimpan, status `dikirim` | No surat jalan unik |
| 5.2 | Buka detail surat jalan `[id]` | **QR code ter-generate** | QR encode shipment id valid |
| 5.3 | Lihat list surat jalan | Semua kiriman tampil per status | Filter status benar |

### 6. Terima Kiriman ⭐ (two-way verification)
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 6.1 | Scan QR di `/terima/scan` | QRScanner baca → buka verifikasi | **Kamera permission** di Vercel (HTTPS wajib) |
| 6.2 | Input kode OTP verifikasi | Kode cocok → lanjut | **Lockout setelah salah berkali** |
| 6.3 | Isi qty diterima (VerifikasiForm) | Selisih dihitung vs qty dikirim | `diff` akurat, foto bukti ke-upload |
| 6.4 | Tanda tangan (SignatureFlow) | Signature canvas tersimpan | **Signature ter-upload ke Storage** |
| 6.5 | Submit penerimaan | Status → `diterima_lengkap`/`selisih_dicatat` | Transisi status benar |

### 7. Integrasi M3 → M2 ⭐⭐ (PALING KRITIS)
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 7.1 | Setelah terima kiriman terverifikasi | Ledger `terima_kiriman` muncul di **app stok** | **Qty terverifikasi → stok masuk otomatis** |
| 7.2 | Cek saldo stok outlet setelah terima | Saldo naik sesuai qty diterima (bukan qty dikirim) | **Selisih tidak ikut nambah stok** |
| 7.3 | Kiriman ditolak/rejected | Ledger `rejected_kiriman` terbentuk | Stok TIDAK bertambah |

### 8. Riwayat
| # | Skenario | Target | Critical Point |
|---|----------|--------|----------------|
| 8.1 | Buka riwayat → detail `[id]` | Histori penerimaan + signature + foto | Dynamic route + data lengkap |

---

## 🌐 9. Cross-cutting (wajib dicek di staging)

| # | Area | Critical Point |
|---|------|----------------|
| 9.1 | **Offline** | OfflineIndicator muncul saat koneksi putus; offline-queue antri & flush saat online |
| 9.2 | **Mobile** | Distribusi dipakai di HP — BottomNav, kamera, signature works di layar kecil |
| 9.3 | **HTTPS-only** | Kamera QR & getUserMedia hanya jalan di HTTPS (Vercel OK, pastikan) |
| 9.4 | **RLS leak** | Inspect Network — pastikan response tidak bocor data outlet lain |
| 9.5 | **Cross-app nav** | Link stok ↔ distribusi (`getCrossAppUrl`) arahkan ke domain Vercel yang benar, bukan localhost |

---

## 🎯 Prioritas Eksekusi (kalau waktu mepet sebelum demo)

1. **P0 (blocker):** 0.1–0.4 (auth+RLS), 7.1–7.2 (integrasi M3→M2), 6.1–6.5 (terima kiriman)
2. **P1 (core):** 1.x monitoring, 2.x opname, 5.x surat jalan
3. **P2 (fitur baru):** 4.x transfer suggestion, 3.x ledger
4. **P3 (polish):** 9.x cross-cutting, 8.x riwayat

---

## ⚠️ 3 Titik Paling Rawan (test paling awal)

- **#7.1–7.2** — Integrasi distribusi→stok. Jantung sistem; kalau qty terverifikasi tidak masuk ledger stok, value proposition gugur.
- **#9.5** — `getCrossAppUrl` kemungkinan masih hardcode `localhost:3001/3002`. Di Vercel domain beda → link antar-app rusak.
- **#9.3 / #6.1** — Kamera QR butuh HTTPS + permission. Test di HP asli, bukan cuma desktop.
