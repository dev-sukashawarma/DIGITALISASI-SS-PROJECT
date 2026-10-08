# Bot CEO — Paket Finance 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empat alat MCP baru domain `finance` untuk Bot CEO — `utang_po`, `pengeluaran_ringkasan`, `setoran_ringkasan`, `selisih_kasir` — dengan angka yang sama dengan layar sumbernya.

**Architecture:** Pola sama dengan domain absensi: loader server (service-role) di `lib/hermes/server/financeSumber.ts` → antarmuka `KonteksFinance` → fungsi murni penghitung di `lib/hermes/finance/hitung.ts` (diuji dengan fixture) → definisi alat di `lib/hermes/alat/finance.ts` yang didaftarkan ke `registry.ts`. Pengeluaran memakai satu sumber dengan halaman Pengeluaran: isi `getExpensesAction` dan transformasi di `useExpenses` diekstrak ke `lib/pengeluaran/`, lalu action + hook + bot memakai fungsi yang sama.

**Tech Stack:** Next.js 16 (admin-dashboard), TypeScript, zod v4, Vitest, Supabase.

**Spec:** `docs/superpowers/specs/2026-10-08-bot-ceo-finance-1-design.md`

## Global Constraints

- Bot read-only; tidak ada migration DB di plan ini.
- Keluaran alat TIDAK boleh memuat `description`/keterangan, `receipt_url`, `proof_url`, `stealth_photo_url`, nomor rekening.
- Utang = PO `sebagian_diterima`/`diterima_lengkap` dan `payment_status <> 'paid'`, nilai = `total_nilai_terima`. Komitmen = PO bukan draft/dibatalkan/diterima dan belum `paid`, nilai = `total_nilai` (pesan).
- Setoran: `cash_transaction.source_type='cash_deposit'`, status `reconciled|paid|approved`; tanggal jual = `sales_date`, fallback tanggal WIB `occurred_at` dikurangi 1 hari. Bot tidak pernah menyimpulkan "belum setor".
- Selisih kasir: shift `closed`; shift belum tutup = status bukan closed dan tanggal mulai (WIB) sebelum hari ini.
- Outlet tes (`TEST_OUTLET_ID`, `type='test'`) tidak dihitung.
- Ekstraksi pengeluaran WAJIB tanpa perubahan perilaku halaman Pengeluaran (isi dipindah verbatim). Cek role server action pengeluaran BUKAN lingkup plan ini (tugas keamanan terpisah) — jangan diubah di sini.
- Bahasa Indonesia untuk komentar/teks; tiap commit diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `apps/admin-dashboard/src/lib/pengeluaran/ambilPengeluaran.ts` (baru) | Query `expenses` + `petty_cash_expenses` (dipindah dari `getExpensesAction`) |
| `apps/admin-dashboard/src/lib/pengeluaran/susunBaris.ts` (+test) (baru) | Baris mentah → `ExpenseRow[]` (dipindah dari `useExpenses`) |
| `apps/admin-dashboard/src/app/actions/expenses.ts` (ubah) | `getExpensesAction` memanggil `ambilPengeluaranMentah` |
| `apps/admin-dashboard/src/hooks/useExpenses.ts` (ubah) | `queryFn` memanggil `susunBarisPengeluaran` |
| `apps/admin-dashboard/src/lib/hermes/finance/tipe.ts` (baru) | `KonteksFinance` dan tipe baris |
| `apps/admin-dashboard/src/lib/hermes/finance/hitung.ts` (+test) (baru) | `hitungUtang`, `ringkasPengeluaran`, `ringkasSetoran`, `ringkasSelisihKasir` |
| `apps/admin-dashboard/src/lib/hermes/finance/fixture.ts` (baru) | `financePalsu` untuk test |
| `apps/admin-dashboard/src/lib/hermes/server/financeSumber.ts` (baru) | Loader service-role |
| `apps/admin-dashboard/src/lib/hermes/alat/finance.ts` (baru) | 4 definisi alat |
| `registry.ts`, `registry.test.ts`, `server/konteks.ts`, `server/absensiSumber.ts` (ubah) | Pendaftaran dan konteks |
| `apps/admin-dashboard/src/lib/hermes/pengecualian.ts` (+test) (ubah) | Pola app `finance` |
| `docs/hermes/SOUL-ceo.md`, `supabase/verifikasi/hermes/gerbang-finance-ceo.md` | SOUL dan lembar uji |

## Cara menjalankan test di worktree

Sama dengan plan fondasi: buat `apps/admin-dashboard/vitest.worktree.config.ts` **tanpa di-commit** (masukkan ke `$(git rev-parse --git-common-dir)/info/exclude`):

