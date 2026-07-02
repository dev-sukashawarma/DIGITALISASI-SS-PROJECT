# Petty Cash Hardening — Canggih, Anti-Curang, Otomatis

**Tanggal:** 2026-07-01
**App:** `apps/pos-kasir` (halaman `Kas & Shift`) + `supabase`
**Status:** Design approved (interview-driven), implementasi selesai.

## Ruang lingkup (hasil klarifikasi user)
Petty Cash = **pencatatan pengeluaran TUNAI operasional outlet** (mis. beli galon,
es batu, plastik). BUKAN rekonsiliasi kas besar / blokir penjualan.
- Blokir penjualan tunai tanpa shift → **di-skip** (permintaan user).

## Masalah pada implementasi awal
1. **Bug "Invalid Date"** — UI baca `activeShift.opened_at`/`closed_at`, tapi kolom
   tabel `shifts` bernama `start_time`/`end_time`.
2. **Anti-curang lemah:**
   - `expenses` tak punya `created_by` → tak diketahui siapa mencatat.
   - RLS `USING(true)` untuk INSERT/UPDATE/DELETE → siapa pun (authenticated) bisa
     mengubah/menghapus pengeluaran outlet mana pun.
   - Insert dari client mengirim `outlet_id` sendiri (bisa dipalsukan).

## Solusi

### Data / DB (`20260701140000_petty_cash_hardening.sql`)
- Kolom baru: `expenses.created_by` (FK `outlet_staff`).
- **RLS dikunci:** hapus policy INSERT/UPDATE/DELETE `USING(true)`; ganti:
  - INSERT: scoped ke `accessible_outlet_ids()`.
  - UPDATE/DELETE: hanya `admin`/`owner` (koreksi terkontrol). Entri kasir jadi
    **immutable** → audit utuh.
- **RPC `add_petty_cash`** (SECURITY DEFINER): resolve `outlet_id` dari
  `outlet_staff` milik `auth.uid()` (abaikan input client), stempel `created_by`,
  `expense_date = CURRENT_DATE`, `payment_source='cash_drawer'`; validasi
  kategori/nominal/keterangan. Trigger `trg_link_expense_to_shift` mengisi
  `shift_id` & menolak bila tak ada shift terbuka.

Isolasi: `admin-dashboard` hanya membaca `expenses` (tak insert/update/delete),
jadi penguncian RLS tak merusaknya. SELECT dibiarkan (sudah di-scope migrasi mitra).

### UI (`app/kasir/shift/page.tsx`)
- Perbaiki interface `Shift` → `start_time`/`end_time`; helper `formatDateTime`/
  `formatTime` yang aman (kembalikan `—` bila invalid).
- `handleAddExpense` → panggil RPC `add_petty_cash`. **Fallback**: bila RPC belum
  ada (migrasi belum di-apply) → insert langsung (perilaku lama) supaya halaman
  tak rusak.
- Daftar pengeluaran menampilkan **siapa (nama) + jam** + kategori.
- Header **Total pengeluaran hari ini** (auto-akumulasi).

## Testing / verifikasi
- `yarn build` pos-kasir ✓.
- Manual: catat petty cash → muncul di daftar dengan nama & jam; total hari ini
  bertambah; entri tak bisa diedit/hapus oleh kasir.

## Non-goals (YAGNI)
- Foto/bukti struk (dihapus atas permintaan user).
- Blokir penjualan tunai tanpa shift (di-skip atas permintaan).
- Approval berjenjang / limit nominal petty cash.
- OCR struk / auto-kategori.
