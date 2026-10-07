# Bot HRD di Dashboard HR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HRD bisa bertanya soal kehadiran, telat, alpa/belum hadir, cuti, kasbon agregat, dan ceklist harian lewat widget chat di dashboard HR, dijawab Hermes profil `hrd` yang membaca data lewat MCP domain `absensi` di admin-dashboard.

**Architecture:** Rumus papan kehadiran, alpa virtual rekap, filter staf tes, dan nilai ceklist dipindah ke package baru `@suka/hr-rumus` (satu sumber rumus untuk app absensi, HR, dan admin-dashboard). Admin-dashboard menambah 6 alat MCP domain `absensi` (baca-saja, service role, agregasi berat lewat 2 RPC baru). App HR memanggil Hermes API server profil `hrd` lewat jaringan internal VPS dari server action; riwayat chat disimpan di 2 tabel baru ber-RLS milik sendiri.

**Tech Stack:** Next.js 16 (app router, server actions), TypeScript, Supabase (Postgres RPC + RLS), zod v4, vitest, Hermes Agent API server (OpenAI-compatible), Coolify.

**Spec:** `docs/superpowers/specs/2026-10-07-bot-hrd-dashboard-design.md` (D1–D11). Induk: `docs/superpowers/specs/2026-10-07-hermes-api-design.md`.

## Global Constraints

- Hermes **read-only**: nol endpoint/RPC tulis untuk Hermes (spec induk K1).
- Alat wajib memakai rumus yang sama dengan layar; dilarang menyalin rumus — pindahkan ke `@suka/hr-rumus` (spec §3).
- Larangan data (spec §4): tak pernah keluar gaji & kasbon **per orang**, NIK, HP, alamat, email, selfie, `face_descriptor`, `ref_photo_url`, alasan cuti.
- Alpa/belum hadir **mengikuti rumus sekarang** (D7); cuti/libur tidak dikecualikan — alat menyertakan `meta.catatan` soal itu.
- Cakupan lokasi alat absensi: outlet `is_active`, `type IN ('internal','mitra','office','gudang')`, bukan outlet tes (`isTestOutlet`), bukan slug `ss-backup`. Kantor Pusat **ikut** (D8).
- Kasbon: per outlet saja — total aktif + jumlah & nominal **menunggu** (D9). Tanpa nama/nominal per orang.
- Pengguna bot: role `admin_hr`, `owner`, `admin`, `developer` aktif (D4).
- Gagal ambil data = galat eksplisit (`status: 'galat'`), **tidak pernah** angka 0.
- Query: kolom eksplisit, paginasi `ORDER BY` unik bila bisa >1.000 baris, agregasi di DB bila berat (aturan performa repo).
- Secret server-only baru di app HR wajib `ARG`+`ENV` di stage **runner** Dockerfile + diset di panel Coolify.
- Package `@suka/*` diekspor sebagai TS source → wajib di `transpilePackages` app pemakai + `COPY packages/<pkg>/package.json` di Dockerfile sebelum `yarn install`.
- Jangan `yarn install` polos di root (lockfile tercemar workspace `SUKASHAWARMA`); dependency workspace `"@suka/hr-rumus": "*"` tidak mengubah `yarn.lock`. Verifikasi `git diff --stat yarn.lock` = 0.
- Timestamp migration: cek bentrok `ls supabase/migrations | cut -c1-14 | sort | uniq -d` sebelum commit; lint `node scripts/migration-timestamp-lint.mjs` harus lolos.
- UI tanpa kontrol native browser (select/checkbox/time); komponen kustom.
- Digest Telegram HRD **di luar** plan ini (D11).
- Commit diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

**Package baru `packages/hr-rumus/`**
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/waktu.ts` — helper WIB murni (tanggal, menit, batas, rentang hari)
- `src/papan.ts` — `computeBoard` & batas alpha (pindahan `apps/absensi/src/features/board/board.ts`)
- `src/rekap.ts` — alpa virtual rekap + hitung alpa dari jumlah hari hadir
- `src/staf.ts` — filter staf/outlet tes (pindahan `apps/HR/src/lib/staffFilters.ts`)
- `src/ceklist.ts` — `terburuk` (nilai ceklist)
- `src/index.ts` — ekspor publik
- `src/*.test.ts`

**apps/absensi** — `papan/route.ts` & `rekap/route.ts` memakai package; `features/board/board.ts` & test dihapus.

**apps/HR** — `lib/staffFilters.ts` & `lib/ceklistHarian.ts` re-export dari package; `lib/botHrd/*` (klien Hermes, riwayat), `app/actions/botHrd.ts`, `components/botHrd/*` (widget), `app/layout.tsx` (mount).

**apps/admin-dashboard**
- `src/lib/hermes/registry.ts` — `sumber` & `catatan` per alat, `KonteksHermes.absensi`
- `src/lib/hermes/absensi/tipe.ts` — tipe & antarmuka `KonteksAbsensi`
- `src/lib/hermes/absensi/outlet.ts` — cakupan & pencocokan outlet
- `src/lib/hermes/alat/absensi.ts` — 6 alat
- `src/lib/hermes/server/absensiSumber.ts` — loader nyata (service role)
- `src/lib/hermes/server/konteks.ts` — merangkai konteks absensi

**supabase/migrations**
- `20261008090000_hermes_absensi_rpc.sql` — `hermes_absensi_rekap_staf`, `hermes_kasbon_per_outlet`
- `20261008091000_bot_hrd_percakapan.sql` — tabel chat + RLS

**docs** — `docs/hermes/SOUL-hrd.md`, `docs/RUNBOOK-HERMES-VPS.md` (§ profil hrd & API server), `supabase/verifikasi/hermes/gerbang-absensi.md`, spec & `CLAUDE.md`.

---

### Task 1: Package `@suka/hr-rumus` — waktu WIB & papan kehadiran

**Files:**
- Create: `packages/hr-rumus/package.json`, `packages/hr-rumus/tsconfig.json`, `packages/hr-rumus/vitest.config.ts`
- Create: `packages/hr-rumus/src/waktu.ts`, `packages/hr-rumus/src/papan.ts`, `packages/hr-rumus/src/index.ts`
- Test: `packages/hr-rumus/src/waktu.test.ts`, `packages/hr-rumus/src/papan.test.ts`

**Interfaces:**
- Produces:
  - `tanggalWib(d: Date): string` (YYYY-MM-DD), `menitWib(ts: string | Date): number`, `batasWib(tanggal: string, jamHHMM: string, tambahMenit: number): Date`, `tambahHari(tanggal: string, n: number): string`, `daftarTanggal(dari: string, sampai: string): string[]`
  - `computeBoard(staff, records, config, jamMasukAturan?, opsi?: { sekarang?: Date; tanggal?: string })` → `{ rows: BoardRow[]; summary: BoardSummary }`
  - Tipe `BoardStaff`, `BoardRecord`, `BoardConfig`, `BoardState`, `BoardRow`, `BoardSummary`, fungsi `jamMasukBatasAlpha`, `jamMasukBatasAlphaStaf`

**Catatan perilaku (wajib dicatat di commit & laporan):** versi lama menghitung batas alpha dengan `new Date().setHours(...)` = **zona waktu container** (Docker `node:24-bookworm-slim` = UTC), sehingga di produksi batas 13:15 WIB jatuh pukul 20:15 WIB. Versi baru memakai WIB eksplisit. Ini memperbaiki papan kehadiran produksi (alpa muncul tepat waktu), bukan mengubah aturan alpa.

- [ ] **Step 1: Buat kerangka package**

`packages/hr-rumus/package.json`:
```json
{
  "name": "@suka/hr-rumus",
  "version": "0.0.1",
  "description": "Rumus HR/absensi bersama (papan kehadiran, alpa rekap, filter staf tes) — satu sumber untuk absensi, HR, admin-dashboard",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "files": ["src"],
  "scripts": {
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^2.0.0"
  }
}
```

`packages/hr-rumus/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`packages/hr-rumus/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 2: Tulis test waktu WIB yang gagal**

`packages/hr-rumus/src/waktu.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { tanggalWib, menitWib, batasWib, tambahHari, daftarTanggal } from './waktu'

describe('waktu WIB', () => {
  it('tanggalWib memakai +07:00, bukan zona server', () => {
    expect(tanggalWib(new Date('2026-10-07T16:59:00Z'))).toBe('2026-10-07')
    expect(tanggalWib(new Date('2026-10-07T17:00:00Z'))).toBe('2026-10-08')
  })
  it('menitWib', () => {
    expect(menitWib('2026-10-07T06:15:00Z')).toBe(13 * 60 + 15)
    expect(menitWib('2026-10-07T13:15:00+07:00')).toBe(13 * 60 + 15)
  })
  it('batasWib = tanggal + jam WIB + menit tambahan', () => {
    expect(batasWib('2026-10-07', '13:00', 15).toISOString()).toBe('2026-10-07T06:15:00.000Z')
    expect(batasWib('2026-10-07', '23:50:00', 15).toISOString()).toBe('2026-10-07T17:05:00.000Z')
  })
  it('tambahHari & daftarTanggal lintas bulan', () => {
    expect(tambahHari('2026-09-30', 1)).toBe('2026-10-01')
    expect(daftarTanggal('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(daftarTanggal('2026-10-02', '2026-10-01')).toEqual([])
  })
})
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd packages/hr-rumus && ../../node_modules/.bin/vitest run src/waktu.test.ts`
Expected: FAIL — `Failed to resolve import "./waktu"`.

- [ ] **Step 4: Implementasi `waktu.ts`**

```ts
// Indonesia (WIB) tetap UTC+7 tanpa DST — aritmetika offset tetap aman & tanpa dependency.
const WIB_MS = 7 * 60 * 60 * 1000
const HARI_MS = 24 * 60 * 60 * 1000

/** Tanggal kalender WIB (YYYY-MM-DD) dari sebuah instan. */
export function tanggalWib(d: Date): string {
  return new Date(d.getTime() + WIB_MS).toISOString().slice(0, 10)
}

