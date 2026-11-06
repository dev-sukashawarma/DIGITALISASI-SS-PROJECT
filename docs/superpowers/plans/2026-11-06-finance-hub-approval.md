# Hub Approval Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu halaman `/approval` di app finance tempat admin finance memutuskan semua pengajuan (petty cash, serah ke AM, approval PO, bayar vendor, dana kantor), sementara halaman lama kehilangan tombol keputusannya.

**Architecture:** Fungsi murni di `src/lib/approval/hub.ts` mengubah data tiap sumber menjadi `HubItem` seragam, mengurutkan, dan menghitung. Hook `useHubApproval` memanggil hook sumber yang sudah ada (plus satu kueri petty cash baru) dan menggabungkan hasilnya. Halaman `/approval` merender daftar dan membuka modal yang sudah ada (dipindah ke `src/components/approval/` bila sekarang inline). Semua tulis tetap lewat RPC/server action yang ada.

**Tech Stack:** Next.js app router, TypeScript, TanStack Query, Supabase JS, Vitest (jsdom), Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-06-finance-hub-approval-design.md`

## Global Constraints

- Nol migration, nol RPC baru, nol perubahan aturan uang (rekening sumber, bukti wajib, cek saldo tetap di modal & RPC yang ada).
- Perubahan hanya di `apps/finance` dan `apps/admin-dashboard/src/app/dashboard/pos-admin/petty-cash/`.
- Rute `/approval`, menu "Hub Approval", item pertama grup "Kas" di `CashLayout.tsx`.
- Yang memakai hub: `isChecker` dari `useFinanceRole` (owner, admin, admin_finance, developer). Purchasing tidak mendapat hub.
- Tolak wajib alasan (string ter-trim tidak kosong) untuk semua jenis kecuali "Serahkan ke AM" (tanpa Tolak).
- Ambang "lama" = konstanta `AMBANG_LAMA_JAM = 24`.
- Kosong: teks persis `Tidak ada pengajuan yang menunggu`.
- Teks tautan di halaman lama: `Putuskan di Hub Approval`.
- Jangan `select` mentah tanpa batas baru selain yang dirinci di Task 3 (cap 1.000 baris PostgREST).
- Kerja di worktree sendiri (branch `feat/hub-approval-finance`); checkout utama dipakai sesi lain. **Jangan** pasang junction `node_modules` lalu menjalankan `yarn` di worktree (memangkas `node_modules` repo utama); jalankan alat lewat `node_modules/.bin` root atau `yarn install --frozen-lockfile --ignore-engines` di root worktree.

## Review Focus

1. **Satu sumber gagal dibaca** (mis. developer ditolak `PERAN_KEUANGAN` di dana kantor) → sumber lain tetap tampil, chip sumber itu menunjukkan `!` dan pesan galat, badge tidak menghitungnya sebagai 0 diam-diam. Diuji di Task 1 (`gabungSumber`).
2. **Pengajuan sudah diputuskan di tab/perangkat lain** → RPC menolak, toast menampilkan pesan RPC, daftar disegarkan (invalidate) sehingga barisnya hilang. Diuji manual di Task 8 (langkah 4).
3. **Petty cash baru di-Acc** → barisnya berganti jadi "Serahkan ke AM", tidak hilang dari hub. Diuji di Task 1 (`itemDariPettyCash` per status) dan manual Task 8.
4. **Alasan tolak berisi spasi saja** → tombol konfirmasi tetap mati. Diuji di Task 2.
5. **Badge ≠ isi daftar** (sumber hitung berbeda dari sumber daftar) → badge dihitung dari kueri dengan filter yang sama persis dengan daftar. Diuji di Task 1 (`hitungPerJenis`) + manual Task 8.

---

### Task 1: Model hub murni

**Files:**
- Create: `apps/finance/src/lib/approval/hub.ts`
- Test: `apps/finance/src/lib/approval/hub.test.ts`
- Juga commit: spec & plan ini (`docs/superpowers/specs/2026-11-06-finance-hub-approval-design.md`, `docs/superpowers/plans/2026-11-06-finance-hub-approval.md`) — salin dari checkout utama ke worktree.

**Interfaces:**
- Consumes: `PettyCashTopup` (`@/lib/types`), `PendingPo` (`@/hooks/usePoApproval`, ditambah field `updated_at: string` di Task 3), `PayablePo`, `TxBayarPo` (`@/hooks/useSupplierSettlement`), `OfficeVoucher` (`@/lib/officeVoucher`).
- Produces:
  ```ts
  export type HubJenis = 'petty_cash' | 'serah_am' | 'po' | 'bayar_vendor' | 'dana_kantor'
  export const URUTAN_JENIS: HubJenis[] // ['petty_cash','serah_am','po','bayar_vendor','dana_kantor']
  export const JENIS_LABEL: Record<HubJenis, string>
  //   petty_cash 'Petty cash', serah_am 'Serahkan ke AM', po 'Approval PO',
  //   bayar_vendor 'Bayar vendor', dana_kantor 'Dana kantor'
  export const AMBANG_LAMA_JAM = 24
  type Dasar = { key: string; id: string; judul: string; keterangan: string; nominal: number; menungguSejak: string; detailHref: string | null }
  export type HubItem = Dasar & (
    | { jenis: 'petty_cash' | 'serah_am'; data: PettyCashTopup }
    | { jenis: 'po'; data: PendingPo }
    | { jenis: 'bayar_vendor'; data: PayablePo }
    | { jenis: 'dana_kantor'; data: OfficeVoucher })
  export function itemDariPettyCash(t: PettyCashTopup): HubItem | null
  export function itemDariPo(p: PendingPo): HubItem
  export function itemDariBayarVendor(p: PayablePo, tx?: TxBayarPo): HubItem | null
  export function itemDariVoucher(v: OfficeVoucher): HubItem | null
  export function urutkanHub(items: HubItem[]): HubItem[]
  export function hitungPerJenis(items: HubItem[]): Record<HubJenis, number>
  export function isLama(menungguSejak: string, now: Date, ambangJam?: number): boolean
  export type SumberHasil = { jenis: HubJenis[]; items: HubItem[]; isLoading: boolean; error: unknown }
  export function gabungSumber(sumber: SumberHasil[]): { items: HubItem[]; galat: HubJenis[]; isLoading: boolean }
  ```
  `key` = `${jenis}:${id}`. Aturan pemetaan:
  - petty cash: `status === 'forwarded_to_finance'` → `petty_cash`; `'approved_by_finance'` → `serah_am`; selain itu `null`. `judul` = `t.outlet?.name ?? '-'`, `keterangan` = pengaju (`outlet_staff?.name`) + alasan dipotong, `nominal` = `t.amount`, `menungguSejak` = `t.created_at`, `detailHref` = `null`.
  - PO: `judul` = `supplier_nama`, `keterangan` = `nomor_po`, `nominal` = `total`, `menungguSejak` = `updated_at`, `detailHref` = `/pembelian/${id}`.
  - Bayar vendor: hanya `payment_status === 'pending'`; `keterangan` = `nomor_po` + `tx?.pengaju`; `menungguSejak` = `tx?.created_at ?? tanggal_po`; `detailHref` = `/pembelian/${id}`.
  - Voucher: hanya `status === 'waiting_verification'`; `judul` = `${division} · ${recipientName}`, `keterangan` = `voucherNumber` + `reason`, `nominal` = `realizedAmount ?? advanceAmount`, `menungguSejak` = `createdAt`, `detailHref` = `/pengeluaran/kantor`.
  - `urutkanHub`: `menungguSejak` naik (paling lama di atas), seri → `key` naik.
  - `gabungSumber`: sumber dengan `error` → semua `jenis`-nya masuk `galat`, `items`-nya diabaikan; `isLoading` = ada sumber yang loading; `items` hasil `urutkanHub`.

- [ ] **Step 1: Buat worktree** — pakai superpowers:using-git-worktrees, branch `feat/hub-approval-finance` dari `main`; salin spec & plan ke worktree.
- [ ] **Step 2: Tulis test gagal** di `hub.test.ts`:
  - `itemDariPettyCash` → `forwarded_to_finance` jadi `jenis 'petty_cash'`, `approved_by_finance` jadi `'serah_am'`, `rejected`/`forwarded_by_finance`/`completed` jadi `null`.
  - `itemDariBayarVendor` → `payment_status 'unpaid'` dan `'paid'` → `null`; `'pending'` dengan `tx.created_at = '2026-11-05T10:00:00Z'` → `menungguSejak` itu; tanpa tx → `tanggal_po`.
  - `itemDariVoucher` → hanya `waiting_verification`; `nominal` memakai `realizedAmount` bila ada (750000) bukan `advanceAmount` (1000000).
  - `urutkanHub` → item 3 hari lalu di atas item 2 jam lalu lintas jenis.
  - `hitungPerJenis` → `{ petty_cash: 2, serah_am: 1, po: 0, bayar_vendor: 1, dana_kantor: 0 }` untuk masukan campuran; semua kunci selalu ada.
  - `isLama('2026-11-05T09:00:00Z', new Date('2026-11-06T10:00:00Z'))` → `true`; selisih 23 jam → `false`.
  - `gabungSumber` → sumber dana kantor ber-`error` → `galat` = `['dana_kantor']`, items sumber lain tetap ada & terurut.
- [ ] **Step 3: Jalankan** `cd apps/finance && yarn vitest run src/lib/approval/hub.test.ts` → FAIL (modul belum ada).
- [ ] **Step 4: Implementasi** `hub.ts` sesuai Interfaces.
- [ ] **Step 5: Jalankan ulang** → PASS.
- [ ] **Step 6: Commit** spec + plan + `hub.ts` + test: `feat(finance): model hub approval murni`.

### Task 2: Jendela alasan tolak & alasan petty cash tersimpan

**Files:**
- Create: `apps/finance/src/components/approval/AlasanTolakModal.tsx`
- Test: `apps/finance/src/components/approval/AlasanTolakModal.test.tsx`
- Create: `apps/finance/src/lib/approval/deskripsiPettyCash.ts` (+ `deskripsiPettyCash.test.ts`)
- Modify: `apps/finance/src/app/actions/pettyCash.ts:98-110` (bangun `newDescription` lewat fungsi baru)
- Modify: `apps/finance/src/hooks/usePettyCash.ts` (`useProcessPettyCashFinance`: kirim `approvalNote` juga saat `reject` — sudah ada di FormData, cukup pastikan dipakai)

**Interfaces:**
- Produces:
  ```ts
  // AlasanTolakModal.tsx
  export function AlasanTolakModal(props: {
    isOpen: boolean; judul: string; onClose: () => void
    onKonfirmasi: (alasan: string) => Promise<void>   // alasan sudah di-trim
    isPending?: boolean
  }): JSX.Element | null
  // deskripsiPettyCash.ts
  export function deskripsiPettyCash(input: {
    deskripsiAwal: string; action: 'approve' | 'reject'
    nominalDiajukan: number; nominalDisetujui?: number; catatan?: string | null
  }): string
  ```
  `deskripsiPettyCash` untuk `approve` = persis tiga cabang yang ada sekarang di `pettyCash.ts:99-110`; untuk `reject` dengan catatan = `${deskripsiAwal}\n\n[Ditolak Finance: ${catatan.trim()}]`; tanpa catatan = `deskripsiAwal`. RPC `finance_process_petty_cash_custom` sudah menulis `p_description` pada `reject` (dicek ke DB 6 Nov), jadi tanpa migration.

- [ ] **Step 1: Tulis test gagal**
  - `AlasanTolakModal`: textarea kosong atau `'   '` → tombol "Tolak" `disabled`; ketik `' stok habis '` lalu klik → `onKonfirmasi` dipanggil dengan `'stok habis'`.
  - `deskripsiPettyCash`: reject + `'salah nominal'` → `'awal\n\n[Ditolak Finance: salah nominal]'`; approve tanpa catatan & nominal sama → `'awal'`; approve nominal 300000 dari 500000 tanpa catatan → teks `[Catatan Finance: Nominal disetujui Rp 300.000 dari diajukan Rp 500.000]` (format sama seperti kode sekarang).
- [ ] **Step 2: Jalankan** `yarn vitest run src/components/approval src/lib/approval/deskripsiPettyCash.test.ts` → FAIL.
- [ ] **Step 3: Implementasi** kedua file; ganti blok `newDescription` di `pettyCash.ts` dengan pemanggilan `deskripsiPettyCash`. Modal memakai gaya modal yang ada (`components/ui.tsx` / pola `BuktiModal`).
- [ ] **Step 4: Jalankan ulang** → PASS, plus `yarn vitest run` seluruh app finance → tidak ada test baru yang gagal dibanding baseline.
- [ ] **Step 5: Commit** `feat(finance): jendela alasan tolak + alasan tolak petty cash tersimpan`.

### Task 3: Hook data hub

**Files:**
- Create: `apps/finance/src/hooks/useHubApproval.ts`
- Modify: `apps/finance/src/hooks/usePoApproval.ts` (`PendingPo` + `updated_at`, select ikut `updated_at`)
- Modify: `apps/finance/src/hooks/usePettyCash.ts` (tambah `usePettyCashMenunggu`)
- Modify: `apps/finance/src/hooks/useSupplierSettlement.ts` (tambah `useBayarVendorPendingCount`)

**Interfaces:**
- Consumes: Task 1 (`itemDari*`, `gabungSumber`, `hitungPerJenis`, `HubJenis`); `usePendingPos`, `usePendingPoCount`, `usePayablePos`, `useTxBayarPo`, `useOfficeVouchers`, `usePettyCashCount`.
- Produces:
  ```ts
  // usePettyCash.ts
  export function usePettyCashMenunggu(): UseQueryResult<PettyCashTopup[]>
  //   queryKey ['petty_cash_topups','hub'], select & flatten sama dengan usePettyCashRequests,
  //   .in('status', ['forwarded_to_finance','approved_by_finance']), order created_at asc
  // useSupplierSettlement.ts
  export function useBayarVendorPendingCount(): UseQueryResult<number>
  //   queryKey ['po_payable','count','pending'], HEAD count po_payable_spv where payment_status='pending'
  // useHubApproval.ts
  export function useHubApproval(enabled: boolean): {
    items: HubItem[]; galat: HubJenis[]; isLoading: boolean; perJenis: Record<HubJenis, number>
  }
  export function useHubApprovalCount(enabled: boolean): { total: number; adaGalat: boolean }
  ```
  `useHubApproval`: petty dari `usePettyCashMenunggu`; PO dari `usePendingPos`; vendor dari `usePayablePos` + `useTxBayarPo`; voucher dari `useOfficeVouchers()` tanpa bulan. Semua kueri `enabled` hanya bila argumen `enabled` true (role tanpa hub tidak memicu kueri). `useHubApprovalCount`: `usePettyCashCount('forwarded_to_finance')` + `usePettyCashCount('approved_by_finance')` + `usePendingPoCount` + `useBayarVendorPendingCount` + jumlah voucher `waiting_verification` dari `useOfficeVouchers()`; `adaGalat` bila salah satunya error. Filter tiap hitungan identik dengan daftarnya (Review Focus 5). Bila `usePettyCashCount`/`usePendingPoCount` belum menerima opsi `enabled`, tambahkan parameter opsional `enabled = true`.

- [ ] **Step 1:** Tambahkan field/hook di tiga hook sumber sesuai Interfaces.
- [ ] **Step 2:** Implementasi `useHubApproval.ts`. Periksa `hooks/useFinanceRealtime.ts`: perubahan tabel `petty_cash_topups`, `purchase_order`, `cash_transaction`, dan `expenses` harus meng-invalidate prefix `['petty_cash_topups']`, `['po-pending-approval']`, `['po_payable']`, dan `['office_vouchers']`; tambahkan prefix yang belum tercakup (spec §4 "Segar").
- [ ] **Step 3: Verifikasi** `cd apps/finance && yarn type-check` → 0 error baru; `yarn vitest run` → sama dengan baseline.
- [ ] **Step 4: Commit** `feat(finance): hook data hub approval`.

### Task 4: Modal bayar vendor dipindah keluar dari SupplierView

**Files:**
- Create: `apps/finance/src/components/approval/SetujuiBayarVendorModal.tsx`
- Modify: `apps/finance/src/app/supplier/components/SupplierView.tsx:185-` (hapus fungsi `SetujuiModal` lokal, impor komponen baru)

**Interfaces:**
- Produces: `export function SetujuiBayarVendorModal(props: { po: PayablePo; rekeningLabel: string; saldo: number; onClose: () => void }): JSX.Element` — isi & perilaku persis `SetujuiModal` sekarang (pindah, bukan ditulis ulang).

- [ ] **Step 1:** Pindahkan komponen; `SupplierView` tetap memakainya untuk sementara (dicabut di Task 7).
- [ ] **Step 2: Verifikasi** `yarn type-check` → 0 error baru.
- [ ] **Step 3: Commit** `refactor(finance): modal setujui bayar vendor jadi komponen sendiri`.

### Task 5: Halaman `/approval`

**Files:**
- Create: `apps/finance/src/app/approval/page.tsx` (server component tipis, render `HubApprovalView`)
- Create: `apps/finance/src/app/approval/HubApprovalView.tsx`
- Create: `apps/finance/src/app/approval/BarisHub.tsx`
- Test: `apps/finance/src/app/approval/BarisHub.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`HubItem`, `JENIS_LABEL`, `URUTAN_JENIS`, `isLama`), Task 2 (`AlasanTolakModal`), Task 3 (`useHubApproval`), Task 4 (`SetujuiBayarVendorModal`); modal lama `FinanceApprovalModal` (`app/petty-cash/components/FinanceApprovalModal.tsx`), `VerifyVoucherModal` (`components/VerifyVoucherModal.tsx`); mutasi `useProcessPettyCashFinance`, `useForwardPettyCashFinance`, `useApprovePo`, `useRejectPo`, `useTolakBayarPo`, `useOfficeVouchers().verifyVoucher/rejectVoucher`; rekening Bahan Baku Bank seperti di `SupplierView` (`label`, `saldo`).
- Produces: `export function BarisHub(props: { item: HubItem; now: Date; bolehPutuskan: boolean; onSetujui: (i: HubItem) => void; onTolak: (i: HubItem) => void }): JSX.Element`

