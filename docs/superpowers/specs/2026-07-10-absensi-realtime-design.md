# Absensi Realtime — Design Spec

**Tanggal:** 2026-07-10
**App:** `apps/absensi`
**Goal:** Seluruh aktivitas di sistem absensi bersifat realtime — data masuk/diterima dan muncul/hilang di detik itu juga, tanpa refresh manual — dan tetap **ringan** (hemat koneksi & CPU), aman untuk 19 outlet + kiosk always-on.

---

## 1. Konteks & Temuan Awal (code review)

Sudah ada realtime parsial (pola per-halaman ad-hoc):

- `dashboard/papan-kehadiran/page.tsx` — subscribe `attendance`, `outlet_attendance_config`, `global_settings` → `refetch()`.
- `features/clock/AttendanceKioskPanel.tsx` — subscribe attendance.
- `dashboard/checklist-monitor/page.tsx` & `dashboard/kru-checklist/page.tsx` — subscribe checklist.

**Temuan yang harus diperbaiki:**

1. **Publication mati untuk sebagian tabel.** Di DB, hanya `attendance` dan `daily_checklist_ticks` yang ada di `supabase_realtime`. Padahal papan-kehadiran subscribe `outlet_attendance_config` & `global_settings` → event tersebut **tidak pernah terkirim** (realtime diam-diam mati sebagian).
2. **Polling tersisa.** `features/cuti/useLeaveNotifications.ts` pakai `refetchInterval: 15000` — persis "refresh" yang harus dihilangkan.
3. **Mutation hanya update lokal.** `useSubmitLeave`/`useSubmitKasbon` hanya `invalidateQueries` di device pengaju; device SPV/HR tidak update tanpa realtime.
4. **Pola `refetch()` + `useEffect` di-copy-paste** di 4 tempat, dependency array rawan bikin channel dibuat-ulang tiap render, cleanup tak seragam, dan berpotensi refetch storm saat banyak baris berubah.
5. **DELETE / "data hilang" tidak andal** tanpa `REPLICA IDENTITY FULL`: event DELETE hanya membawa PK, sehingga filter (`outlet_id=eq.x`) dan RLS bisa menggugurkan event → baris tak hilang dari UI.

---

## 2. Arsitektur — Lapisan Realtime Terpusat (Approach B)

Satu hook reusable yang mengubah event Postgres → invalidasi React Query, dengan **satu channel per scope** yang di-multiplex untuk banyak tabel.

```ts
// src/lib/realtime/useRealtimeInvalidate.ts
type Sub = {
  table: string
  filter?: string                 // mis. `outlet_id=eq.${outletId}`
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'  // default '*'
  invalidate: QueryKey[]          // queryKey yang di-invalidate saat event masuk
}

useRealtimeInvalidate({
  channel: `absensi-${scopeId}`,  // stabil per scope (outlet / user)
  enabled: !!scopeId,
  subs: Sub[],
})
```

**Perilaku inti:**

- **Satu `supabase.channel` per scope**, semua `subs` di-`.on('postgres_changes', ...)` ke channel yang sama lalu satu kali `.subscribe()`. Menekan jumlah koneksi realtime (kiosk always-on + banyak HP crew × 19 outlet).
- Handler memanggil `queryClient.invalidateQueries({ queryKey })` — **bukan** `refetch()` manual. Konsisten dengan React Query, menghormati `staleTime`, dan komponen yang unmount tidak ikut fetch.
- **Debounce ~200 ms** per queryKey untuk meredam invalidasi beruntun (mis. reset checklist massal) → cegah refetch storm.
- **Cleanup** `supabase.removeChannel(channel)` di return effect. `channel` & `supabase` dibuat via `useMemo`/ref agar tidak di-recreate tiap render (perbaikan atas pola lama).
- Logika murni (pemetaan event→queryKey, debounce) diekstrak ke fungsi teruji unit; hook hanya wiring.

Hook ini **menggantikan** blok `useEffect`+`channel` yang di-copy-paste di 4 halaman existing (merapikan, bukan menambah).

---

## 3. Peta Surface → Tabel → QueryKey (echo vs optimistic)

Strategi feedback: **campur** — optimistic untuk jalur panas (absen kiosk, toggle checklist), realtime echo untuk sisanya.

| Surface | Tabel yang di-subscribe | Filter | QueryKey di-invalidate | Feedback |
|---|---|---|---|---|
| papan-kehadiran | attendance, outlet_attendance_config, global_settings | `outlet_id=eq.{outlet}` (config/attendance) | `['papan-kehadiran', outlet, today]` | echo |
| Kiosk panel / crew dashboard (`AttendanceKioskPanel`) | attendance, outlet_attendance_config | own outlet | panel state | **optimistic** (absen langsung tampil) + echo |
| checklist (crew), kru-checklist, checklist-monitor | daily_checklist_ticks, daily_checklist_records, checklist_items, checklist_categories | via outlet/record | checklist queryKeys | **optimistic** toggle + echo |
| Cuti (CutiView) — pengaju | leave_requests | `staff_id=eq.{uid}` | `['leaves', uid]`, `['leaveBalance', uid, year]` | echo (submit boleh optimistic) |
| Cuti — approver (SPV/HR) | leave_requests | scope outlet/role | daftar approval | echo |
| Kasbon (KasbonView) | cash_advances, cash_advance_installments | `staff_id=eq.{uid}` / scope approver | `['kasbon', uid]` | echo |
| Manajemen Kru | outlet_staff | `outlet_id=eq.{outlet}` | daftar staff | echo (muncul/hilang instan) |
| Pengaturan | outlet_attendance_config, global_settings | `outlet_id=eq.{outlet}` | config queryKey | echo |
| Rekap | attendance | `outlet_id=eq.{outlet}` (+ rentang tanggal di klien) | rekap queryKey | echo |

