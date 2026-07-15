# Setelan Layout Cetak Terpusat (Centralized Print Layout)

**Tanggal:** 2026-07-15
**Apps:** `apps/admin-dashboard` (hub), `apps/pos-kasir` (konsumen), `apps/distribusi` (konsumen)
**Status:** Design (disetujui — menunggu review spec)
**Menggantikan sebagian:** `2026-07-15-admin-dashboard-printer-settings-design.md` (halaman `/dashboard/printer` sudah ada & merged; kartu konfigurasi generik-nya diganti oleh desain ini).

## Tujuan

Admin bisa mengatur **layout** dari semua template cetak sistem **dari satu tempat**
(`/dashboard/printer`), dan setelan itu **benar-benar mengontrol hasil cetak asli** di
aplikasi lain. Tiga template:

1. **Struk Customer** — pos-kasir (`printReceipt.ts`, `receiptType='customer'`).
2. **Struk Dapur** — pos-kasir (`printReceipt.ts`, `receiptType='kitchen'`).
3. **QR / Surat Jalan** — distribusi (`generatePDF.ts` `printBarcode`).

## Keputusan Kunci

1. **Sumber kebenaran = 1 baris DB.** Simpan di tabel `global_settings` yang sudah ada
   (key/value JSONB), key baru **`print_layout`**. RLS existing: `SELECT` untuk semua
   `authenticated` (`USING(true)`) → semua app bisa baca saat mencetak. Tulis lewat API
   admin-dashboard (service client), sama seperti brand name/logo. **Tidak ada tabel baru.**
2. **Scope global** (satu setelan untuk 19 outlet), sejajar brand name/logo. Bukan per-outlet.
3. **Reader per-app (bukan shared package).** Tiap app punya modul kecil `printLayout.ts`
   (tipe + default + `fetchPrintLayout`). Sentralisasi ada di baris DB, bukan di kode —
   jadi duplikasi reader tak berbahaya (semua baca baris yang sama) dan kita hindari
   friksi build/deploy `@suka/*` dist yang terdokumentasi.
4. **Fallback aman = perilaku sekarang.** Nilai default tiap field = nilai hardcoded saat
   ini. Bila fetch gagal / baris `print_layout` kosong / field hilang → app pakai default →
   **hasil cetak identik dengan sekarang**. Config buruk tak akan pernah merusak cetak live.
5. **Koneksi Bluetooth tetap device-local** (localStorage + store yang sudah ada). Yang jadi
   DB-backed hanya *layout*, bukan *koneksi printer*.

## Data Model

`global_settings` row: `key = 'print_layout'`, `value` (JSONB) =

```jsonc
{
  "struk_customer": {
    "paperWidth": 58,                 // 58 | 80 (mm)
    "showLogo": true,
    "headerText": "",                 // kosong = pakai nama outlet (perilaku sekarang)
    "footerText": "Terima kasih & selamat menikmati!",
    "fontScale": "normal",            // "normal" | "besar"
    "showCashier": true,
    "showCustomer": true,
    "showItemNotes": true             // tampilkan catatan/deskripsi item
  },
  "struk_dapur": {
    "paperWidth": 58,
    "showLogo": true,
    "headerText": "STRUK DAPUR",      // judul
    "fontScale": "besar",
    "showCustomer": true
  },
  "qr_surat_jalan": {
    "paperWidth": 58,
    "showLogo": false,                // template QR sekarang tanpa logo
    "title": "VERIFIKASI SJ",
    "footerText": "Distribusi\nSuka Shawarma",
    "qrSizeMm": 45
  }
}
```

Default (fallback) di atas = nilai hardcoded sekarang. `headerText` customer: bila kosong,
template tetap render nama outlet dinamis + subtitle "Suka Shawarma" (tak berubah). Bila diisi,
override baris atas. `fontScale='besar'` menaikkan ukuran font relatif (customer 14→~18px,
escpos `size(false,true)`); dapur default sudah besar.

