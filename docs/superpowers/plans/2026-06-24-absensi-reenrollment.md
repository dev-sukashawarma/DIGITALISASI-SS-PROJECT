# Re-enrollment Wajah (SPV-driven) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beri SPV/leader kemampuan meng-enroll-ulang wajah crew yang sudah terdaftar, dengan konfirmasi + audit, sekaligus membereskan tools reset wajah lama yang berisiko/bermasalah.

**Architecture:** Tambah 3 kolom audit di `outlet_staff` (migration aditif). Halaman enroll yang sudah ada (SPV-only) diperluas menjadi dua section ("Belum Terdaftar" + "Sudah Terdaftar"); section kedua memicu alur capture 3-angle yang sama dengan flag re-enroll yang menulis kolom audit. Tombol bulk-reset berbahaya dihapus dan endpoint debug `unenroll` diperbaiki agar konsisten.

**Tech Stack:** Next.js (app router) + TypeScript, Supabase (Postgres + JS client), @vladmandic/human (capture), vitest (unit test helper murni).

**Spec:** `docs/superpowers/specs/2026-06-24-absensi-reenrollment-design.md`

---

## File Structure

- **Create** `supabase/migrations/20260624100000_outlet_staff_reenroll_audit.sql` — kolom audit re-enroll.
- **Create** `apps/absensi/src/lib/enroll/splitByEnrollment.ts` — helper murni memisah staff terdaftar vs belum (testable).
- **Create** `apps/absensi/src/lib/enroll/splitByEnrollment.test.ts` — unit test helper.
- **Modify** `apps/absensi/src/app/dashboard/enroll/page.tsx` — query semua staff aktif, dua section, alur re-enroll + tulis audit.
- **Modify** `apps/absensi/src/app/dashboard/DashboardSettings.tsx` — hapus tombol bulk "Reset Wajah".
- **Modify** `apps/absensi/src/app/api/debug/reset/route.ts` — perbaiki `unenroll` agar null-kan `enrolled_at` + `ref_photo_url`.

---

## Task 1: Migration kolom audit re-enroll

**Files:**
- Create: `supabase/migrations/20260624100000_outlet_staff_reenroll_audit.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- Kolom audit untuk re-enrollment wajah (SPV-driven).
-- Aditif murni: tidak mengubah/menghapus objek existing.
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS re_enrolled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS re_enrolled_by   uuid,
  ADD COLUMN IF NOT EXISTS re_enroll_reason text;

COMMENT ON COLUMN outlet_staff.re_enrolled_at   IS 'Waktu re-enroll wajah terakhir';
COMMENT ON COLUMN outlet_staff.re_enrolled_by   IS 'outlet_staff.id SPV/leader yang melakukan re-enroll';
COMMENT ON COLUMN outlet_staff.re_enroll_reason IS 'Alasan re-enroll (opsional)';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260624100000_outlet_staff_reenroll_audit.sql
git commit -m "feat(absensi): migration kolom audit re-enroll outlet_staff"
```

> **Catatan push DB:** JANGAN `supabase db push` polos. History remote sering drift —
> jalankan `supabase migration list`, dan bila perlu `supabase migration repair --status applied <ts>`
> sebelum push. Push DB dilakukan terpisah saat deploy, bukan bagian dari eksekusi kode ini.

---

## Task 2: Helper murni `splitByEnrollment` (TDD)

Memisah daftar staff menjadi yang belum & sudah enroll. Diekstrak agar logika bisa diuji
tanpa DOM/kamera.

