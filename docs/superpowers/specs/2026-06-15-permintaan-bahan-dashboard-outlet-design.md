# Spec — Permintaan Bahan, Dashboard Kondisi Outlet & Pesan Owner

**Tanggal:** 2026-06-15
**Status:** Disetujui (brainstorming)
**Konteks:** Tindak lanjut rapat dengan owner. Tiga fitur baru hasil masukan beliau.

---

## Ringkasan

Tiga fitur saling terkait:

1. **Permintaan Bahan Baku** — outlet menginisiasi permintaan (pull), kitchen pusat tetap pegang kontrol via approval.
2. **Dashboard Kondisi Outlet** — landing di portal launcher, menampilkan kondisi stok + penjualan + kehadiran outlet sendiri.
3. **Pesan dari Owner** — owner mengirim pesan (broadcast manual + otomatis berbasis target) yang tampil di dashboard outlet.

**Catatan global:** Operasional hanya **1 shift**. Semua elemen UI terkait "shift" (mis. label "Shift Pagi" di launcher) dihapus.

---

## Fitur 1 — Permintaan Bahan Baku (Outlet → Kitchen)

### Tujuan
Mengubah alur dari **push** (kitchen bikin surat jalan, outlet terima) menjadi **pull** (outlet minta), tanpa kehilangan kontrol kitchen. Model **approval-based**: permintaan = usulan, kitchen approve/edit/tolak.

### Alur
```
Crew (outlet)                 Kepala Outlet Kitchen           Sistem
─────────────                 ─────────────────────           ──────
Buka "Buat Permintaan"
  → sistem tampilkan item
    di bawah threshold
    (dari stok_balance)
  → centang + atur qty
  → submit            ──────► status: MENUNGGU
                              lihat daftar masuk
                              edit qty / tambah / kurangi item
                              approve ──────────────────────► buat DRAFT surat jalan
                                  atau tolak (+alasan)         (item & qty final)
                                                               + notif realtime ke crew
crew lihat status
+ notif realtime
```

### Aktor & aturan
- **Pembuat:** `crew` yang sedang bertugas (paling tahu kondisi lapangan).
- **Pengisian dibantu:** form otomatis menampilkan item yang stok outletnya **di bawah threshold** (dari `stok_balance` + monitoring), crew centang & sesuaikan qty. Item lain tetap bisa ditambah manual.
- **Approver:** `kepala_outlet` dari outlet **kitchen** (kitchen adalah salah satu outlet). Bisa **edit** (kurangi/tambah item & qty) sebelum approve.
- **Setelah approve:** otomatis membuat **draft surat jalan** dari item & qty final, terhubung ke permintaan (`surat_jalan_id`). Kitchen lanjut proses kirim seperti alur eksisting.
- **Notifikasi:** realtime (Supabase channel per outlet) saat status berubah → crew dapat badge/toast.

### Data model (migration baru)
- `permintaan_bahan` — `id`, `outlet_id`, `dibuat_oleh` (crew, FK outlet_staff), `status` (`menunggu`/`disetujui`/`ditolak`), `catatan_kitchen`, `surat_jalan_id` (nullable, terisi saat approve), `created_at`, `updated_at`.
- `permintaan_bahan_item` — `permintaan_id`, `bahan_baku_id`, `qty_diminta`, `qty_disetujui` (bisa beda setelah edit kitchen).
- **RPC `approve_permintaan()`** — transaksional: set status `disetujui`, tulis `qty_disetujui`, panggil pembuatan surat jalan eksisting, link `surat_jalan_id`. Versi tolak: set `ditolak` + `catatan_kitchen` (alasan).
- **RLS:**
  - crew/kepala_outlet melihat permintaan **outletnya sendiri**.
  - kepala_outlet kitchen melihat semua permintaan yang ditujukan ke kitchen.

### UI (app `stok`)
- Menu baru **"Permintaan"**.
- Crew: list permintaan outlet + form buat (item dibantu threshold).
- Kepala_outlet kitchen: list approval + modal edit qty/item → approve/tolak.
- Notif via Supabase realtime channel per outlet.

---

## Fitur 2 — Dashboard Kondisi Outlet (Portal Launcher)