## Reader Module (`printLayout.ts`, per app)

Interface identik di tiap app (admin-dashboard = kanonik; pos-kasir & distribusi salin
subset yang dipakai). Isi:

- `export type PaperWidth = 58 | 80`
- `export interface CustomerLayout { ... }`, `KitchenLayout`, `QrLayout` (persis kunci JSON di atas).
- `export interface PrintLayout { struk_customer: CustomerLayout; struk_dapur: KitchenLayout; qr_surat_jalan: QrLayout }`
- `export const DEFAULT_PRINT_LAYOUT: PrintLayout` (nilai default di atas).
- `export async function fetchPrintLayout(supabase): Promise<PrintLayout>` —
  `select value from global_settings where key='print_layout'` via `.maybeSingle()`;
  deep-merge `value` di atas `DEFAULT_PRINT_LAYOUT` (per-template + per-field), sehingga
  field hilang tetap terisi default. `try/catch` → return `DEFAULT_PRINT_LAYOUT` saat error.
  Tak pernah throw.

Merge dangkal-2-level cukup (objek per-template berisi field skalar).

## Komponen per App

### 1. admin-dashboard — hub (`/dashboard/printer`)

Evolusi halaman yang sudah ada:
- **Pertahankan** kartu **Koneksi Printer** (Bluetooth) + lib `escpos-encoder`/`bluetooth-printer`/`printerStore`.
- **Ganti** kartu "Konfigurasi Cetak" + "Layout & Uji Cetak" generik dengan **3 tab**:
  **Struk Customer · Struk Dapur · QR Surat Jalan**. Tiap tab:
  - Kontrol sesuai knob template (tabel di bawah).
  - **Preview live** yang meniru template asli app terkait.
    - *Struk Customer* preview memakai **contoh order realistis**: item menu induk + catatan/deskripsi
      + baris **extra topping** (mis. `EXTRA Keju`, `EXTRA Kentang`) ter-indent seperti `isChild` di
      template asli, plus subtotal/diskon/total.
    - *Struk Dapur* preview: item tanpa harga, font besar, "STRUK DAPUR".
    - *QR* preview: kotak judul + placeholder QR (ukuran mengikuti `qrSizeMm`) + footer.
  - Tombol **Simpan** → `POST /api/settings` `{ print_layout: {...} }` (API existing, tanpa perubahan).
  - Tombol **Uji Cetak** → cetak template terkait (Bluetooth bila terhubung via escpos, else `window.print()` iframe) memakai config tab aktif.
- **Muat** config saat mount: `GET /api/settings` → `print_layout` (merge default). State lokal per-tab; simpan menulis seluruh objek `print_layout`.
- `src/lib/printer/printerConfig.ts` lama (localStorage generik) **dihapus/di-superseded**;
  `printerConfig.test.ts` diganti test untuk merge `printLayout` (lihat Testing). `buildSampleReceipt`
  dipindah/di-generalisasi jadi builder per-template untuk uji cetak escpos.

**Knob per template (UI):**

| Template | Field |
|---|---|
| Struk Customer | paperWidth, showLogo, headerText, footerText, fontScale, showCashier, showCustomer, showItemNotes |
| Struk Dapur | paperWidth, showLogo, headerText (judul), fontScale, showCustomer |
| QR Surat Jalan | paperWidth, showLogo, title, footerText, qrSizeMm |

### 2. pos-kasir — konsumen (Struk Customer + Dapur)

- Tambah `lib/printLayout.ts` (reader; template `struk_customer` + `struk_dapur`).
- `lib/printReceipt.ts` `buildReceiptHtml(d, origin, layout)` — terima param `layout`
  (opsional; default `DEFAULT_PRINT_LAYOUT[...]`) dan terapkan: `paperWidth`, `showLogo`,
  `headerText` (override), `footerText`, `fontScale`, `showCashier`, `showCustomer`,
  `showItemNotes`. `printReceipt()` fetch layout sekali (atau terima dari caller) sebelum render;
  jalur Bluetooth (`bluetooth-printer.ts printViaBluetooth`) menerima layout serupa untuk escpos
  (char width 32/48 sesuai paperWidth, size sesuai fontScale, toggle field).
