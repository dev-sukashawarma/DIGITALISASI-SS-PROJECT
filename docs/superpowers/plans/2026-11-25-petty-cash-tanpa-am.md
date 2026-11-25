# Pengajuan Petty Cash Tanpa AM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengajuan top up petty cash langsung ke Finance; Finance transfer dengan bukti wajib; leader konfirmasi "masuk laci" (saldo POS naik). AM tidak dilibatkan.

**Architecture:** Satu migration mengganti mesin status (`petty_cash_enforce_flow`) dan RPC terkait; nama status lama dipertahankan agar pembaca saldo/laporan tidak berubah. Layar AM jadi riwayat saja; Hub Approval kehilangan item "Serahkan ke AM"; modal pencairan Finance mewajibkan bukti.

**Tech Stack:** Supabase Postgres (plpgsql), Next.js app router, React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-petty-cash-tanpa-am-design.md`

## Global Constraints

- Status yang dipakai: `forwarded_to_finance` → `approved_by_finance` → `forwarded_by_leader` (+ `completed` lama), `rejected`. Jangan ganti nama status.
- Saldo POS (`get_petty_cash_snapshot`) TIDAK disentuh.
- Bukti wajib untuk aksi `approve`, metode `transfer` maupun `tunai`. Label: transfer → "Bukti transfer (wajib)", tunai → "Foto bukti serah uang (wajib)".
- Alur `petty_cash_expenses` (pengeluaran kasir, disetujui AM) TIDAK disentuh.
- Fungsi lama tidak di-DROP; badannya `RAISE EXCEPTION 'Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance.'`.
- Timestamp migration: `20261125120000` (terakhir terstempel `20261123150000`; cek ulang `ls supabase/migrations | sort | tail` sebelum menulis).
- Migration TIDAK di-apply sebelum app siap di-push (Task 6); uji di DB lewat `BEGIN … ROLLBACK`.
- Abaikan salinan berkas di `**/.claude/worktrees/**` dan `scratch/**`.

## Review Focus

1. Pengajuan yang sedang di status AM saat migration jalan → harus pindah, bukan terjebak (uji t1 kasus f).
2. Leader outlet lain menekan konfirmasi → ditolak (uji t1 kasus d).
3. Finance menekan Setujui tanpa bukti lewat tab lama / panggilan RPC langsung → ditolak DB, bukan hanya UI (uji t1 kasus c).
4. Ganti metode transfer → tunai di modal setelah memilih file → bukti tetap terkirim (test modal kasus b).
5. Tolak setelah dana cair (`approved_by_finance`/`forwarded_by_leader` → `rejected`) → ditolak trigger (uji t1 kasus e).

---

### Task 1: Migration mesin status + RPC

**Files:**
- Create: `supabase/migrations/20261125120000_petty_cash_tanpa_am.sql`
- Test: `supabase/verifikasi/petty_cash_tanpa_am/t1_alur.sql`

**Interfaces:**
- Produces (DB): `create_petty_cash_topup(...)` → baris `forwarded_to_finance`; `finance_process_petty_cash_custom(...)` approve wajib `p_proof_of_transfer_url`; `leader_forward_funds(p_topup_id uuid)` menerima `approved_by_finance` → `forwarded_by_leader`.

- [ ] **Step 1: Tulis uji `t1_alur.sql`** — satu blok `BEGIN; … ROLLBACK;` yang memakai `request.jwt.claims` + `SET LOCAL ROLE authenticated` untuk menyamar (ambil semua id fixture SEBELUM ganti peran). Asersi lewat `DO $$ … RAISE EXCEPTION 'ASERSI GAGAL: …' $$`:
  - (a) leader aktif → `create_petty_cash_topup` → status `forwarded_to_finance`.
  - (b) admin_finance → approve dengan rekening `grup='petty_cash'` + bukti URL → `approved_by_finance`, ada 1 `cash_transaction` `source_type='petty_cash_topup'`.
  - (c) approve tanpa bukti (`p_proof_of_transfer_url` NULL dan `''`) → error memuat `'Bukti'`.
  - (d) leader outlet LAIN → `leader_forward_funds` → error; leader outlet sendiri → `forwarded_by_leader`.
  - (e) `UPDATE … SET status='rejected'` dari `approved_by_finance` & dari `forwarded_by_leader` (sebagai `postgres`) → error trigger.
  - (f) baris lama `forwarded_to_area_manager` / `forwarded_by_finance` / `forwarded_by_area_manager` (disisipkan dengan trigger insert dinonaktifkan di dalam transaksi) setelah blok pemindahan data migration → `forwarded_to_finance` / `approved_by_finance` / `approved_by_finance`.
  - (g) `area_manager_process_petty_cash` → error memuat `'Tahap Area Manager sudah dihapus'`.
  - Kontrol negatif: satu asersi sengaja salah di akhir (dikomentari setelah terbukti gagal).
- [ ] **Step 2: Jalankan uji tanpa migration** (konektor `5f2e798c` `execute_sql`, project `khpkoreaaucvyqfhynfq`). Expected: gagal di (a) (`forwarded_to_area_manager`).
- [ ] **Step 3: Tulis migration**, urutan:
  1. Pindah data: `ALTER TABLE petty_cash_topups DISABLE TRIGGER trg_petty_cash_enforce_flow_update;` → 2 UPDATE pemetaan (spec) → `ENABLE TRIGGER`.
  2. `CREATE OR REPLACE petty_cash_enforce_flow()`: INSERT wajib `forwarded_to_finance`; UPDATE sah hanya `(forwarded_to_finance→approved_by_finance)`, `(approved_by_finance→forwarded_by_leader)`, `(forwarded_by_leader→completed)`, `(forwarded_to_finance→rejected)`.
  3. `create_petty_cash_topup`: sama persis versi live, status `forwarded_to_finance`.
  4. `finance_process_petty_cash_custom`: salin versi live (lihat `pg_get_functiondef`), tambah di cabang approve sebelum cek lokasi: `IF length(btrim(COALESCE(p_proof_of_transfer_url,''))) = 0 THEN RAISE EXCEPTION 'Bukti transfer/serah uang wajib dilampirkan'; END IF;`. Pertahankan `SECURITY DEFINER SET search_path = public`.
  5. `leader_forward_funds`: status sumber `approved_by_finance`; peran pemanggil dari `outlet_staff` dengan `status='active'`; tambah `IF v_topup.outlet_id NOT IN (SELECT accessible_outlet_ids()) THEN RAISE…`. Daftar role tetap.
  6. Ganti badan `area_manager_process_petty_cash`, `area_manager_forward_funds`, `finance_forward_funds`, `korlap_process_petty_cash`, `korlap_forward_funds`, `review_petty_cash_topup` dengan `RAISE EXCEPTION` (teks Global Constraints). Signature & SECURITY DEFINER tetap.
  7. `trigger_petty_cash_push_notification`: hapus EVENT 1 (ke AM) & EVENT 3; EVENT 2 (`→ approved_by_finance`) dikirim ke `NEW.created_by` (fallback leader aktif outlet), `app='leader'`, `url='leader_petty_cash'`, title `'💰 Petty Cash Sudah Ditransfer'`, body `'Petty cash <outlet> Rp <nominal> sudah ditransfer Finance. Tekan "Dana diterima" setelah uang masuk laci.'`.
  8. `trg_approval_log_petty_cash`: buang cabang `serah_am`.
- [ ] **Step 4: Jalankan uji dengan migration di dalam transaksi yang sama** (`BEGIN; <isi migration>; <isi t1>; ROLLBACK;`). Expected: tanpa `ASERSI GAGAL`, kontrol negatif gagal sesuai harapan.
- [ ] **Step 5: Commit** `feat(db): petty cash langsung ke Finance, bukti wajib (belum di-apply)`.

### Task 2: Finance — modal pencairan bukti wajib

**Files:**
- Modify: `apps/finance/src/app/petty-cash/components/FinanceApprovalModal.tsx` (blok upload ~391–440, `canApprove` :81, `handle` :118)
- Modify: `apps/finance/src/app/actions/pettyCash.ts` (`processPettyCashFinanceCustomAmount`)
- Test: `apps/finance/src/app/petty-cash/components/FinanceApprovalModal.test.tsx`

- [ ] **Step 1: Tulis test** `'tombol Setujui terkunci sampai bukti dilampirkan'` (a: tanpa file → tombol disabled + teks "wajib"); `'bukti tetap terkirim untuk metode tunai'` (b: pilih file, ganti ke tunai, klik Setujui → `onApprove` dipanggil dengan `File` di argumen ke-3). Label persis: Global Constraints.
- [ ] **Step 2: Jalankan** `cd apps/finance && ./node_modules/.bin/vitest run src/app/petty-cash/components/FinanceApprovalModal.test.tsx` → FAIL.
- [ ] **Step 3: Implementasi** — upload tampil untuk kedua metode; `canApprove` += `!!proofFile`; kirim `proofFile` tanpa syarat metode. Server action: `action==='approve' && !proofUrlMentah` → `throw new Error('Bukti transfer/serah uang wajib dilampirkan')`.
- [ ] **Step 4: Jalankan test** → PASS.
- [ ] **Step 5: Commit** `feat(finance): bukti wajib saat mencairkan petty cash`.

### Task 3: Finance — buang tahap AM dari Hub, hook, daftar

**Files:**
- Modify: `apps/finance/src/lib/approval/hub.ts` (buang jenis `serah_am`; `itemDariPettyCash` hanya `forwarded_to_finance`)
- Modify: `apps/finance/src/lib/approval/hub.test.ts` (test :90 → `approved_by_finance` menghasilkan `null`; hapus `serah_am` dari ringkasan :207–293)
- Modify: `apps/finance/src/app/approval/HubApprovalView.tsx` (hapus kasus `serah_am` :98, :166 & `useForwardPettyCashFinance`)
- Modify: `apps/finance/src/hooks/usePettyCash.ts` (hapus `useProcessPettyCashLeader`, `useProcessPettyCashAreaManager`, `useForwardPettyCashFinance`, `useForwardPettyCashAreaManager`, `useReceivePettyCashCrew`; pertahankan `useForwardPettyCashLeader`), `apps/finance/src/app/actions/pettyCash.ts` (hapus `forwardPettyCashFinance`)
- Modify: `apps/finance/src/app/petty-cash/components/FinancePettyCashList.tsx`, `apps/finance/src/app/leader/petty-cash/components/PettyCashList.tsx`, `apps/finance/src/components/LeaderLayout.tsx`, `apps/finance/src/app/area-manager/petty-cash/components/PettyCashList.tsx`, `apps/finance/src/components/AreaManagerLayout.tsx`, `apps/finance/src/hooks/usePettyCashTopups.ts`, `apps/finance/src/lib/types.ts`

Aturan untuk semua daftar/badge: "perlu aksi leader" = `approved_by_finance` (tombol **Dana diterima & masuk laci** → `useForwardPettyCashLeader`); "menunggu Finance" = `forwarded_to_finance`; status AM lama tetap punya label riwayat di `types.ts` tapi tidak dihitung sebagai antrean. Halaman AM: tab review & tombol aksi dibuang, badge layout AM = 0/dihapus. Filter `waiting_am` di daftar Finance dibuang.

- [ ] **Step 1: Ubah `hub.test.ts`** sesuai di atas → jalankan `vitest run src/lib/approval/hub.test.ts` → FAIL.
- [ ] **Step 2: Implementasi** semua berkas di atas.
- [ ] **Step 3: Jalankan** `vitest run` (finance) + `./node_modules/.bin/tsc --noEmit -p .` → PASS / 0 error baru (bandingkan dengan baseline yang dicatat sebelum mulai).
- [ ] **Step 4: Commit** `feat(finance): petty cash tanpa tahap AM`.

### Task 4: admin-dashboard — leader & AM

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/leader/petty-cash/page.tsx` (tombol :580–640: tampil saat `approved_by_finance`, label "Dana diterima & masuk laci", confirm teks "Uang sudah masuk laci kasir? Saldo petty cash outlet akan bertambah."; filter :293–316; hapus `.update` outlets :246–253 karena RPC sudah menyimpan rekening)
- Modify: `apps/admin-dashboard/src/app/dashboard/area-manager/petty-cash/page.tsx` (hapus `handleApprove`/`handleReject`/`handleForwardToLeader` & tombolnya; tab review dibuang; riwayat tetap)
- Modify: `apps/admin-dashboard/src/hooks/usePettyCashTopups.ts` (status AM lama tetap dibaca untuk riwayat, tidak lebih)

- [ ] **Step 1: Implementasi.**
- [ ] **Step 2: Verifikasi** `cd apps/admin-dashboard && ./node_modules/.bin/tsc --noEmit -p .` + `vitest run` → tidak ada error/kegagalan baru vs baseline.
- [ ] **Step 3: Commit** `feat(admin): petty cash leader konfirmasi langsung, AM riwayat saja`.

### Task 5: manager & pos-kasir

**Files:**
- Modify: `apps/manager/src/app/petty-cash/page.tsx` (hapus approve/reject/forward :340–390 & tombolnya; riwayat tetap; panel pengeluaran kasir `PengeluaranKasirPanel` JANGAN disentuh)
- Modify: `apps/pos-kasir/app/kasir/shift/page.tsx` (peta label :1029–1033: `forwarded_to_finance: 'Menunggu Finance'`, `approved_by_finance: 'Sudah ditransfer — menunggu konfirmasi leader'`; label AM lama dibiarkan untuk riwayat)

- [ ] **Step 1: Implementasi.**
- [ ] **Step 2: Verifikasi** type-check `apps/manager` & `apps/pos-kasir` → tanpa error baru.
- [ ] **Step 3: Commit** `feat(manager,pos): petty cash tanpa tahap AM`.

### Task 6: Rilis

- [ ] **Step 1:** `next build --webpack` untuk finance, admin-dashboard, manager, pos-kasir → sukses.
- [ ] **Step 2:** Tambah entri Session 2026-11-25 di `CLAUDE.md` (alur baru, bukti wajib, fungsi AM diganti pesan galat, urutan rilis).
- [ ] **Step 3:** **Minta OK owner**, lalu dalam satu waktu: apply migration (`apply_migration`, rename berkas mengikuti versi stempel bila berbeda), verifikasi `pg_get_functiondef` 3 fungsi + stempel `schema_migrations`, jalankan ulang `t1_alur.sql`, lalu merge + push ke `main` (deploy otomatis).