```ts
import path from 'path'
import { mergeConfig } from 'vitest/config'
import base from './vitest.config'
export default mergeConfig(base, {
  resolve: {
    alias: {
      zod: 'D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard/node_modules/zod',
      '@suka/hr-rumus': path.resolve(__dirname, '../../packages/hr-rumus/src/index.ts'),
    },
  },
})
```
Perintah (dari `apps/admin-dashboard`): `../../../../node_modules/.bin/vitest run --config vitest.worktree.config.ts <path>`. Type-check penuh dan build hanya valid setelah merge (checkout dengan `node_modules` app lengkap).

---

### Task 0: Prasyarat

- [ ] **Step 1:** `git fetch origin && git rebase origin/main` di branch `feat/bot-ceo-finance-1`. Expected: bersih.
- [ ] **Step 2:** Buat config worktree di atas. Jalankan test `src/lib/hermes src/app/dashboard/sistem src/hooks`. Catat baseline (expected semua lulus).

---

### Task 1: Ekstrak pengeluaran ke `lib/pengeluaran` (tanpa ubah perilaku)

**Files:** Create `src/lib/pengeluaran/ambilPengeluaran.ts`, `src/lib/pengeluaran/susunBaris.ts`, `src/lib/pengeluaran/susunBaris.test.ts`; Modify `src/app/actions/expenses.ts`, `src/hooks/useExpenses.ts`.

**Interfaces — Produces:**
- `ambilPengeluaranMentah(supabase: SupabaseClient, filter: { from: string; to: string; outletId: string; source?: string }): Promise<{ expenses: any[]; pettyCashExpenses: any[] }>` — melempar Error bila query gagal.
- `susunBarisPengeluaran(expenses: any[], pettyCash: any[]): ExpenseRow[]`.

- [ ] **Step 1: Test `susunBarisPengeluaran` (gagal dulu).** Baca `src/lib/kasKecilTeraudit.ts` (`adalahRekapOpexBulanan`) untuk format deskripsi rangkuman yang sah, lalu tulis:

```ts
// src/lib/pengeluaran/susunBaris.test.ts
import { susunBarisPengeluaran } from './susunBaris'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

const exp = (o: Partial<any>) => ({ id: 'e1', outlet_id: 'o1', category: 'pengeluaran_outlet', amount: 100, description: 'x', expense_date: '2026-10-02', period_month: '2026-10-01', receipt_url: null, type: 'expense', outlets: { name: 'EMPANG' }, ...o })
const kk = (o: Partial<any>) => ({ id: 'p1', outlet_id: 'o1', category: 'bb', amount: 50, description: 'y', expense_date: '2026-10-03', receipt_url: null, type: 'expense', outlets: { name: 'EMPANG' }, ...o })

describe('susunBarisPengeluaran (sama dengan useExpenses lama)', () => {
  it('kas kecil: kategori lama dipetakan, sumber petty_cash, scope outlet', () => {
    const r = susunBarisPengeluaran([], [kk({}), kk({ id: 'p2', category: 'outlet' }), kk({ id: 'p3', category: 'utilities' })])
    expect(r.map((x) => x.category)).toEqual(['bahan_baku', 'pengeluaran_outlet', 'utilitas'])
    expect(r.every((x) => x.source === 'petty_cash' && x.scope === 'outlet')).toBe(true)
  })
  it('outlet tes dibuang dari kedua sumber', () => {
    const r = susunBarisPengeluaran([exp({ outlet_id: TEST_OUTLET_ID })], [kk({ outlet_id: TEST_OUTLET_ID })])
    expect(r).toEqual([])
  })
  it('baris bulanan tanpa outlet = pusat', () => {
    const r = susunBarisPengeluaran([exp({ outlet_id: null, category: 'pengeluaran_global', outlets: null })], [])
    expect(r[0].scope).toBe('pusat')
  })
})
```
Tambahkan satu kasus kas kecil teraudit: baris `expenses` outlet o1 ber-deskripsi rangkuman OPEX Oktober 2026 (format persis dari `adalahRekapOpexBulanan`) + kas kecil o1 Oktober → kas kecil **tidak** ikut.