- **Tak mengubah kontrak data order** — hanya presentasi. Fallback default = tampilan sekarang.

### 3. distribusi — konsumen (QR / Surat Jalan)

- Tambah `src/utils/printLayout.ts` (reader; template `qr_surat_jalan`).
- `utils/generatePDF.ts` `printBarcode(docNumber, dataUrl, layout?)` — terapkan `paperWidth`,
  `title`, `footerText`, `qrSizeMm`, `showLogo`. `SuratJalanList.tsx handlePrintBarcode` fetch
  layout lalu passing. Fallback default = tampilan sekarang.

## Alur Data

```
admin-dashboard hub ──POST /api/settings {print_layout}──▶ global_settings (service client)
                                                              │  (key='print_layout')
                          ┌───────────────────────────────────┤ SELECT (authenticated, USING true)
                          ▼                                   ▼
        pos-kasir fetchPrintLayout()            distribusi fetchPrintLayout()
        → buildReceiptHtml / escpos             → printBarcode
        (customer + dapur)                      (QR)
```

## Testing

- **Unit (tiap app punya, pure):** `fetchPrintLayout` merge — (a) baris kosong → default;
  (b) partial JSON → field hilang jatuh ke default; (c) override penuh → nilai tersimpan;
  (d) error/throw dari supabase → default (tak throw). Mock supabase `.maybeSingle()`.
- **admin-dashboard:** test builder uji-cetak per template hasilkan bytes non-kosong & beda
  saat paperWidth 58 vs 80; test `navConfig` existing tetap (item printer tak berubah).
- **pos-kasir:** test `buildReceiptHtml` — dengan layout `showItemNotes:false` catatan hilang;
  `showCashier:false` baris kasir hilang; `paperWidth:80` lebar `@page` = 80mm; extra topping
  (`isChild`) tetap render `EXTRA <nama>`.
- **distribusi:** test string HTML `printBarcode` mengandung `title`/`footerText`/`qrSizeMm`
  sesuai layout (ekstrak builder HTML jadi fungsi murni agar bisa diuji tanpa DOM).
- Verifikasi tiap app: `type-check` + `build` bersih; vitest hijau (abaikan baseline
  pre-existing tak-terkait yang sudah ada).

## Isolasi & Risiko

- **DB aditif** (hanya seed 1 key `print_layout`; opsional — app fallback bila absen). Tak ubah
  skema. Tak sentuh `@suka/*`.
- **Perubahan pos-kasir/distribusi = presentasi cetak** dengan **fallback ke perilaku sekarang** →
  risiko rendah; bila reader/DB bermasalah, cetak tetap seperti sebelumnya.
- **3 app harus redeploy** agar efek penuh terlihat (hub, pos-kasir, distribusi). Konsekuensi
  intrinsik dari "kontrol cetak asli di semua app".
- **Reader terduplikasi** → default bisa drift antar-app; dimitigasi: DB baris tunggal meng-override
  default, dan default dijaga sama persis via spec ini (nilai di atas). Bila drift jadi masalah,
  promosikan ke `@suka/print-config` belakangan.
- **Uji cetak Bluetooth** butuh perangkat fisik → smoke test manual.

## Fase Implementasi (dibangun sekaligus, tetap dipisah agar reviewable)

- **Fase 1 — admin hub + DB:** seed migration `print_layout`; `printLayout.ts` (admin); rework
  `PrinterSettingsView` jadi 3 tab + preview + save/load + uji cetak; test merge & builder.
- **Fase 2 — pos-kasir:** `printLayout.ts`; parametrisasi `printReceipt.ts` + jalur escpos; test.
- **Fase 3 — distribusi:** `printLayout.ts`; parametrisasi `printBarcode`; test.