### Tujuan
Staff outlet melihat kondisi outletnya sendiri (stok, penjualan, kehadiran) langsung saat login portal.

### Lokasi
Menggantikan **"Metrics Ribbon" mock** di `apps/portal/src/app/launcher/page.tsx` dengan dashboard real, di atas daftar aplikasi. Audiens: **semua staff outlet** (crew, kasir, kepala_outlet) melihat dashboard yang sama untuk outletnya. Outlet ditentukan dari `staff.outlet_id`.

### Panel (3, scoped ke outlet)
```
┌─ STOK ──────────────┬─ PENJUALAN HARI INI ─┬─ KEHADIRAN ────────┐
│ ● N kritis          │ Omzet  Rp …          │ X/Y hadir          │
│ ● N menipis         │ Transaksi  N         │ Z belum absen      │
│ ● N aman            │ Terlaris: …          │                    │
│ + N permintaan      │ vs target: …         │                    │
│   menunggu (Fitur1) │ (pesan owner)        │                    │
└─────────────────────┴──────────────────────┴────────────────────┘
```

### Sumber data — view `outlet_dashboard_spv` (security definer, per outlet)
- **Stok:** agregat dari `monitoring_view_spv` / `stok_balance` → kritis / menipis / aman + jumlah permintaan `menunggu` (nyambung Fitur 1).
- **Penjualan:** dari schema pos-kasir (sudah di-merge) → omzet, jumlah transaksi, item terlaris **hari ini** untuk outlet itu.
- **Kehadiran:** dari tabel attendance (app absensi) → jumlah hadir / total kru aktif hari ini.
- **Target & pesan:** field target omzet harian + status pencapaian (lihat Fitur 3).

### Refresh
Server-render saat buka launcher + auto/tombol refresh ringan (mirip monitoring-live). Tidak perlu realtime penuh.

### Staff global (spv/admin/owner tanpa `outlet_id`)
Versi pertama: **sembunyikan dashboard**, langsung tampilkan daftar app. (Ringkasan multi-outlet bisa nyusul.)

### Catatan teknis
Portal pakai `@suka/auth` server client; view diquery server-side di `launcher/page.tsx`, ter-scope outlet via RLS/parameter `outlet_id`.

---

## Fitur 3 — Pesan dari Owner (Owner-Dashboard → Dashboard Outlet)

### Tujuan
Owner mengirim pesan ke outlet — manual (motivasi/instruksi) maupun otomatis berbasis pencapaian target penjualan.

### Sisi owner (app `owner-dashboard`)
- **Broadcast manual:** tulis pesan + pilih tujuan (semua outlet / outlet tertentu) + aktif/nonaktif. Tampil sampai diganti/dihapus.
- **Target & pesan otomatis:** set **target omzet harian per outlet**. Tulis template pesan untuk kondisi `di_bawah_target` (motivasi) & `tercapai` (apresiasi).

### Sisi staff (panel di dashboard kondisi outlet — Fitur 2)
- Sistem bandingkan omzet hari ini vs target outlet → tampilkan pesan otomatis yang sesuai.
- **Prioritas:** broadcast manual aktif tampil **paling atas**; pesan otomatis target di bawahnya.

### Data model (migration baru)
- `owner_broadcast` — `id`, `pesan`, `target` (`all`/`outlet`), `outlet_id` (nullable), `aktif`, `dibuat_oleh`, `created_at`, `updated_at`.
- `outlet_target` — `outlet_id`, `target_omzet_harian`, `pesan_di_bawah`, `pesan_tercapai`.
- View `outlet_dashboard_spv` ditambah field target + status pencapaian + pesan berlaku.
- **RLS:** owner/admin menulis; staff membaca pesan yang berlaku untuk outletnya.

---

## Urutan Implementasi (disarankan)
1. **Fitur 1** (mengubah alur data; fondasi permintaan & link surat jalan).
2. **Fitur 2** (dashboard; mengonsumsi data stok + jumlah permintaan dari Fitur 1).
3. **Fitur 3** (pesan owner; memperluas view & panel dari Fitur 2).

## Out of scope (versi pertama)
- Push notification eksternal (cukup realtime in-app).
- Ringkasan multi-outlet untuk staff global di dashboard.
- Target mingguan/bulanan (hanya harian per outlet).
- Multi-shift.