**Notifikasi cuti:** buang `refetchInterval: 15000` di `useLeaveNotifications`; ganti dengan invalidasi dari subscription `leave_requests` (badge unread update via realtime, bukan polling).

---

## 4. Migration DB (aditif)

`supabase/migrations/2026071012xxxx_absensi_realtime_publication.sql`:

1. **Tambah ke publication** `supabase_realtime` (idempotent, cek dulu belum ada):
   `leave_requests`, `cash_advances`, `cash_advance_installments`, `outlet_staff`, `outlet_attendance_config`, `global_settings`, `daily_checklist_records`, `checklist_items`, `checklist_categories`.
   (`attendance`, `daily_checklist_ticks` sudah ada.)
2. **`REPLICA IDENTITY FULL`** untuk tabel yang di-filter dan/atau bisa DELETE, agar event DELETE membawa baris lama & lolos filter + RLS:
   `attendance`, `leave_requests`, `cash_advances`, `cash_advance_installments`, `outlet_staff`, `daily_checklist_ticks`, `daily_checklist_records`, `outlet_attendance_config`.
   (Biaya WAL kecil untuk tabel-tabel bervolume rendah ini — dapat diterima.)
3. **Audit RLS SELECT.** Realtime `postgres_changes` hanya mengirim baris yang boleh di-`SELECT` user tersebut. Verifikasi:
   - SPV/HR bisa `SELECT` `leave_requests`/`cash_advances` untuk crew di outlet mereka (kalau tidak, approval tidak akan realtime).
   - `outlet_staff` visible per outlet untuk board/manajemen-kru.
   Tambahkan/perluas policy hanya bila kurang (aditif, tidak melonggarkan lintas-outlet).

**Isolasi:** menambah tabel absensi ke `supabase_realtime` tidak mengganggu app lain. Hook bersifat app-local (`apps/absensi`), tidak menyentuh `@suka/auth` atau app lain.

---

## 5. Ringan / Performa

- **Satu channel per scope, multiplex** banyak tabel → minimalkan koneksi realtime (batas concurrent connection Supabase).
- `invalidate` (bukan `refetch`) + **debounce** → hindari badai fetch; hanya query yang aktif & stale yang benar-benar fetch ulang.
- Subscribe **hanya di halaman yang butuh** (channel dibuat saat mount, dilepas saat unmount).
- Di kiosk, loop deteksi wajah (WebGL) sudah bersaing dgn UI; pendekatan invalidate ringan + optimistic mencegah refetch berat menabrak loop.
- `global_settings` tanpa filter outlet = tabel kecil, semua klien menerima perubahannya; dapat diterima (jarang berubah).

---

## 6. Testing & Verifikasi

- **Unit test** logika murni: pemetaan event→queryKey, debounce (tanpa DOM).
- **Type-check** bersih, **vitest** hijau (pertahankan suite existing).
- **Smoke 2-device** (bukti realtime, tanpa refresh):
  1. Crew absen di kiosk → papan-kehadiran device SPV update < 1 dtk.
  2. SPV approve cuti → layar crew berubah status + badge, tanpa refresh.
  3. Hapus/nonaktifkan staff di Manajemen Kru → baris hilang instan di device lain.
  4. Toggle checklist → monitor SPV update instan.
- **Regresi:** pastikan `outlet_attendance_config`/`global_settings` kini benar-benar memicu update (dulu mati).

---

## 7. Non-Goals (YAGNI)

- Tidak membangun client store ternormalisasi (Zustand) — overkill.
- Tidak mengubah mekanisme auth/SSO.
- Tidak menambah presence/broadcast (typing indicator dll) — di luar goal.
- Tidak menyentuh app lain (stok/distribusi/admin-dashboard).

---

## 8. Urutan Implementasi (ringkas)

1. Migration publication + `REPLICA IDENTITY FULL` + audit RLS.
2. Hook `useRealtimeInvalidate` + unit test.
3. Refactor 4 halaman existing ke hook (hapus refetch manual).
4. Pasang subscription baru: cuti, kasbon, manajemen-kru, pengaturan, rekap; buang polling notifikasi cuti.
5. Optimistic pada jalur panas (kiosk absen, toggle checklist).
6. Smoke 2-device + type-check + vitest.
7. Catat di CLAUDE.md; redeploy `absensi.sukashawarma.com`.
