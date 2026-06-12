# Tugas Lanjutan — Absensi UI Redesain (Tasks 14-17)

> **Status:** Tasks 1-13 COMPLETED dengan semua fixes applied  
> **Branch:** `feat/m1-absensi`  
> **Last commit:** `52098c5` (fix liveness timeout + camera error + reset timers + loop stabilization + match_distance)  
> **Date:** 2026-06-10

---

## 📋 Ringkasan Progres

### ✅ Completed (Tasks 1-13)

1. **T1** — Install `lucide-react` v1.17.0
2. **T2-T3** — Design-system primitives (`StatusPill`, `Avatar`, `EmptyState`, `Spinner`)
3. **T4-T5** — Remove GPS entirely (Edge Function + types)
4. **T6-T7** — Face identify 1:N (`lib/face/identify.ts`) + liveness random challenge (`lib/face/liveness.ts`) — both TDD, tests passing
5. **T8-T9** — Board query logic (`features/board/board.ts`) + CSV export (`features/rekap/csv.ts`) — both TDD, tests passing
6. **T10-T11** — Toast + sound feedback (`lib/feedback/sound.ts` + `lib/feedback/toast.tsx`) + Navbar icon polish (lucide icons, no emoji)
7. **T12-T13** — Clock kiosk hook (`features/clock/useClockKiosk.ts`) + page rewrite (`app/clock/page.tsx`) with auto-identify + random liveness
8. **Fix commit** — Applied 5 code-quality fixes:
   - Liveness timeout (8s) to prevent kiosk getting stuck on one person
   - Camera error feedback (no silent failures)
   - Reset timer tracking/cleanup (unmount safety)
   - Detection loop stabilization (ref-based to prevent excessive re-subscriptions)
   - `match_distance` now sent with real 1:N distance (not hardcoded 0)

### 📊 Current State

- **Files created:** 15+ new files (design-system components, face lib, feedback lib, board/rekap features, kiosk hook)
- **Files modified:** Edge Function, types, Navbar, layout (ToastProvider wrap), clock page
- **Tests:** 20/20 passing (identify, liveness, board, csv)
- **Type-check:** Only pre-existing `@/`-alias resolution issue affecting entire project (out of scope)
- **Branch:** Clean, all commits have proper messages, no uncommitted changes
- **Kiosk flow:** IDLE → identify 1:N → liveness challenge (random, timeout 8s) → submit (online/offline) → result (2.5s) → IDLE

---

## 🚀 Remaining Tasks (14-17)

### Task 14: Dashboard — Papan Kehadiran Hari Ini

**File to modify:** `apps/absensi/src/app/dashboard/page.tsx` (ganti seluruh isi)

**Apa yang dibuat:**
- 4 metric cards: Hadir (hijau), Telat (coklat), Belum hadir (merah), Total staff
- Daftar staff aktif hari ini dengan `StatusPill` (icon + label: Masuk/Telat/Belum/Keluar + jam)
- Query: `outlet_staff` (aktif) + `attendance` (hari ini); hitung status pakai `computeBoard` dari `features/board/board.ts`
- Avatar + role di setiap baris

