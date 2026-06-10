# Spec: QR Scan + Card-by-Card Verifikasi Penerimaan

> Date: 2026-06-10  
> Module: M3 Distribusi  
> Status: Approved

## Overview

Crew yang menerima barang di outlet scan QR code dari Surat Jalan fisik. Setelah scan, muncul antarmuka kartu per item — satu kartu satu barang — untuk konfirmasi qty terima dan kondisi. Item yang "jelek" wajib isi qty aktual + catatan. Setelah semua item dikonfirmasi, muncul ringkasan sebelum submit ke `finalize_surat_jalan_and_ledger()`.

## Scope

- Tambah QR code ke PDF Surat Jalan (encode nomor dokumen)
- Halaman scan QR baru: `/distribusi/terima/scan`
- Redesign `VerifikasiForm` jadi card-by-card stepper
- Tidak ada perubahan schema database

## Architecture

### 1. QR Code di PDF

File: `apps/distribusi/src/utils/generatePDF.ts`

- Generate QR code dari `document_number` (format: `SJ/KITCHEN/YYYYMMDD/SEQ`)
- Encode ke data URL PNG via library `qrcode` (Node-compatible, bukan `qrcode.react`)
- Embed di pojok kanan atas header PDF, ukuran 80×80px
- Label di bawah QR: nomor dokumen dalam teks

### 2. Halaman Scan QR

File baru: `apps/distribusi/src/app/distribusi/terima/scan/page.tsx`  
Komponen baru: `apps/distribusi/src/components/distribusi/QRScanner.tsx`

**Flow:**
1. Buka kamera via `getUserMedia({ video: { facingMode: 'environment' } })`
2. Decode frame via `BarcodeDetector` API (native browser, Android Chrome 83+)
3. Fallback: input manual nomor dokumen kalau `BarcodeDetector` tidak tersedia
4. Setelah QR terdeteksi → query Supabase: `SELECT id FROM surat_jalan WHERE document_number = ?`
5. Redirect ke `/distribusi/terima/[id]` verifikasi

**Error states:**
- Kamera tidak bisa diakses → tampilkan input manual
- Nomor dokumen tidak ditemukan → pesan error + retry
- SJ sudah berstatus `diterima` → redirect ke detail, bukan form verifikasi

### 3. Card-by-Card VerifikasiForm

File: `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx` (redesign)

**State:**
```typescript
type ItemVerification = {
  qty_terima: number       // default = qty_dikirim
  kondisi: 'baik' | 'jelek'
  catatan: string          // wajib jika kondisi = jelek
}

const [currentIndex, setCurrentIndex] = useState(0)
const [verifications, setVerifications] = useState<Record<string, ItemVerification>>({})
```

**Layar per item:**
- Progress bar: `currentIndex / total`
- Nama barang + kategori + satuan
- Qty dikirim (read-only referensi)
- Qty diterima (number input, default = qty_dikirim, min=0)
- Tombol **Baik** → kondisi='baik', qty_terima=qty_dikirim, lanjut item berikutnya
- Tombol **Jelek** → kondisi='jelek', tampilkan input qty aktual + textarea catatan
- Konfirmasi Jelek → lanjut item berikutnya

**Validasi:**
- Jelek wajib isi catatan (tidak boleh kosong)
- qty_terima tidak boleh melebihi qty_dikirim
- Tombol submit hanya aktif setelah semua item dikonfirmasi

**Layar ringkasan (setelah item terakhir):**
- List semua item dengan badge Baik / Jelek + qty terima
- Warning merah jika ada item jelek
- Tombol "Selesai & Simpan Verifikasi"

**Submit:**
- Update semua `surat_jalan_item` secara parallel (`Promise.all`)
- Map kondisi: `'baik'` → `kondisi='baik'`, `'jelek'` → `kondisi='rusak'` (sesuai enum existing)
- Simpan `catatan` ke kolom `catatan` (perlu cek apakah kolom sudah ada — jika belum, tambah migration)
- Call `finalize_surat_jalan_and_ledger(sj_id)`
- Redirect ke `/distribusi/terima`

### 4. Navigasi

Tambah tombol/link "Scan QR" di halaman `/distribusi/terima` (TerimaList) sebagai aksi utama, di atas list SJ yang ada.

## Schema Check

Perlu verifikasi apakah kolom `catatan` sudah ada di `surat_jalan_item`. Jika belum:

```sql
ALTER TABLE surat_jalan_item ADD COLUMN catatan TEXT;
```

Migration file: `supabase/migrations/20260610001100_add_catatan_to_surat_jalan_item.sql`

## Dependencies

- `qrcode` — generate QR PNG di PDF (sudah umum, ~50KB)
- `BarcodeDetector` — native API, tidak perlu install. Fallback: `html5-qrcode` dari CDN jika perlu support browser lama

## Out of Scope

- Push notifikasi concern ke SPV (M4)
- Barcode per item individual (bukan per SJ)
- Offline queue untuk submit verifikasi

## Files Changed

| File | Perubahan |
|------|-----------|
| `apps/distribusi/src/utils/generatePDF.ts` | Tambah QR code di header PDF |
| `apps/distribusi/src/app/distribusi/terima/scan/page.tsx` | Baru — halaman scan |
| `apps/distribusi/src/components/distribusi/QRScanner.tsx` | Baru — komponen kamera |
| `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx` | Redesign jadi stepper |
| `apps/distribusi/src/app/distribusi/terima/page.tsx` | Tambah tombol Scan QR |
| `supabase/migrations/20260610001100_add_catatan_to_surat_jalan_item.sql` | Jika kolom belum ada |