Perilaku:
- Chip: `Semua N` + satu chip per jenis dalam `URUTAN_JENIS`; jenis di `galat` menampilkan `!` dan teks galat, bukan angka.
- Baris: label jenis berwarna, `judul`, `keterangan`, nominal `rupiah()`, umur (`relativeTime` dari `@/lib/format` bila ada), umur merah bila `isLama`, tautan detail bila `detailHref`.
- Tombol per jenis: `petty_cash` "Setujui" → `FinanceApprovalModal` (onApprove = `useProcessPettyCashFinance` approve; onReject di dalam modal → tutup modal & buka `AlasanTolakModal`); `serah_am` hanya "Serahkan ke AM" → `confirm('Konfirmasi penyerahan dana dari Finance ke Area Manager?')` lalu `useForwardPettyCashFinance`; `po` "Setujui" → `useApprovePo` langsung (tanpa modal, sama dengan `/po-approval` sekarang); `bayar_vendor` "Setujui" → `SetujuiBayarVendorModal`; `dana_kantor` "Verifikasi" → `VerifyVoucherModal`. "Tolak" (semua kecuali `serah_am`) → `AlasanTolakModal` → `processTopup({action:'reject', approvalNote})` / `useRejectPo({poId, alasan})` / `useTolakBayarPo({poId, alasan})` / `rejectVoucher({voucher, reason})`.
- Galat mutasi → `toast.error(err.message)`; sukses → toast + query sudah di-invalidate oleh hook sumber.
- Halaman hanya untuk `isChecker`; selain itu tampilkan pesan tanpa akses (perlindungan sebenarnya di RPC/server action).
- Kosong (tidak loading, tidak ada item, tidak ada galat): `Tidak ada pengajuan yang menunggu`.
- Layar HP: baris bertumpuk (tombol di bawah teks).