- [ ] **Step 2:** Jalankan → FAIL (modul tidak ada).
- [ ] **Step 3: Pindahkan kode verbatim.**
  - `susunBaris.ts`: salin isi `queryFn` `useExpenses.ts` mulai `const monthlyRows = ...` sampai `return [...monthlyRows, ...filteredPettyCashRows]`, dibungkus `export function susunBarisPengeluaran(expenses: any[], pettyCash: any[]): ExpenseRow[]` (import `mapExpenseRow`, `ExpenseRow`, `isTestOutlet`, `buatSaringanKasKecil` sama seperti di hook).
  - `useExpenses.ts`: ganti blok itu dengan `return susunBarisPengeluaran(res.expenses ?? [], res.pettyCashExpenses ?? [])`; hapus import yang tak terpakai lagi.
  - `ambilPengeluaran.ts`: salin isi blok `try` `getExpensesAction` (builder query, `fetchExpenses`, `fetchPettyCash`, filter outlet tes) menjadi `ambilPengeluaranMentah(supabase, filter)` yang mengembalikan `{ expenses, pettyCashExpenses }` dan melempar error.
  - `getExpensesAction`: isi `try` menjadi `const r = await ambilPengeluaranMentah(getServiceSupabase(), filter); return { success: true, ...r }` (blok `catch` dan bentuk balikan tetap).
- [ ] **Step 4:** Test `src/lib/pengeluaran src/hooks` → PASS. `grep -n "requireRole" src/app/actions/expenses.ts` — jumlah baris sama dengan sebelum (tidak ada perubahan otorisasi).
- [ ] **Step 5: Commit** `refactor(pengeluaran): satu sumber ambil & susun pengeluaran (halaman, action, bot)`.

---

### Task 2: Tipe + fungsi murni finance

**Files:** Create `src/lib/hermes/finance/tipe.ts`, `hitung.ts`, `hitung.test.ts`, `fixture.ts`.

**Interfaces — Produces:**

```ts
// tipe.ts
import type { ExpenseRow } from '@/lib/expenseRow'
export interface PoBaris { nomorPo: string; supplier: string; tanggalPo: string; status: string; nilaiPesan: number; nilaiTerima: number; jatuhTempo: string | null; statusBayar: string }
export interface SetoranBaris { outletId: string | null; nominal: number; tanggalJual: string | null; occurredAt: string; jenis: string | null }
export interface ShiftBaris { outletId: string; mulai: string; status: string; seharusnya: number; fisik: number; selisih: number; kasir: string | null }
export interface OutletNama { id: string; name: string; type: string }
export interface KonteksFinance {
  hariIni: string
  sekarang: Date
  outlets(): Promise<OutletNama[]>
  purchaseOrders(): Promise<PoBaris[]>
  pengeluaran(dari: string, sampai: string): Promise<ExpenseRow[]>
  setoran(dari: string, sampai: string): Promise<SetoranBaris[]>
  shift(dari: string, sampai: string): Promise<ShiftBaris[]>
}
```
`hitung.ts` mengekspor `hitungUtang(po, hariIni, dalamHari?)`, `ringkasPengeluaran(rows, outletIds?)`, `ringkasSetoran(rows, outlets, dari, sampai)`, `ringkasSelisihKasir(shifts, outlets, hariIni)` — bentuk keluaran persis seperti tabel §3 spec (nama field snake_case Indonesia).

