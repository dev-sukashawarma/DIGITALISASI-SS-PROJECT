# Shift Kasir Belum Ditutup → Blokir Absen Pulang

**Tanggal:** 2026-07-08
**Status:** Disetujui, siap implementasi

## Latar Belakang

Kasir/crew di `apps/pos-kasir` wajib menutup shift laci (`Petty Cash`, lihat `app/kasir/shift/page.tsx`) sebelum pulang, tapi saat ini tidak ada validasi yang memaksanya — crew bisa absen pulang di `apps/absensi` meski shift laci outlet masih terbuka. Karena `outlet_staff`, `shifts`, dan `attendance` berbagi satu database Supabase, validasi ini bisa dilakukan lintas-app tanpa duplikasi data.

**Fakta skema kunci** (`supabase/migrations/20260701130000_create_shifts_blind_close.sql`):
- Tabel `shifts` punya `UNIQUE INDEX ... WHERE status = 'open'` → **maksimal satu shift terbuka per outlet** (bukan per staf). Shift adalah state milik laci/outlet, bukan milik individu.
- `close_shift_blind()` RPC tidak mensyaratkan penutup = pembuka shift — siapa pun staf dengan akses ke outlet itu bisa menutupnya.

**Keputusan produk** (dikonfirmasi user):
1. Blokir **semua staf** yang absen pulang di outlet tsb selama shift masih `status='open'` — bukan hanya staf yang membuka shift.
2. **Tidak ada jalur darurat/bypass.** Kasir wajib kembali menutup shift.
3. Role `'kasir'` sudah dihapus dari sistem (migration `20260626102000_remove_kasir_role.sql`, semua akun dipindah ke `'crew'`) — tidak relevan untuk desain ini karena blokir tidak difilter per-role.

**Preseden yang sudah ada:** `apps/absensi/src/features/clock/useClockKiosk.ts` (baris 243-248, fungsi `isClosingChecklistDone()`) sudah mengimplementasikan pola identik untuk gate absen-pulang berbasis "checklist penutupan belum selesai" — client-side saja, tanpa bypass. Desain ini meniru pola tersebut.

## Desain

### 1. Client-side gate (utama — UX instan, tanpa round-trip API)

Di `useClockKiosk.ts`, tambah fungsi baru `isShiftClosed()` sejajar dengan `isClosingChecklistDone()`:

```ts
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

RLS tabel `shifts` (`shifts_select_all`) sudah mengizinkan staf membaca shift outlet sendiri via `accessible_outlet_ids()` — tidak perlu migration/policy baru.

Panggil di `tick()`, tepat setelah pengecekan checklist yang sudah ada (baris ~248), dengan bentuk identik:

```ts
if (next === "out" && !(await isShiftClosed())) {
  setResult({ ok: false, message: "Shift kasir outlet ini belum ditutup (Petty Cash). Tidak bisa absen pulang." });
  setPhase("result");
  scheduleReset(3500);
  return;
}
```

### 2. Server-side gate (lapis kedua — otoritatif)

Berbeda dari pola checklist (client-only), tambahkan juga validasi di `apps/absensi/src/app/api/submit-attendance/route.ts` karena ini data finansial (rekonsiliasi kas), dan pola serupa (`too_early_in`/`too_early_out`) di route yang sama sudah dicek di kedua sisi (client + server).

Untuk `body.type === "out"`, sebelum fetch `cfg` (tidak bergantung padanya), query `shifts` pakai service-role client yang sudah ada di route ini:

```ts
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

### 3. Pesan error

Tambah entri baru di `gagalText()` (`useClockKiosk.ts`) untuk reason server `shift_not_closed` (dipakai kalau jalur client-side kebetulan lolos tapi server menolak — mis. race condition antar-cek):

```ts
shift_not_closed: "Shift kasir belum ditutup",
```

## Cakupan & Batasan

- **Berlaku untuk semua staf**, semua role, yang mencoba absen pulang (`type: "out"`) di outlet dengan shift `status='open'`. Tidak difilter per-role (crew/leader/kitchen semua kena, sesuai keputusan user).
- **Tidak berlaku untuk absen masuk** (`type: "in"`) — hanya menggate pulang.
- **Tidak ada bypass/override** — konsisten dengan pola checklist yang sudah ada.
- **Tidak ada migration baru** — hanya membaca tabel `shifts` yang sudah ada, RLS sudah cukup.
- **Tidak mengubah perilaku shift/kasir di `apps/pos-kasir` sama sekali** — hanya menambah pembacaan (read-only) dari `apps/absensi`. Fitur checklist-gate, time-window, dan alur absen lain yang sudah ada tidak disentuh/diubah urutannya, hanya ditambah satu kondisi baru setelahnya.

## Risiko yang Diketahui (diterima secara sadar oleh user)

Tanpa jalur darurat, kalau kasir lupa menutup shift dan sudah pulang/tidak bisa kembali, staf lain di outlet itu (termasuk yang tidak pegang laci) tetap terblokir absen pulang sampai ada yang menutup shift tersebut (dari mana saja yang punya akses outlet itu — tidak harus di lokasi outlet, karena `close_shift_blind` bisa dipanggil dari `apps/pos-kasir` di device mana pun yang sesi login-nya terhubung ke outlet tsb). Ini sama seperti pola checklist yang sudah berjalan tanpa bypass.