**Spec content (ganti SELURUH file dengan):**
```tsx
"use client";

import { useEffect, useState } from "react";
import { Avatar, StatusPill, EmptyState, Spinner } from "@suka/design-system";
import { LogIn, LogOut, Clock4, MoreHorizontal, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { computeBoard, type BoardStaff, type BoardRecord, type BoardRow } from "@/features/board/board";

const PILL: Record<BoardRow["state"], { icon: React.ReactNode; label: (t: string | null) => string }> = {
  masuk:  { icon: <LogIn size={13} />,  label: (t) => `Masuk ${t}` },
  telat:  { icon: <Clock4 size={13} />, label: (t) => `Telat ${t}` },
  keluar: { icon: <LogOut size={13} />, label: (t) => `Keluar ${t}` },
  belum:  { icon: <MoreHorizontal size={13} />, label: () => "Belum hadir" },
};

export default function DashboardPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [data, setData] = useState<ReturnType<typeof computeBoard> | null>(null);

  useEffect(() => {
    if (!outletStaff) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [{ data: staff }, { data: recs }] = await Promise.all([
        supabase.from("outlet_staff").select("id,name,role").eq("outlet_id", outletStaff.outlet_id).eq("status", "active"),
        supabase.from("attendance").select("outlet_staff_id,type,status,ts_server")
          .eq("outlet_id", outletStaff.outlet_id).gte("ts_server", `${today}T00:00:00`).lte("ts_server", `${today}T23:59:59`),
      ]);
      setData(computeBoard((staff as BoardStaff[]) ?? [], (recs as BoardRecord[]) ?? []));
    })();
  }, [outletStaff]);

  if (!data) return <div className="p-6 flex justify-center"><Spinner /></div>;

  const cards = [
    { label: "Hadir", value: data.summary.hadir, color: "text-suka-green" },
    { label: "Telat", value: data.summary.telat, color: "text-[#854f0b]" },
    { label: "Belum hadir", value: data.summary.belum, color: "text-red-600" },
    { label: "Total staff", value: data.summary.total, color: "text-suka-ink" },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-suka-brown">Papan kehadiran</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-suka-gray-50 p-3">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-suka-gray-200 bg-white divide-y divide-suka-gray-200">
        {data.rows.length === 0 && <EmptyState icon={<Users size={28} />} title="Belum ada staff aktif" />}
        {data.rows.map((r) => {
          const p = PILL[r.state];
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={r.name} size={34} />
              <div className="flex-1">
                <div className="text-sm font-medium text-suka-ink">{r.name}</div>
                <div className="text-xs text-gray-500 capitalize">{r.role}</div>
              </div>
              <StatusPill kind={r.state}>{p.icon}{p.label(r.time)}</StatusPill>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Steps:**
1. Replace entire file content
2. Run: `yarn workspace @suka/absensi type-check` (expect no errors)
3. Manual check: `localhost:3000/dashboard` shows 4 metric cards + staff list with StatusPill (no emoji)
4. Commit: `git add apps/absensi/src/app/dashboard/page.tsx && git commit -m "feat(absensi): dashboard jadi Papan Kehadiran Hari Ini"`

---

### Task 15: Rekap — ringkasan + selfie + export CSV

**File to modify:** `apps/absensi/src/app/rekap/page.tsx` (ganti seluruh isi)

**Apa yang dibuat:**
- Date picker untuk filter tanggal (bawaan HTML `<input type="date">`)
- 3 metric cards: Tepat (hijau), Telat (coklat), Alpha (merah)
- Daftar attendance per tanggal dengan thumbnail selfie (klik → preview fullscreen)
- Export CSV button → download `rekap-<tanggal>.csv` yang rapi di spreadsheet
- Tipe: LogIn/LogOut icons, jam terformat

**Spec content (ganti SELURUH file dengan):**
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, StatusPill, EmptyState } from "@suka/design-system";
import { Download, LogIn, LogOut, CalendarDays, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { attendanceToCsv, downloadCsv, type CsvRow } from "@/features/rekap/csv";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha";
  selfie_url: string | null;
  outlet_staff: { name: string } | null;
};

const SELFIE_BUCKET = "selfies";

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!outletStaff) return;
    supabase
      .from("attendance")
      .select("id,type,ts_server,ts_client,status,selfie_url,outlet_staff(name)")
      .eq("outlet_id", outletStaff.outlet_id)
      .gte("ts_server", `${date}T00:00:00`)
      .lte("ts_server", `${date}T23:59:59`)
      .order("ts_server", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [outletStaff, date]);

  const summary = useMemo(() => ({
    tepat: rows.filter((r) => r.status === "tepat").length,
    telat: rows.filter((r) => r.status === "telat").length,
    alpha: rows.filter((r) => r.status === "alpha").length,
  }), [rows]);

  function jam(ts: string) {
    return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function selfieUrl(path: string) {
    return supabase.storage.from(SELFIE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function exportCsv() {
    const data: CsvRow[] = rows.map((r) => ({
      name: r.outlet_staff?.name ?? "-", type: r.type, jam: jam(r.ts_server), status: r.status,
    }));
    downloadCsv(`rekap-${date}.csv`, attendanceToCsv(data));
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-suka-brown">Rekap kehadiran</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-md border border-suka-gray-300 px-2 py-1.5 text-sm text-gray-600">
            <CalendarDays size={15} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="outline-none" />
          </label>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-md bg-suka-brown px-3 py-1.5 text-sm font-medium text-white">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([["Tepat", summary.tepat, "text-suka-green"], ["Telat", summary.telat, "text-[#854f0b]"], ["Alpha", summary.alpha, "text-red-600"]] as const).map(([label, val, color]) => (
          <div key={label} className="rounded-lg bg-suka-gray-50 p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-suka-gray-200 bg-white divide-y divide-suka-gray-200">
        {rows.length === 0 && <EmptyState icon={<ClipboardList size={28} />} title="Belum ada data" description="Tidak ada absensi untuk tanggal ini." />}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            {r.selfie_url ? (
              <img src={selfieUrl(r.selfie_url)} alt="selfie" onClick={() => setPreview(selfieUrl(r.selfie_url!))}
                   className="h-10 w-10 cursor-pointer rounded-md object-cover" />
            ) : <Avatar name={r.outlet_staff?.name ?? "?"} size={40} />}
            <div className="flex-1">
              <div className="text-sm font-medium text-suka-ink">{r.outlet_staff?.name ?? "-"}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {r.type === "in" ? <LogIn size={13} /> : <LogOut size={13} />}
                {r.type === "in" ? "Masuk" : "Keluar"} · {jam(r.ts_server)}
              </div>
            </div>
            <StatusPill kind={r.status}>{r.status}</StatusPill>
          </div>
        ))}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6">
          <img src={preview} alt="selfie besar" className="max-h-[80vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
```