- [ ] **Step 1: Tulis test gagal** `BarisHub.test.tsx`: item `serah_am` → ada tombol "Serahkan ke AM", tidak ada "Tolak"; item `po` umur 30 jam → elemen umur punya kelas merah; `bolehPutuskan=false` → tombol `disabled`.
- [ ] **Step 2: Jalankan** `yarn vitest run src/app/approval` → FAIL.
- [ ] **Step 3: Implementasi** `BarisHub`, `HubApprovalView`, `page.tsx`.
- [ ] **Step 4: Jalankan ulang** → PASS; `yarn type-check` → 0 error baru.
- [ ] **Step 5: Commit** `feat(finance): halaman Hub Approval`.

### Task 6: Menu & badge

**Files:**
- Modify: `apps/finance/src/components/CashLayout.tsx` (item grup Kas `:67`, badge `:216-239`, `getItemBadge` `:329-333`)

**Interfaces:**
- Consumes: Task 3 `useHubApprovalCount(enabled)`.

Perubahan: tambah `{ href: '/approval', label: 'Hub Approval', icon: Inbox }` sebagai item pertama grup Kas (bukan nav purchasing). `getItemBadge('/approval')` = `total`; hapus badge `/petty-cash` & `/po-approval` (tetap `/pembelian/permintaan` untuk purchasing). Total badge grup/judul memakai `total` hub untuk role non-purchasing (`useHubApprovalCount(!isPurchasingRole)`). Pastikan pengalih rute purchasing di `CashLayout` tidak memuat `/approval` (purchasing yang membuka `/approval` dialihkan seperti rute non-pembelian lain).