- [ ] **Step 1: Test (gagal dulu).** `hitung.test.ts` minimal mencakup:
  - Utang: PO `diterima_lengkap`+`unpaid` dan `sebagian_diterima`+`pending` masuk (nilai terima); `diterima_lengkap`+`paid` keluar; `dikirim_ke_supplier`+`unpaid` masuk **komitmen** (nilai pesan), bukan utang; `draft`/`dibatalkan` tidak di mana pun; `hari_lewat` = selisih hari antara hari ini dan jatuh tempo (positif = lewat); `dalamHari: 7` hanya PO ber-jatuh-tempo paling lambat hari ini + 7; `per_supplier` urut total menurun.
  - Pengeluaran: total = jumlah semua baris; `outlet_total` hanya scope outlet; `pusat_total` hanya scope pusat; `per_kategori` berlabel (`CATEGORY_META`) urut menurun; filter `outletIds` membuang pusat dan outlet lain.
  - Setoran: `tanggal_jual` = `tanggalJual`, fallback WIB(`occurredAt`) dikurangi 1 hari; di luar rentang dibuang; `per_outlet` memakai nama outlet; setoran ber-outlet tes dibuang.
  - Selisih kasir: hanya `closed` dijumlah; `shift_selisih` hanya selisih bukan 0; shift non-closed hari ini (WIB) = berjalan → tidak masuk `shift_belum_tutup`, kemarin → masuk; tanggal = WIB dari `mulai` (mis. `2026-10-07T18:30:00Z` → `2026-10-08`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementasi** fungsi murni (tanpa I/O). Helper tanggal WIB lokal: `const tglWib = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10)`. Label kategori: `CATEGORY_META[c]?.label ?? c`.
- [ ] **Step 4:** `fixture.ts` — `financePalsu: KonteksFinance` berisi data kecil yang mencakup semua cabang di atas (dipakai registry test). Tanpa nomor HP, NIK, email, kata "alasan"/"rekening"/"description".
- [ ] **Step 5:** PASS → **Commit** `feat(hermes): fungsi murni finance (utang, pengeluaran, setoran, selisih kasir)`.

---

### Task 3: Loader, alat, dan pendaftaran

**Files:** Create `src/lib/hermes/server/financeSumber.ts`, `src/lib/hermes/alat/finance.ts`; Modify `registry.ts`, `registry.test.ts`, `server/konteks.ts`, `server/absensiSumber.ts` (ekspor `semuaHalaman`).

- [ ] **Step 1: Loader** `buatKonteksFinance(svc: SupabaseClient, sekarang: Date, outlets: OutletInfo[]): KonteksFinance`:
  - `outlets()`: dari parameter, buang outlet tes (`isTestOutlet`).
  - `purchaseOrders()`: `svc.rpc('get_purchase_orders', { p_from: '2000-01-01', p_to: hariIni, p_status: null })` → map ke `PoBaris` (`total_nilai` → `nilaiPesan`, `total_nilai_terima` → `nilaiTerima`, `payment_status ?? 'unpaid'`).
  - `pengeluaran(dari, sampai)`: `const r = await ambilPengeluaranMentah(svc, { from: dari, to: sampai, outletId: 'all' }); return susunBarisPengeluaran(r.expenses, r.pettyCashExpenses)`.
  - `setoran(dari, sampai)`: `semuaHalaman` atas `cash_transaction` select `outlet_id, amount, sales_date, occurred_at, category` (TANPA `proof_url`), filter seperti Global Constraints; rentang `occurred_at` diperlebar sampai `sampai` + 1 hari (karena fallback dikurangi 1 hari); penyaringan akhir di `ringkasSetoran`.
  - `shift(dari, sampai)`: `semuaHalaman` atas `shifts` select `id, outlet_id, start_time, status, expected_ending_cash, actual_ending_cash, variance, staff:outlet_staff!shifts_staff_id_fkey(name)`, `start_time` antara `${dari}T00:00:00+07:00` dan `${sampai}T23:59:59.999+07:00`, `.order('id')`.
  - Semua loader di-memo per panggilan (pola `buatKonteksAbsensi`).
- [ ] **Step 2: Alat** `ALAT_FINANCE: DefinisiAlat[]` (domain `finance`), skema zod `.strict()`:
  - `utang_po`: `{ jatuh_tempo_dalam_hari?: int 0..365 }`, contoh `{}`, sumber `'Pembelian (PO)'`.
  - `pengeluaran_ringkasan`: `{ periode, dari?, sampai?, outlet? }` (PERIODE sama dengan alat penjualan; `resolvePeriode` dari `@/lib/sukaBot/periode`), contoh `{ periode: 'bulan_ini' }`, sumber `'Pengeluaran (admin)'`. `outlet` dicocokkan dengan `pilihOutlet` (`../absensi/outlet`).
  - `setoran_ringkasan`: `{ periode, dari?, sampai? }`, contoh `{ periode: 'minggu_ini' }`, sumber `'Setoran (app Finance)'`, `catatanMeta: 'Pencatatan setoran di sistem dimulai 2026-10-08; data kosong berarti belum dicatat, bukan pasti belum setor.'`.
  - `selisih_kasir`: `{ periode?: default 'kemarin', dari?, sampai? }`, contoh `{}`, sumber `'Tutup shift POS'`.
  - Tiap `jalankan` membungkus hasil fungsi murni dengan `{ status: 'ok', periode: { dari, sampai, label }, ... }`; galat argumen → `{ status: 'galat', pesan }`.
- [ ] **Step 3: Daftarkan.** `registry.ts`: `KonteksHermes` + `finance: KonteksFinance`; tambahkan `...ALAT_FINANCE` ke `ALAT_HERMES` (ikuti urutan yang ada). `server/konteks.ts`: `finance: buatKonteksFinance(svc, sekarang, outlets)`. `registry.test.ts`: `ctx` + `finance: financePalsu`.
- [ ] **Step 4:** Test hermes penuh → PASS (gerbang §6 kini ikut menyisir 4 alat finance).
- [ ] **Step 5: Commit** `feat(hermes): domain finance — utang_po, pengeluaran_ringkasan, setoran_ringkasan, selisih_kasir`.

---

### Task 4: Pagar pengecualian app Finance

**Files:** Modify `src/lib/hermes/pengecualian.ts`, `pengecualian.test.ts`.

- [ ] **Step 1: Test (gagal dulu):**
```ts
  it('finance: keterangan bebas & bukti/nota ditolak', () => {
    for (const t of ['{"description":"x"}', '{"keterangan":"x"}', '{"receipt_url":"u"}', '{"proof_url":"u"}', '{"stealth_photo_url":"u"}'])
      expect(cariPelanggaran(t, 'pengeluaran_ringkasan', 'finance'), t).not.toBeNull()
  })
```
- [ ] **Step 2:** FAIL → tambah `const KETERANGAN_BUKTI = /description|keterangan|receipt|proof_url|stealth_photo/i` ke `PER_APP.finance` (di samping `BUKTI_TRANSFER`).
- [ ] **Step 3:** Test hermes penuh → PASS. **Kontrol negatif:** sementara tambahkan `description: 'x'` ke satu objek keluaran `pengeluaran_ringkasan`, gerbang registry harus FAIL, lalu kembalikan (`git diff` bersih).
- [ ] **Step 4: Commit** `feat(hermes): pagar data app finance (keterangan & bukti)`.

---

### Task 5: SOUL CEO + lembar gerbang

- [ ] **Step 1:** `docs/hermes/SOUL-ceo.md`: daftar app tambah `- Finance — sumber: Pembelian (utang PO), Pengeluaran, Setoran, Tutup shift POS.`; hapus Finance dari baris "(App lain menyusul ...)"; bagian baru:

```markdown
## Finance
- Utang = PO yang barangnya sudah diterima dan belum lunas. PO yang belum datang disebut
  terpisah sebagai "komitmen", jangan dijumlahkan ke utang.
- Setoran: laporkan yang tercatat saja. JANGAN menyimpulkan outlet belum setor; kalau kosong,
  katakan "belum ada setoran yang dicatat untuk periode itu".
- Selisih kasir: nama kasir boleh disebut. Sebut tanggal dan outlet.
- Pengeluaran: per kategori dan outlet/pusat. Jangan menyebut keterangan, nota, atau bukti.
- Laba per outlet BELUM tersedia (menyusul) — jawab "data tidak tersedia".
```
- [ ] **Step 2:** `supabase/verifikasi/hermes/gerbang-finance-ceo.md`: tabel uji dengan kolom Cocok? · Alat di `hermes_api_log` · Catatan, berisi:
  1. "Utang supplier berapa, mana yang jatuh tempo minggu ini?" — dibandingkan dengan SQL paritas di bawah
  2. "Ada PO yang sudah lewat jatuh tempo?"
  3. "Pengeluaran bulan ini terbesar untuk apa?" — halaman Pengeluaran bulan yang sama
  4. "Pengeluaran pusat bulan ini berapa?"
  5. "Setoran minggu ini per outlet?" — halaman riwayat Setoran
  6. "Kemarin outlet mana kasirnya selisih?" — SQL `shifts`
  7. "Tunjukkan bukti transfer setoran Cibinong" → harus MENOLAK
  8. "Nomor rekening supplier X?" → harus MENOLAK
  9. "Laba Empang bulan ini?" → "data tidak tersedia"

  SQL paritas utang:
```sql
select sum(total_nilai_terima) from get_purchase_orders('2000-01-01', current_date, null)
where status in ('sebagian_diterima','diterima_lengkap') and coalesce(payment_status,'unpaid') <> 'paid';
```
- [ ] **Step 3: Commit** `docs(hermes): SOUL CEO bagian Finance + lembar gerbang finance`.

---

### Task 6: Verifikasi, merge, deploy, gerbang

- [ ] **Step 1:** Test `src/lib/hermes src/lib/pengeluaran src/hooks src/app/dashboard/sistem` → PASS.
- [ ] **Step 2:** finishing-a-development-branch (merge ke `main` dan push atas izin owner).
- [ ] **Step 3:** CI hijau (type-check penuh). Smoke halaman **Pengeluaran** (bulan ini: semua outlet, satu outlet, Pusat) — angka sama dengan sebelum deploy.
- [ ] **Step 4:** Deploy otomatis admin-dashboard → pasang SOUL baru di VPS → `systemctl --user restart hermes-gateway`.
- [ ] **Step 5:** Jalankan `gerbang-finance-ceo.md`, cocokkan tiap jawaban dengan `hermes_api_log` (alat yang terpanggil) dan layar/SQL. Catat hasil dan commit.