**Steps:**
1. Replace entire file content
2. Run: `yarn workspace @suka/absensi type-check` (expect no errors)
3. Manual check: `localhost:3000/rekap` — date picker works, 3 metric cards, selfie thumbnails clickable, Export CSV downloads correctly
4. Commit: `git add apps/absensi/src/app/rekap/page.tsx && git commit -m "feat(absensi): rekap + ringkasan + spot-check selfie + export CSV"`

---

### Task 16: Enroll — poles ikon (no emoji)

**File to modify:** `apps/absensi/src/app/enroll/page.tsx`

**Apa yang diubah:**
- Ganti judul dengan icon Camera (lucide-react)
- Ganti consent checkbox dengan ShieldCheck icon
- Ganti tombol Simpan dengan Save icon
- Ganti pesan sukses/gagal dari `setMsg(emoji...)` ke `toast.show("ok"|"err", text)`
- Hapus semua emoji, ganti dengan ikon + teks

**Detailed changes:**

1. **Add imports:**
   ```tsx
   import { Camera, Save, ShieldCheck } from "lucide-react";
   import { useToast } from "@/lib/feedback/toast";
   ```

2. **Add toast hook** (di dalam komponen, setelah `const supabase = createClient();`):
   ```tsx
   const toast = useToast();
   ```

3. **Change title** (find & replace):
   ```tsx
   // FROM:
   <h1 className="text-xl font-bold">Enroll Wajah Staff</h1>
   
   // TO:
   <h1 className="flex items-center gap-2 text-xl font-bold text-suka-brown"><Camera size={20} /> Enroll wajah staff</h1>
   ```

4. **Change consent label**:
   ```tsx
   // FROM:
   Staff menyetujui pemrosesan data biometrik (UU PDP).
   
   // TO:
   <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-suka-green" /> Staff menyetujui pemrosesan data biometrik (UU PDP).</span>
   ```

5. **Change save button**:
   ```tsx
   // FROM:
   <Button onClick={save} disabled={shots.length === 0}>
     Simpan
   </Button>
   
   // TO:
   <Button onClick={save} disabled={shots.length === 0}>
     <span className="flex items-center gap-1.5"><Save size={16} /> Simpan</span>
   </Button>
   ```

6. **Change success/error messages** (in `save` function):
   ```tsx
   // FROM:
   setMsg(error ? `❌ ${error.message}` : "✅ Enroll tersimpan.");
   
   // TO:
   if (error) toast.show("err", error.message);
   else toast.show("ok", "Enroll tersimpan");
   ```

7. **Change face-detection error** (in `takeShot` function):
   ```tsx
   // FROM:
   if (!d) return setMsg("Wajah tidak terdeteksi.");
   
   // TO:
   if (!d) return toast.show("err", "Wajah tidak terdeteksi");
   ```

**Steps:**
1. Add imports and toast hook
2. Apply all 6 label/button/message changes
3. Run: `yarn workspace @suka/absensi type-check` (expect no errors)
4. Commit: `git add apps/absensi/src/app/enroll/page.tsx && git commit -m "refactor(absensi): poles enroll dengan ikon + toast (hapus emoji)"`

---

### Task 17: Verifikasi Akhir — full test + build