- [ ] **Step 1:** Ubah sesuai di atas.
- [ ] **Step 2: Verifikasi** `yarn type-check` → 0 error baru.
- [ ] **Step 3: Commit** `feat(finance): menu Hub Approval + badge total`.

### Task 7: Cabut tombol keputusan di halaman lama

**Files:**
- Modify: `apps/finance/src/app/petty-cash/components/FinancePettyCashList.tsx` (tombol "Proses / Acc" `:533-540`, "Serahkan AM" `:542-550`, `FinanceApprovalModal` `:611`, handler terkait)
- Modify: `apps/finance/src/app/po-approval/page.tsx` (tombol setuju/tolak)
- Modify: `apps/finance/src/app/supplier/components/SupplierView.tsx` (tombol Setujui/Tolak tab "Menunggu approval", `tolakPo`, `SetujuiBayarVendorModal`; tombol **Ajukan** tetap)
- Modify: `apps/finance/src/app/pengeluaran/kantor/page.tsx` (tombol verifikasi/tolak untuk `waiting_verification`, `VerifyVoucherModal` `:474`; buat voucher & unggah nota tetap)
- Modify: `apps/admin-dashboard/src/app/dashboard/pos-admin/petty-cash/PettyCashView.tsx` (`:163-235`: tombol "Cairkan di Finance", "Tolak", "Serahkan ke AM")
- Modify/Delete: `apps/admin-dashboard/src/app/dashboard/pos-admin/petty-cash/actions.ts` (`processFinancePettyCash`, `forwardFinanceFunds` dihapus bila `grep -rn` tidak menemukan pemakai lain)

