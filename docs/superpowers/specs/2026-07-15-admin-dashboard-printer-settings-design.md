# Pengaturan Printer — admin-dashboard

**Tanggal:** 2026-07-15
**App:** `apps/admin-dashboard`
**Status:** Design (disetujui)

## Tujuan

Menambahkan halaman **Pengaturan Printer** di admin-dashboard: mengelola koneksi
printer thermal Bluetooth (meniru stack `apps/pos-kasir`) **dan** preferensi cetak
(ukuran kertas, logo, header/footer, layout), plus uji cetak.

Fokus deliverable adalah **halaman pengaturannya sendiri**. Mewiring printer thermal
ke permukaan cetak nyata (reprint struk POS, laporan A4) **di luar scope** sesi ini —
menyusul di pass berikutnya.

## Non-Goals

- Tidak mengubah alur cetak laporan/struk yang ada (`window.print()` di `reports/*`).
- Tidak ada migration / perubahan DB. Tidak menyentuh `@suka/*` atau app lain.
- Tidak sinkronisasi lintas-perangkat (config bersifat device-local).

## Keputusan Kunci

1. **Home & akses.** Halaman baru `/dashboard/pos-admin/printer` ("Pengaturan Printer"),
   masuk grup nav **Manajemen POS**, role **ADMIN** (sama seperti "Pengaturan POS").
2. **Persistensi = localStorage (device-local).** Printer thermal terikat fisik ke satu
   perangkat; `apps/pos-kasir` sudah pakai pola ini (`saved_printer_id` di localStorage).
   Tanpa DB → perubahan terisolasi penuh, tidak menyentuh Supabase.
3. **Port kode dari pos-kasir**, tapi didekopel dari bentuk `ReceiptData` khusus POS —
   layer Bluetooth hanya tahu "kirim bytes".

## Arsitektur

Semua kode baru di bawah `apps/admin-dashboard/src/lib/printer/`:

- **`printerStore.ts`** — zustand connection state (`device`, `characteristic`,
  `isConnecting`, `error`, `setDevice`, `disconnect`, `setConnecting`, `setError`).
  Port langsung dari pos-kasir.
- **`escpos-encoder.ts`** — port langsung encoder ESC/POS pos-kasir.
- **`bluetooth-printer.ts`** — Web Bluetooth: `connectBluetoothPrinter()`,
  `autoConnectBluetoothPrinter()`, dan penulis generik `printBytes(payload: Uint8Array)`
  (chunk 256 byte + jeda antar-chunk). Dipisah dari `ReceiptData` POS.
- **`printerConfig.ts`** — tipe `PrinterConfig` + `loadConfig()` / `saveConfig()` via
  localStorage (key mis. `admin_printer_config`), dan builder murni
  `buildSampleReceipt(config): Uint8Array` untuk uji cetak.

### `PrinterConfig`

```ts
interface PrinterConfig {
  paperWidth: 58 | 80        // mm
  showLogo: boolean
  headerText: string         // baris atas struk (default nama brand)
  footerText: string         // baris bawah (default "Terima kasih")
  density: 'normal' | 'padat' // skala font/spacing
  align: 'left' | 'center'
}
```

Default aman bila localStorage kosong (58mm, showLogo true, header/footer default).

### UI — `PrinterSettingsView` (client component)

Gaya mengikuti halaman `pos-admin/settings` yang ada (kartu putih `rounded-2xl`,
aksen amber, pola toast success/error). Tiga kartu:

1. **Koneksi Printer** — status pill (nama device / "Belum terhubung"), tombol
   Connect / Disconnect, auto-connect saat mount (best-effort, silent bila gagal).
   Guard `navigator.bluetooth` tak ada → tampilkan pesan "browser tak mendukung".
2. **Konfigurasi Cetak** — radio paper width, toggle show-logo, input header/footer,
   pilihan density/align. Tombol **Simpan** → `saveConfig()` + toast.
3. **Layout & Uji Cetak** — preview HTML struk contoh memakai config aktif + tombol
   **Uji Cetak**: bila printer terhubung → `printBytes(buildSampleReceipt(config))`;
   bila tidak → fallback `window.print()` via hidden iframe (pola pos-kasir).

## Isolasi & Testing

- Perubahan: 4 file di `src/lib/printer/`, 1 halaman + 1 view, 1 baris `navConfig.ts`,
  update `navConfig.test.ts` (assert item "Pengaturan Printer" untuk ADMIN).
- Unit test kandidat (pure, tanpa DOM/Bluetooth): `printerConfig` load/save round-trip
  + default fallback; `buildSampleReceipt` menghasilkan bytes non-kosong sesuai config.
- Bluetooth & UI = smoke test manual (butuh perangkat fisik) — di luar unit test.
- Verifikasi: `yarn type-check` + `yarn build` admin-dashboard bersih; vitest hijau.

## Risiko

- Web Bluetooth hanya jalan di konteks secure (https / localhost) & Chrome/Edge.
  Halaman harus degrade rapi di browser tak didukung (kartu koneksi disabled + pesan).
- Config device-local: admin di perangkat berbeda punya setelan berbeda (disengaja).