**Files:**
- Create: `apps/absensi/src/lib/enroll/splitByEnrollment.ts`
- Test: `apps/absensi/src/lib/enroll/splitByEnrollment.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { describe, it, expect } from "vitest";
import { splitByEnrollment, type EnrollStaff } from "./splitByEnrollment";

const mk = (id: string, enrolled_at: string | null): EnrollStaff =>
  ({ id, name: id, role: "crew", enrolled_at });

describe("splitByEnrollment", () => {
  it("memisah staff terdaftar vs belum berdasarkan enrolled_at", () => {
    const { unenrolled, enrolled } = splitByEnrollment([
      mk("a", null),
      mk("b", "2026-06-01T00:00:00Z"),
      mk("c", null),
    ]);
    expect(unenrolled.map((s) => s.id)).toEqual(["a", "c"]);
    expect(enrolled.map((s) => s.id)).toEqual(["b"]);
  });

  it("mengembalikan dua array kosong untuk input kosong", () => {
    const { unenrolled, enrolled } = splitByEnrollment([]);
    expect(unenrolled).toEqual([]);
    expect(enrolled).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `cd apps/absensi && npm test -- run src/lib/enroll/splitByEnrollment.test.ts`
Expected: FAIL — `Cannot find module './splitByEnrollment'`.

- [ ] **Step 3: Tulis implementasi minimal**

```ts
export type EnrollStaff = {
  id: string;
  name: string;
  role: string;
  enrolled_at: string | null;
};

