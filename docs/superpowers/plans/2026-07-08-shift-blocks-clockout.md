# Shift Kasir Belum Ditutup → Blokir Absen Pulang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crew tidak bisa absen pulang di `apps/absensi` selama shift kasir (laci) outletnya masih `status='open'` di `apps/pos-kasir`.

**Architecture:** Dua gate aditif, tidak mengubah kode yang sudah ada:
1. Client-side, `apps/absensi/src/features/clock/useClockKiosk.ts` — fungsi baru `isShiftClosed()` (query `shifts` via RLS-scoped anon client), dipanggil di `tick()` sejajar dengan `isClosingChecklistDone()` yang sudah ada.
2. Server-side, `apps/absensi/src/app/api/submit-attendance/route.ts` — guard clause baru untuk `body.type === "out"` (query `shifts` via service-role client yang sudah ada di route), sebelum semua logika lain.

**Tech Stack:** Next.js 16 App Router, Supabase (`@supabase/supabase-js`), TypeScript, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-08-shift-blocks-clockout-design.md`.
- **Jangan ubah baris kode yang sudah ada** di kedua file — hanya menyisipkan kode baru. Checklist-gate (`isClosingChecklistDone`), time-window (`too_early_in`/`too_early_out`), dan semua validasi lain di `submit-attendance/route.ts` harus tetap identik.
- Tidak ada migration DB baru — tabel `shifts` dan RLS-nya (`shifts_select_all`) sudah ada dan sudah mengizinkan staf membaca shift outlet sendiri via `accessible_outlet_ids()`.
- Tidak ada bypass/override — sesuai keputusan produk di spec.
- Repo tidak punya test harness untuk API routes Next.js maupun untuk `useClockKiosk.ts` (hook ini terikat kamera/geolocation/human.js, tidak ada `*.test.ts` untuknya sama sekali). Jangan perkenalkan infrastruktur test baru untuk perubahan kecil ini — verifikasi lewat `yarn type-check`, `yarn build`, dan review diff manual (bukan unit test baru), konsisten dengan cakupan test yang sudah ada di repo ini.

---

### Task 1: Client-side gate di `useClockKiosk.ts`

**Files:**
- Modify: `apps/absensi/src/features/clock/useClockKiosk.ts`

**Interfaces:**
- Consumes: `supabase` (sudah ada di scope hook, dari `createClient()` di baris 34), `outletId` (parameter hook, sudah ada).
- Produces: fungsi `isShiftClosed(): Promise<boolean>` dipakai di `tick()` pada task ini saja (tidak dikonsumsi task lain).

- [ ] **Step 1: Tambah fungsi `isShiftClosed()`**

Sisipkan fungsi baru tepat setelah penutup `isClosingChecklistDone()` (baris 335, sebelum `async function doSubmit(video: HTMLVideoElement) {` di baris 337):

```ts
  /**
   * True bila TIDAK ada shift kasir yang masih terbuka (status='open') di outlet ini.
   * Shift adalah state milik OUTLET (laci bersama), bukan milik staf tertentu — jadi
   * ini berlaku untuk siapa pun yang absen pulang di outlet tsb, terlepas dari siapa
   * yang membuka shift. Tidak ada bypass (sesuai desain checklist-gate di atas).
   */
  async function isShiftClosed(): Promise<boolean> {
    if (!outletId) return true;
    const { data } = await supabase
      .from("shifts")
      .select("id")
      .eq("outlet_id", outletId)
      .eq("status", "open")
      .maybeSingle();
    return !data;
  }
```

- [ ] **Step 2: Panggil gate baru di `tick()`**

Cari blok gate checklist yang sudah ada di `tick()` (sekitar baris 242-248):

```ts
      // Gate absen pulang: checklist penutupan (fase "tutup") wajib selesai dulu.
      if (next === "out" && !(await isClosingChecklistDone())) {
        setResult({ ok: false, message: "Checklist penutupan belum selesai. Tidak bisa absen pulang." });
        setPhase("result");
        scheduleReset(3500);
        return;
      }
```

Tambahkan gate baru **persis setelah** blok di atas (jangan ubah blok yang sudah ada), sebelum baris `setWho({ id: found.id, name: found.name });` yang menyusul:

```ts
      // Gate absen pulang: shift kasir (laci) outlet ini wajib sudah ditutup.
      if (next === "out" && !(await isShiftClosed())) {
        setResult({ ok: false, message: "Shift kasir outlet ini belum ditutup (Petty Cash). Tidak bisa absen pulang." });
        setPhase("result");
        scheduleReset(3500);
        return;
      }
```

- [ ] **Step 3: Tambah entri reason code baru di `gagalText()`**

Di map `gagalText()` (baris ~413-425), tambahkan satu baris baru ke object `map` (jangan ubah entri lain):

```ts
    shift_not_closed: "Shift kasir belum ditutup",
```

- [ ] **Step 4: Type-check**

Run: `cd apps/absensi && yarn type-check`
Expected: `Done` tanpa error (sama seperti sebelum perubahan — cek dulu baseline dengan `git stash && yarn type-check && git stash pop` bila ragu apakah ada error pre-existing).

- [ ] **Step 5: Review diff — pastikan hanya penyisipan, tidak ada baris lama berubah**

Run: `git diff apps/absensi/src/features/clock/useClockKiosk.ts`
Expected: Semua baris yang muncul di diff berwarna `+` (baris baru). Tidak ada baris `-` sama sekali. Kalau ada baris lama yang ikut berubah/format ulang, batalkan dan sisipkan ulang dengan lebih presisi.

- [ ] **Step 6: Commit**

```bash
git add apps/absensi/src/features/clock/useClockKiosk.ts
git commit -m "$(cat <<'EOF'
feat(absensi): block clock-out while outlet shift is still open

Mirrors the existing closing-checklist gate: crew cannot absen pulang
until the shared cash-drawer shift (apps/pos-kasir) for their outlet
has been closed. No bypass, matching the checklist gate's design.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Server-side gate di `submit-attendance/route.ts`

**Files:**
- Modify: `apps/absensi/src/app/api/submit-attendance/route.ts`

**Interfaces:**
- Consumes: `admin` (service-role Supabase client, sudah dibuat di baris 11), `body.type`, `body.outlet_id` (sudah ada di payload, dipakai validasi lain di route ini).
- Produces: response `{ ok: false, reason: "shift_not_closed" }` (status 200) — dikonsumsi oleh `gagalText()` yang ditambahkan di Task 1, Step 3.

- [ ] **Step 1: Tambah guard clause setelah validasi selfie path**

Cari blok validasi selfie path yang sudah ada (baris 64-66):

```ts
    if (body.selfie_path && !body.selfie_path.startsWith(`${body.outlet_id}/`)) {
      return NextResponse.json({ ok: false, reason: "selfie_path_mismatch" }, { status: 403 });
    }
```

Tambahkan blok baru **persis setelah** blok di atas (sebelum `const { data: cfg } = await admin` di baris 68), jangan ubah blok yang sudah ada:

```ts
    // Blokir absen pulang selama shift kasir (laci) outlet ini masih terbuka.
    // Shift adalah state milik OUTLET, bukan staf tertentu — berlaku untuk siapa
    // pun yang absen pulang di outlet ini. Tidak ada bypass.
    if (body.type === "out") {
      const { data: openShift } = await admin
        .from("shifts")
        .select("id")
        .eq("outlet_id", body.outlet_id)
        .eq("status", "open")
        .maybeSingle();
      if (openShift) {
        return NextResponse.json({ ok: false, reason: "shift_not_closed" }, { status: 200 });
      }
    }
```

- [ ] **Step 2: Type-check**

Run: `cd apps/absensi && yarn type-check`
Expected: `Done` tanpa error baru.

- [ ] **Step 3: Build**

Run: `cd apps/absensi && yarn build`
Expected: Build sukses (`✓ Compiled successfully`), route `/api/submit-attendance` tetap terklasifikasi `ƒ Dynamic` seperti sebelumnya (route API selalu dynamic, tidak berubah).

- [ ] **Step 4: Review diff — pastikan hanya penyisipan**

Run: `git diff apps/absensi/src/app/api/submit-attendance/route.ts`
Expected: Semua baris `+` saja, tidak ada `-`. Blok `selfie_path_mismatch` di atasnya dan blok `cfg` fetch di bawahnya harus tetap identik dengan sebelum perubahan.

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/app/api/submit-attendance/route.ts
git commit -m "$(cat <<'EOF'
feat(absensi): reject clock-out server-side when outlet shift is open

Authoritative server-side mirror of the client-side shift gate added
in useClockKiosk.ts — defense in depth for financial reconciliation
data, matching how too_early_in/too_early_out are already checked on
both sides. No existing validation logic changed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Verifikasi lintas-app & regresi

**Files:** Tidak ada file baru — hanya verifikasi.

**Interfaces:**
- Consumes: hasil Task 1 & Task 2.
- Produces: konfirmasi bahwa `apps/pos-kasir` (pemilik tabel `shifts`) tidak tersentuh sama sekali, dan `apps/absensi` tetap lulus test suite yang sudah ada.

- [ ] **Step 1: Pastikan `apps/pos-kasir` nihil perubahan**

Run: `git status --short apps/pos-kasir`
Expected: kosong (tidak ada output) — perubahan murni terjadi di `apps/absensi`, tidak menyentuh `apps/pos-kasir/app/kasir/shift/page.tsx` atau migration `shifts` yang sudah ada.

- [ ] **Step 2: Jalankan test suite absensi yang sudah ada**

Run: `cd apps/absensi && yarn test`
Expected: Semua test lama tetap PASS dengan jumlah yang sama seperti sebelum perubahan (tidak ada test baru ditambahkan di plan ini, karena tidak ada test existing untuk `useClockKiosk.ts`/route API — lihat Global Constraints). Kalau ada test yang gagal, itu regresi dari perubahan ini — investigasi sebelum lanjut.

- [ ] **Step 3: Full type-check monorepo (opsional tapi disarankan)**

Run: `cd "C:\Users\Digital Marketing\OneDrive\Desktop\project\DIGITALISASI-SS-PROJECT" && yarn type-check`
Expected: Tidak ada error baru dibanding sebelum perubahan (error pre-existing di app lain, jika ada, bukan tanggung jawab plan ini).

- [ ] **Step 4: Catat batasan verifikasi manual**

Tidak bisa diverifikasi end-to-end di sandbox ini (butuh: staf ber-`face_descriptor` ter-enroll, sesi kiosk absensi nyata, dan shift kasir aktif di `apps/pos-kasir`). Setelah deploy, smoke test manual:
1. Buka shift kasir di outlet test (`/kasir/shift` → Buka Shift).
2. Coba absen pulang staf outlet itu di kiosk absensi → harus muncul pesan "Shift kasir outlet ini belum ditutup (Petty Cash). Tidak bisa absen pulang."
3. Tutup shift (`/kasir/shift` → Kunci & Tutup Shift).
4. Ulangi absen pulang → harus berhasil normal.
5. Pastikan absen **masuk** tidak terpengaruh sama sekali (gate hanya berlaku untuk `type: "out"`).

Tidak ada commit di step ini (verifikasi saja).