/** Menit sejak 00:00 WIB dari sebuah timestamp. */
export function menitWib(ts: string | Date): number {
  const d = new Date(new Date(ts).getTime() + WIB_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** Instan pada `tanggal` WIB jam `jamHHMM` (HH:MM atau HH:MM:SS) ditambah `tambahMenit`. */
export function batasWib(tanggal: string, jamHHMM: string, tambahMenit: number): Date {
  const [h, m] = jamHHMM.split(':').map(Number)
  return new Date(Date.parse(`${tanggal}T00:00:00+07:00`) + (h * 60 + m + tambahMenit) * 60_000)
}

export function tambahHari(tanggal: string, n: number): string {
  return new Date(Date.parse(`${tanggal}T00:00:00Z`) + n * HARI_MS).toISOString().slice(0, 10)
}

/** Semua tanggal dari `dari` s/d `sampai` (inklusif); kosong bila dari > sampai. */
export function daftarTanggal(dari: string, sampai: string): string[] {
  const hasil: string[] = []
  for (let t = dari; t <= sampai; t = tambahHari(t, 1)) hasil.push(t)
  return hasil
}
```

- [ ] **Step 5: Jalankan test waktu, pastikan lolos**

Run: `cd packages/hr-rumus && ../../node_modules/.bin/vitest run src/waktu.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Pindahkan test lama + tulis test `computeBoard` yang gagal**

```bash
git mv apps/absensi/src/features/board/board.test.ts packages/hr-rumus/src/papan.test.ts
```
Ubah import baris 2 menjadi `import { jamMasukBatasAlpha, jamMasukBatasAlphaStaf, computeBoard, type BoardConfig, type BoardRecord } from "./papan";` lalu tambahkan di akhir berkas:
```ts
describe("computeBoard", () => {
  const cfg: BoardConfig = { jam_masuk: "13:00:00", jam_keluar: "22:00:00", toleransi_menit: 15 };
  const staff = [
    { id: "a", name: "Andi", role: "crew" },
    { id: "b", name: "Budi", role: "crew" },
    { id: "c", name: "Cici", role: "crew" },
    { id: "d", name: "Dedi", role: "crew" },
  ];
  const rec = (r: Partial<BoardRecord> & Pick<BoardRecord, "outlet_staff_id" | "type" | "status" | "ts_server">): BoardRecord => r;
  const records = [
    rec({ outlet_staff_id: "a", type: "in", status: "tepat", ts_server: "2026-10-07T12:55:00+07:00" }),
    rec({ outlet_staff_id: "b", type: "in", status: "telat", ts_server: "2026-10-07T13:40:00+07:00", telat_menit: 40 }),
    rec({ outlet_staff_id: "c", type: "in", status: "tepat", ts_server: "2026-10-07T12:50:00+07:00" }),
    rec({ outlet_staff_id: "c", type: "out", status: "tepat", ts_server: "2026-10-07T22:01:00+07:00" }),
  ];

  it("batas alpha memakai WIB, bukan zona server", () => {
    // 13:10 WIB: Dedi belum lewat 13:15 → belum
    const sebelum = computeBoard(staff, records, cfg, undefined, { sekarang: new Date("2026-10-07T06:10:00Z"), tanggal: "2026-10-07" });
    expect(sebelum.rows.find((r) => r.id === "d")!.state).toBe("belum");
    // 13:16 WIB: lewat batas → alpha
    const sesudah = computeBoard(staff, records, cfg, undefined, { sekarang: new Date("2026-10-07T06:16:00Z"), tanggal: "2026-10-07" });
    expect(sesudah.rows.find((r) => r.id === "d")!.state).toBe("alpha");
  });

  it("tanggal lampau → yang tak absen selalu alpha; status & menit telat dari DB", () => {
    const { rows, summary } = computeBoard(staff, records, cfg, undefined, { sekarang: new Date("2026-10-08T01:00:00Z"), tanggal: "2026-10-07" });
    expect(rows.map((r) => [r.id, r.state])).toEqual([["a", "masuk"], ["b", "telat"], ["c", "keluar"], ["d", "alpha"]]);
    expect(rows.find((r) => r.id === "b")!.delay_minutes).toBe(40);
    expect(summary).toEqual({ hadir: 2, telat: 1, telat_toleransi: 0, belum: 0, alpha: 1, total: 4 });
  });

  it("jadwal khusus staf menggeser batas alpha staf itu saja", () => {
    const aturan = new Map([["d", "15:00"]]);
    const { rows } = computeBoard(staff, records, cfg, aturan, { sekarang: new Date("2026-10-07T07:00:00Z"), tanggal: "2026-10-07" });
    expect(rows.find((r) => r.id === "d")!.state).toBe("belum");
  });
});
```

- [ ] **Step 7: Jalankan, pastikan gagal**

Run: `cd packages/hr-rumus && ../../node_modules/.bin/vitest run src/papan.test.ts`
Expected: FAIL — `Failed to resolve import "./papan"`.

- [ ] **Step 8: Pindahkan `board.ts` → `papan.ts` dan ganti waktu ke WIB**

```bash
git mv apps/absensi/src/features/board/board.ts packages/hr-rumus/src/papan.ts
```
Lalu di `packages/hr-rumus/src/papan.ts`:
1. Hapus 6 baris import & `dayjs.extend` dayjs di puncak berkas, ganti dengan:
```ts
import { batasWib, menitWib, tanggalWib } from "./waktu";
```
2. Ganti seluruh fungsi `calculateDelayMinutes` dengan:
```ts
function calculateDelayMinutes(tsServer: string, jamMasuk: string): number {
  const [h, m] = jamMasuk.split(":").map(Number);
  const diff = menitWib(tsServer) - (h * 60 + m);
  return diff > 0 ? diff : 0;
}
```
3. Ganti signature & blok `now`/`lewatBatas` di `computeBoard` dengan:
```ts
export type OpsiPapan = {
  /** Instan "sekarang" (default: jam sistem). */
  sekarang?: Date;
  /** Tanggal papan WIB YYYY-MM-DD (default: tanggal WIB dari `sekarang`). */
  tanggal?: string;
};

export function computeBoard(
  staff: BoardStaff[],
  records: BoardRecord[],
  config: BoardConfig,
  jamMasukAturan?: ReadonlyMap<string, string>,
  opsi: OpsiPapan = {},
): {
  rows: BoardRow[];
  summary: BoardSummary;
} {
  const byStaff = new Map<string, BoardRecord[]>();
  for (const r of records) {
    const arr = byStaff.get(r.outlet_staff_id) ?? [];
    arr.push(r);
    byStaff.set(r.outlet_staff_id, arr);
  }

  const now = opsi.sekarang ?? new Date();
  const tanggal = opsi.tanggal ?? tanggalWib(now);
  // Outlet berpilihan shift: yang belum absen baru dianggap alpha setelah shift
  // TERAKHIR lewat batas — crew siang tak boleh tercap alpha di pagi hari.
  // Staf berjadwal khusus memakai jam masuk aturannya sendiri (toleransi tetap outlet).
  // Batas dihitung dalam WIB (dulu memakai zona server → di container UTC telat 7 jam).
  const lewatBatasPerJam = new Map<string, boolean>();
  const lewatBatas = (staffId: string): boolean => {
    const jamMasuk = jamMasukBatasAlphaStaf(config, jamMasukAturan?.get(staffId));
    let hasil = lewatBatasPerJam.get(jamMasuk);
    if (hasil === undefined) {
      hasil = now.getTime() > batasWib(tanggal, jamMasuk, config.toleransi_menit).getTime();
      lewatBatasPerJam.set(jamMasuk, hasil);
    }
    return hasil;
  };
```
Sisa badan fungsi (`rows`, `summary`, `return`) tidak berubah.

`packages/hr-rumus/src/index.ts`:
```ts
export * from './waktu'
export * from './papan'
```

- [ ] **Step 9: Jalankan seluruh test package**

Run: `cd packages/hr-rumus && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: PASS semua test (waktu 4, jamMasukBatasAlpha 4, jamMasukBatasAlphaStaf 2, computeBoard 3), tsc 0 error.

- [ ] **Step 10: Commit**

```bash
git add packages/hr-rumus apps/absensi/src/features/board
git commit -m "feat(hr-rumus): package rumus HR bersama; papan kehadiran pakai batas WIB

Pindahan computeBoard dari apps/absensi. Batas alpha kini WIB eksplisit
(dulu zona container UTC -> alpa muncul 7 jam terlambat di produksi).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(App absensi belum dikompilasi ulang di task ini — impornya diperbaiki di Task 3; jangan push di antara Task 1 dan Task 3.)

---

### Task 2: `@suka/hr-rumus` — alpa rekap, filter staf tes, nilai ceklist

**Files:**
- Create: `packages/hr-rumus/src/rekap.ts`, `packages/hr-rumus/src/ceklist.ts`
- Move: `apps/HR/src/lib/staffFilters.ts` → `packages/hr-rumus/src/staf.ts`
- Modify: `packages/hr-rumus/src/index.ts`
- Test: `packages/hr-rumus/src/rekap.test.ts`, `packages/hr-rumus/src/ceklist.test.ts`

**Interfaces:**
- Consumes: `daftarTanggal`, `tanggalWib` (Task 1)
- Produces:
  - `type BarisHadir = { outlet_staff_id: string; ts_server: string; status: string }`
  - `alpaVirtual(staff: { id: string; name: string }[], baris: BarisHadir[], dari: string, sampai: string, hariIni: string): { staffId: string; nama: string; tanggal: string }[]`
  - `jumlahHariRekap(dari: string, sampai: string, hariIni: string): number`
  - `alpaDariHariHadir(dari: string, sampai: string, hariIni: string, hariHadir: number): number`
  - dari `staf.ts`: `TEST_OUTLET_ID`, `KANTOR_PUSAT_ID`, `StaffFilterCandidate`, `isRendyOrDeveloperStaff`, `isTestOrDevStaff`, **baru** `isTestOutlet(o: { id?: string|null; name?: string|null; slug?: string|null } | null | undefined): boolean`
  - `type NilaiCeklist = 'baik' | 'perhatian' | 'buruk'`, `terburuk(daftar: (NilaiCeklist | null | undefined)[]): NilaiCeklist | null`

- [ ] **Step 1: Tulis test rekap yang gagal**

`packages/hr-rumus/src/rekap.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { alpaVirtual, jumlahHariRekap, alpaDariHariHadir, type BarisHadir } from './rekap'

const staff = [{ id: 'a', name: 'Andi' }, { id: 'b', name: 'Budi' }]
const baris: BarisHadir[] = [
  { outlet_staff_id: 'a', ts_server: '2026-10-05T13:00:00+07:00', status: 'tepat' },
  { outlet_staff_id: 'a', ts_server: '2026-10-06T13:20:00+07:00', status: 'telat' },
  { outlet_staff_id: 'b', ts_server: '2026-10-06T13:00:00+07:00', status: 'alpha' }, // alpha tersimpan tak dihitung hadir
  { outlet_staff_id: 'b', ts_server: '2026-10-05T23:30:00+07:00', status: 'tepat' },
]

describe('alpa virtual (aturan layar Rekap)', () => {
  it('staf tanpa absen non-alpha pada suatu hari WIB = alpa; hari depan dilewati', () => {
    const hasil = alpaVirtual(staff, baris, '2026-10-05', '2026-10-09', '2026-10-07')
    expect(hasil).toEqual([
      { staffId: 'b', nama: 'Budi', tanggal: '2026-10-06' },
      { staffId: 'a', nama: 'Andi', tanggal: '2026-10-07' },
      { staffId: 'b', nama: 'Budi', tanggal: '2026-10-07' },
    ])
  })
  it('jumlah hari dipotong di hari ini; alpa = hari − hari hadir, setara alpaVirtual', () => {
    expect(jumlahHariRekap('2026-10-05', '2026-10-09', '2026-10-07')).toBe(3)
    expect(alpaDariHariHadir('2026-10-05', '2026-10-09', '2026-10-07', 2)).toBe(1)
    const perStaf = (id: string) => alpaVirtual(staff, baris, '2026-10-05', '2026-10-09', '2026-10-07').filter((x) => x.staffId === id).length
    expect(perStaf('a')).toBe(alpaDariHariHadir('2026-10-05', '2026-10-09', '2026-10-07', 2))
    expect(perStaf('b')).toBe(alpaDariHariHadir('2026-10-05', '2026-10-09', '2026-10-07', 1))
  })
  it('hari hadir tak pernah membuat alpa negatif', () => {
    expect(alpaDariHariHadir('2026-10-05', '2026-10-05', '2026-10-07', 3)).toBe(0)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd packages/hr-rumus && ../../node_modules/.bin/vitest run src/rekap.test.ts`
Expected: FAIL — `Failed to resolve import "./rekap"`.

- [ ] **Step 3: Implementasi `rekap.ts`**

Aturan disalin persis dari loop `virtualAlphas` di `apps/absensi/src/app/api/attendance/rekap/route.ts`: hari > hari ini dilewati; staf tanpa baris ber-status ≠ `alpha` pada tanggal WIB itu = alpa; urutan per tanggal lalu urutan staf.
```ts
import { daftarTanggal, tanggalWib } from './waktu'

export type BarisHadir = { outlet_staff_id: string; ts_server: string; status: string }

/** Aturan "alpha virtual" layar Rekap absensi — satu-satunya sumber. */
export function alpaVirtual(
  staff: { id: string; name: string }[],
  baris: BarisHadir[],
  dari: string,
  sampai: string,
  hariIni: string,
): { staffId: string; nama: string; tanggal: string }[] {
  const hadir = new Set<string>()
  for (const r of baris) {
    if (r.status === 'alpha') continue
    hadir.add(`${r.outlet_staff_id}|${tanggalWib(new Date(r.ts_server))}`)
  }
  const hasil: { staffId: string; nama: string; tanggal: string }[] = []
  for (const t of daftarTanggal(dari, sampai)) {
    if (t > hariIni) continue
    for (const s of staff) if (!hadir.has(`${s.id}|${t}`)) hasil.push({ staffId: s.id, nama: s.name, tanggal: t })
  }
  return hasil
}

/** Jumlah hari yang dinilai Rekap: dari..sampai, dipotong di hari ini. */
export function jumlahHariRekap(dari: string, sampai: string, hariIni: string): number {
  return daftarTanggal(dari, sampai < hariIni ? sampai : hariIni).length
}

/** Alpa satu staf bila jumlah hari hadirnya (hari WIB berbeda dengan absen non-alpha) sudah diketahui. */
export function alpaDariHariHadir(dari: string, sampai: string, hariIni: string, hariHadir: number): number {
  return Math.max(0, jumlahHariRekap(dari, sampai, hariIni) - hariHadir)
}
```

- [ ] **Step 4: Jalankan test rekap**

Run: `cd packages/hr-rumus && ../../node_modules/.bin/vitest run src/rekap.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Pindahkan filter staf & tambah `isTestOutlet`**

```bash
git mv apps/HR/src/lib/staffFilters.ts packages/hr-rumus/src/staf.ts
```
Tambahkan di akhir `packages/hr-rumus/src/staf.ts` (salinan persis logika `apps/HR/src/lib/outletFilters.ts`, yang setelah ini menjadi re-export):
```ts
/** Outlet uji coba/demo — dikecualikan dari semua hitungan HR. */
export function isTestOutlet(
  outlet?: { id?: string | null; name?: string | null; slug?: string | null } | string | null
): boolean {
  if (!outlet) return false
  const cocok = (s: string) => s.includes('tes') || s.includes('test') || s.includes('trial') || s.includes('demo')
  if (typeof outlet === 'string') {
    const s = outlet.trim().toLowerCase()
    return s === TEST_OUTLET_ID || cocok(s)
  }
  if (outlet.id && (outlet.id === TEST_OUTLET_ID || outlet.id.toLowerCase().includes('tes') || outlet.id.toLowerCase().includes('test'))) return true
  if (outlet.name && cocok(outlet.name.trim().toLowerCase())) return true
  if (outlet.slug && cocok(outlet.slug.trim().toLowerCase())) return true
  return false
}
```
Sebelum menulis, bandingkan dengan isi `apps/HR/src/lib/outletFilters.ts` saat itu; bila berbeda dari blok di atas, salin versi berkas itu apa adanya (berkas itu sumber kebenarannya).

Buat ulang `apps/HR/src/lib/staffFilters.ts`:
```ts
// Dipindah ke @suka/hr-rumus agar bot HRD (admin-dashboard) memakai filter yang sama.
export {
  TEST_OUTLET_ID,
  KANTOR_PUSAT_ID,
  isRendyOrDeveloperStaff,
  isTestOrDevStaff,
  type StaffFilterCandidate,
} from '@suka/hr-rumus'
```
Ganti isi `apps/HR/src/lib/outletFilters.ts`:
```ts
export { TEST_OUTLET_ID, isTestOutlet } from '@suka/hr-rumus'
```

- [ ] **Step 6: Tulis test ceklist yang gagal, lalu implementasi**

`packages/hr-rumus/src/ceklist.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { terburuk } from './ceklist'

describe('terburuk', () => {
  it('mengambil nilai terburuk, abaikan kosong', () => {
    expect(terburuk(['baik', 'perhatian', null, 'baik'])).toBe('perhatian')
    expect(terburuk(['baik', 'buruk', 'perhatian'])).toBe('buruk')
    expect(terburuk([undefined, null])).toBeNull()
  })
})
```
Run: `cd packages/hr-rumus && ../../node_modules/.bin/vitest run src/ceklist.test.ts` → FAIL (modul tak ada).

`packages/hr-rumus/src/ceklist.ts` (pindahan dari `apps/HR/src/lib/ceklistHarian.ts`):
```ts
export type NilaiCeklist = 'baik' | 'perhatian' | 'buruk'
const URUTAN_NILAI: Record<NilaiCeklist, number> = { baik: 0, perhatian: 1, buruk: 2 }

/** Nilai terburuk dari sekumpulan penilaian ceklist harian. */
export function terburuk(daftar: (NilaiCeklist | null | undefined)[]): NilaiCeklist | null {
  let hasil: NilaiCeklist | null = null
  for (const n of daftar) if (n && (hasil == null || URUTAN_NILAI[n] > URUTAN_NILAI[hasil])) hasil = n
  return hasil
}
```
Di `apps/HR/src/lib/ceklistHarian.ts`: hapus `const URUTAN_NILAI ...` dan fungsi `terburuk` lokal, ganti `export type Nilai = 'baik' | 'perhatian' | 'buruk'` dengan:
```ts
import { terburuk, type NilaiCeklist } from '@suka/hr-rumus'
export { terburuk }
export type Nilai = NilaiCeklist
```
(letakkan `import` bersama import lain di atas berkas). Bila `URUTAN_NILAI` masih dipakai bagian lain berkas itu (`grep -n URUTAN_NILAI apps/HR/src/lib/ceklistHarian.ts`), pertahankan konstanta lokalnya dan hapus hanya fungsi `terburuk`.

`packages/hr-rumus/src/index.ts`:
```ts
export * from './waktu'
export * from './papan'
export * from './rekap'
export * from './staf'
export * from './ceklist'
```

- [ ] **Step 7: Daftarkan package di app HR & jalankan test**

`apps/HR/package.json` → `dependencies` tambah `"@suka/hr-rumus": "*",` (urut abjad setelah `@suka/design-system`).
`apps/HR/next.config.mjs` → `transpilePackages: ['@suka/auth','@suka/design-system','@suka/realtime','@suka/hr-rumus']`.
`apps/HR/Dockerfile` → setelah baris `COPY packages/offline-queue/package.json ...` tambah:
```dockerfile
COPY packages/hr-rumus/package.json packages/hr-rumus/package.json
```
Tautkan workspace tanpa menyentuh lockfile:
```bash
yarn install --frozen-lockfile --ignore-engines
git diff --stat yarn.lock
```
Expected: install sukses, `git diff --stat yarn.lock` kosong.

Run:
```bash
cd packages/hr-rumus && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json
cd ../../apps/HR && yarn test && yarn type-check
```
Expected: semua test package PASS; HR `staffFilters.test.ts` dkk PASS (impor lewat re-export); type-check HR 0 error baru (bandingkan dengan `git stash`-free baseline: jalankan `yarn type-check` di commit sebelumnya bila ragu).

- [ ] **Step 8: Commit**

```bash
git add packages/hr-rumus apps/HR
git commit -m "feat(hr-rumus): alpa rekap, filter staf/outlet tes, nilai ceklist jadi satu sumber

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: App absensi memakai `@suka/hr-rumus`

**Files:**
- Modify: `apps/absensi/package.json`, `apps/absensi/next.config.*` (transpilePackages), `apps/absensi/Dockerfile`
- Modify: `apps/absensi/src/app/api/attendance/papan/route.ts`
- Modify: `apps/absensi/src/app/api/attendance/rekap/route.ts`
- Modify: setiap impor `@/features/board/board` (cari dengan `grep -rn "features/board" apps/absensi/src`)

**Interfaces:**
- Consumes: `computeBoard(..., opsi)`, `alpaVirtual`, tipe Board* (Task 1–2)

- [ ] **Step 1: Daftarkan package**

`apps/absensi/package.json` → `"@suka/hr-rumus": "*",` di `dependencies`. `apps/absensi/next.config.*` → tambahkan `'@suka/hr-rumus'` ke `transpilePackages`. `apps/absensi/Dockerfile` → setelah `COPY packages/offline-queue/package.json ...`:
```dockerfile
COPY packages/hr-rumus/package.json packages/hr-rumus/package.json
```

- [ ] **Step 2: Papan route**

Di `apps/absensi/src/app/api/attendance/papan/route.ts` ganti baris import board:
```ts
import { computeBoard, type BoardStaff, type BoardRecord, type BoardConfig } from '@suka/hr-rumus';
```
dan baris pemanggilan:
```ts
    const boardData = computeBoard(staffList as BoardStaff[], (attRes.data as BoardRecord[]) ?? [], cfg, jamMasukAturan, { tanggal: date });
```

- [ ] **Step 3: Rekap route**

Di `apps/absensi/src/app/api/attendance/rekap/route.ts` tambahkan import `import { alpaVirtual } from '@suka/hr-rumus';` lalu ganti seluruh blok dari `const todayStr = dayjs()...` sampai penutup `while` (loop `virtualAlphas`) dengan:
```ts
    const todayStr = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
    // Aturan alpa virtual = @suka/hr-rumus (dipakai juga bot HRD).
    const virtualAlphas: any[] = alpaVirtual(activeStaff, dbRows, start_date!, end_date!, todayStr).map((a) => ({
      id: `virtual-alpha-${a.staffId}-${a.tanggal}`,
      type: 'in',
      ts_server: `${a.tanggal}T23:59:59+07:00`,
      ts_client: null,
      status: 'alpha',
      selfie_url: null,
      outlet_staff_id: a.staffId,
      is_manual_button: false,
      outlet_staff: { name: a.nama },
    }));
```
Pastikan nama variabel baris hasil (`dbRows`) sama dengan yang dipakai loop lama; bila berbeda, pakai nama yang ada di berkas.

- [ ] **Step 4: Impor lain**

Run: `grep -rn "features/board" apps/absensi/src`
Ganti setiap `from "@/features/board/board"` / `'@/features/board/board'` menjadi `from '@suka/hr-rumus'`. Hapus folder `apps/absensi/src/features/board` bila sudah kosong.

- [ ] **Step 5: Verifikasi**

```bash
yarn install --frozen-lockfile --ignore-engines && git diff --stat yarn.lock
cd apps/absensi && yarn type-check && yarn test && NEXT_TURBOPACK=0 yarn build
```
Expected: lockfile tak berubah; type-check tanpa error baru; test lolos; build sukses dengan route `/api/attendance/papan` & `/api/attendance/rekap`.

- [ ] **Step 6: Commit**

```bash
git add apps/absensi
git commit -m "refactor(absensi): papan & rekap memakai @suka/hr-rumus

Batas alpha papan kini WIB eksplisit (sebelumnya zona container).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: RPC agregasi absensi & kasbon untuk Hermes

**Files:**
- Create: `supabase/migrations/20261008090000_hermes_absensi_rpc.sql`
- Create: `supabase/verifikasi/hermes/t2_absensi_rpc.sql`

**Interfaces:**
- Produces (dipanggil service role dari admin-dashboard):
  - `hermes_absensi_rekap_staf(p_dari date, p_sampai date)` → `outlet_staff_id uuid, hari_hadir int, jumlah_telat int, jumlah_telat_toleransi int, total_menit_telat int`
  - `hermes_kasbon_per_outlet(p_exclude_staff uuid[])` → `outlet_id uuid, menunggu_jumlah int, menunggu_nominal numeric, aktif_jumlah int, aktif_sisa numeric`

- [ ] **Step 1: Tulis uji SQL (harus gagal sebelum migration)**

`supabase/verifikasi/hermes/t2_absensi_rpc.sql`:
```sql
-- Jalankan di transaksi; ROLLBACK di akhir. Gagal = RAISE EXCEPTION.
BEGIN;
DO $$
DECLARE r record; n int; b bigint;
BEGIN
  -- 1) hari_hadir setara aturan Rekap: hari WIB berbeda dengan absen non-alpha
  SELECT count(*) INTO n FROM hermes_absensi_rekap_staf(current_date - 7, current_date);
  IF n = 0 THEN RAISE EXCEPTION 'rekap_staf kosong untuk 7 hari terakhir'; END IF;

  SELECT x.outlet_staff_id, x.hari_hadir INTO r
    FROM hermes_absensi_rekap_staf(current_date - 7, current_date) x ORDER BY x.hari_hadir DESC LIMIT 1;
  SELECT count(DISTINCT (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date) INTO b
    FROM attendance a
   WHERE a.outlet_staff_id = r.outlet_staff_id AND a.status <> 'alpha'
     AND a.ts_server >= ((current_date - 7)::timestamp AT TIME ZONE 'Asia/Jakarta')
     AND a.ts_server <  ((current_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta');
  IF b <> r.hari_hadir THEN RAISE EXCEPTION 'hari_hadir % <> hitung manual %', r.hari_hadir, b; END IF;

  -- 2) kasbon per outlet = total hr_perizinan_ringkasan (predikat sama)
  SELECT coalesce(sum(menunggu_jumlah),0) INTO n FROM hermes_kasbon_per_outlet('{}');
  SELECT ((hr_perizinan_ringkasan('{}')->'kasbon'->>'pending'))::int INTO b;
  IF n <> b THEN RAISE EXCEPTION 'kasbon menunggu % <> ringkasan HR %', n, b; END IF;

  -- 3) bukan untuk authenticated/anon
  IF has_function_privilege('authenticated', 'public.hermes_kasbon_per_outlet(uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh EXECUTE hermes_kasbon_per_outlet';
  END IF;
  IF has_function_privilege('anon', 'public.hermes_absensi_rekap_staf(date,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon tidak boleh EXECUTE hermes_absensi_rekap_staf';
  END IF;
  RAISE NOTICE 'T2 LULUS';
END $$;
ROLLBACK;
```
Sebelum menulis migration, cek signature RPC HR: `SELECT pg_get_function_identity_arguments('public.hr_perizinan_ringkasan'::regproc);` — bila parameternya bukan `p_exclude_staff uuid[]`, sesuaikan panggilan di butir 2.

- [ ] **Step 2: Jalankan uji, pastikan gagal**

Jalankan lewat jalur yang biasa dipakai sesi ini (memory `supabase-cli-not-on-path-desktop-app`: RPC `exec_sql` produksi + service key), atau `supabase db query --linked -f supabase/verifikasi/hermes/t2_absensi_rpc.sql`.
Expected: ERROR `function hermes_absensi_rekap_staf(date, date) does not exist`.

- [ ] **Step 3: Tulis migration**

`supabase/migrations/20261008090000_hermes_absensi_rpc.sql`:
```sql
-- Agregasi absensi & kasbon untuk alat MCP Hermes domain `absensi` (bot HRD).
-- Spec: docs/superpowers/specs/2026-10-07-bot-hrd-dashboard-design.md
-- Hanya service_role (dipanggil route /api/hermes/mcp setelah autentikasi kunci).

-- Per staf dalam rentang tanggal WIB (inklusif).
-- hari_hadir = jumlah hari WIB berbeda dengan absen ber-status <> 'alpha'
--              (= aturan "alpha virtual" layar Rekap; alpa = hari dinilai − hari_hadir,
--               dihitung di @suka/hr-rumus alpaDariHariHadir).
-- Telat dihitung dari status tersimpan absen masuk (tidak dihitung ulang).
CREATE OR REPLACE FUNCTION public.hermes_absensi_rekap_staf(p_dari date, p_sampai date)
RETURNS TABLE (
  outlet_staff_id uuid,
  hari_hadir integer,
  jumlah_telat integer,
  jumlah_telat_toleransi integer,
  total_menit_telat integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT a.outlet_staff_id,
         count(DISTINCT (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date) FILTER (WHERE a.status <> 'alpha')::int,
         count(*) FILTER (WHERE a.type = 'in' AND a.status = 'telat')::int,
         count(*) FILTER (WHERE a.type = 'in' AND a.status = 'telat_toleransi')::int,
         COALESCE(sum(a.telat_menit) FILTER (WHERE a.type = 'in' AND a.status IN ('telat','telat_toleransi')), 0)::int
    FROM attendance a
   WHERE a.ts_server >= (p_dari::timestamp AT TIME ZONE 'Asia/Jakarta')
     AND a.ts_server <  ((p_sampai + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
     AND a.outlet_staff_id IS NOT NULL
   GROUP BY a.outlet_staff_id
$$;

-- Kasbon per outlet staf. Predikat SAMA dengan hr_perizinan_ringkasan
-- (migration 20260930191000): menunggu = status_hr pending & belum lunas;
-- aktif = disetujui & berjalan, sisa = COALESCE(remaining, amount).
CREATE OR REPLACE FUNCTION public.hermes_kasbon_per_outlet(p_exclude_staff uuid[] DEFAULT '{}')
RETURNS TABLE (
  outlet_id uuid,
  menunggu_jumlah integer,
  menunggu_nominal numeric,
  aktif_jumlah integer,
  aktif_sisa numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT s.outlet_id,
         count(*) FILTER (WHERE COALESCE(k.status_hr, 'pending') = 'pending' AND k.status <> 'paid_off')::int,
         COALESCE(sum(k.amount) FILTER (WHERE COALESCE(k.status_hr, 'pending') = 'pending' AND k.status <> 'paid_off'), 0),
         count(*) FILTER (WHERE k.status_hr = 'approved' AND k.status = 'active')::int,
         COALESCE(sum(COALESCE(k.remaining, k.amount)) FILTER (WHERE k.status_hr = 'approved' AND k.status = 'active'), 0)
    FROM cash_advances k
    JOIN outlet_staff s ON s.id = k.staff_id
   WHERE NOT (k.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
   GROUP BY s.outlet_id
$$;

REVOKE ALL ON FUNCTION public.hermes_absensi_rekap_staf(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hermes_kasbon_per_outlet(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_absensi_rekap_staf(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.hermes_kasbon_per_outlet(uuid[]) TO service_role;
```
Cek index: `SELECT indexdef FROM pg_indexes WHERE tablename = 'attendance';` — harus ada index berawalan `ts_server`. Bila tidak ada, ukur dulu (`EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM hermes_absensi_rekap_staf(date_trunc('month', current_date)::date, current_date);`); bila > 300 ms tambahkan di migration yang sama `CREATE INDEX IF NOT EXISTS attendance_ts_server_idx ON public.attendance (ts_server);`. Catat angka sebelum/sesudah di commit message.

- [ ] **Step 4: Cek timestamp & apply**

```bash
ls supabase/migrations | cut -c1-14 | sort | uniq -d
node scripts/migration-timestamp-lint.mjs
```
Expected: tidak ada duplikat; lint lolos. Apply migration ke DB (jalur `exec_sql` atau `supabase db push` setelah `migration list` bersih), lalu stempel `schema_migrations` dan verifikasi dengan `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261008090000';` → 1 baris.

- [ ] **Step 5: Jalankan uji lagi**

Expected: `NOTICE: T2 LULUS`. Kontrol negatif: ubah sementara butir 3 menjadi `IF NOT has_function_privilege(...)` dan pastikan blok gagal, lalu kembalikan.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261008090000_hermes_absensi_rpc.sql supabase/verifikasi/hermes/t2_absensi_rpc.sql
git commit -m "feat(db): RPC agregasi absensi & kasbon untuk Hermes domain absensi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Registry Hermes siap multi-domain + kontrak `KonteksAbsensi`

**Files:**
- Modify: `apps/admin-dashboard/src/lib/hermes/registry.ts`
- Create: `apps/admin-dashboard/src/lib/hermes/absensi/tipe.ts`
- Create: `apps/admin-dashboard/src/lib/hermes/absensi/outlet.ts`
- Create: `apps/admin-dashboard/src/lib/hermes/absensi/fixture.ts` (data palsu untuk test; bukan berkas test agar bisa diimpor tanpa menjalankan ulang suite lain)
- Modify: `apps/admin-dashboard/src/lib/hermes/registry.test.ts`
- Modify: `apps/admin-dashboard/package.json`, `apps/admin-dashboard/next.config.*`, `apps/admin-dashboard/Dockerfile`
- Test: `apps/admin-dashboard/src/lib/hermes/absensi/outlet.test.ts`

**Interfaces:**
- Produces:
  - `DefinisiAlat` tambah field opsional `sumber?: string` (default `'Rangkuman Penjualan'`) dan `catatanMeta?: string`
  - `KonteksHermes` tambah `absensi: KonteksAbsensi`
  - `tipe.ts`:
```ts
export interface OutletAbsensi { id: string; name: string; type: string }
export interface StafPapan { id: string; nama: string; state: import('@suka/hr-rumus').BoardState; menitTelat: number | null; jam: string | null }
export interface PapanOutlet { outlet: OutletAbsensi; ringkas: import('@suka/hr-rumus').BoardSummary; staf: StafPapan[] }
export interface RekapStafBaris { staffId: string; hariHadir: number; telat: number; telatToleransi: number; menitTelat: number }
export interface StafOutlet { id: string; nama: string }
export interface CutiBaris { nama: string; outletId: string | null; jenis: string; mulai: string; selesai: string; hari: number; status: 'pending' | 'approved' | 'rejected' }
export interface KasbonOutlet { outletId: string; menungguJumlah: number; menungguNominal: number; aktifJumlah: number; aktifSisa: number }
export interface CeklistOutlet { outlet: OutletAbsensi; laporan: null | { namaAm: string; nilai: 'baik' | 'perhatian' | 'buruk' | null; jumlahTemuan: number; ditinjau: boolean } }
export interface KonteksAbsensi {
  hariIni: string
  sekarang: Date
  outlets(): Promise<OutletAbsensi[]>
  papan(tanggal: string): Promise<PapanOutlet[]>
  stafPerOutlet(): Promise<Map<string, StafOutlet[]>>
  rekapStaf(dari: string, sampai: string): Promise<RekapStafBaris[]>
  cuti(): Promise<CutiBaris[]>
  kasbon(): Promise<KasbonOutlet[]>
  ceklist(tanggal: string): Promise<CeklistOutlet[]>
}
```
  - `outlet.ts`: `outletTerhitungAbsensi(o: { id: string; name: string; slug: string | null; type: string; is_active: boolean }[]): OutletAbsensi[]` dan `pilihOutlet(outlets: OutletAbsensi[], teks?: string): { ok: true; outlets: OutletAbsensi[] } | { ok: false; pesan: string }`

- [ ] **Step 1: Daftarkan package di admin-dashboard**

`apps/admin-dashboard/package.json` → `"@suka/hr-rumus": "*",`. `next.config.*` → tambahkan `'@suka/hr-rumus'` ke `transpilePackages`. `Dockerfile` → setelah `COPY packages/offline-queue/package.json ...` tambah `COPY packages/hr-rumus/package.json packages/hr-rumus/package.json`. Lalu `yarn install --frozen-lockfile --ignore-engines && git diff --stat yarn.lock` (harus kosong).

- [ ] **Step 2: Test outlet yang gagal**

`apps/admin-dashboard/src/lib/hermes/absensi/outlet.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { outletTerhitungAbsensi, pilihOutlet } from './outlet'

const mentah = [
  { id: '1', name: 'SUKA SHAWARMA EMPANG', slug: 'empang', type: 'internal', is_active: true },
  { id: '2', name: 'MITRA CIBINONG', slug: 'cibinong', type: 'mitra', is_active: true },
  { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', name: 'Kantor Pusat', slug: 'kantor-pusat', type: 'office', is_active: true },
  { id: '4', name: 'GUDANG PUSAT (HQ)', slug: 'gudang', type: 'office', is_active: true },
  { id: 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a', name: 'outlet tes', slug: 'tes', type: 'test', is_active: true },
  { id: '6', name: 'SS BACKUP', slug: 'ss-backup', type: 'internal', is_active: true },
  { id: '7', name: 'TikTok Shop', slug: 'tiktok-shop', type: 'marketplace', is_active: true },
  { id: '8', name: 'SUKA SHAWARMA LAMA', slug: 'lama', type: 'internal', is_active: false },
]

describe('cakupan outlet absensi', () => {
  it('internal/mitra/office/gudang aktif, tanpa tes, ss-backup, marketplace, nonaktif; Kantor Pusat ikut (D8)', () => {
    expect(outletTerhitungAbsensi(mentah).map((o) => o.name)).toEqual(['GUDANG PUSAT (HQ)', 'Kantor Pusat', 'MITRA CIBINONG', 'SUKA SHAWARMA EMPANG'])
  })
  it('pilihOutlet: kosong = semua; cocok sebagian nama; tak dikenal & ambigu = galat', () => {
    const o = outletTerhitungAbsensi(mentah)
    expect(pilihOutlet(o)).toEqual({ ok: true, outlets: o })
    expect(pilihOutlet(o, 'empang')).toEqual({ ok: true, outlets: [o.find((x) => x.name === 'SUKA SHAWARMA EMPANG')] })
    expect(pilihOutlet(o, 'bekasi')).toMatchObject({ ok: false })
    expect(pilihOutlet(o, 'pusat')).toMatchObject({ ok: false, pesan: expect.stringContaining('Kantor Pusat') })
  })
})
```
Run: `cd apps/admin-dashboard && yarn vitest run src/lib/hermes/absensi/outlet.test.ts` → FAIL (modul tak ada).

- [ ] **Step 3: Implementasi `tipe.ts` & `outlet.ts`**

`tipe.ts` = blok `tipe.ts` di Interfaces di atas, persis (ganti `import('...')` inline dengan `import type { BoardState, BoardSummary } from '@suka/hr-rumus'` di puncak berkas).

`outlet.ts`:
```ts
import { isTestOutlet } from '@suka/hr-rumus'
import type { OutletAbsensi } from './tipe'

const TIPE_ABSENSI = new Set(['internal', 'mitra', 'office', 'gudang'])

/** Lokasi yang dihitung bot HRD: punya staf operasional; Kantor Pusat ikut (spec D8). */
export function outletTerhitungAbsensi(
  outlets: { id: string; name: string; slug: string | null; type: string; is_active: boolean }[],
): OutletAbsensi[] {
  return outlets
    .filter((o) => o.is_active && TIPE_ABSENSI.has(o.type) && o.slug !== 'ss-backup' && !isTestOutlet(o))
    .map((o) => ({ id: o.id, name: o.name, type: o.type }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

/** Teks outlet dari pengguna → daftar outlet. Kosong = semua. */
export function pilihOutlet(
  outlets: OutletAbsensi[],
  teks?: string,
): { ok: true; outlets: OutletAbsensi[] } | { ok: false; pesan: string } {
  const t = teks?.trim().toLowerCase()
  if (!t) return { ok: true, outlets }
  const persis = outlets.filter((o) => o.name.toLowerCase() === t)
  if (persis.length === 1) return { ok: true, outlets: persis }
  const cocok = outlets.filter((o) => o.name.toLowerCase().includes(t))
  if (cocok.length === 1) return { ok: true, outlets: cocok }
  if (cocok.length === 0) return { ok: false, pesan: `Outlet "${teks}" tidak dikenal. Pilihan: ${outlets.map((o) => o.name).join(', ')}` }
  return { ok: false, pesan: `"${teks}" cocok dengan beberapa outlet: ${cocok.map((o) => o.name).join(', ')}. Sebutkan lebih spesifik.` }
}
```
Run test → PASS (2 test).

- [ ] **Step 4: Ubah registry**

Di `apps/admin-dashboard/src/lib/hermes/registry.ts`:
1. Import & konteks:
```ts
import type { KonteksAbsensi } from './absensi/tipe'

export interface KonteksHermes {
  penjualan: KonteksPenjualan
  absensi: KonteksAbsensi
  sekarang: Date
}
```
2. `DefinisiAlat` tambah:
```ts
  /** Nama layar sumber angka (meta.sumber). Default 'Rangkuman Penjualan'. */
  sumber?: string
  /** Catatan tetap untuk pembaca (meta.catatan), mis. batasan rumus. */
  catatanMeta?: string
```
3. Di `bungkus`, ganti objek `meta` menjadi:
```ts
            meta: {
              sumber: def.sumber ?? 'Rangkuman Penjualan',
              dihitung_pada: ctx.sekarang.toISOString(),
              // `catatan` diisi alat SUKA Bot bila periode masih berjalan (hari ini/minggu ini).
              kelengkapan: hasil.catatan ? 'sebagian' : 'lengkap',
              ...(def.catatanMeta ? { catatan: def.catatanMeta } : {}),
            },
```

- [ ] **Step 5: Siapkan fixture test registry untuk domain absensi**

Di `registry.test.ts`:
- Buat `apps/admin-dashboard/src/lib/hermes/absensi/fixture.ts` berisi fixture berikut (dipakai Task 6–7), lalu di `registry.test.ts` tambahkan `import { absensiPalsu } from './absensi/fixture'` dan ubah `ctx`:
```ts
// absensi/fixture.ts
import type { KonteksAbsensi } from './tipe'

const OUTLET_EMPANG = { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal' }
const OUTLET_KP = { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', name: 'Kantor Pusat', type: 'office' }
export const absensiPalsu: KonteksAbsensi = {
  hariIni: '2026-10-07',
  sekarang: new Date('2026-10-07T07:00:00Z'),
  outlets: async () => [OUTLET_EMPANG, OUTLET_KP],
  papan: async () => [
    {
      outlet: OUTLET_EMPANG,
      ringkas: { hadir: 1, telat: 1, telat_toleransi: 0, belum: 1, alpha: 1, total: 4 },
      staf: [
        { id: 's1', nama: 'Andi', state: 'masuk', menitTelat: null, jam: '12.55' },
        { id: 's2', nama: 'Budi', state: 'telat', menitTelat: 40, jam: '13.40' },
        { id: 's3', nama: 'Cici', state: 'belum', menitTelat: null, jam: null },
        { id: 's4', nama: 'Dedi', state: 'alpha', menitTelat: null, jam: null },
      ],
    },
    { outlet: OUTLET_KP, ringkas: { hadir: 1, telat: 0, telat_toleransi: 0, belum: 0, alpha: 0, total: 1 }, staf: [{ id: 's5', nama: 'Eka', state: 'masuk', menitTelat: null, jam: '08.00' }] },
  ],
  stafPerOutlet: async () => new Map([['o1', [{ id: 's1', nama: 'Andi' }, { id: 's2', nama: 'Budi' }]], [OUTLET_KP.id, [{ id: 's5', nama: 'Eka' }]]]),
  rekapStaf: async () => [
    { staffId: 's1', hariHadir: 7, telat: 0, telatToleransi: 1, menitTelat: 3 },
    { staffId: 's2', hariHadir: 5, telat: 3, telatToleransi: 0, menitTelat: 95 },
    { staffId: 's5', hariHadir: 7, telat: 0, telatToleransi: 0, menitTelat: 0 },
  ],
  cuti: async () => [
    { nama: 'Cici', outletId: 'o1', jenis: 'annual', mulai: '2026-10-06', selesai: '2026-10-08', hari: 3, status: 'approved' },
    { nama: 'Budi', outletId: 'o1', jenis: 'sick', mulai: '2026-10-09', selesai: '2026-10-09', hari: 1, status: 'pending' },
  ],
  kasbon: async () => [{ outletId: 'o1', menungguJumlah: 2, menungguNominal: 750_000, aktifJumlah: 3, aktifSisa: 1_200_000 }],
  ceklist: async () => [
    { outlet: OUTLET_EMPANG, laporan: { namaAm: 'Fajar', nilai: 'perhatian', jumlahTemuan: 2, ditinjau: false } },
    { outlet: OUTLET_KP, laporan: null },
  ],
}
```
```ts
// registry.test.ts
const ctx: KonteksHermes = { penjualan, absensi: absensiPalsu, sekarang: penjualan.sekarang }
```
- Di test `'GERBANG §6 ...'` ganti `expect(r.data.meta).toMatchObject({ sumber: 'Rangkuman Penjualan' })` dengan `expect(typeof (r.data.meta as any).sumber).toBe('string')`.
- Ganti daftar `TERLARANG` dan loop pemindainya menjadi:
```ts
// §6 spec: pola yang tak boleh pernah muncul di output alat mana pun.
// `kasbon` dikecualikan HANYA untuk alat kasbon_ringkasan (agregat per outlet, D9) —
// alat itu diuji terpisah: tak boleh membawa nama/id staf.
const TERLARANG_UMUM = [
  /gaji|salary|payroll/i,
  /\bnik\b|ktp/i,
  /face_descriptor|selfie|ref_photo_url|foto_wajah/i,
  /password|token|api_key|service_role/i,
  /(\+62|\b08)\d{8,12}\b/,
  /\b\d{16}\b/,
  /@[a-z0-9-]+\.[a-z]{2,}/i,
  /\breason\b|alasan_cuti/i,
]
const KHUSUS_KASBON = /kasbon|cash_advance/i
const terlarangUntuk = (nama: string) => (nama === 'kasbon_ringkasan' ? TERLARANG_UMUM : [...TERLARANG_UMUM, KHUSUS_KASBON])
```
dan di dalam loop: `for (const pola of terlarangUntuk(m.nama)) expect(teks, \`${m.nama} cocok ${pola}\`).not.toMatch(pola)`.
- Tambahkan test baru:
```ts
  it('GERBANG §6: kasbon_ringkasan tanpa nama/id staf', async () => {
    const r = await cari('kasbon_ringkasan').jalankan({})
    expect(r.ok).toBe(true)
    const teks = JSON.stringify(r)
    for (const kata of ['Andi', 'Budi', 'Cici', 'Dedi', 'Eka', 's1', 's2', 'staff_id', 'staffId', '"nama"']) expect(teks).not.toContain(kata)
  })
```
(test ini gagal sampai Task 7 — itu disengaja; jalankan suite penuh di Task 7.)

- [ ] **Step 6: Jalankan test yang relevan**

`KonteksHermes.absensi` kini wajib, sehingga `server/konteks.ts` baru lengkap setelah Task 8. **Kerjakan Task 8 langsung setelah task ini** (urutan eksekusi 5 → 8 → 6 → 7); Task 8 tidak bergantung pada alat Task 6–7. Pada task ini cukup:
```bash
cd apps/admin-dashboard && yarn vitest run src/lib/hermes/absensi/outlet.test.ts
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/package.json apps/admin-dashboard/next.config.* apps/admin-dashboard/Dockerfile apps/admin-dashboard/src/lib/hermes
git commit -m "feat(hermes): registry multi-domain (sumber & catatan per alat), kontrak KonteksAbsensi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Alat absensi — hari ini, rekap, telat bulan ini

**Files:**
- Create: `apps/admin-dashboard/src/lib/hermes/alat/absensi.ts`
- Modify: `apps/admin-dashboard/src/lib/hermes/registry.ts` (`ALAT_HERMES = [...ALAT_PENJUALAN, ...ALAT_ABSENSI]`)
- Test: `apps/admin-dashboard/src/lib/hermes/alat/absensi.test.ts`

**Interfaces:**
- Consumes: `KonteksAbsensi`, `pilihOutlet` (Task 5), `alpaDariHariHadir`, `jumlahHariRekap` (Task 2)
- Produces: `ALAT_ABSENSI: DefinisiAlat[]` berisi `absensi_hari_ini`, `absensi_rekap`, `absensi_telat_bulan_ini` (Task 7 menambah 3 alat ke array yang sama)

- [ ] **Step 1: Test yang gagal**

`apps/admin-dashboard/src/lib/hermes/alat/absensi.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ALAT_ABSENSI } from './absensi'
import { absensiPalsu } from '../absensi/fixture'
import type { KonteksHermes } from '../registry'

const ctx = { absensi: absensiPalsu, sekarang: absensiPalsu.sekarang } as unknown as KonteksHermes
const alat = (n: string) => ALAT_ABSENSI.find((a) => a.nama === n)!
const jalan = (n: string, a: Record<string, unknown> = {}) => alat(n).jalankan(ctx, alat(n).skema.parse(a))

describe('absensi_hari_ini', () => {
  it('ringkas per outlet + daftar telat/belum/alpa (nama & menit), tanpa yang hadir tepat', async () => {
    const r: any = await jalan('absensi_hari_ini')
    expect(r.status).toBe('ok')
    expect(r.tanggal).toBe('2026-10-07')
    expect(r.total).toEqual({ hadir: 2, telat: 1, telat_toleransi: 0, belum: 1, alpa: 1, staf: 5 })
    const empang = r.outlet.find((o: any) => o.outlet === 'SUKA SHAWARMA EMPANG')
    expect(empang.telat).toEqual([{ nama: 'Budi', menit: 40, jam: '13.40' }])
    expect(empang.belum_hadir).toEqual(['Cici'])
    expect(empang.alpa).toEqual(['Dedi'])
    expect(JSON.stringify(r)).not.toContain('Andi')
  })
  it('filter outlet & outlet tak dikenal = galat', async () => {
    const r: any = await jalan('absensi_hari_ini', { outlet: 'kantor' })
    expect(r.outlet.map((o: any) => o.outlet)).toEqual(['Kantor Pusat'])
    expect(await jalan('absensi_hari_ini', { outlet: 'bekasi' })).toMatchObject({ status: 'galat' })
  })
})

describe('absensi_rekap & telat bulan ini', () => {
  it('rekap per outlet: hari dinilai, total telat, total alpa (aturan Rekap)', async () => {
    const r: any = await jalan('absensi_rekap', { dari: '2026-10-01', sampai: '2026-10-07' })
    expect(r.hari_dinilai).toBe(7)
    const empang = r.outlet.find((o: any) => o.outlet === 'SUKA SHAWARMA EMPANG')
    expect(empang).toMatchObject({ staf: 2, telat: 3, telat_toleransi: 1, alpa: 2 })
  })
  it('rentang > 62 hari ditolak skema', () => {
    expect(alat('absensi_rekap').skema.safeParse({ dari: '2026-01-01', sampai: '2026-10-07' }).success).toBe(false)
  })
  it('telat bulan ini: per orang, urut telat terbanyak, hanya yang telat/alpa', async () => {
    const r: any = await jalan('absensi_telat_bulan_ini')
    expect(r.dari).toBe('2026-10-01')
    expect(r.sampai).toBe('2026-10-07')
    expect(r.orang[0]).toEqual({ nama: 'Budi', outlet: 'SUKA SHAWARMA EMPANG', telat: 3, telat_toleransi: 0, menit_telat: 95, alpa: 2 })
    expect(r.orang.find((o: any) => o.nama === 'Eka')).toBeUndefined()
  })
})
```
Fixture `absensiPalsu` dibuat di Task 5 (`absensi/fixture.ts`).

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/hermes/alat/absensi.test.ts` → FAIL (`./absensi` tak ada).

- [ ] **Step 2: Implementasi**

`apps/admin-dashboard/src/lib/hermes/alat/absensi.ts`:
```ts
import { z } from 'zod'
import { alpaDariHariHadir, jumlahHariRekap } from '@suka/hr-rumus'
import type { DefinisiAlat, KonteksHermes } from '../registry'
import { pilihOutlet } from '../absensi/outlet'

const TGL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format YYYY-MM-DD')
const OUTLET = z.string().min(1).max(60).describe('Nama outlet (sebagian nama boleh). Kosong = semua lokasi.')
const CATATAN_ALPA =
  'Alpa/belum hadir mengikuti rumus papan & rekap absensi: staf yang sedang cuti atau libur BELUM dikecualikan. Cek alat cuti_izin sebelum menyimpulkan.'
const SUMBER_PAPAN = 'Papan Kehadiran (app absensi)'
const SUMBER_REKAP = 'Rekap Absensi (app absensi)'

const galat = (pesan: string) => ({ status: 'galat', pesan })
const selisihHari = (dari: string, sampai: string) => (Date.parse(sampai) - Date.parse(dari)) / 86_400_000

async function hariIni(ctx: KonteksHermes, a: { tanggal?: string; outlet?: string }) {
  const tanggal = a.tanggal ?? ctx.absensi.hariIni
  if (tanggal > ctx.absensi.hariIni) return galat('Tanggal di masa depan.')
  const pilih = pilihOutlet(await ctx.absensi.outlets(), a.outlet)
  if (!pilih.ok) return galat(pilih.pesan)
  const ids = new Set(pilih.outlets.map((o) => o.id))
  const papan = (await ctx.absensi.papan(tanggal)).filter((p) => ids.has(p.outlet.id))
  const total = { hadir: 0, telat: 0, telat_toleransi: 0, belum: 0, alpa: 0, staf: 0 }
  const outlet = papan.map((p) => {
    total.hadir += p.ringkas.hadir
    total.telat += p.ringkas.telat
    total.telat_toleransi += p.ringkas.telat_toleransi
    total.belum += p.ringkas.belum
    total.alpa += p.ringkas.alpha
    total.staf += p.ringkas.total
    return {
      outlet: p.outlet.name,
      ringkas: { hadir: p.ringkas.hadir, telat: p.ringkas.telat, telat_toleransi: p.ringkas.telat_toleransi, belum: p.ringkas.belum, alpa: p.ringkas.alpha, staf: p.ringkas.total },
      telat: p.staf.filter((s) => s.state === 'telat' || s.state === 'telat_toleransi').map((s) => ({ nama: s.nama, menit: s.menitTelat, jam: s.jam })),
      belum_hadir: p.staf.filter((s) => s.state === 'belum').map((s) => s.nama),
      alpa: p.staf.filter((s) => s.state === 'alpha').map((s) => s.nama),
    }
  })
  return { status: 'ok', tanggal, total, outlet }
}

async function rekapDasar(ctx: KonteksHermes, dari: string, sampai: string, teksOutlet?: string) {
  const pilih = pilihOutlet(await ctx.absensi.outlets(), teksOutlet)
  if (!pilih.ok) return { galat: pilih.pesan } as const
  const [stafMap, rekap] = await Promise.all([ctx.absensi.stafPerOutlet(), ctx.absensi.rekapStaf(dari, sampai)])
  const perStaf = new Map(rekap.map((r) => [r.staffId, r]))
  const hariIniStr = ctx.absensi.hariIni
  const baris = pilih.outlets.flatMap((o) =>
    (stafMap.get(o.id) ?? []).map((s) => {
      const r = perStaf.get(s.id)
      return {
        nama: s.nama,
        outlet: o.name,
        telat: r?.telat ?? 0,
        telat_toleransi: r?.telatToleransi ?? 0,
        menit_telat: r?.menitTelat ?? 0,
        alpa: alpaDariHariHadir(dari, sampai, hariIniStr, r?.hariHadir ?? 0),
      }
    }),
  )
  return { outlets: pilih.outlets, baris, hariDinilai: jumlahHariRekap(dari, sampai, hariIniStr) } as const
}

async function rekap(ctx: KonteksHermes, a: { dari?: string; sampai?: string; outlet?: string }) {
  const sampai = a.sampai ?? ctx.absensi.hariIni
  const dari = a.dari ?? `${sampai.slice(0, 8)}01`
  if (dari > sampai) return galat('Tanggal "dari" setelah "sampai".')
  const d = await rekapDasar(ctx, dari, sampai, a.outlet)
  if ('galat' in d) return galat(d.galat!)
  const outlet = d.outlets.map((o) => {
    const b = d.baris.filter((x) => x.outlet === o.name)
    return {
      outlet: o.name,
      staf: b.length,
      telat: b.reduce((s, x) => s + x.telat, 0),
      telat_toleransi: b.reduce((s, x) => s + x.telat_toleransi, 0),
      alpa: b.reduce((s, x) => s + x.alpa, 0),
    }
  })
  return { status: 'ok', dari, sampai, hari_dinilai: d.hariDinilai, outlet }
}

async function telatBulanIni(ctx: KonteksHermes, a: { outlet?: string }) {
  const sampai = ctx.absensi.hariIni
  const dari = `${sampai.slice(0, 8)}01`
  const d = await rekapDasar(ctx, dari, sampai, a.outlet)
  if ('galat' in d) return galat(d.galat!)
  const orang = d.baris
    .filter((x) => x.telat + x.telat_toleransi + x.alpa > 0)
    .sort((x, y) => y.telat - x.telat || y.alpa - x.alpa || y.menit_telat - x.menit_telat || x.nama.localeCompare(y.nama, 'id'))
  return { status: 'ok', dari, sampai, hari_dinilai: d.hariDinilai, orang }
}

export const ALAT_ABSENSI: DefinisiAlat[] = [
  {
    nama: 'absensi_hari_ini',
    domain: 'absensi',
    sumber: SUMBER_PAPAN,
    catatanMeta: CATATAN_ALPA,
    deskripsi: 'Kehadiran satu hari (default hari ini) per lokasi: ringkasan, siapa telat (menit), siapa belum hadir, siapa alpa. Angka = Papan Kehadiran.',
    skema: z.object({ tanggal: TGL.optional(), outlet: OUTLET.optional() }).strict(),
    contoh: {},
    jalankan: hariIni,
  },
  {
    nama: 'absensi_rekap',
    domain: 'absensi',
    sumber: SUMBER_REKAP,
    catatanMeta: CATATAN_ALPA,
    deskripsi: 'Rekap absensi rentang tanggal (default awal bulan s/d hari ini, maks 62 hari) per lokasi: jumlah staf, telat, telat toleransi, alpa. Angka = Rekap Absensi.',
    skema: z
      .object({ dari: TGL.optional(), sampai: TGL.optional(), outlet: OUTLET.optional() })
      .strict()
      .refine((a) => !a.dari || !a.sampai || selisihHari(a.dari, a.sampai) <= 61, 'rentang maksimal 62 hari'),
    contoh: { dari: '2026-10-01', sampai: '2026-10-07' },
    jalankan: rekap,
  },
  {
    nama: 'absensi_telat_bulan_ini',
    domain: 'absensi',
    sumber: SUMBER_REKAP,
    catatanMeta: CATATAN_ALPA,
    deskripsi: 'Daftar orang yang telat atau alpa bulan berjalan (awal bulan s/d hari ini), urut telat terbanyak: jumlah telat, telat toleransi, total menit telat, alpa.',
    skema: z.object({ outlet: OUTLET.optional() }).strict(),
    contoh: {},
    jalankan: telatBulanIni,
  },
]
```

Di `registry.ts`: `import { ALAT_ABSENSI } from './alat/absensi'` dan `export const ALAT_HERMES: DefinisiAlat[] = [...ALAT_PENJUALAN, ...ALAT_ABSENSI]`.

Catatan fixture: Empang punya 2 staf di `stafPerOutlet` (Andi hadir 7, Budi hadir 5) → dengan 7 hari dinilai alpa Andi 0 + Budi 2 = 2 ✓; telat 0+3=3 ✓; toleransi 1+0=1 ✓.

- [ ] **Step 3: Jalankan test**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/hermes/alat/absensi.test.ts`
Expected: PASS (5 test).

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/lib/hermes
git commit -m "feat(hermes): alat absensi hari ini, rekap, telat bulan ini

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Alat cuti/izin, kasbon agregat, ceklist harian

**Files:**
- Modify: `apps/admin-dashboard/src/lib/hermes/alat/absensi.ts`
- Modify: `apps/admin-dashboard/src/lib/hermes/alat/absensi.test.ts`

**Interfaces:**
- Consumes: `KonteksAbsensi.cuti/kasbon/ceklist/outlets` (Task 5)
- Produces: `cuti_izin`, `kasbon_ringkasan`, `ceklist_kepatuhan` di `ALAT_ABSENSI`

- [ ] **Step 1: Test yang gagal**

Tambahkan ke `absensi.test.ts`:
```ts
describe('cuti_izin', () => {
  it('siapa cuti pada tanggal itu (disetujui) + pengajuan menunggu; tanpa alasan', async () => {
    const r: any = await jalan('cuti_izin', { tanggal: '2026-10-07' })
    expect(r.sedang_cuti).toEqual([{ nama: 'Cici', outlet: 'SUKA SHAWARMA EMPANG', jenis: 'Cuti Tahunan', mulai: '2026-10-06', selesai: '2026-10-08', hari: 3 }])
    expect(r.menunggu).toEqual([{ nama: 'Budi', outlet: 'SUKA SHAWARMA EMPANG', jenis: 'Sakit', mulai: '2026-10-09', selesai: '2026-10-09', hari: 1 }])
  })
})

describe('kasbon_ringkasan', () => {
  it('per outlet: aktif & menunggu (jumlah + nominal), total, tanpa nama', async () => {
    const r: any = await jalan('kasbon_ringkasan')
    expect(r.outlet).toEqual([{ outlet: 'SUKA SHAWARMA EMPANG', menunggu_jumlah: 2, menunggu_nominal: 750_000, aktif_jumlah: 3, aktif_sisa: 1_200_000 }])
    expect(r.total).toEqual({ menunggu_jumlah: 2, menunggu_nominal: 750_000, aktif_jumlah: 3, aktif_sisa: 1_200_000 })
  })
})

describe('ceklist_kepatuhan', () => {
  it('sudah/belum dicek per lokasi, nilai terburuk, jumlah temuan, status tinjau', async () => {
    const r: any = await jalan('ceklist_kepatuhan')
    expect(r.ringkas).toEqual({ lokasi: 2, sudah_dicek: 1, belum_dicek: 1, perlu_perhatian: 1, belum_ditinjau: 1 })
    expect(r.outlet).toEqual([
      { outlet: 'SUKA SHAWARMA EMPANG', status: 'sudah_dicek', area_manager: 'Fajar', nilai: 'perhatian', jumlah_temuan: 2, ditinjau: false },
      { outlet: 'Kantor Pusat', status: 'belum_dicek' },
    ])
  })
})
```
Run: `cd apps/admin-dashboard && yarn vitest run src/lib/hermes/alat/absensi.test.ts` → FAIL (alat tak ditemukan).

- [ ] **Step 2: Implementasi**

Tambahkan ke `alat/absensi.ts` (sebelum `export const ALAT_ABSENSI`):
```ts
// Label sama dengan layar Perizinan HR (src/lib/types.ts LeaveType).
const LABEL_CUTI: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Lainnya',
}

async function cutiIzin(ctx: KonteksHermes, a: { tanggal?: string }) {
  const tanggal = a.tanggal ?? ctx.absensi.hariIni
  const [daftar, outlets] = await Promise.all([ctx.absensi.cuti(), ctx.absensi.outlets()])
  const nama = new Map(outlets.map((o) => [o.id, o.name]))
  const bentuk = (c: (typeof daftar)[number]) => ({
    nama: c.nama,
    outlet: (c.outletId && nama.get(c.outletId)) || '-',
    jenis: LABEL_CUTI[c.jenis] ?? c.jenis,
    mulai: c.mulai,
    selesai: c.selesai,
    hari: c.hari,
  })
  return {
    status: 'ok',
    tanggal,
    sedang_cuti: daftar.filter((c) => c.status === 'approved' && c.mulai <= tanggal && c.selesai >= tanggal).map(bentuk),
    menunggu: daftar.filter((c) => c.status === 'pending').map(bentuk),
  }
}

async function kasbonRingkasan(ctx: KonteksHermes) {
  const [baris, outlets] = await Promise.all([ctx.absensi.kasbon(), ctx.absensi.outlets()])
  const nama = new Map(outlets.map((o) => [o.id, o.name]))
  const outlet = baris
    .filter((b) => nama.has(b.outletId) && b.menungguJumlah + b.aktifJumlah > 0)
    .map((b) => ({ outlet: nama.get(b.outletId)!, menunggu_jumlah: b.menungguJumlah, menunggu_nominal: b.menungguNominal, aktif_jumlah: b.aktifJumlah, aktif_sisa: b.aktifSisa }))
    .sort((x, y) => x.outlet.localeCompare(y.outlet, 'id'))
  const total = outlet.reduce(
    (t, o) => ({ menunggu_jumlah: t.menunggu_jumlah + o.menunggu_jumlah, menunggu_nominal: t.menunggu_nominal + o.menunggu_nominal, aktif_jumlah: t.aktif_jumlah + o.aktif_jumlah, aktif_sisa: t.aktif_sisa + o.aktif_sisa }),
    { menunggu_jumlah: 0, menunggu_nominal: 0, aktif_jumlah: 0, aktif_sisa: 0 },
  )
  return { status: 'ok', outlet, total }
}

async function ceklistKepatuhan(ctx: KonteksHermes, a: { tanggal?: string }) {
  const tanggal = a.tanggal ?? ctx.absensi.hariIni
  const daftar = await ctx.absensi.ceklist(tanggal)
  const outlet = daftar.map((c) =>
    c.laporan
      ? { outlet: c.outlet.name, status: 'sudah_dicek', area_manager: c.laporan.namaAm, nilai: c.laporan.nilai, jumlah_temuan: c.laporan.jumlahTemuan, ditinjau: c.laporan.ditinjau }
      : { outlet: c.outlet.name, status: 'belum_dicek' },
  )
  const sudah = daftar.filter((c) => c.laporan)
  return {
    status: 'ok',
    tanggal,
    ringkas: {
      lokasi: daftar.length,
      sudah_dicek: sudah.length,
      belum_dicek: daftar.length - sudah.length,
      perlu_perhatian: sudah.filter((c) => c.laporan!.jumlahTemuan > 0 || (c.laporan!.nilai ?? 'baik') !== 'baik').length,
      belum_ditinjau: sudah.filter((c) => !c.laporan!.ditinjau).length,
    },
    outlet,
  }
}
```
Tambahkan 3 entri di akhir array `ALAT_ABSENSI`:
```ts
  {
    nama: 'cuti_izin',
    domain: 'absensi',
    sumber: 'Perizinan HR (cuti & izin)',
    deskripsi: 'Siapa sedang cuti/izin yang sudah disetujui pada satu tanggal (default hari ini), dan semua pengajuan cuti/izin yang masih menunggu persetujuan.',
    skema: z.object({ tanggal: TGL.optional() }).strict(),
    contoh: {},
    jalankan: cutiIzin,
  },
  {
    nama: 'kasbon_ringkasan',
    domain: 'absensi',
    sumber: 'Perizinan HR (kasbon)',
    deskripsi: 'Kasbon per outlet: jumlah & nominal pengajuan yang masih menunggu persetujuan, jumlah kasbon aktif & sisa yang belum lunas. Agregat per outlet saja — tidak ada data per orang.',
    skema: z.object({}).strict(),
    contoh: {},
    jalankan: (ctx) => kasbonRingkasan(ctx),
  },
  {
    nama: 'ceklist_kepatuhan',
    domain: 'absensi',
    sumber: 'Ceklist Harian (HR)',
    deskripsi: 'Ceklist harian area manager per outlet pada satu tanggal (default hari ini): sudah/belum dicek, nilai terburuk, jumlah temuan, sudah ditinjau atau belum.',
    skema: z.object({ tanggal: TGL.optional() }).strict(),
    contoh: {},
    jalankan: ceklistKepatuhan,
  },
```

- [ ] **Step 3: Jalankan seluruh suite Hermes**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/hermes`
Expected: PASS semua, termasuk `GERBANG §6` untuk 11 alat dan `kasbon_ringkasan tanpa nama/id staf`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/lib/hermes
git commit -m "feat(hermes): alat cuti/izin, kasbon agregat per outlet, ceklist harian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Loader nyata `KonteksAbsensi` (service role) + konteks MCP

**Files:**
- Create: `apps/admin-dashboard/src/lib/hermes/server/absensiSumber.ts`
- Modify: `apps/admin-dashboard/src/lib/hermes/server/konteks.ts`

**Interfaces:**
- Consumes: `computeBoard`, `BoardConfig`, `BoardRecord`, `isTestOrDevStaff`, `terburuk` (`@suka/hr-rumus`); RPC Task 4; tipe Task 5
- Produces: `buatKonteksAbsensi(svc: SupabaseClient, sekarang: Date): KonteksAbsensi`

- [ ] **Step 1: Implementasi loader**

Semua query meniru layar sumbernya (lihat komentar). Setiap galat Supabase dilempar (registry mengubahnya jadi "Data tidak tersedia").
```ts
// Loader data bot HRD — HANYA dipanggil route /api/hermes/mcp setelah autentikasi kunci.
// Setiap query meniru layar sumbernya; rumus dari @suka/hr-rumus (satu sumber).
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeBoard, isTestOrDevStaff, tanggalWib, terburuk, type BoardConfig, type BoardRecord, type NilaiCeklist } from '@suka/hr-rumus'
import { outletTerhitungAbsensi } from '../absensi/outlet'
import type { CeklistOutlet, CutiBaris, KasbonOutlet, KonteksAbsensi, OutletAbsensi, PapanOutlet, RekapStafBaris, StafOutlet } from '../absensi/tipe'

const HALAMAN = 1000

/** Ambil semua halaman; `build` wajib membuat builder baru tiap panggilan & berurutan unik. */
async function semuaHalaman<T>(build: () => any): Promise<T[]> {
  const hasil: T[] = []
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await build().range(dari, dari + HALAMAN - 1)
    if (error) throw new Error(error.message)
    hasil.push(...((data ?? []) as T[]))
    if (!data || data.length < HALAMAN) return hasil
  }
}

function wajib<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// Fallback config sama dengan /api/attendance/papan (bukan aturan_jam_absen SQL).
const CFG_CADANGAN: BoardConfig = { jam_masuk: '08:00', jam_keluar: '16:00', toleransi_menit: 15 }

export function buatKonteksAbsensi(svc: SupabaseClient, sekarang: Date): KonteksAbsensi {
  const hariIni = tanggalWib(sekarang)
  let janjiOutlet: Promise<OutletAbsensi[]> | null = null
  let janjiStaf: Promise<Map<string, StafOutlet[]>> | null = null

  const outlets = () =>
    (janjiOutlet ??= (async () => {
      const data = wajib(await svc.from('outlets').select('id, name, slug, type, is_active').order('id'))
      return outletTerhitungAbsensi(data as any[])
    })())

  // Staf aktif per lokasi = outlet_staff.outlet_id + staff_outlets (aturan papan & rekap).
  const stafPerOutlet = () =>
    (janjiStaf ??= (async () => {
      const ids = (await outlets()).map((o) => o.id)
      const [utama, tambahan] = await Promise.all([
        semuaHalaman<{ id: string; name: string; outlet_id: string }>(() =>
          svc.from('outlet_staff').select('id, name, outlet_id').eq('status', 'active').in('outlet_id', ids).order('id'),
        ),
        semuaHalaman<{ outlet_id: string; outlet_staff: any }>(() =>
          svc.from('staff_outlets').select('outlet_id, staff_id, outlet_staff!inner(id, name, status)').in('outlet_id', ids).order('outlet_id').order('staff_id'),
        ),
      ])
      const peta = new Map<string, Map<string, StafOutlet>>(ids.map((id) => [id, new Map()]))
      for (const s of utama) peta.get(s.outlet_id)?.set(s.id, { id: s.id, nama: s.name })
      for (const r of tambahan) {
        const st = Array.isArray(r.outlet_staff) ? r.outlet_staff[0] : r.outlet_staff
        if (st?.status === 'active' && !peta.get(r.outlet_id)?.has(st.id)) peta.get(r.outlet_id)?.set(st.id, { id: st.id, nama: st.name })
      }
      return new Map([...peta].map(([k, v]) => [k, [...v.values()]]))
    })())

  async function papan(tanggal: string): Promise<PapanOutlet[]> {
    const daftar = await outlets()
    const ids = daftar.map((o) => o.id)
    const [staf, absen, cfgRes, globalRes, jadwal] = await Promise.all([
      stafPerOutlet(),
      semuaHalaman<BoardRecord & { outlet_id: string }>(() =>
        svc
          .from('attendance')
          .select('id, outlet_id, outlet_staff_id, type, status, ts_server, telat_menit, is_manual_button, shift_jam_masuk, shift_jam_keluar')
          .in('outlet_id', ids)
          .gte('ts_server', `${tanggal}T00:00:00+07:00`)
          .lte('ts_server', `${tanggal}T23:59:59+07:00`)
          .order('ts_server')
          .order('id'),
      ),
      svc.from('outlet_attendance_config').select('outlet_id, jam_masuk, jam_keluar, toleransi_menit, pilih_shift_aktif, shift2_jam_masuk, outlet_attendance_shift(jam_masuk)').in('outlet_id', ids),
      svc.from('global_settings').select('value').eq('key', 'global_attendance_config').maybeSingle(),
      svc.from('attendance_staff_schedule').select('outlet_id, jam_masuk, attendance_staff_schedule_member(staff_id)').in('outlet_id', ids),
    ])
    const cfgLokal = new Map<string, BoardConfig>()
    for (const c of wajib(cfgRes) as any[]) {
      const { outlet_attendance_shift: shift, outlet_id, ...kolom } = c
      cfgLokal.set(outlet_id, { ...kolom, shifts_jam_masuk: ((shift ?? []) as { jam_masuk: string | null }[]).map((s) => s.jam_masuk).filter((j): j is string => !!j) })
    }
    let cfgGlobal: BoardConfig | null = null
    const gv = (wajib(globalRes) as any)?.value
    if (gv) {
      try {
        cfgGlobal = typeof gv === 'string' ? JSON.parse(gv) : gv
      } catch {
        cfgGlobal = null
      }
    }
    const aturan = new Map<string, Map<string, string>>()
    for (const j of wajib(jadwal) as any[]) {
      if (!j.jam_masuk) continue
      const m = aturan.get(j.outlet_id) ?? new Map<string, string>()
      for (const a of j.attendance_staff_schedule_member ?? []) m.set(a.staff_id, String(j.jam_masuk).slice(0, 5))
      aturan.set(j.outlet_id, m)
    }
    return daftar.map((o) => {
      const s = staf.get(o.id) ?? []
      const rec = absen.filter((r) => r.outlet_id === o.id)
      const cfg = cfgLokal.get(o.id) ?? cfgGlobal ?? CFG_CADANGAN
      const { rows, summary } = computeBoard(
        s.map((x) => ({ id: x.id, name: x.nama, role: '' })),
        rec,
        cfg,
        aturan.get(o.id),
        { sekarang, tanggal },
      )
      return {
        outlet: o,
        ringkas: summary,
        staf: rows.map((r) => ({ id: r.id, nama: r.name, state: r.state, menitTelat: r.delay_minutes, jam: r.time })),
      }
    })
  }

  async function rekapStaf(dari: string, sampai: string): Promise<RekapStafBaris[]> {
    const data = wajib(await svc.rpc('hermes_absensi_rekap_staf', { p_dari: dari, p_sampai: sampai })) as any[]
    if (data.length >= HALAMAN) throw new Error('Hasil rekap terpotong (>= 1.000 staf); persempit rentang/outlet.')
    return data.map((r) => ({ staffId: r.outlet_staff_id, hariHadir: r.hari_hadir, telat: r.jumlah_telat, telatToleransi: r.jumlah_telat_toleransi, menitTelat: r.total_menit_telat }))
  }

  // Staf tes/dev/mitra/owner disembunyikan sama seperti layar HR (useHrDirectory).
  async function stafDikecualikan(): Promise<Set<string>> {
    const data = await semuaHalaman<any>(() =>
      svc.from('outlet_staff').select('id, name, username, role, account_category, outlet_id, outlets!outlet_staff_outlet_id_fkey(id, name, slug)').order('id'),
    )
    return new Set(data.filter((s) => isTestOrDevStaff(s)).map((s) => s.id))
  }

  async function cuti(): Promise<CutiBaris[]> {
    const tujuhHariLalu = tanggalWib(new Date(sekarang.getTime() - 7 * 86_400_000))
    const [kecuali, data] = await Promise.all([
      stafDikecualikan(),
      semuaHalaman<any>(() =>
        svc
          .from('leave_requests')
          .select('id, staff_id, leave_type, start_date, end_date, days, status, outlet_staff!leave_requests_staff_id_fkey!inner(name, outlet_id)')
          .or(`status.eq.pending,end_date.gte.${tujuhHariLalu}`)
          .in('status', ['pending', 'approved'])
          .order('start_date')
          .order('id'),
      ),
    ])
    return data
      .filter((r) => !kecuali.has(r.staff_id))
      .map((r) => {
        const st = Array.isArray(r.outlet_staff) ? r.outlet_staff[0] : r.outlet_staff
        return { nama: st?.name ?? '-', outletId: st?.outlet_id ?? null, jenis: r.leave_type, mulai: r.start_date, selesai: r.end_date, hari: r.days, status: r.status }
      })
  }

  async function kasbon(): Promise<KasbonOutlet[]> {
    const kecuali = await stafDikecualikan()
    const data = wajib(await svc.rpc('hermes_kasbon_per_outlet', { p_exclude_staff: [...kecuali] })) as any[]
    return data.map((r) => ({ outletId: r.outlet_id, menungguJumlah: r.menunggu_jumlah, menungguNominal: Number(r.menunggu_nominal), aktifJumlah: r.aktif_jumlah, aktifSisa: Number(r.aktif_sisa) }))
  }

  // Cakupan ceklist = layar Ceklist Harian HR: outlet aktif internal/mitra saja.
  async function ceklist(tanggal: string): Promise<CeklistOutlet[]> {
    const daftar = (await outlets()).filter((o) => o.type === 'internal' || o.type === 'mitra')
    const data = wajib(
      await svc.from('ceklist_harian').select('outlet_id, nama_am, temuan, ditinjau_pada, ceklist_harian_item(nilai)').eq('tanggal', tanggal),
    ) as any[]
    const per = new Map(data.map((d) => [d.outlet_id, d]))
    return daftar.map((o) => {
      const d = per.get(o.id)
      return {
        outlet: o,
        laporan: d
          ? {
              namaAm: d.nama_am ?? '-',
              nilai: terburuk(((d.ceklist_harian_item ?? []) as { nilai: NilaiCeklist }[]).map((i) => i.nilai)),
              jumlahTemuan: (d.temuan ?? []).length,
              ditinjau: Boolean(d.ditinjau_pada),
            }
          : null,
      }
    })
  }

  return { hariIni, sekarang, outlets, papan, stafPerOutlet, rekapStaf, cuti, kasbon, ceklist }
}
```
Sebelum lanjut, cocokkan nama FK di embed dengan yang dipakai HR: `grep -rn "leave_requests_staff_id_fkey\|outlet_staff_outlet_id_fkey" apps/HR/src/hooks` — pakai string yang sama persis.

- [ ] **Step 2: Rangkai konteks**

`apps/admin-dashboard/src/lib/hermes/server/konteks.ts` — tambahkan import `import { buatKonteksAbsensi } from './absensiSumber'` dan di objek return tambahkan:
```ts
    absensi: buatKonteksAbsensi(svc, sekarang),
```
Loader absensi malas: tidak ada query sampai alat absensi dipanggil, jadi panggilan penjualan tidak bertambah biaya.

- [ ] **Step 3: Verifikasi kompilasi & test**

```bash
cd apps/admin-dashboard && yarn type-check && yarn vitest run src/lib/hermes && NEXT_TURBOPACK=0 yarn build
```
Expected: type-check tanpa error baru; test hijau; build sukses (route `/api/hermes/mcp`).

- [ ] **Step 4: Uji asap lokal lewat endpoint MCP**

Jalankan `yarn dev` admin-dashboard (port 3005). Buat kunci uji scope `absensi` + IP `127.0.0.1`/`::1` di halaman **Sistem → Kunci Hermes**. Lalu:
```bash
curl -s http://localhost:3005/api/hermes/mcp -H "Authorization: Bearer $KUNCI" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"absensi_hari_ini","arguments":{}}}'
```
Bila 403, lihat kolom `ip` baris terbaru `hermes_api_log` dan tambahkan IP itu ke kunci uji. Expected: `isError:false`, `structuredContent.total.staf` > 0, `meta.sumber` = `Papan Kehadiran (app absensi)`. Ulangi untuk 5 alat lain. Catat durasi tiap panggilan dari tabel `hermes_api_log` (`durasi_ms`) — target < 2.000 ms; bila lebih, catat & optimasi sebelum Task 9.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/hermes/server
git commit -m "feat(hermes): loader data absensi (service role) untuk domain absensi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gerbang 1–3 domain absensi

**Files:**
- Create: `supabase/verifikasi/hermes/gerbang-absensi.md`

- [ ] **Step 1: Gerbang 1 — cocok angka (3 tanggal)**

Pilih 3 tanggal: hari ini, kemarin, dan satu tanggal minggu lalu. Untuk tiap tanggal & 2 outlet (satu internal, satu mitra) + Kantor Pusat:
- `absensi_hari_ini {tanggal, outlet}` vs layar **Papan Kehadiran** app absensi (hari ini saja; tanggal lampau bandingkan dengan **Rekap** tanggal itu: jumlah telat & alpa).
- `absensi_rekap {dari, sampai}` (rentang 7 hari) vs layar **Rekap** app absensi rentang sama: jumlah telat & alpa per outlet.
- `cuti_izin` vs layar HR **Perizinan → Izin** (status disetujui yang mencakup tanggal, dan tab menunggu).
- `kasbon_ringkasan.total.menunggu_jumlah` vs kartu ringkasan HR **Perizinan → Kasbon** (pending).
- `ceklist_kepatuhan` vs layar HR **Ceklist Harian** ("n / N outlet sudah dicek").

Tulis tabel hasil di `gerbang-absensi.md` (kolom: alat, tanggal, outlet, angka alat, angka layar, cocok?). Semua harus sama persis; bila beda, cari sebabnya (cakupan outlet, filter staf tes, zona waktu) dan perbaiki sebelum lanjut.

Catatan yang diharapkan berbeda & sah: papan kehadiran **produksi** yang belum di-redeploy masih memakai batas alpha zona UTC (Task 1) — bandingkan setelah app absensi di-redeploy, atau bandingkan pada jam di luar jendela 13:15–20:15 WIB.

- [ ] **Step 2: Gerbang 2 — uji kunci**

- Kunci scope `penjualan` saja memanggil `absensi_hari_ini` → jawaban `Alat tidak dikenal` (tidak bocor).
- Kunci scope `absensi` memanggil `penjualan_ringkasan` → `Alat tidak dikenal`.
- Cabut kunci uji → panggilan berikutnya 401.
Catat hasil di `gerbang-absensi.md`.

- [ ] **Step 3: Gerbang 3 — larangan data**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/hermes/registry.test.ts` → PASS. Tambahan manual: simpan output nyata 6 alat dari Step 1 ke berkas sementara di scratchpad, lalu `grep -Ei "gaji|nik|ktp|selfie|face_descriptor|@[a-z0-9-]+\.[a-z]{2,}|(\+62|08)[0-9]{8,12}"` → tidak ada hasil. Hapus berkas sementara.

- [ ] **Step 4: Commit**

```bash
git add supabase/verifikasi/hermes/gerbang-absensi.md
git commit -m "docs(hermes): gerbang 1-3 domain absensi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: VPS — profil Hermes `hrd` & API server (D10)

**Prasyarat:** Task 9 lolos. Admin-dashboard dengan alat absensi sudah ter-deploy (redeploy lewat alur GitHub Actions → Coolify; memory `gh-actions-coolify-trigger-silent-fail`).

**Files:**
- Create: `docs/hermes/SOUL-hrd.md`
- Modify: `docs/RUNBOOK-HERMES-VPS.md` (§7 API server, § profil hrd)

- [ ] **Step 1: Pastikan app HR & Hermes satu mesin**

Lewat MCP Coolify (`coolify_list_applications` → `coolify_get_application` app HR → server; `coolify_get_server`) ambil IP server app HR, bandingkan dengan IP VPS Hermes `76.13.193.138`.
- Sama → lanjut.
- Beda → **berhenti**, laporkan ke owner: API server tidak boleh dibuka ke internet tanpa keputusan baru.

- [ ] **Step 2: Tulis SOUL profil hrd**

`docs/hermes/SOUL-hrd.md`:
```markdown
<!-- Salin ke ~/.hermes/profiles/hrd/SOUL.md di VPS (user suka-hermes). -->
Kamu adalah asisten HRD Suka Shawarma di dashboard HR. Kamu hanya membaca data lewat
alat MCP "suka" domain absensi: absensi_hari_ini, absensi_rekap, absensi_telat_bulan_ini,
cuti_izin, kasbon_ringkasan, ceklist_kepatuhan.

## Aturan angka (wajib)
- Setiap angka & nama WAJIB berasal dari hasil alat di percakapan ini. Jangan menebak.
- Bila alat gagal atau tidak ada alat untuk pertanyaan itu, katakan "data tidak tersedia"
  beserta alasannya.
- Sebutkan tanggal/rentang dan lokasi setiap kali menyebut angka.
- Alpa & belum hadir: cuti dan libur BELUM dikecualikan oleh sistem. Saat melaporkan alpa,
  cek `cuti_izin` untuk tanggal yang sama dan tandai nama yang sedang cuti.
- Kasbon hanya per outlet. Jika ditanya kasbon seseorang, jawab bahwa data per orang
  hanya bisa dilihat di menu Perizinan → Kasbon.

## Keamanan (wajib)
- Jangan pernah meminta, menerima, atau menampilkan kunci, password, token, atau isi file
  konfigurasi. Jika pengguna menempelkannya, minta menghapus pesan & merotasi kuncinya.
- Jangan menyarankan perintah terminal atau server.
- Jangan membahas gaji, NIK, nomor HP, alamat, atau data pribadi siapa pun.
- Jangan memberi saran sanksi atau tindakan disiplin.

## Gaya
Bahasa Indonesia, singkat, poin dengan "-", tanpa tabel. Nama orang ditulis apa adanya.
Dibaca di panel chat kecil dashboard HR.
```

- [ ] **Step 3: Kunci MCP & profil**

1. Halaman admin **Sistem → Kunci Hermes** → buat kunci "Bot HRD", scope **absensi saja**, IP `76.13.193.138`. Salin (tampil sekali).
2. SSH ke VPS sebagai `suka-hermes`, lalu ikuti pola runbook profil `ceo`:
```bash
hermes profile create hrd
hrd setup model            # Custom endpoint http://127.0.0.1:20128/v1, mode 2 (Chat Completions)
echo 'SUKA_MCP_KEY=<kunci Bot HRD>' >> ~/.hermes/profiles/hrd/.env
chmod 600 ~/.hermes/profiles/hrd/.env
```
`~/.hermes/profiles/hrd/config.yaml` tambahkan:
```yaml
mcp_servers:
  suka:
    url: https://admin.sukashawarma.com/api/hermes/mcp
    headers:
      Authorization: "Bearer ${SUKA_MCP_KEY}"
    enabled: true
```
3. Salin `docs/hermes/SOUL-hrd.md` → `~/.hermes/profiles/hrd/SOUL.md`.
4. Matikan memory/skills/session_search & kunci toolset untuk **cli dan platform API server**:
```bash
hrd tools disable --platform cli web browser terminal file code_execution vision image_gen tts skills todo memory session_search connections delegation cronjob computer_use
hrd tools --summary --platform cli     # hanya clarify + suka:*
```
5. Uji CLI: `hrd chat` → "siapa yang telat hari ini?" harus memanggil `suka:absensi_hari_ini`; "baca file ~/.hermes/config.yaml" harus ditolak.

- [ ] **Step 4: Nyalakan API server**

1. Baca dokumentasi versi Hermes terpasang: `hermes gateway --help`, `hermes config --help`, dan berkas `~/.hermes/config.yaml` bagian api server. Tentukan: (a) cara menyalakan API server di port **8643** bind **127.0.0.1**, (b) kunci `API_SERVER_KEY` per profil, (c) path endpoint per profil (README `apps/bot` menyebut `/p/<profil>/v1/...` — **verifikasi**, jangan diasumsikan), (d) apakah header `X-Hermes-Session-Id` menyimpan riwayat di sisi server.
2. Nyalakan, set `API_SERVER_KEY` profil hrd (acak 48 char: `openssl rand -base64 36`), lalu kunci toolset platform API server seperti Step 3.4 dengan `--platform <nama platform api server>` dan `hrd tools --summary --platform <...>` = hanya clarify + suka:*.
3. `systemctl --user restart hermes-gateway`.
4. Uji dari VPS:
```bash
curl -s http://127.0.0.1:8643/<path profil hrd>/v1/chat/completions \
  -H "Authorization: Bearer $API_SERVER_KEY_HRD" -H 'Content-Type: application/json' \
  -d '{"model":"hermes-agent","stream":false,"messages":[{"role":"user","content":"Berapa yang alpa hari ini?"}]}'
```
Expected: JSON OpenAI `choices[0].message.content` berisi jawaban dengan angka dari alat. Uji juga tanpa header Authorization → 401.

- [ ] **Step 5: Jalur jaringan container HR → API server**

Dari dalam container HR (Coolify "Terminal" app HR, atau `docker exec`), cari alamat host:
```bash
getent hosts host.docker.internal || ip route | awk '/default/ {print $3}'
```
Pilih satu (urut preferensi):
- (a) Hermes API server bind ke IP gateway jaringan docker Coolify (mis. `10.0.1.1`) + `ufw` hanya izinkan subnet docker ke port 8643;
- (b) tetap bind 127.0.0.1 + reverse proxy kecil (Caddy/nginx host) di IP gateway docker dengan allowlist subnet docker.
Verifikasi: `curl` dari container HR ke `http://<ip>:8643/...` → 200; `curl` dari laptop ke `http://76.13.193.138:8643` → timeout/ditolak.

- [ ] **Step 6: Catat kontrak final**

Isi tabel berikut di runbook (§7 baru "API server profil hrd") dengan hasil nyata:

| Item | Nilai |
|---|---|
| `HERMES_HRD_URL` (dari container HR) | `http://<ip>:8643/<path profil hrd>` |
| Model di body | nilai yang diterima server |
| `X-Hermes-Session-Id` menyimpan riwayat? | ya/tidak → `HERMES_HRD_KIRIM_RIWAYAT` = `false`/`true` |
| Toolset platform API server | 1/28 + suka:* |

- [ ] **Step 7: Commit dokumentasi**

```bash
git add docs/hermes/SOUL-hrd.md docs/RUNBOOK-HERMES-VPS.md
git commit -m "docs(hermes): profil hrd, API server 8643 & jalur jaringan app HR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Jangan pernah menulis nilai kunci ke repo, commit, atau output terminal yang ditampilkan.

---

### Task 11: Tabel percakapan bot HRD

**Files:**
- Create: `supabase/migrations/20261008091000_bot_hrd_percakapan.sql`
- Create: `supabase/verifikasi/hermes/t3_bot_hrd_rls.sql`

**Interfaces:**
- Produces: `bot_hrd_percakapan(id uuid, user_id uuid, judul text, dibuat_at, diperbarui_at)`, `bot_hrd_pesan(id, percakapan_id, user_id, peran 'user'|'assistant', isi, dibuat_at)`, fungsi `bisa_bot_hrd() returns boolean`

- [ ] **Step 1: Uji RLS (gagal sebelum migration)**

`supabase/verifikasi/hermes/t3_bot_hrd_rls.sql`:
```sql
-- Simulasi user nyata lewat request.jwt.claims; ROLLBACK di akhir.
BEGIN;
DO $$
DECLARE hr uuid; crew uuid; p uuid; n int;
BEGIN
  SELECT id INTO hr FROM outlet_staff WHERE role = 'admin_hr' AND status = 'active' LIMIT 1;
  SELECT id INTO crew FROM outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  IF hr IS NULL OR crew IS NULL THEN RAISE EXCEPTION 'fixture admin_hr/crew tidak ada'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', hr, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO bot_hrd_percakapan (judul) VALUES ('uji') RETURNING id INTO p;
  INSERT INTO bot_hrd_pesan (percakapan_id, peran, isi) VALUES (p, 'user', 'halo');
  SELECT count(*) INTO n FROM bot_hrd_pesan WHERE percakapan_id = p;
  IF n <> 1 THEN RAISE EXCEPTION 'admin_hr tak bisa membaca pesannya sendiri'; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM bot_hrd_percakapan;
  IF n <> 0 THEN RAISE EXCEPTION 'crew melihat percakapan orang lain'; END IF;
  BEGIN
    INSERT INTO bot_hrd_percakapan (judul) VALUES ('crew');
    RAISE EXCEPTION 'crew bisa membuat percakapan';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  RESET ROLE;
  RAISE NOTICE 'T3 LULUS';
END $$;
ROLLBACK;
```
Jalankan → Expected ERROR `relation "bot_hrd_percakapan" does not exist`.

- [ ] **Step 2: Migration**

`supabase/migrations/20261008091000_bot_hrd_percakapan.sql`:
```sql
-- Riwayat chat bot HRD (widget dashboard HR). Pola SUKA Bot (20261003180000):
-- milik pengguna sendiri, hanya role bot HRD aktif. Spec 2026-10-07-bot-hrd-dashboard D4.

CREATE OR REPLACE FUNCTION public.bisa_bot_hrd()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM outlet_staff
     WHERE id = auth.uid() AND status = 'active'
       AND role IN ('admin_hr', 'owner', 'admin', 'developer')
  )
$$;
REVOKE ALL ON FUNCTION public.bisa_bot_hrd() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bisa_bot_hrd() TO authenticated, service_role;

CREATE TABLE public.bot_hrd_percakapan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  judul text NOT NULL DEFAULT 'Percakapan' CHECK (char_length(judul) <= 80),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  diperbarui_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_hrd_percakapan_user_idx ON public.bot_hrd_percakapan (user_id, diperbarui_at DESC);

CREATE TABLE public.bot_hrd_pesan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  percakapan_id uuid NOT NULL REFERENCES public.bot_hrd_percakapan(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  peran text NOT NULL CHECK (peran IN ('user', 'assistant')),
  isi text NOT NULL CHECK (char_length(isi) <= 20000),
  dibuat_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_hrd_pesan_percakapan_idx ON public.bot_hrd_pesan (percakapan_id, dibuat_at);
CREATE INDEX bot_hrd_pesan_user_hari_idx ON public.bot_hrd_pesan (user_id, dibuat_at) WHERE peran = 'user';

ALTER TABLE public.bot_hrd_percakapan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_hrd_pesan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_hrd_percakapan, public.bot_hrd_pesan FROM anon;
REVOKE ALL ON public.bot_hrd_percakapan, public.bot_hrd_pesan FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bot_hrd_percakapan TO authenticated;
GRANT SELECT, INSERT ON public.bot_hrd_pesan TO authenticated;

CREATE POLICY bot_hrd_percakapan_milik ON public.bot_hrd_percakapan
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND bisa_bot_hrd())
  WITH CHECK (user_id = auth.uid() AND bisa_bot_hrd());

CREATE POLICY bot_hrd_pesan_milik ON public.bot_hrd_pesan
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND bisa_bot_hrd())
  WITH CHECK (
    user_id = auth.uid() AND bisa_bot_hrd()
    AND EXISTS (SELECT 1 FROM bot_hrd_percakapan p WHERE p.id = percakapan_id AND p.user_id = auth.uid())
  );

-- Retensi 90 hari (pola suka-bot-retensi-90-hari). 19:30 UTC = 02:30 WIB.
SELECT cron.schedule(
  'bot-hrd-retensi-90-hari',
  '30 19 * * *',
  $$DELETE FROM public.bot_hrd_percakapan WHERE diperbarui_at < now() - interval '90 days'$$
);
```

- [ ] **Step 3: Cek timestamp, apply, stempel, uji**

```bash
ls supabase/migrations | cut -c1-14 | sort | uniq -d
node scripts/migration-timestamp-lint.mjs
```
Apply + stempel seperti Task 4 Step 4. Jalankan `t3_bot_hrd_rls.sql` → `NOTICE: T3 LULUS`. Verifikasi cron: `SELECT schedule, active FROM cron.job WHERE jobname = 'bot-hrd-retensi-90-hari';` → `30 19 * * *`, `true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261008091000_bot_hrd_percakapan.sql supabase/verifikasi/hermes/t3_bot_hrd_rls.sql
git commit -m "feat(db): tabel percakapan bot HRD ber-RLS milik sendiri + retensi 90 hari

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Server bot HRD di app HR (klien Hermes + server action)

**Files:**
- Create: `apps/HR/src/lib/botHrd/hermes.ts`, `apps/HR/src/lib/botHrd/hermes.test.ts`
- Create: `apps/HR/src/app/actions/botHrd.ts`
- Modify: `apps/HR/Dockerfile` (runner + builder ARG/ENV)

**Interfaces:**
- Consumes: tabel Task 11; env `HERMES_HRD_URL`, `HERMES_HRD_API_KEY`, `HERMES_HRD_MODEL` (default `hermes-agent`), `HERMES_HRD_KIRIM_RIWAYAT` (default `true`), `BOT_HRD_BATAS_HARIAN` (default `100`)
- Produces:
  - `tanyaHermes(opsi: { url: string; kunci: string; model: string; sesiId: string; pesan: { role: 'user' | 'assistant'; content: string }[]; fetchFn?: typeof fetch; batasMs?: number }): Promise<string>`
  - server actions: `kirimPesanBotHrd(input: { percakapanId?: string; pesan: string }): Promise<{ ok: true; percakapanId: string; jawaban: string } | { ok: false; galat: string }>` dan `ambilPesanBotHrd(percakapanId: string): Promise<{ ok: true; pesan: { peran: 'user' | 'assistant'; isi: string; dibuat_at: string }[] } | { ok: false; galat: string }>`

- [ ] **Step 1: Test klien Hermes yang gagal**

`apps/HR/src/lib/botHrd/hermes.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { tanyaHermes } from './hermes'

const dasar = { url: 'http://10.0.1.1:8643/p/hrd', kunci: 'k', model: 'hermes-agent', sesiId: 's-1', pesan: [{ role: 'user' as const, content: 'halo' }] }

describe('tanyaHermes', () => {
  it('POST chat/completions non-stream dengan bearer & session id, kembalikan isi jawaban', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Halo HRD' } }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const jawab = await tanyaHermes({ ...dasar, fetchFn: fetchFn as any })
    expect(jawab).toBe('Halo HRD')
    const [url, init] = fetchFn.mock.calls[0] as any
    expect(url).toBe('http://10.0.1.1:8643/p/hrd/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer k')
    expect(init.headers['X-Hermes-Session-Id']).toBe('s-1')
    expect(JSON.parse(init.body)).toEqual({ model: 'hermes-agent', stream: false, messages: dasar.pesan })
  })
  it('HTTP gagal / jawaban kosong → error tanpa membocorkan isi respons', async () => {
    const gagal = vi.fn(async () => new Response('secret detail', { status: 500 }))
    await expect(tanyaHermes({ ...dasar, fetchFn: gagal as any })).rejects.toThrow('Bot HRD sedang tidak tersedia (HTTP 500)')
    const kosong = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    await expect(tanyaHermes({ ...dasar, fetchFn: kosong as any })).rejects.toThrow('Bot HRD tidak memberi jawaban')
  })
})
```
Run: `cd apps/HR && yarn vitest run src/lib/botHrd/hermes.test.ts` → FAIL (modul tak ada).

- [ ] **Step 2: Implementasi klien**

`apps/HR/src/lib/botHrd/hermes.ts`:
```ts
// Klien Hermes API server (OpenAI-compatible) profil `hrd`. Server-only:
// kunci tak pernah sampai ke browser. Kontrak diverifikasi di runbook Hermes §7.
export interface PesanHermes {
  role: 'user' | 'assistant'
  content: string
}

export async function tanyaHermes(opsi: {
  url: string
  kunci: string
  model: string
  sesiId: string
  pesan: PesanHermes[]
  fetchFn?: typeof fetch
  batasMs?: number
}): Promise<string> {
  const f = opsi.fetchFn ?? fetch
  const res = await f(`${opsi.url.replace(/\/+$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opsi.kunci}`,
      'X-Hermes-Session-Id': opsi.sesiId,
    },
    body: JSON.stringify({ model: opsi.model, stream: false, messages: opsi.pesan }),
    signal: AbortSignal.timeout(opsi.batasMs ?? 90_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Bot HRD sedang tidak tersedia (HTTP ${res.status})`)
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string | null } }[] } | null
  const isi = body?.choices?.[0]?.message?.content?.trim()
  if (!isi) throw new Error('Bot HRD tidak memberi jawaban')
  return isi
}
```
Run test → PASS (2 test).

- [ ] **Step 3: Server action**

`apps/HR/src/app/actions/botHrd.ts`:
```ts
'use server'

import { z } from 'zod'
import { jakartaDayKey } from '@suka/auth'
import { requireRole } from '@/lib/authz'
import { createServerComponentClient } from '@/lib/supabase-server'
import { tanyaHermes, type PesanHermes } from '@/lib/botHrd/hermes'

const ROLE_BOT_HRD = ['admin_hr', 'owner', 'admin']
const RIWAYAT_MAKS = 20
const Masukan = z.object({ percakapanId: z.string().uuid().optional(), pesan: z.string().trim().min(1).max(1000) })

type Hasil<T> = ({ ok: true } & T) | { ok: false; galat: string }

const awalHariWib = () => `${jakartaDayKey()}T00:00:00+07:00`

export async function kirimPesanBotHrd(input: { percakapanId?: string; pesan: string }): Promise<Hasil<{ percakapanId: string; jawaban: string }>> {
  try {
    await requireRole(ROLE_BOT_HRD)
  } catch {
    return { ok: false, galat: 'Bot HRD hanya untuk HRD, owner, dan admin.' }
  }
  const p = Masukan.safeParse(input)
  if (!p.success) return { ok: false, galat: 'Pesan kosong atau terlalu panjang (maks 1.000 karakter).' }
  const url = process.env.HERMES_HRD_URL
  const kunci = process.env.HERMES_HRD_API_KEY
  if (!url || !kunci) return { ok: false, galat: 'Bot HRD belum dikonfigurasi.' }

  const db = await createServerComponentClient()

  const batas = Number(process.env.BOT_HRD_BATAS_HARIAN ?? 100)
  const { count, error: galatHitung } = await db
    .from('bot_hrd_pesan')
    .select('id', { count: 'exact', head: true })
    .eq('peran', 'user')
    .gte('dibuat_at', awalHariWib())
  if (galatHitung) return { ok: false, galat: 'Gagal memeriksa batas harian.' }
  if ((count ?? 0) >= batas) return { ok: false, galat: `Batas ${batas} pertanyaan per hari tercapai. Coba lagi besok.` }

  // Percakapan hanya berlanjut di hari yang sama (WIB) — pola SUKA Bot.
  let percakapanId: string | undefined
  if (p.data.percakapanId) {
    const { data } = await db.from('bot_hrd_percakapan').select('id, dibuat_at').eq('id', p.data.percakapanId).maybeSingle()
    if (data && jakartaDayKey(new Date(data.dibuat_at)) === jakartaDayKey()) percakapanId = data.id
  }
  if (!percakapanId) {
    const { data, error } = await db.from('bot_hrd_percakapan').insert({ judul: p.data.pesan.slice(0, 60) }).select('id').single()
    if (error || !data) return { ok: false, galat: 'Gagal membuat percakapan.' }
    percakapanId = data.id as string
  }

  const { data: lama, error: galatRiwayat } = await db
    .from('bot_hrd_pesan')
    .select('peran, isi, dibuat_at')
    .eq('percakapan_id', percakapanId)
    .order('dibuat_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(RIWAYAT_MAKS)
  if (galatRiwayat) return { ok: false, galat: 'Gagal memuat riwayat.' }

  const { error: galatSimpan } = await db.from('bot_hrd_pesan').insert({ percakapan_id: percakapanId, peran: 'user', isi: p.data.pesan })
  if (galatSimpan) return { ok: false, galat: 'Gagal menyimpan pesan.' }

  const kirimRiwayat = process.env.HERMES_HRD_KIRIM_RIWAYAT !== 'false'
  const riwayat: PesanHermes[] = kirimRiwayat
    ? (lama ?? []).reverse().map((m) => ({ role: m.peran as 'user' | 'assistant', content: m.isi as string }))
    : []

  let jawaban: string
  try {
    jawaban = await tanyaHermes({
      url,
      kunci,
      model: process.env.HERMES_HRD_MODEL || 'hermes-agent',
      sesiId: percakapanId,
      pesan: [...riwayat, { role: 'user', content: p.data.pesan }],
    })
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : 'Bot HRD sedang tidak tersedia.' }
  }

  await db.from('bot_hrd_pesan').insert({ percakapan_id: percakapanId, peran: 'assistant', isi: jawaban.slice(0, 20000) })
  await db.from('bot_hrd_percakapan').update({ diperbarui_at: new Date().toISOString() }).eq('id', percakapanId)
  return { ok: true, percakapanId, jawaban }
}

export async function ambilPesanBotHrd(percakapanId: string): Promise<Hasil<{ pesan: { peran: 'user' | 'assistant'; isi: string; dibuat_at: string }[] }>> {
  try {
    await requireRole(ROLE_BOT_HRD)
  } catch {
    return { ok: false, galat: 'Bot HRD hanya untuk HRD, owner, dan admin.' }
  }
  if (!z.string().uuid().safeParse(percakapanId).success) return { ok: false, galat: 'Percakapan tidak valid.' }
  const db = await createServerComponentClient()
  const { data, error } = await db
    .from('bot_hrd_pesan')
    .select('peran, isi, dibuat_at')
    .eq('percakapan_id', percakapanId)
    .order('dibuat_at')
    .order('id')
    .limit(200)
  if (error) return { ok: false, galat: 'Gagal memuat percakapan.' }
  return { ok: true, pesan: (data ?? []) as { peran: 'user' | 'assistant'; isi: string; dibuat_at: string }[] }
}
```
Sebelum memakai: pastikan `jakartaDayKey` di `@suka/auth` menerima argumen `Date` opsional (`grep -n "export function jakartaDayKey" -A3 packages/auth/src/*.ts`). Bila tidak menerima argumen, ganti `jakartaDayKey(new Date(data.dibuat_at))` dengan `new Date(new Date(data.dibuat_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10)`. Pastikan `zod` ada di `apps/HR/package.json`; bila tidak ada, cek range yang sudah resolved di `yarn.lock` (`grep -n '^zod@\|^"zod@' yarn.lock`) dan tambahkan dependency dengan range yang PERSIS sama (lockfile tidak berubah).

- [ ] **Step 4: Env Dockerfile HR**

Di `apps/HR/Dockerfile` stage **runner**, setelah `ARG WAHA_API_KEY` tambahkan:
```dockerfile
ARG HERMES_HRD_URL
ARG HERMES_HRD_API_KEY
ARG HERMES_HRD_MODEL
ARG HERMES_HRD_KIRIM_RIWAYAT
ARG BOT_HRD_BATAS_HARIAN
```
dan setelah `ENV WAHA_API_KEY=$WAHA_API_KEY`:
```dockerfile
ENV HERMES_HRD_URL=$HERMES_HRD_URL
ENV HERMES_HRD_API_KEY=$HERMES_HRD_API_KEY
ENV HERMES_HRD_MODEL=$HERMES_HRD_MODEL
ENV HERMES_HRD_KIRIM_RIWAYAT=$HERMES_HRD_KIRIM_RIWAYAT
ENV BOT_HRD_BATAS_HARIAN=$BOT_HRD_BATAS_HARIAN
```
(Variabel ini hanya dibaca saat runtime; tidak perlu di stage builder.)

- [ ] **Step 5: Verifikasi**

```bash
cd apps/HR && yarn test && yarn type-check && NEXT_TURBOPACK=0 yarn build
```
Expected: test hijau, type-check tanpa error baru, build sukses.

- [ ] **Step 6: Commit**

```bash
git add apps/HR/src/lib/botHrd apps/HR/src/app/actions/botHrd.ts apps/HR/Dockerfile apps/HR/package.json
git commit -m "feat(hr): server bot HRD — klien Hermes profil hrd + server action ber-riwayat

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Widget chat melayang di dashboard HR

**Files:**
- Create: `apps/HR/src/components/botHrd/BotHrdWidget.tsx`
- Create: `apps/HR/src/components/botHrd/PanelBotHrd.tsx`
- Create: `apps/HR/src/lib/botHrd/simpanan.ts`, `apps/HR/src/lib/botHrd/simpanan.test.ts`
- Modify: `apps/HR/src/app/layout.tsx`

**Interfaces:**
- Consumes: `kirimPesanBotHrd`, `ambilPesanBotHrd` (Task 12); `useRole()` dari `@/components/layout/RoleContext`
- Produces: `bacaPercakapan(simpanan: Storage | null, hariIni: string): string | null`, `simpanPercakapan(simpanan: Storage | null, id: string, hariIni: string): void`, `hapusPercakapan(simpanan: Storage | null): void`

- [ ] **Step 1: Test simpanan percakapan yang gagal**

`apps/HR/src/lib/botHrd/simpanan.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { bacaPercakapan, simpanPercakapan, hapusPercakapan } from './simpanan'

function memori(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size } }
}

describe('simpanan percakapan bot HRD', () => {
  it('hanya dipakai di hari yang sama (WIB)', () => {
    const s = memori()
    simpanPercakapan(s, 'abc', '2026-10-07')
    expect(bacaPercakapan(s, '2026-10-07')).toBe('abc')
    expect(bacaPercakapan(s, '2026-10-08')).toBeNull()
  })
  it('tahan storage rusak / tidak tersedia', () => {
    const s = memori()
    s.setItem('botHrd.percakapan', '{rusak')
    expect(bacaPercakapan(s, '2026-10-07')).toBeNull()
    expect(bacaPercakapan(null, '2026-10-07')).toBeNull()
    expect(() => simpanPercakapan(null, 'x', '2026-10-07')).not.toThrow()
    hapusPercakapan(s)
    expect(s.getItem('botHrd.percakapan')).toBeNull()
  })
})
```
Run: `cd apps/HR && yarn vitest run src/lib/botHrd/simpanan.test.ts` → FAIL.

- [ ] **Step 2: Implementasi simpanan**

`apps/HR/src/lib/botHrd/simpanan.ts`:
```ts
const KUNCI = 'botHrd.percakapan'

export function bacaPercakapan(simpanan: Storage | null, hariIni: string): string | null {
  try {
    const v = simpanan?.getItem(KUNCI)
    if (!v) return null
    const o = JSON.parse(v) as { id?: string; tanggal?: string }
    return o.tanggal === hariIni && typeof o.id === 'string' ? o.id : null
  } catch {
    return null
  }
}

export function simpanPercakapan(simpanan: Storage | null, id: string, hariIni: string): void {
  try {
    simpanan?.setItem(KUNCI, JSON.stringify({ id, tanggal: hariIni }))
  } catch {
    /* storage diblokir: percakapan tetap jalan, hanya tak diingat */
  }
}

export function hapusPercakapan(simpanan: Storage | null): void {
  try {
    simpanan?.removeItem(KUNCI)
  } catch {
    /* abaikan */
  }
}
```
Run test → PASS (2 test).

- [ ] **Step 3: Panel chat**

`apps/HR/src/components/botHrd/PanelBotHrd.tsx`:
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, RotateCcw, X } from 'lucide-react'
import { jakartaDayKey } from '@suka/auth'
import { kirimPesanBotHrd, ambilPesanBotHrd } from '@/app/actions/botHrd'
import { bacaPercakapan, simpanPercakapan, hapusPercakapan } from '@/lib/botHrd/simpanan'

type Pesan = { peran: 'user' | 'assistant'; isi: string }

const SARAN = ['Siapa yang telat hari ini?', 'Siapa yang alpa hari ini?', 'Siapa yang sedang cuti?', 'Ceklist harian hari ini sudah lengkap?']
const PEMBUKA: Pesan = {
  peran: 'assistant',
  isi: 'Halo! Saya Bot HRD. Saya bisa menjawab soal kehadiran, telat, alpa, cuti & izin, kasbon per outlet, dan ceklist harian. Mau tanya apa?',
}

const storage = () => (typeof window === 'undefined' ? null : window.localStorage)

export function PanelBotHrd({ onTutup }: { onTutup: () => void }) {
  const [pesan, setPesan] = useState<Pesan[]>([PEMBUKA])
  const [teks, setTeks] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const percakapanId = useRef<string | null>(null)
  const bawah = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = bacaPercakapan(storage(), jakartaDayKey())
    if (!id) return
    percakapanId.current = id
    ambilPesanBotHrd(id).then((r) => {
      if (r.ok && r.pesan.length) setPesan([PEMBUKA, ...r.pesan.map((m) => ({ peran: m.peran, isi: m.isi }))])
    })
  }, [])

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pesan, memuat])

  async function kirim(isi: string) {
    const t = isi.trim()
    if (!t || memuat) return
    setGalat(null)
    setTeks('')
    setPesan((p) => [...p, { peran: 'user', isi: t }])
    setMemuat(true)
    const r = await kirimPesanBotHrd({ pesan: t, percakapanId: percakapanId.current ?? undefined })
    setMemuat(false)
    if (!r.ok) {
      setGalat(r.galat)
      return
    }
    percakapanId.current = r.percakapanId
    simpanPercakapan(storage(), r.percakapanId, jakartaDayKey())
    setPesan((p) => [...p, { peran: 'assistant', isi: r.jawaban }])
  }

  function mulaiBaru() {
    hapusPercakapan(storage())
    percakapanId.current = null
    setPesan([PEMBUKA])
    setGalat(null)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:rounded-2xl sm:border sm:border-[#E8DCCB]">
      <div className="flex items-center justify-between bg-[#4A1713] px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Bot HRD</p>
          <p className="text-xs text-white/70">Data absensi, cuti, kasbon & ceklist</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={mulaiBaru} className="rounded-lg p-2 hover:bg-white/10" aria-label="Percakapan baru">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={onTutup} className="rounded-lg p-2 hover:bg-white/10" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#FDF9F3] px-4 py-4">
        {pesan.map((m, i) => (
          <div key={i} className={m.peran === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.peran === 'user'
                  ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-suka-orange px-3 py-2 text-sm text-white'
                  : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-[#2B1B17] shadow-sm'
              }
            >
              {m.isi}
            </div>
          </div>
        ))}
        {pesan.length === 1 && (
          <div className="flex flex-wrap gap-2">
            {SARAN.map((s) => (
              <button key={s} type="button" onClick={() => kirim(s)} className="rounded-full border border-[#E8DCCB] bg-white px-3 py-1.5 text-xs text-[#4A1713] hover:bg-[#F6EDE1]">
                {s}
              </button>
            ))}
          </div>
        )}
        {memuat && (
          <div className="flex items-center gap-2 text-xs text-[#8A766C]">
            <Loader2 className="h-4 w-4 animate-spin" /> Bot HRD sedang mengecek data…
          </div>
        )}
        {galat && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{galat}</p>}
        <div ref={bawah} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          kirim(teks)
        }}
        className="flex items-end gap-2 border-t border-[#E8DCCB] bg-white p-3"
      >
        <textarea
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              kirim(teks)
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Tanya soal absensi…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-[#E8DCCB] bg-[#FDF9F3] px-3 py-2 text-sm outline-none focus:border-suka-orange"
        />
        <button type="submit" disabled={memuat || !teks.trim()} className="rounded-xl bg-suka-orange p-2.5 text-white disabled:opacity-40" aria-label="Kirim">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Widget & mount**

`apps/HR/src/components/botHrd/BotHrdWidget.tsx`:
```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MessageCircle } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'

// Panel dimuat saat dibuka saja (tak menambah bundel halaman awal).
const PanelBotHrd = dynamic(() => import('./PanelBotHrd').then((m) => m.PanelBotHrd), { ssr: false })

const ROLE_BOT = new Set(['ADMIN_HR', 'OWNER', 'ADMIN', 'DEVELOPER'])

export function BotHrdWidget() {
  const { role } = useRole()
  const [buka, setBuka] = useState(false)
  if (!role || !ROLE_BOT.has(role)) return null
  return (
    <>
      {buka && (
        <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px]">
          <PanelBotHrd onTutup={() => setBuka(false)} />
        </div>
      )}
      {!buka && (
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-suka-orange text-white shadow-lg transition hover:scale-105 lg:bottom-6 lg:right-6"
          aria-label="Buka Bot HRD"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </>
  )
}
```
`bottom-24` di HP agar tidak menutupi `BottomNav`; `lg:bottom-6` di desktop. Bila tinggi BottomNav berbeda, sesuaikan dengan kelas tinggi di `src/components/layout/BottomNav.tsx`.

`apps/HR/src/app/layout.tsx`: tambahkan import `import { BotHrdWidget } from '@/components/botHrd/BotHrdWidget'` dan render `<BotHrdWidget />` tepat setelah `<BottomNav />` (masih di dalam `<Providers>` agar `useRole` tersedia).

- [ ] **Step 5: Verifikasi**

```bash
cd apps/HR && yarn test && yarn type-check && NEXT_TURBOPACK=0 yarn build
```
Uji manual (`yarn dev`, port 3025) dengan `.env.local` berisi `HERMES_HRD_URL` mengarah ke tunnel SSH (`ssh -L 8643:127.0.0.1:8643 root@76.13.193.138` lalu `HERMES_HRD_URL=http://127.0.0.1:8643/<path profil hrd>`):
- Login admin_hr → tombol bulat muncul di semua halaman HR; klik → panel; chip saran mengirim pertanyaan; jawaban tampil.
- Refresh halaman → riwayat hari ini muncul lagi; "Percakapan baru" mengosongkan.
- Lebar 375px: panel layar penuh, tombol tak menutupi BottomNav.
- Matikan tunnel → pesan galat "Bot HRD sedang tidak tersedia", UI tidak crash.

- [ ] **Step 6: Commit**

```bash
git add apps/HR/src/components/botHrd apps/HR/src/lib/botHrd apps/HR/src/app/layout.tsx
git commit -m "feat(hr): widget chat melayang Bot HRD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Deploy, masa uji, dokumentasi

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-bot-hrd-dashboard-design.md` (§5 pesan pembuka)
- Modify: `docs/superpowers/specs/2026-10-07-hermes-api-design.md` (§7 urutan & §7.3)
- Modify: `CLAUDE.md` (entri sesi)

- [ ] **Step 1: Selaraskan spec**

- Spec bot HRD §5: ganti "Pesan pembuka: ringkasan absensi hari ini (template dari alat, bukan karangan AI)" menjadi "Pesan pembuka: sapaan tetap + chip saran pertanyaan (tanpa angka). Ringkasan otomatis ditunda — app HR tidak memanggil MCP langsung (tanpa kunci kedua)."
- Spec induk §7: urutan menjadi `penjualan → absensi → gudang → finance` (D1), dan §7.3 tambahkan rujukan ke spec bot HRD (belum hadir/alpa kini termasuk, D6/D7).

- [ ] **Step 2: Env Coolify app HR**

Lewat MCP Coolify (`coolify_list_envs` app HR lalu `coolify_create_env`), set `HERMES_HRD_URL`, `HERMES_HRD_API_KEY`, `HERMES_HRD_MODEL`, `HERMES_HRD_KIRIM_RIWAYAT` sesuai tabel runbook Task 10 Step 6, `BOT_HRD_BATAS_HARIAN=100`. Nilai kunci dibaca dari VPS dan langsung dimasukkan ke Coolify — jangan dicetak ke chat/log.

- [ ] **Step 3: Push & redeploy (izin owner dulu)**

Minta izin owner untuk push branch & membuka PR `feat/bot-hrd-dashboard` → `main`. Setelah merge: redeploy **absensi**, **admin-dashboard**, **HR** (alur GitHub Actions → Coolify). Cek `/api/hermes/mcp` produksi dengan kunci Bot HRD (`tools/list` memuat 6 alat absensi).

- [ ] **Step 4: Masa uji (gerbang 4)**

Satu minggu dipakai dev/owner saja (spec §6 gerbang 4): sementara masa uji, set `BOT_HRD_BATAS_HARIAN` normal tapi umumkan ke admin_hr setelah minggu uji selesai. Catat temuan di `supabase/verifikasi/hermes/gerbang-absensi.md` (bagian Gerbang 4).

- [ ] **Step 5: CLAUDE.md**

Tambahkan entri `## Session 2026-10-07/08: Bot HRD di Dashboard HR` berisi: status (apa yang live), package `@suka/hr-rumus` (satu sumber papan/rekap/filter staf/ceklist), perubahan batas alpha WIB (dulu zona container UTC → alpa 7 jam terlambat), 2 RPC + 2 tabel baru, env HR baru, kontrak Hermes API server (dari runbook), gotcha test larangan data (`kasbon` dikecualikan khusus `kasbon_ringkasan`), dan "perlu redeploy absensi, admin-dashboard, HR".

- [ ] **Step 6: Commit**

```bash
git add docs CLAUDE.md supabase/verifikasi/hermes/gerbang-absensi.md
git commit -m "docs: bot HRD — spec diselaraskan, catatan sesi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Urutan eksekusi & ketergantungan

1 → 2 → 3 (package & absensi) · 4 (DB) bisa paralel dengan 1–3 · 5 → 8 → 6 → 7 (admin-dashboard; 8 butuh 4) · 9 (gerbang) · 10 (VPS, butuh 9 + deploy admin-dashboard) · 11 (DB) bisa kapan saja sebelum 12 · 12 → 13 (HR; uji nyata butuh 10) · 14.

Antara Task 5 dan Task 8, `konteks.ts` belum lengkap (type-check admin-dashboard merah) — jangan push/deploy di antaranya.