/** Pisah staff menjadi yang belum enroll (enrolled_at null) dan yang sudah. */
export function splitByEnrollment<T extends { enrolled_at: string | null }>(
  staff: T[],
): { unenrolled: T[]; enrolled: T[] } {
  const unenrolled: T[] = [];
  const enrolled: T[] = [];
  for (const s of staff) {
    if (s.enrolled_at) enrolled.push(s);
    else unenrolled.push(s);
  }
  return { unenrolled, enrolled };
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `cd apps/absensi && npm test -- run src/lib/enroll/splitByEnrollment.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/lib/enroll/splitByEnrollment.ts apps/absensi/src/lib/enroll/splitByEnrollment.test.ts
git commit -m "feat(absensi): helper splitByEnrollment + test"
```

---

## Task 3: Halaman enroll — tarik semua staff aktif + dua section

Ubah sumber data & render. Belum menambah logika simpan re-enroll (Task 4).

**Files:**
- Modify: `apps/absensi/src/app/dashboard/enroll/page.tsx`

- [ ] **Step 1: Import helper**

Tambah setelah baris `import { OutletSwitcher } from "@/components/OutletSwitcher";`:

```ts
import { splitByEnrollment } from "@/lib/enroll/splitByEnrollment";
```

- [ ] **Step 2: Hapus filter `enrolled_at` di query staff**

Ganti blok query (saat ini memfilter belum terdaftar):

```ts
    supabase
      .from("outlet_staff")
      .select("id, name, role, enrolled_at")
      .eq("outlet_id", selectedOutletId)
      .eq("status", "active")
      .is("enrolled_at", null)
      .order("name")
      .then(({ data }) => {
        setStaffList((data as Staff[]) ?? []);
        setLoadingStaff(false);
      });
```

menjadi (tanpa `.is("enrolled_at", null)`):

```ts
    supabase
      .from("outlet_staff")
      .select("id, name, role, enrolled_at")
      .eq("outlet_id", selectedOutletId)
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        setStaffList((data as Staff[]) ?? []);
        setLoadingStaff(false);
      });
```

- [ ] **Step 3: Derivasi dua section sebelum `return (`**

Tambah tepat sebelum `return (` di body komponen:

```ts
  const { unenrolled, enrolled } = splitByEnrollment(staffList);
```

- [ ] **Step 4: Ganti render daftar `phase === "list"`**

Ganti isi conditional render daftar yang sekarang memetakan `staffList.map(...)`.
Cari blok yang dimulai `{staffList.map((s) => (` di dalam `phase === "list"` dan ganti
seluruh cabang grid (saat `staffList.length > 0`) sehingga menampilkan dua section.
Ganti dari kondisi:

```tsx
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {staffList.map((s) => (
```

...sampai penutup grid+conditional...

```tsx
              ))}
            </div>
          )}
```

menjadi:

```tsx
          ) : (
            <div className="space-y-8">
              {/* Section: Belum Terdaftar */}
              {unenrolled.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">Belum Terdaftar ({unenrolled.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {unenrolled.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectCrew(s)}
                        className="bg-white p-4 rounded-2xl border-2 border-gray-200 hover:border-suka-orange hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
                      >
                        <div className="w-12 h-12 bg-suka-cream rounded-full flex items-center justify-center text-suka-brown font-bold shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-suka-ink truncate group-hover:text-suka-orange transition-colors">{s.name}</h4>
                          <p className="text-xs text-gray-500 capitalize">{s.role}</p>
                        </div>
                        <div className="shrink-0 text-suka-orange/0 group-hover:text-suka-orange transition-colors">
                          <ArrowRight size={20} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Sudah Terdaftar (Enroll Ulang) */}
              {enrolled.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-suka-green uppercase tracking-wider">Sudah Terdaftar ({enrolled.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {enrolled.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white p-4 rounded-2xl border-2 border-gray-100 flex items-center gap-4"
                      >
                        <div className="w-12 h-12 bg-emerald-50 text-suka-green rounded-full flex items-center justify-center font-bold shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-suka-ink truncate">{s.name}</h4>
                          <p className="text-xs text-gray-500 capitalize">{s.role} · <span className="text-suka-green font-semibold">Terdaftar</span></p>
                        </div>
                        <button
                          onClick={() => handleReEnroll(s)}
                          className="shrink-0 text-xs font-bold text-suka-brown bg-suka-cream border border-suka-orange/30 px-3 py-2 rounded-lg hover:bg-suka-orange hover:text-white transition-colors"
                        >
                          Enroll Ulang
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
```

> Catatan: `handleReEnroll` dibuat di Task 4. Untuk Task 3, biar type-check lewat, tambahkan
> stub sementara di Step 5.

- [ ] **Step 5: Tambah stub `handleReEnroll`**

Tambah tepat di bawah fungsi `handleSelectCrew`:

```ts
  function handleReEnroll(s: Staff) {
    handleSelectCrew(s); // sementara: perilaku penuh di Task 4
  }
```

- [ ] **Step 6: Type-check**

Run: `cd apps/absensi && npm run type-check`
Expected: 0 error.

- [ ] **Step 7: Commit**

```bash
git add apps/absensi/src/app/dashboard/enroll/page.tsx
git commit -m "feat(absensi): halaman enroll dua section (belum/sudah terdaftar)"
```

---

## Task 4: Alur re-enroll — flag, alasan, dan tulis audit

Lengkapi `handleReEnroll`, fase consent yang menampilkan info re-enroll + input alasan,
dan cabang simpan audit di `saveAuto`.

**Files:**
- Modify: `apps/absensi/src/app/dashboard/enroll/page.tsx`

- [ ] **Step 1: Tambah state re-enroll**

Tambah setelah baris `const [consent, setConsent] = useState(false);`:

```ts
  const [isReEnroll, setIsReEnroll] = useState(false);
  const [reEnrollReason, setReEnrollReason] = useState("");
```

- [ ] **Step 2: Implementasi `handleReEnroll` penuh**

Ganti stub dari Task 3:

```ts
  function handleReEnroll(s: Staff) {
    handleSelectCrew(s); // sementara: perilaku penuh di Task 4
  }
```

menjadi:

```ts
  function handleReEnroll(s: Staff) {
    setTargetStaff(s);
    setConsent(false);
    setIsReEnroll(true);
    setReEnrollReason("");
    setPhase("consent");
  }
```

- [ ] **Step 3: Reset flag di `handleSelectCrew` dan `handleCancel`**

Di `handleSelectCrew`, tambahkan `setIsReEnroll(false);` setelah `setConsent(false);`.
Di `handleCancel`, tambahkan `setIsReEnroll(false); setReEnrollReason("");` setelah `setConsent(false);`.

- [ ] **Step 4: Tampilkan badge + input alasan di fase consent**

Di blok `phase === "consent"`, tepat sebelum `<div className="space-y-3">` (blok Persetujuan Privasi),
sisipkan blok khusus re-enroll:

```tsx
          {isReEnroll && (
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-semibold flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                Enroll Ulang: data wajah lama {targetStaff.name} akan ditimpa dan tidak bisa dikembalikan.
              </div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alasan (opsional)</label>
              <input
                type="text"
                value={reEnrollReason}
                onChange={(e) => setReEnrollReason(e.target.value)}
                placeholder="mis. wajah sering gagal terdeteksi"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-suka-orange outline-none"
              />
            </div>
          )}
```

`AlertTriangle` sudah diimpor di file ini (dipakai untuk modelError).

- [ ] **Step 5: Tulis kolom audit di `saveAuto`**

Di `saveAuto`, ganti objek update:

```ts
        .update({
          face_descriptor: descriptor,
          ref_photo_url: refPath,
          consent_at: new Date().toISOString(),
          consent_by: outletStaff.id,
          enrolled_at: new Date().toISOString(),
        })
```

menjadi:

```ts
        .update({
          face_descriptor: descriptor,
          ref_photo_url: refPath,
          consent_at: new Date().toISOString(),
          consent_by: outletStaff.id,
          enrolled_at: new Date().toISOString(),
          ...(isReEnroll && {
            re_enrolled_at: new Date().toISOString(),
            re_enrolled_by: outletStaff.id,
            re_enroll_reason: reEnrollReason.trim() || null,
          }),
        })
```

- [ ] **Step 6: Perbarui daftar lokal setelah simpan (jangan hapus baris)**

Di `saveAuto`, ganti pembaruan list yang menghapus staff:

```ts
      // Update local list to remove enrolled staff
      setStaffList(prev => prev.filter(s => s.id !== targetStaff.id));
```

menjadi pembaruan `enrolled_at` agar staff pindah ke section "Sudah Terdaftar":

```ts
      // Tandai staff sebagai terdaftar (pindah ke section "Sudah Terdaftar")
      setStaffList(prev => prev.map(s =>
        s.id === targetStaff.id ? { ...s, enrolled_at: new Date().toISOString() } : s
      ));
```

- [ ] **Step 7: Sesuaikan `resetToNext` (tidak lagi andalkan list menyusut)**

`resetToNext` saat ini memakai `staffList[0]`. Karena list kini berisi semua staff,
ganti agar memilih crew yang BELUM terdaftar berikutnya, atau kembali ke daftar.
Ganti fungsi `resetToNext`:

```ts
  function resetToNext() {
    const next = staffList.find((s) => !s.enrolled_at && s.id !== targetStaff?.id);
    if (next) {
      setTargetStaff(next);
      setConsent(false);
      setIsReEnroll(false);
      setReEnrollReason("");
      setShots([]);
      setPhase("consent");
    } else {
      handleCancel();
    }
  }
```

Dan pada blok "Done Overlay", tombol "Lanjut Enroll Crew Berikutnya" sebaiknya hanya muncul
bila masih ada yang belum terdaftar. Ganti kondisi `staffList.length > 0 ?` di Done Overlay
menjadi `unenrolled.length > 0 ?`.

- [ ] **Step 8: Type-check**

Run: `cd apps/absensi && npm run type-check`
Expected: 0 error.

- [ ] **Step 9: Commit**

```bash
git add apps/absensi/src/app/dashboard/enroll/page.tsx
git commit -m "feat(absensi): alur re-enroll wajah + audit (re_enrolled_at/by/reason)"
```

---

## Task 5: Cleanup tombol bulk "Reset Wajah"

**Files:**
- Modify: `apps/absensi/src/app/dashboard/DashboardSettings.tsx`

- [ ] **Step 1: Hapus fungsi `resetFaces`**

Hapus seluruh fungsi:

```ts
  async function resetFaces() {
    if (!outletStaff || !confirm("Yakin mereset semua wajah staff?")) return;
    const { error } = await supabase.from("outlet_staff")
      .update({ face_descriptor: null, ref_photo_url: null, enrolled_at: null })
      .eq("outlet_id", outletStaff.outlet_id);
    if (error) toast.show("err", "Gagal reset wajah");
    else toast.show("ok", "Semua wajah berhasil direset (belum terdaftar)");
  }
```

- [ ] **Step 2: Hapus tombolnya**

Hapus elemen tombol:

```tsx
          <button onClick={resetFaces} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
            <Trash2 size={15} /> Reset Wajah (Un-enroll)
          </button>
```

- [ ] **Step 3: Type-check (bersihkan import tak terpakai bila ada)**

Run: `cd apps/absensi && npm run type-check`
Expected: 0 error. Bila `Trash2` masih dipakai tombol Reset Log → biarkan; bila tidak,
hapus dari import `lucide-react`. (Tombol Reset Log masih memakai `Trash2`, jadi import tetap.)

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/dashboard/DashboardSettings.tsx
git commit -m "refactor(absensi): hapus bulk reset wajah per-outlet (diganti re-enroll per-crew)"
```

---

## Task 6: Perbaiki bug endpoint debug `unenroll`

**Files:**
- Modify: `apps/absensi/src/app/api/debug/reset/route.ts`

- [ ] **Step 1: Perbaiki update agar konsisten**

Ganti:

```ts
    if (action === "unenroll") {
      const { error } = await supabaseAdmin
        .from("outlet_staff")
        .update({ face_descriptor: null })
        .eq("id", outlet_staff_id);
```

menjadi:

```ts
    if (action === "unenroll") {
      const { error } = await supabaseAdmin
        .from("outlet_staff")
        .update({ face_descriptor: null, enrolled_at: null, ref_photo_url: null })
        .eq("id", outlet_staff_id);
```

- [ ] **Step 2: Type-check**

Run: `cd apps/absensi && npm run type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/src/app/api/debug/reset/route.ts
git commit -m "fix(absensi): unenroll debug null-kan enrolled_at + ref_photo_url (hindari state terjebak)"
```

---

## Task 7: Verifikasi akhir

- [ ] **Step 1: Type-check & test penuh app absensi**

Run: `cd apps/absensi && npm run type-check && npm test -- run`
Expected: 0 type error; semua test (termasuk `splitByEnrollment` + face tests) PASS.

- [ ] **Step 2: Smoke test manual (kamera) — checklist**

Tidak otomatis. Verifikasi di browser:
- Halaman `/dashboard/enroll` menampilkan dua section.
- Crew terdaftar punya tombol "Enroll Ulang" → dialog konfirmasi + input alasan muncul.
- Re-enroll menyimpan deskriptor baru; cek di DB kolom `re_enrolled_at/by/reason` terisi.
- Absen 1:1 (akun sendiri) tetap bekerja dengan wajah yang baru di-enroll-ulang.
- Tombol bulk "Reset Wajah" sudah hilang dari Alat testing dashboard.

---

## Self-Review Notes

- **Spec coverage:** migration kolom audit (T1), dua section (T3), konfirmasi+alasan+audit (T4),
  bedakan enroll vs re-enroll di saveAuto (T4), cleanup bulk reset (T5), fix endpoint debug (T6),
  akses SPV-only diwarisi (tak ada perubahan guard, sesuai spec), testing (T2/T7). Semua tercakup.
- **Catatan:** push DB & push kode dilakukan terpisah saat deploy (di-bundle dengan perubahan
  threshold 0.45 + mode 1:1 sesuai permintaan user "push sekalian nanti").