Di tempat tombol yang dicabut: `<Link>`/`<a>` `Putuskan di Hub Approval` ke `/approval` (admin-dashboard: `${financeUrl}/approval`). Di `/po-approval` tautan hanya untuk `isChecker`; purchasing tetap melihat mode pantau tanpa tautan. Komponen modal lama yang jadi tak terpakai di halaman itu dilepas impornya (komponennya sendiri tetap ada, dipakai hub).

- [ ] **Step 1:** Ubah lima halaman.
- [ ] **Step 2: Verifikasi** `grep -rn "handleOpenModal\|tolakPo\|useApprovePo" apps/finance/src/app/petty-cash apps/finance/src/app/supplier apps/finance/src/app/po-approval` → tidak ada pemanggil keputusan tersisa; `cd apps/finance && yarn type-check` dan `cd apps/admin-dashboard && yarn type-check` → 0 error baru.
- [ ] **Step 3: Commit** `feat(finance,admin): keputusan pengajuan hanya di Hub Approval`.

### Task 8: Verifikasi akhir

- [ ] **Step 1:** `cd apps/finance && yarn vitest run && yarn type-check && yarn build` → test sama/naik dari baseline, 0 error, build sukses dengan rute `/approval`.
- [ ] **Step 2:** `cd apps/admin-dashboard && yarn type-check && yarn build` → sukses.
- [ ] **Step 3: Uji browser** (dev server finance, akun admin finance): `/approval` tampil; chip & badge sama dengan jumlah baris; tiap jenis yang ada datanya bisa Setujui & Tolak (alasan kosong ditolak); petty cash yang di-Acc berubah jadi baris "Serahkan ke AM". Bila tak ada data menunggu, buat satu pengajuan uji di **outlet tes** lalu tolak (jangan setujui uang sungguhan tanpa izin owner).
- [ ] **Step 4:** Buka dua tab, putuskan satu pengajuan di tab A, klik Setujui di tab B → toast galat dari RPC, baris hilang setelah segar.
- [ ] **Step 5:** Login purchasing → menu hub tidak ada, `/approval` dialihkan, `/po-approval` tetap jalan tanpa tautan hub.
- [ ] **Step 6:** Catat di `CLAUDE.md` (section sesi baru, ringkas): fitur, file utama, ⚠️ perlu redeploy `finance` + `admin-dashboard`. Commit `docs: catat sesi Hub Approval`.