**Files:** (tidak ada — verification only)

**Apa yang diverifikasi:**

1. **Run semua unit tests:**
   ```bash
   cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test
   ```
   **Expected:** All tests PASS (identify, liveness, board, csv, + existing tests from M1)

2. **Type-check kedua paket:**
   ```bash
   cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check && yarn workspace @suka/design-system type-check
   ```
   **Expected:** No errors di kedua paket

3. **Build produksi (static export):**
   ```bash
   cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi build
   ```
   **Expected:** Build sukses, `out/` folder tergenerate, tanpa error "Module not found"

4. **Grep untuk emoji yang tersisa:**
   ```bash
   cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT/apps/absensi && grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/ || echo "BERSIH: tak ada emoji"
   ```
   **Expected:** Output `BERSIH: tak ada emoji` (atau hanya di komentar/test yang tidak tampil ke user)

5. **Grep untuk referensi GPS di alur absen:**
   ```bash
   cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT/apps/absensi && grep -rn "getCurrentPosition\|gps_lat\|outside_radius" src/app src/features || echo "BERSIH: GPS lepas dari alur"
   ```
   **Expected:** Output `BERSIH: GPS lepas dari alur`

6. **Optional: Commit catatan verifikasi:**
   ```bash
   git add -A && git commit -m "chore(absensi): verifikasi akhir redesain UI kiosk lulus"
   ```

---

## 📝 Implementation Notes

- **Subagent-Driven Development** approach: Fresh subagent per task → spec-compliance reviewer → code-quality reviewer
- **TDD only for pure logic** (identify, liveness, board, csv). UI/pages verified via type-check + build + manual E2E
- **Anti-curang architecture** = face 1:N identify + random liveness challenge + selfie audit. GPS fully removed
- **Scalability**: folder `features/*` isolates business logic; unit tests are reusable; export CSV = first data integration contract
- **Performance**: No GPS wait; liveness free from landmark model already loaded; icons tree-shaken; face descriptors cached per kiosk session

---

## 🔗 Related Files

- **Plan:** `docs/superpowers/plans/2026-06-10-absensi-ui-redesign.md` (full spec, lines 1446-1847 for Tasks 14-17)
- **Design Spec:** `docs/superpowers/specs/2026-06-10-absensi-ui-redesign-design.md`
- **Design System:** `packages/design-system/src/components/` (StatusPill, Avatar, EmptyState, Spinner)
- **Face Library:** `apps/absensi/src/lib/face/` (identify.ts, liveness.ts, recognizer.ts, match.ts)
- **Attendance:** `apps/absensi/src/lib/attendance/` (types.ts, submit.ts, useAttendanceQueue.ts)
- **Feedback:** `apps/absensi/src/lib/feedback/` (sound.ts, toast.tsx)
- **Board & CSV:** `apps/absensi/src/features/` (board/board.ts, rekap/csv.ts)
- **Kiosk Hook:** `apps/absensi/src/features/clock/useClockKiosk.ts`
- **AuthContext:** `apps/absensi/src/context/AuthContext.tsx`
- **Tailwind Design Tokens:** `suka-green`, `suka-brown`, `suka-orange`, `suka-cream`, `suka-ink`, `suka-gray-*` (in design system)

---

## ⚡ Quick Start for Next Agent

```bash
# Clone branch context
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT
git log --oneline -10  # See last 10 commits

# Start Task 14 (Dashboard)
# Edit: apps/absensi/src/app/dashboard/page.tsx
# Copy spec content from this file into the page
# Type-check + commit

# Continue to Tasks 15, 16, 17...
```

---

## ✅ Acceptance Criteria Summary

**Task 14:** Dashboard loads 4 metric cards (hadir/telat/belum/total), staff list with StatusPill + Avatar, no emoji, type-check clean, committed  
**Task 15:** Rekap page with date picker, 3 summary cards, selfie thumbnails clickable, Export CSV generates proper CSV file, type-check clean, committed  
**Task 16:** Enroll page icons (Camera/Save/ShieldCheck), toast feedback (no emoji), type-check clean, committed  
**Task 17:** All tests pass, type-check clean both pakets, build succeeds, grep verifies emoji-free + GPS-free alur, optional commit

---

**Created by:** Claude (Haiku 4.5) — Subagent-Driven Development, Task 1-13 + fixes  
**For:** Next AI agent continuing Tasks 14-17  
**Date:** 2026-06-10
