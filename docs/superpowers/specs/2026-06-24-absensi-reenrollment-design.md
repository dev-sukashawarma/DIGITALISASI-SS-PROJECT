# Spec: Re-enrollment Wajah (SPV-driven) — apps/absensi

**Tanggal:** 2026-06-24
**Status:** Disetujui (brainstorming) — siap masuk plan
**Scope:** apps/absensi

## Latar Belakang

Sistem enrollment wajah saat ini **tidak punya alur re-enrollment yang proper**. Yang ada:

1. Halaman enroll ([enroll/page.tsx](../../../apps/absensi/src/app/dashboard/enroll/page.tsx))
   hanya menampilkan crew dengan `enrolled_at IS NULL`. Begitu terdaftar, crew hilang
   dari daftar dan tak bisa didaftarkan ulang lewat UI.
2. Satu-satunya jalan re-enroll = reset paksa lewat "alat testing":
   - **Bulk reset per-outlet** ([DashboardSettings.tsx](../../../apps/absensi/src/app/dashboard/DashboardSettings.tsx))
     — null-kan `face_descriptor`+`ref_photo_url`+`enrolled_at` untuk **seluruh outlet** sekaligus. Rawan kepencet di produksi.
   - **Self un-enroll** via `api/debug/reset` (`unenroll`) — **bug**: hanya null-kan
     `face_descriptor`, tidak `enrolled_at`/`ref_photo_url` → crew "terjebak" (tak bisa
     absen DAN tak muncul di daftar enroll).
3. Tidak ada audit siapa/kapan/kenapa re-enroll.

## Keputusan Desain (hasil brainstorming)

| Aspek | Keputusan |
|---|---|
| Pemicu | **SPV/leader langsung re-enroll** (tanpa request dari crew, tanpa approval workflow) |
| Tampilan | **Dua section** di halaman enroll: "Belum Terdaftar" + "Sudah Terdaftar (Enroll Ulang)" |
| Audit & konfirmasi | **Konfirmasi + audit lengkap**: dialog timpa + alasan opsional + catat actor & waktu |
| Penyimpanan audit | **Kolom di `outlet_staff`** (re-enroll terakhir saja, bukan tabel log) |
| Cleanup lama | **Bereskan keduanya**: amankan bulk reset + perbaiki bug endpoint debug |
| Akses | Tetap **SPV/leader-only** (page guard sudah ada) |

## Desain

### 1. Database (migration aditif)

Tambah 3 kolom ke `outlet_staff`:

```sql
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS re_enrolled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS re_enrolled_by   uuid,
  ADD COLUMN IF NOT EXISTS re_enroll_reason text;
```

- Aditif murni — tidak mengubah kolom/objek existing, tidak menyentuh app lain.
- File: `supabase/migrations/<timestamp>_outlet_staff_reenroll_audit.sql`.
- Catatan: history remote sering drift — ikuti playbook `migration repair` sebelum `db push`.

### 2. UI Halaman Enroll — dua section

Ubah query di [enroll/page.tsx](../../../apps/absensi/src/app/dashboard/enroll/page.tsx):
- Hapus filter `.is("enrolled_at", null)`; tarik **semua staff aktif** (`status = active`)
  beserta `enrolled_at`.
- Pisah di client jadi dua array berdasarkan `enrolled_at`.

Render:
- **Section "Belum Terdaftar"** — perilaku sekarang, tombol "Daftarkan".
- **Section "Sudah Terdaftar"** — kartu crew dengan badge "Terdaftar" + tanggal `enrolled_at`,
  tombol **"Enroll Ulang"**.

Klik "Enroll Ulang":
1. Dialog konfirmasi: *"Timpa data wajah [Nama]? Data wajah lama tidak bisa dikembalikan."*
2. Input alasan singkat (opsional).
3. Masuk fase consent → capture 3-angle (reuse alur `center`/`left`/`right` yang ada).

### 3. Logika simpan (bedakan enroll vs re-enroll)

`saveAuto` diberi konteks mode (mis. state `reEnrollTarget`/`isReEnroll` + `reEnrollReason`):

- **Enroll baru** (perilaku sekarang): set `face_descriptor`, `ref_photo_url`,
  `consent_at`, `consent_by`, `enrolled_at`.
- **Re-enroll**: set semua di atas **(refresh `enrolled_at` & `consent_at/by`)** PLUS:
  - `re_enrolled_at = now()`
  - `re_enrolled_by = outletStaff.id` (SPV/leader yang login)
  - `re_enroll_reason = <input>` (boleh null)
  - Karena `enrolled_at` di-refresh & `face_descriptor` terisi, crew yang sebelumnya
    "terjebak" otomatis pulih.

### 4. Cleanup tools lama

- **DashboardSettings.tsx**: hapus tombol & fungsi `resetFaces` (bulk reset per-outlet).
  Re-enroll per-crew menggantikan kebutuhannya. `resetAttendance` (log) tetap.
- **api/debug/reset/route.ts** (`unenroll`): null-kan `face_descriptor` **+ `enrolled_at`
  + `ref_photo_url`** agar konsisten dengan DashboardSettings — hilangkan state "terjebak".

### 5. Akses & Keamanan

- Tetap SPV/leader-only. Page-level guard `/dashboard/enroll` yang sudah ada meng-cover
  jalur re-enroll (komponen sama).
- Tidak ada jalur crew self-service untuk re-enroll.

### 6. Testing

- Mayoritas perubahan = UI + DB; verifikasi via `npm run type-check` (0 error) + smoke test
  manual (kamera): re-enroll crew terdaftar, pastikan deskriptor lama tertimpa & absen 1:1
  tetap bekerja.
- Jika ada helper murni baru, tambahkan unit test (vitest). Tidak ada logika numerik baru
  yang diharapkan.

## Out of Scope

- Approval workflow / request dari crew (sengaja tidak dipilih).
- Tabel audit log append-only (memilih kolom di `outlet_staff`).
- Quality-check capture (blur/brightness) — backlog terpisah.
- Perubahan threshold matching / mode 1:1 (sudah dikerjakan terpisah di sesi ini).
