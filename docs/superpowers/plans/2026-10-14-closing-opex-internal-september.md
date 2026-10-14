# Closing OPEX Internal September 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tabel OPEX September 2026 outlet internal (11 outlet + SS Online) dan OPEX HQ di layar sistem sama persis dengan sheet FIXED SEPTEMBER 2026.

**Architecture:** Satu file data closing yang dibangkitkan skrip dari Excel, satu fungsi murni `terapkanClosingOpex` yang menambahkan baris "Penyesuaian closing" (target − data) ke baris OPEX hasil pipeline yang sudah ada, dan satu fungsi murni `targetKartuClosing` untuk kartu Buku Kas. Fungsi dipasang di Laba Rugi, ekspor, Ringkasan Bisnis, dan Buku Kas (admin & Finance). Enam koreksi data (B1–B6) dijalankan di DB dengan arsip.

**Tech Stack:** Next.js (App Router) + TypeScript, Vitest, Supabase Postgres, Python 3 + openpyxl (generator).

**Spec:** `docs/superpowers/specs/2026-10-14-closing-opex-internal-september-design.md`

## Global Constraints

- Hanya September 2026. Bulan lain (Agustus, Oktober, dst.) **tidak boleh berubah** di layar mana pun.
- Rumus Oktober+ (bonus RM per item × Rp 50, alokasi AM sistem, pembagian kru cadangan, bonus realtime) **tidak diubah**.
- Penyesuaian hanya dipasang untuk rentang **tepat** `2026-09-01` s/d `2026-09-30` (lihat catatan revisi spec di Task 1).
- Target = sel sheet FIXED SEPTEMBER 2026 file `SS LAP. LABA RUGI 2026 fixxxxx.xlsx`. Tidak ada angka target yang diketik tangan di kode.
- File Excel sumber **tidak** di-commit (berisi rincian gaji per orang). Repo GitHub ini publik.
- GUDANG SS ONLINE (`d23e11b3-23f1-4f9a-b428-cc73e1aa9b91`) digabung ke kolom SS Online (`ss-online`) hanya saat closing diterapkan.
- File `src/lib/closing/*.ts` (non-test) di admin-dashboard dan finance harus **byte-identik**.
- Keterangan baris penyesuaian non-lembur **tidak boleh** mengandung kata "lembur", "lemburan", atau "overtime" (dibaca `isLemburExpense` sebagai lembur).
- Kantor Pusat = `outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'`.
- Perubahan DB (Task 8) dijalankan controller sesi utama, bukan subagent, dengan arsip di `SS COGS SET/`.
- Bahasa UI & komentar: Bahasa Indonesia.

## Review Focus

1. **Rentang memotong September** (mis. 1–15 Sep, atau Agustus–September): layar memakai data apa adanya dan menampilkan catatan; tidak pernah memasang penyesuaian sebagian. → tes di Task 2.
2. **Filter satu outlet di Laba Rugi**: penyesuaian hanya untuk outlet itu, tidak ada baris pusat; outlet mitra tidak pernah disesuaikan. → tes di Task 2.
3. **Outlet tanpa baris data** (SS Online di sistem tidak punya gaji): penyesuaian tetap ditambahkan penuh. → tes di Task 2.
4. **Baris pusat berdeskripsi "Lemburan …"** (B3b memindahkan lembur Aby ke pengeluaran global): dihitung sebagai Pengeluaran Global, bukan lembur. → tes di Task 2.
5. **Nilai pecahan rupiah dari slip** (mis. 1.384.615,38): penyesuaian membuat total tepat sama dengan target. → tes di Task 2.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps/admin-dashboard/scripts/closing/bangkitkan_opex_internal_sept2026.py` | Generator: baca sheet FIXED → tulis file data TS |
| `apps/admin-dashboard/src/lib/closing/opexClosingInternalSeptember2026.ts` | (dibangkitkan) tipe + konstanta target & alasan |
| `apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.ts` | Fungsi murni penerap + pemetaan baris |
| `apps/admin-dashboard/src/lib/closing/targetKartuClosing.ts` | Fungsi murni target kartu Buku Kas |
| `apps/admin-dashboard/src/lib/closing/*.test.ts` | Tes data, penerap, kartu |
| `apps/admin-dashboard/src/app/dashboard/owner/profit/ProfitView.tsx` | Pasang penerap + banner |
| `apps/admin-dashboard/src/lib/export/profitExportFetcher.ts` | Pasang penerap |
| `apps/admin-dashboard/src/lib/server/opexLabaRugi.ts` | Ekspor `susunBarisOpexLabaRugi` + pasang penerap |
| `apps/admin-dashboard/src/app/dashboard/reports/input-pengeluaran/page.tsx` | Kartu Buku Kas admin |
| `apps/finance/src/lib/closing/*.ts` | Salinan identik + tes paritas |
| `apps/finance/src/app/laporan/buku-kas/page.tsx` | Kartu Buku Kas Finance |
| `apps/admin-dashboard/scripts/closing/cek-closing-opex-sept2026.run.ts` + `vitest.cek.config.mts` | Cek data hidup (manual) |
| `SS COGS SET/closing-opex-sept2026-B1-B6.sql` | Arsip perubahan data + pembatalan |

---

### Task 1: Generator + data closing

**Files:**
- Create: `apps/admin-dashboard/scripts/closing/bangkitkan_opex_internal_sept2026.py`
- Create (dibangkitkan): `apps/admin-dashboard/src/lib/closing/opexClosingInternalSeptember2026.ts`
- Test: `apps/admin-dashboard/src/lib/closing/opexClosingInternalSeptember2026.test.ts`
- Modify: `docs/superpowers/specs/2026-10-14-closing-opex-internal-september-design.md` (catatan revisi)

**Interfaces:**
- Produces:
  ```ts
  export type BarisOpexOutlet = 'pengeluaran_outlet' | 'gaji_crew_outlet' | 'bonus_crew' | 'bonus_area_manager' | 'bonus_regional_manager' | 'lembur' | 'ads' | 'endorsement' | 'promo' | 'pdam' | 'pln' | 'internet' | 'sewa_outlet'
  export type BarisOpexPusat = 'pdam' | 'pln' | 'internet' | 'pengeluaran_global' | 'gaji_staff_kantor' | 'crew_backup' | 'transport' | 'bahan_baku' | 'ads'
  export interface ClosingOpexOutlet { nama: string; kolomExcel: string; target: Record<BarisOpexOutlet, number>; totalExcel: number; alasan: Partial<Record<BarisOpexOutlet, string>> }
  export interface ClosingOpexPusat { target: Record<BarisOpexPusat, number>; totalExcel: number; alasan: Partial<Record<BarisOpexPusat, string>> }
  export interface ClosingOpexBulan { from: string; to: string; sumber: string; outlets: Record<string, ClosingOpexOutlet>; pusat: ClosingOpexPusat }
  export const BARIS_OPEX_OUTLET: BarisOpexOutlet[]
  export const BARIS_OPEX_PUSAT: BarisOpexPusat[]
  export const CLOSING_OPEX_INTERNAL_SEPT_2026: ClosingOpexBulan
  ```
  Kunci `outlets` = id outlet (`'ss-online'` untuk SS Online).

- [ ] **Step 1: Tulis tes data (gagal dulu)**

`apps/admin-dashboard/src/lib/closing/opexClosingInternalSeptember2026.test.ts`:
```ts
import {
  BARIS_OPEX_OUTLET,
  BARIS_OPEX_PUSAT,
  CLOSING_OPEX_INTERNAL_SEPT_2026 as C,
} from './opexClosingInternalSeptember2026'

const jumlah = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0)

describe('data closing OPEX internal September 2026', () => {
  it('meliputi tepat 12 kolom internal (SS Online + 11 outlet)', () => {
    expect(Object.keys(C.outlets).sort()).toEqual([
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
      '550e8400-e29b-41d4-a716-446655440004',
      '550e8400-e29b-41d4-a716-446655440005',
      '550e8400-e29b-41d4-a716-446655440006',
      '550e8400-e29b-41d4-a716-446655440007',
      '550e8400-e29b-41d4-a716-446655440008',
      '550e8400-e29b-41d4-a716-446655440009',
      '550e8400-e29b-41d4-a716-446655440010',
      '550e8400-e29b-41d4-a716-446655440011',
      '550e8400-e29b-41d4-a716-446655440013',
      'ss-online',
    ])
    expect(C.from).toBe('2026-09-01')
    expect(C.to).toBe('2026-09-30')
  })

  it('jumlah 13 baris tiap outlet = Total OPEX baris 50 Excel', () => {
    for (const o of Object.values(C.outlets)) {
      expect(Object.keys(o.target).sort()).toEqual([...BARIS_OPEX_OUTLET].sort())
      expect(Math.abs(jumlah(o.target) - o.totalExcel)).toBeLessThan(1)
    }
  })

  it('jumlah 9 baris HQ = Total OPEX HQ 222.840.270', () => {
    expect(Object.keys(C.pusat.target).sort()).toEqual([...BARIS_OPEX_PUSAT].sort())
    expect(jumlah(C.pusat.target)).toBe(222840270)
    expect(C.pusat.totalExcel).toBe(222840270)
  })

  it('titik uji sama dengan sel Excel', () => {
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440001'].target.gaji_crew_outlet).toBe(11202714)
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440005'].target.pengeluaran_outlet).toBe(3884000)
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440005'].target.pdam).toBe(0)
    expect(C.outlets['ss-online'].target.gaji_crew_outlet).toBe(6630000)
    expect(C.outlets['ss-online'].target.internet).toBe(260850)
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440008'].totalExcel).toBe(10114336)
    expect(C.pusat.target.pengeluaran_global).toBe(126079883)
    expect(C.pusat.target.crew_backup).toBe(8694636)
    expect(C.pusat.target.bahan_baku).toBe(1504609)
  })

  it('alasan baris non-lembur tidak memuat kata yang dibaca sebagai lembur', () => {
    const terlarang = /\b(lembur(an)?|overtime)\b/i
    for (const o of Object.values(C.outlets)) {
      for (const [baris, teks] of Object.entries(o.alasan)) {
        if (baris !== 'lembur') expect(teks).not.toMatch(terlarang)
      }
    }
    for (const teks of Object.values(C.pusat.alasan)) expect(teks).not.toMatch(terlarang)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run (dari `apps/admin-dashboard`): `./node_modules/.bin/vitest run src/lib/closing/opexClosingInternalSeptember2026.test.ts`
Expected: FAIL — `Failed to resolve import "./opexClosingInternalSeptember2026"`.

- [ ] **Step 3: Tulis generator**

`apps/admin-dashboard/scripts/closing/bangkitkan_opex_internal_sept2026.py`:
```python
"""Bangkitkan data closing OPEX internal September 2026 dari sheet FIXED SEPTEMBER 2026.

Pakai (dari apps/admin-dashboard):
  python -I scripts/closing/bangkitkan_opex_internal_sept2026.py "<path xlsx>" src/lib/closing/opexClosingInternalSeptember2026.ts

File Excel TIDAK di-commit (berisi rincian gaji). Skrip berhenti kalau label baris
di kolom A tidak sesuai — artinya tata letak sheet berubah dan target harus dicek ulang.
"""
import json
import os
import sys

import openpyxl

SHEET = 'FIXED SEPTEMBER 2026'
OUTLETS = [
    ('B', 'ss-online', 'SS Online'),
    ('C', '550e8400-e29b-41d4-a716-446655440001', 'SUKA SHAWARMA BNR'),
    ('D', '550e8400-e29b-41d4-a716-446655440002', 'SUKA SHAWARMA EMPANG'),
    ('E', '550e8400-e29b-41d4-a716-446655440004', 'SUKA SHAWARMA CIMANGGU'),
    ('F', '550e8400-e29b-41d4-a716-446655440005', 'SUKA SHAWARMA DEPOK SUKMAJAYA'),
    ('G', '550e8400-e29b-41d4-a716-446655440006', 'SUKA SHAWARMA JAGAKARSA'),
    ('H', '550e8400-e29b-41d4-a716-446655440007', 'SUKA SHAWARMA BEJI'),
    ('I', '550e8400-e29b-41d4-a716-446655440008', 'SUKA SHAWARMA SAWANGAN (INTERNAL)'),
    ('J', '550e8400-e29b-41d4-a716-446655440009', 'SUKA SHAWARMA PAJAJARAN'),
    ('K', '550e8400-e29b-41d4-a716-446655440010', 'SUKA SHAWARMA JATIWARINGIN'),
    ('L', '550e8400-e29b-41d4-a716-446655440011', 'SUKA SHAWARMA CIRENDEU'),
    ('M', '550e8400-e29b-41d4-a716-446655440013', 'SUKA SHAWARMA DRAMAGA'),
]
BARIS_OUTLET = [
    (37, 'PENGELUARAN OUTLET', 'pengeluaran_outlet'),
    (38, 'GAJI CREW OUTLET', 'gaji_crew_outlet'),
    (39, 'BONUS CREW', 'bonus_crew'),
    (40, 'BONUS AREA MANAGER', 'bonus_area_manager'),
    (41, 'BONUS REGIONAL MANAGER', 'bonus_regional_manager'),
    (42, 'LEMBUR', 'lembur'),
    (43, 'ADS', 'ads'),
    (44, 'ENDORSEMENT', 'endorsement'),
    (45, 'PROMO', 'promo'),
    (46, 'PDAM', 'pdam'),
    (47, 'PLN', 'pln'),
    (48, 'INTERNET', 'internet'),
    (49, 'BIAYA SEWA OUTLET', 'sewa_outlet'),
]
TOTAL_OUTLET = (50, 'TOTAL OPEX')
BARIS_PUSAT = [
    (60, 'PDAM', 'pdam'),
    (61, 'PLN', 'pln'),
    (62, 'INTERNET', 'internet'),
    (65, 'PENGELUARAN GLOBAL', 'pengeluaran_global'),
    (66, 'GAJI STAFF KANTOR', 'gaji_staff_kantor'),
    (67, 'GAJI & BONUS CREW BACKUP', 'crew_backup'),
    (68, 'TRANSPORT', 'transport'),
    (69, 'BAHAN BAKU', 'bahan_baku'),
    (70, 'ADS', 'ads'),
]
TOTAL_PUSAT = (73, 'TOTAL OPEX HQ')

ALASAN_UMUM = {
    'pengeluaran_outlet': 'Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing',
    'gaji_crew_outlet': 'Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing',
    'bonus_crew': 'Bonus mengikuti slip payroll',
    'bonus_area_manager': 'Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)',
    'bonus_regional_manager': 'Bonus RM dibagi rata 1/21 sesuai closing',
    'lembur': 'Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing',
}
ALASAN_KHUSUS = {
    ('ss-online', 'gaji_crew_outlet'): 'Slip Gilang, Ismansyah & Abdul Hanan dibebankan ke SS Online',
    ('550e8400-e29b-41d4-a716-446655440001', 'gaji_crew_outlet'): 'Slip Gilang & Ismansyah dibebankan ke SS Online',
    ('550e8400-e29b-41d4-a716-446655440001', 'lembur'): 'Lemburan a.n Gilang tidak dihitung; lembur Aby pindah ke pusat',
    ('550e8400-e29b-41d4-a716-446655440001', 'internet'): 'Pulsa HP Kitchen tidak dihitung',
    ('550e8400-e29b-41d4-a716-446655440005', 'lembur'): 'Bongkaran Sawangan tidak dihitung; lembur kas kecil di Pengeluaran Outlet',
}
ALASAN_PUSAT = {
    'gaji_staff_kantor': 'Slip Abdul Hanan dibebankan ke SS Online',
    'crew_backup': 'Gaji & bonus kru SS BACKUP dibebankan ke pusat',
    'internet': 'Pulsa KOL & Pulsa Markom tidak dihitung',
}


def angka(v):
    v = float(v or 0)
    r = round(v)
    return r if abs(v - r) < 0.005 else round(v, 2)


def cek_label(ws, baris, label):
    teks = str(ws.cell(baris, 1).value or '').strip().upper()
    if teks != label:
        sys.exit(f'Label baris {baris} = {teks!r}, seharusnya {label!r}. Tata letak sheet berubah.')


def main(sumber, tujuan):
    ws = openpyxl.load_workbook(sumber, data_only=True)[SHEET]
    for b, label, _ in BARIS_OUTLET + BARIS_PUSAT:
        cek_label(ws, b, label)
    cek_label(ws, *TOTAL_OUTLET)
    cek_label(ws, *TOTAL_PUSAT)

    outlets = {}
    for kol, oid, nama in OUTLETS:
        target = {key: angka(ws[f'{kol}{b}'].value) for b, _, key in BARIS_OUTLET}
        total = angka(ws[f'{kol}{TOTAL_OUTLET[0]}'].value)
        if abs(sum(target.values()) - total) >= 1:
            sys.exit(f'Kolom {kol}: jumlah baris {sum(target.values())} != total {total}')
        alasan = {}
        for _, _, key in BARIS_OUTLET:
            teks = ALASAN_KHUSUS.get((oid, key)) or ALASAN_UMUM.get(key)
            if teks:
                alasan[key] = teks
        outlets[oid] = {'nama': nama, 'kolomExcel': kol, 'target': target, 'totalExcel': total, 'alasan': alasan}

    target_pusat = {key: angka(ws[f'B{b}'].value) for b, _, key in BARIS_PUSAT}
    total_pusat = angka(ws[f'B{TOTAL_PUSAT[0]}'].value)
    if abs(sum(target_pusat.values()) - total_pusat) >= 1:
        sys.exit(f'HQ: jumlah baris {sum(target_pusat.values())} != total {total_pusat}')

    data = {
        'from': '2026-09-01',
        'to': '2026-09-30',
        'sumber': f'{os.path.basename(sumber)} — sheet {SHEET}',
        'outlets': outlets,
        'pusat': {'target': target_pusat, 'totalExcel': total_pusat, 'alasan': ALASAN_PUSAT},
    }
    isi = (
        '// File ini DIBANGKITKAN oleh scripts/closing/bangkitkan_opex_internal_sept2026.py.\n'
        '// Jangan diedit tangan. Salinan identik ada di apps/finance/src/lib/closing/.\n'
        '\n'
        "export type BarisOpexOutlet = 'pengeluaran_outlet' | 'gaji_crew_outlet' | 'bonus_crew' | 'bonus_area_manager' | 'bonus_regional_manager' | 'lembur' | 'ads' | 'endorsement' | 'promo' | 'pdam' | 'pln' | 'internet' | 'sewa_outlet'\n"
        "export type BarisOpexPusat = 'pdam' | 'pln' | 'internet' | 'pengeluaran_global' | 'gaji_staff_kantor' | 'crew_backup' | 'transport' | 'bahan_baku' | 'ads'\n"
        '\n'
        'export interface ClosingOpexOutlet {\n'
        '  nama: string\n  kolomExcel: string\n  target: Record<BarisOpexOutlet, number>\n'
        '  totalExcel: number\n  alasan: Partial<Record<BarisOpexOutlet, string>>\n}\n'
        'export interface ClosingOpexPusat {\n'
        '  target: Record<BarisOpexPusat, number>\n  totalExcel: number\n'
        '  alasan: Partial<Record<BarisOpexPusat, string>>\n}\n'
        'export interface ClosingOpexBulan {\n'
        '  from: string\n  to: string\n  sumber: string\n'
        '  outlets: Record<string, ClosingOpexOutlet>\n  pusat: ClosingOpexPusat\n}\n'
        '\n'
        f'export const BARIS_OPEX_OUTLET: BarisOpexOutlet[] = {json.dumps([k for _, _, k in BARIS_OUTLET])}\n'
        f'export const BARIS_OPEX_PUSAT: BarisOpexPusat[] = {json.dumps([k for _, _, k in BARIS_PUSAT])}\n'
        '\n'
        f'export const CLOSING_OPEX_INTERNAL_SEPT_2026: ClosingOpexBulan = {json.dumps(data, ensure_ascii=False, indent=2)}\n'
    )
    with open(tujuan, 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)
    print(f'OK: {len(outlets)} outlet, HQ {total_pusat} → {tujuan}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
```

- [ ] **Step 4: Jalankan generator**

Run (dari `apps/admin-dashboard`):
```bash
python -I scripts/closing/bangkitkan_opex_internal_sept2026.py "C:/Users/lu.DESKTOP-HRO3RNS/Downloads/SS LAP. LABA RUGI 2026 fixxxxx.xlsx" src/lib/closing/opexClosingInternalSeptember2026.ts
```
Expected: `OK: 12 outlet, HQ 222840270 → src/lib/closing/opexClosingInternalSeptember2026.ts`

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `./node_modules/.bin/vitest run src/lib/closing/opexClosingInternalSeptember2026.test.ts`
Expected: PASS (5 tes).

- [ ] **Step 6: Catat revisi spec**

Tambahkan di akhir spec `docs/superpowers/specs/2026-10-14-closing-opex-internal-september-design.md`:
```markdown
## 12. Revisi saat penyusunan rencana (14 Okt 2026)

- **K5 dipersempit:** penyesuaian hanya dipasang untuk rentang **tepat** 1–30 September 2026.
  Alasannya: baris gaji/bonus dari HR untuk rentang multi-bulan dijumlah jadi satu baris
  bertanggal akhir rentang, sehingga bagian September tidak bisa dipisahkan dengan aman.
  Rentang lain yang memuat/memotong September memakai data apa adanya + catatan.
- **Buku Kas:** kartu closing berlaku untuk pilihan satu outlet internal, *Outlet Internal*,
  *Internal + Kantor Pusat*, dan *Kantor Pusat*. Pilihan *Semua Outlet* dan *Outlet Mitra*
  memakai data apa adanya + catatan (closing internal tidak bisa dicampur dengan data mitra
  di kartu yang dihitung dari ringkasan HR). App Finance hanya punya pilihan satu outlet dan
  Kantor Pusat untuk cakupan ini.
- **Kategori baris penyesuaian Gaji & Bonus Crew Backup (HQ)** memakai kategori `salary`.
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/scripts/closing/bangkitkan_opex_internal_sept2026.py apps/admin-dashboard/src/lib/closing/opexClosingInternalSeptember2026.ts apps/admin-dashboard/src/lib/closing/opexClosingInternalSeptember2026.test.ts docs/superpowers/specs/2026-10-14-closing-opex-internal-september-design.md
git commit -m "feat(admin-dashboard): data closing OPEX internal September 2026 dari sheet FIXED"
```

---

### Task 2: Penerap `terapkanClosingOpex`

**Files:**
- Create: `apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.ts`
- Test: `apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.test.ts`

**Interfaces:**
- Consumes: `CLOSING_OPEX_INTERNAL_SEPT_2026`, `BARIS_OPEX_OUTLET`, `BARIS_OPEX_PUSAT`, tipe `BarisOpexOutlet`/`BarisOpexPusat` (Task 1); `ExpenseRow` dari `@/lib/expenseRow`; `isLemburExpense` dari `@/lib/expenseCategories`.
- Produces:
  ```ts
  export const SS_ONLINE_ID = 'ss-online'
  export const GUDANG_SS_ONLINE_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'
  export const AWALAN_ID_PENYESUAIAN = 'closing-sep26-'
  export interface FilterClosing { from: string; to: string; outletId: string } // 'all' | 'PUSAT' | id outlet | 'ss-online'
  export interface HasilClosing { rows: ExpenseRow[]; diterapkan: boolean; catatan: string | null }
  export function rentangClosingTepat(from: string, to: string): boolean
  export function barisOutletDari(r: Pick<ExpenseRow, 'category' | 'description'>): BarisOpexOutlet
  export function barisPusatDari(r: Pick<ExpenseRow, 'category'>): BarisOpexPusat
  export function terapkanClosingOpex(rows: ExpenseRow[], filter: FilterClosing): HasilClosing
  ```

- [ ] **Step 1: Tulis tes (gagal dulu)**

`apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.test.ts`:
```ts
import type { ExpenseRow } from '@/lib/expenseRow'
import { isLemburExpense } from '@/lib/expenseCategories'
import { CLOSING_OPEX_INTERNAL_SEPT_2026 as C } from './opexClosingInternalSeptember2026'
import {
  AWALAN_ID_PENYESUAIAN,
  GUDANG_SS_ONLINE_ID,
  SS_ONLINE_ID,
  barisOutletDari,
  barisPusatDari,
  terapkanClosingOpex,
} from './terapkanClosingOpex'

const BNR = '550e8400-e29b-41d4-a716-446655440001'
const CIRENDEU = '550e8400-e29b-41d4-a716-446655440011'
const MITRA_CIBINONG = '550e8400-e29b-41d4-a716-446655440014'
const PUSAT = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const SEPT = { from: '2026-09-01', to: '2026-09-30' }

let n = 0
function baris(p: Partial<ExpenseRow> & Pick<ExpenseRow, 'category' | 'amount'>): ExpenseRow {
  n += 1
  return {
    id: `t-${n}`,
    outlet_id: BNR,
    outlet_name: 'SUKA SHAWARMA BNR',
    scope: 'outlet',
    description: '',
    expense_date: '2026-09-15',
    period_month: '2026-09-01',
    source: 'monthly',
    ...p,
  } as ExpenseRow
}

function jumlahPerBaris(rows: ExpenseRow[], outletId: string) {
  const hasil: Record<string, number> = {}
  for (const r of rows.filter(r => r.scope === 'outlet' && r.outlet_id === outletId)) {
    const k = barisOutletDari(r)
    hasil[k] = (hasil[k] ?? 0) + r.amount
  }
  return hasil
}

describe('terapkanClosingOpex', () => {
  it('rentang selain tepat September: data apa adanya', () => {
    const rows = [baris({ category: 'gaji_crew_outlet', amount: 100 })]
    const agustus = terapkanClosingOpex(rows, { from: '2026-08-01', to: '2026-08-31', outletId: 'all' })
    expect(agustus).toEqual({ rows, diterapkan: false, catatan: null })

    const separuh = terapkanClosingOpex(rows, { from: '2026-09-01', to: '2026-09-15', outletId: 'all' })
    expect(separuh.rows).toBe(rows)
    expect(separuh.diterapkan).toBe(false)
    expect(separuh.catatan).toMatch(/1–30 September/)

    const gabung = terapkanClosingOpex(rows, { from: '2026-08-01', to: '2026-09-30', outletId: 'all' })
    expect(gabung.diterapkan).toBe(false)
    expect(gabung.catatan).toMatch(/1–30 September/)
  })

  it('satu outlet: tiap baris = target Excel, baris asli tetap ada', () => {
    const rows = [
      baris({ category: 'gaji_crew_outlet', amount: 15832715, id: 'hr-gaji-bnr' }),
      baris({ category: 'bonus_crew', amount: 148801 }),
      baris({ category: 'bonus_area_manager', amount: 74400 }),
      baris({ category: 'lembur', amount: 50000, description: 'Lemburan a.n Gilang' }),
      baris({ category: 'internet', amount: 51500, description: 'Pulsa HP Kitchen' }),
      baris({ category: 'pengeluaran_outlet', amount: 7900, source: 'monthly' }),
    ]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: BNR })
    expect(hasil.diterapkan).toBe(true)
    expect(hasil.rows.slice(0, rows.length)).toEqual(rows)
    const sums = jumlahPerBaris(hasil.rows, BNR)
    for (const [k, v] of Object.entries(C.outlets[BNR].target)) {
      expect(Math.abs((sums[k] ?? 0) - v)).toBeLessThan(0.001)
    }
    const penyesuaian = hasil.rows.filter(r => r.id.startsWith(AWALAN_ID_PENYESUAIAN))
    expect(penyesuaian.every(r => r.outlet_id === BNR && r.source === 'monthly')).toBe(true)
    expect(penyesuaian.find(r => r.category === 'gaji_crew_outlet')?.amount).toBeCloseTo(-4630001, 0)
    expect(penyesuaian.find(r => r.category === 'bonus_regional_manager')?.amount).toBeCloseTo(128224, 0)
    expect(hasil.rows.some(r => r.scope === 'pusat')).toBe(false)
  })

  it('pecahan rupiah dari slip tetap menghasilkan total tepat', () => {
    const rows = [baris({ outlet_id: CIRENDEU, category: 'gaji_crew_outlet', amount: 6267200.38461538 })]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: CIRENDEU })
    expect(jumlahPerBaris(hasil.rows, CIRENDEU).gaji_crew_outlet).toBeCloseTo(C.outlets[CIRENDEU].target.gaji_crew_outlet, 6)
  })

  it('outlet tanpa baris data tetap disesuaikan penuh (SS Online)', () => {
    const hasil = terapkanClosingOpex([], { ...SEPT, outletId: SS_ONLINE_ID })
    const sums = jumlahPerBaris(hasil.rows, SS_ONLINE_ID)
    expect(sums.gaji_crew_outlet).toBe(6630000)
    expect(sums.internet).toBe(260850)
  })

  it('GUDANG SS ONLINE digabung ke SS Online', () => {
    const rows = [baris({ outlet_id: GUDANG_SS_ONLINE_ID, outlet_name: 'GUDANG SS ONLINE', category: 'internet', amount: 260850 })]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: 'all' })
    expect(hasil.rows.some(r => r.outlet_id === GUDANG_SS_ONLINE_ID)).toBe(false)
    const ss = hasil.rows.filter(r => r.outlet_id === SS_ONLINE_ID)
    expect(ss.find(r => r.category === 'internet' && !r.id.startsWith(AWALAN_ID_PENYESUAIAN))?.amount).toBe(260850)
    expect(ss.some(r => r.category === 'internet' && r.id.startsWith(AWALAN_ID_PENYESUAIAN))).toBe(false)
  })

  it('semua outlet tanpa data: total penyesuaian = total OPEX internal + HQ Excel', () => {
    const hasil = terapkanClosingOpex([], { ...SEPT, outletId: 'all' })
    const total = hasil.rows.reduce((s, r) => s + r.amount, 0)
    const totalInternal = Object.values(C.outlets).reduce((s, o) => s + o.totalExcel, 0)
    expect(total).toBeCloseTo(totalInternal + C.pusat.totalExcel, 2)
  })

  it('outlet mitra tidak pernah disesuaikan', () => {
    const rows = [baris({ outlet_id: MITRA_CIBINONG, outlet_name: 'MITRA CIBINONG', category: 'gaji_crew_outlet', amount: 999 })]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: MITRA_CIBINONG })
    expect(hasil.rows).toEqual(rows)
  })

  it('pusat: baris "Lemburan" di pengeluaran global tetap Pengeluaran Global; crew backup pakai kategori salary', () => {
    const rows = [
      baris({ outlet_id: PUSAT, outlet_name: 'Kantor Pusat', scope: 'pusat', category: 'pengeluaran_global', amount: 50000, description: 'Lemburan a.n Aby' }),
      baris({ outlet_id: PUSAT, outlet_name: 'Kantor Pusat', scope: 'pusat', category: 'gaji_staff_kantor', amount: 73755768 }),
    ]
    expect(barisPusatDari(rows[0])).toBe('pengeluaran_global')
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: 'PUSAT' })
    const p = hasil.rows.filter(r => r.id.startsWith(AWALAN_ID_PENYESUAIAN))
    expect(p.every(r => r.scope === 'pusat')).toBe(true)
    expect(p.find(r => r.category === 'gaji_staff_kantor')?.amount).toBe(-2050000)
    expect(p.find(r => r.category === 'salary')?.amount).toBe(8694636)
    expect(p.find(r => r.category === 'pengeluaran_global')?.amount).toBe(126079883 - 50000)
  })

  it('baris penyesuaian non-lembur tidak terbaca sebagai lembur', () => {
    const hasil = terapkanClosingOpex([], { ...SEPT, outletId: 'all' })
    for (const r of hasil.rows) {
      if (r.category !== 'lembur') expect(isLemburExpense(r.category, r.description)).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./node_modules/.bin/vitest run src/lib/closing/terapkanClosingOpex.test.ts`
Expected: FAIL — `Failed to resolve import "./terapkanClosingOpex"`.

- [ ] **Step 3: Implementasi**

`apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.ts`:
```ts
import type { ExpenseRow } from '@/lib/expenseRow'
import { isLemburExpense } from '@/lib/expenseCategories'
import {
  BARIS_OPEX_OUTLET,
  BARIS_OPEX_PUSAT,
  CLOSING_OPEX_INTERNAL_SEPT_2026 as C,
  type BarisOpexOutlet,
  type BarisOpexPusat,
} from './opexClosingInternalSeptember2026'

/* ── Closing OPEX internal September 2026 ────────────────────────────────────
 *
 * Menyamakan tabel OPEX September 2026 dengan sheet FIXED SEPTEMBER 2026.
 * Baris data asli TIDAK diubah; untuk tiap (outlet, baris OPEX) yang berbeda
 * dari target ditambahkan satu baris "Penyesuaian closing" = target − data.
 * Hanya berlaku untuk rentang tepat 1–30 September 2026. Spec:
 * docs/superpowers/specs/2026-10-14-closing-opex-internal-september-design.md
 *
 * File ini identik dengan apps/finance/src/lib/closing/terapkanClosingOpex.ts.
 */

export const SS_ONLINE_ID = 'ss-online'
export const GUDANG_SS_ONLINE_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'
export const AWALAN_ID_PENYESUAIAN = 'closing-sep26-'

const KANTOR_PUSAT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const CATATAN_TERAPKAN = 'OPEX September 2026 disesuaikan dengan laporan closing (sheet FIXED SEPTEMBER 2026).'
const CATATAN_SEBAGIAN = 'Closing OPEX September 2026 hanya berlaku untuk rentang 1–30 September; rentang ini memakai data apa adanya.'
const ALASAN_DEFAULT = 'Menyamakan dengan laporan closing September 2026'

export interface FilterClosing { from: string; to: string; outletId: string }
export interface HasilClosing { rows: ExpenseRow[]; diterapkan: boolean; catatan: string | null }

export function rentangClosingTepat(from: string, to: string): boolean {
  return from === C.from && to === C.to
}

/** Pemetaan sama dengan ekspor Laba Rugi (profitExportService). */
export function barisOutletDari(r: Pick<ExpenseRow, 'category' | 'description'>): BarisOpexOutlet {
  const c = String(r.category ?? '').toLowerCase()
  if (isLemburExpense(c, r.description)) return 'lembur'
  if (c === 'gaji_crew_outlet' || c === 'salary' || c === 'gaji') return 'gaji_crew_outlet'
  if (c === 'bonus_crew' || c === 'bonus_leader') return 'bonus_crew'
  if (c === 'bonus_area_manager' || c === 'bonus_korlap') return 'bonus_area_manager'
  if (c === 'bonus_regional_manager') return 'bonus_regional_manager'
  if (c === 'ads' || c === 'iklan' || c === 'marketing_ads') return 'ads'
  if (c === 'endorsement' || c === 'marcom') return 'endorsement'
  if (c === 'promo' || c === 'diskon') return 'promo'
  if (c === 'pdam' || c === 'air') return 'pdam'
  if (c === 'pln' || c === 'listrik') return 'pln'
  if (c === 'internet' || c === 'wifi') return 'internet'
  if (c === 'sewa_outlet' || c === 'sewa') return 'sewa_outlet'
  return 'pengeluaran_outlet'
}

/** Baris pusat dipetakan menurut kategori saja (lembur pusat masuk Pengeluaran Global). */
export function barisPusatDari(r: Pick<ExpenseRow, 'category'>): BarisOpexPusat {
  const c = String(r.category ?? '').toLowerCase()
  if (c === 'pdam' || c === 'air') return 'pdam'
  if (c === 'pln' || c === 'listrik') return 'pln'
  if (c === 'internet' || c === 'wifi') return 'internet'
  if (c === 'gaji_staff_kantor') return 'gaji_staff_kantor'
  if (c === 'salary') return 'crew_backup'
  if (c === 'transport') return 'transport'
  if (c === 'bahan_baku') return 'bahan_baku'
  if (c === 'ads' || c === 'iklan' || c === 'marketing_ads') return 'ads'
  return 'pengeluaran_global'
}

const KATEGORI_PUSAT: Record<BarisOpexPusat, ExpenseRow['category']> = {
  pdam: 'pdam',
  pln: 'pln',
  internet: 'internet',
  pengeluaran_global: 'pengeluaran_global',
  gaji_staff_kantor: 'gaji_staff_kantor',
  crew_backup: 'salary',
  transport: 'transport',
  bahan_baku: 'bahan_baku',
  ads: 'ads',
}

function cakupan(outletId: string): { outlets: string[]; pusat: boolean } {
  if (outletId === 'all') return { outlets: Object.keys(C.outlets), pusat: true }
  if (outletId === 'PUSAT' || outletId === KANTOR_PUSAT_ID) return { outlets: [], pusat: true }
  const id = outletId === GUDANG_SS_ONLINE_ID ? SS_ONLINE_ID : outletId
  return { outlets: C.outlets[id] ? [id] : [], pusat: false }
}

function barisPenyesuaian(p: {
  kunci: string
  outletId: string | null
  outletName: string
  scope: 'outlet' | 'pusat'
  category: ExpenseRow['category']
  amount: number
  alasan: string
}): ExpenseRow {
  const description = `Penyesuaian closing September 2026 — ${p.alasan}`
  return {
    id: `${AWALAN_ID_PENYESUAIAN}${p.kunci}`,
    outlet_id: p.outletId,
    outlet_name: p.outletName,
    category: p.category,
    scope: p.scope,
    amount: p.amount,
    description,
    expense_date: C.to,
    period_month: C.from,
    source: 'monthly',
    type: 'expense',
    raw_category: p.category,
    raw_description: description,
  }
}

export function terapkanClosingOpex(rows: ExpenseRow[], filter: FilterClosing): HasilClosing {
  if (!rentangClosingTepat(filter.from, filter.to)) {
    const memotong = filter.from <= C.to && filter.to >= C.from
    return { rows, diterapkan: false, catatan: memotong ? CATATAN_SEBAGIAN : null }
  }
  const lingkup = cakupan(filter.outletId)
  if (lingkup.outlets.length === 0 && !lingkup.pusat) return { rows, diterapkan: false, catatan: null }

  const dipetakan = rows.map(r =>
    r.scope === 'outlet' && r.outlet_id === GUDANG_SS_ONLINE_ID
      ? { ...r, outlet_id: SS_ONLINE_ID, outlet_name: C.outlets[SS_ONLINE_ID].nama }
      : r,
  )

  const dataOutlet = new Map<string, Record<string, number>>()
  const dataPusat: Record<string, number> = {}
  for (const r of dipetakan) {
    if (r.scope === 'outlet' && r.outlet_id && lingkup.outlets.includes(r.outlet_id)) {
      const m = dataOutlet.get(r.outlet_id) ?? {}
      const k = barisOutletDari(r)
      m[k] = (m[k] ?? 0) + (Number(r.amount) || 0)
      dataOutlet.set(r.outlet_id, m)
    } else if (r.scope === 'pusat' && lingkup.pusat) {
      const k = barisPusatDari(r)
      dataPusat[k] = (dataPusat[k] ?? 0) + (Number(r.amount) || 0)
    }
  }

  const tambahan: ExpenseRow[] = []
  for (const id of lingkup.outlets) {
    const o = C.outlets[id]
    const data = dataOutlet.get(id) ?? {}
    for (const b of BARIS_OPEX_OUTLET) {
      const selisih = o.target[b] - (data[b] ?? 0)
      if (Math.abs(selisih) < 0.005) continue
      tambahan.push(barisPenyesuaian({
        kunci: `${id}-${b}`,
        outletId: id,
        outletName: o.nama,
        scope: 'outlet',
        category: b,
        amount: selisih,
        alasan: o.alasan[b] ?? ALASAN_DEFAULT,
      }))
    }
  }
  if (lingkup.pusat) {
    for (const b of BARIS_OPEX_PUSAT) {
      const selisih = C.pusat.target[b] - (dataPusat[b] ?? 0)
      if (Math.abs(selisih) < 0.005) continue
      tambahan.push(barisPenyesuaian({
        kunci: `pusat-${b}`,
        outletId: null,
        outletName: 'Kantor Pusat',
        scope: 'pusat',
        category: KATEGORI_PUSAT[b],
        amount: selisih,
        alasan: C.pusat.alasan[b] ?? ALASAN_DEFAULT,
      }))
    }
  }

  return { rows: [...dipetakan, ...tambahan], diterapkan: true, catatan: CATATAN_TERAPKAN }
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `./node_modules/.bin/vitest run src/lib/closing/`
Expected: PASS (semua tes Task 1 & 2). Lalu `yarn workspace @suka/admin-dashboard type-check` dari root repo → tanpa error baru.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.ts apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.test.ts
git commit -m "feat(admin-dashboard): penerap penyesuaian closing OPEX September 2026"
```

---

### Task 3: Pasang di Laba Rugi (ProfitView) + catatan

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/profit/ProfitView.tsx` (memo `expenseRows` ±baris 274–284; JSX setelah `</PageHeader>` ±baris 912)

**Interfaces:**
- Consumes: `terapkanClosingOpex(rows, { from, to, outletId })` → `HasilClosing` (Task 2).

- [ ] **Step 1: Ganti memo `expenseRows`**

Tambahkan import di dekat import `@/lib/opexDariHr`:
```ts
import { terapkanClosingOpex } from '@/lib/closing/terapkanClosingOpex'
```
Ganti blok:
```ts
  const expenseRows = useMemo(() => {
    let barisHr = barisPayrollDariHr({ hr: hrPayroll.data, from: effectiveFilter.from, to: effectiveFilter.to })
    if (barisHr && effectiveFilter.outletId !== 'all') {
      barisHr = barisHr.filter(r => r.outlet_id === effectiveFilter.outletId)
    }
    return gantiPayrollDenganHr(prorataRows, barisHr)
      .filter(r => (r.scope === 'pusat' ? scope !== 'mitra' : inScope(r.outlet_id, (r as any).expense_date || (r as any).date)))
  }, [prorataRows, hrPayroll.data, effectiveFilter.from, effectiveFilter.to, effectiveFilter.outletId, inScope, scope])
```
dengan:
```ts
  // Closing OPEX September 2026 (lib/closing): untuk rentang tepat 1–30 Sep,
  // baris "Penyesuaian closing" menyamakan OPEX internal & HQ dengan sheet FIXED.
  const hasilClosingOpex = useMemo(() => {
    let barisHr = barisPayrollDariHr({ hr: hrPayroll.data, from: effectiveFilter.from, to: effectiveFilter.to })
    if (barisHr && effectiveFilter.outletId !== 'all') {
      barisHr = barisHr.filter(r => r.outlet_id === effectiveFilter.outletId)
    }
    return terapkanClosingOpex(gantiPayrollDenganHr(prorataRows, barisHr), {
      from: effectiveFilter.from,
      to: effectiveFilter.to,
      outletId: effectiveFilter.outletId,
    })
  }, [prorataRows, hrPayroll.data, effectiveFilter.from, effectiveFilter.to, effectiveFilter.outletId])
  const expenseRows = useMemo(
    () => hasilClosingOpex.rows
      .filter(r => (r.scope === 'pusat' ? scope !== 'mitra' : inScope(r.outlet_id, (r as any).expense_date || (r as any).date))),
    [hasilClosingOpex, inScope, scope],
  )
```

- [ ] **Step 2: Tampilkan catatan**

Tepat setelah `</PageHeader>` sisipkan:
```tsx
      {scope !== 'mitra' && hasilClosingOpex.catatan && (
        <div className={`-mt-3 mb-3 rounded-xl border px-3 py-2 text-xs font-semibold ${hasilClosingOpex.diterapkan ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {hasilClosingOpex.catatan}
        </div>
      )}
```

- [ ] **Step 3: Verifikasi**

Run dari root: `yarn workspace @suka/admin-dashboard type-check` → tanpa error baru. Run: `yarn workspace @suka/admin-dashboard test` → jumlah tes gagal tidak bertambah dibanding sebelum task.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/profit/ProfitView.tsx
git commit -m "feat(admin-dashboard): Laba Rugi memakai closing OPEX September 2026"
```

---

### Task 4: Pasang di ekspor Laba Rugi

**Files:**
- Modify: `apps/admin-dashboard/src/lib/export/profitExportFetcher.ts` (blok `const expenseRows = gabungGajiKantor(...)` ±baris 210–216)

**Interfaces:**
- Consumes: `terapkanClosingOpex` (Task 2).

- [ ] **Step 1: Ubah kode**

Tambahkan import:
```ts
import { terapkanClosingOpex } from '@/lib/closing/terapkanClosingOpex'
```
Ganti:
```ts
  const expenseRows = gabungGajiKantor(barisEngineDanHr, susunBarisGajiKantor({
```
menjadi:
```ts
  const expenseRowsData = gabungGajiKantor(barisEngineDanHr, susunBarisGajiKantor({
```
dan tepat setelah penutup `}))` blok itu tambahkan:
```ts
  // Closing OPEX September 2026 — sama dengan layar Laba Rugi.
  const expenseRows = terapkanClosingOpex(expenseRowsData, { from, to, outletId: 'all' }).rows
```

- [ ] **Step 2: Verifikasi**

Run dari root: `yarn workspace @suka/admin-dashboard type-check` → tanpa error baru.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/lib/export/profitExportFetcher.ts
git commit -m "feat(admin-dashboard): ekspor Laba Rugi memakai closing OPEX September 2026"
```

---

### Task 5: Pasang di Ringkasan Bisnis (`opexLabaRugi`)

**Files:**
- Modify: `apps/admin-dashboard/src/lib/server/opexLabaRugi.ts` (fungsi `hitungOpexLabaRugi`, ±baris 120–192)

**Interfaces:**
- Consumes: `terapkanClosingOpex` (Task 2).
- Produces (dipakai Task 9):
  ```ts
  export async function susunBarisOpexLabaRugi(
    filter: { from: string; to: string; outletId: string },
    outlets: { id: string; name: string; type?: string; is_active?: boolean }[],
  ): Promise<{ rows: ExpenseRow[]; semuaOutlet: boolean }>
  ```

- [ ] **Step 1: Pecah fungsi**

Tambahkan import:
```ts
import { terapkanClosingOpex } from '@/lib/closing/terapkanClosingOpex'
```
Tambahkan fungsi baru tepat di atas `export async function hitungOpexLabaRugi(`. Isinya adalah bagian hitung dari `hitungOpexLabaRugi` yang lama, dengan satu tambahan: `terapkanClosingOpex` di akhir.
```ts
/** Baris OPEX versi Laba Rugi (sudah termasuk penyesuaian closing). Tanpa cek peran & memo hasil. */
export async function susunBarisOpexLabaRugi(
  filter: { from: string; to: string; outletId: string },
  outlets: { id: string; name: string; type?: string; is_active?: boolean }[],
): Promise<{ rows: ExpenseRow[]; semuaOutlet: boolean }> {
  const semuaOutlet = !filter.outletId || filter.outletId === 'all'
  const f = { from: filter.from, to: filter.to, outletId: semuaOutlet ? 'all' : filter.outletId, source: 'all' as const }
  const { mentahAll, aux, hr } = await getRawOpexRangeBundle(f.from, f.to)

  const filteredExpenses = semuaOutlet
    ? mentahAll.expenses
    : f.outletId === 'PUSAT'
      ? mentahAll.expenses.filter((e: any) => !e.outlet_id || e.outlet_id === 'ffffffff-ffff-ffff-ffff-ffffffffffff')
      : mentahAll.expenses.filter((e: any) => e.outlet_id === f.outletId)

  const filteredPettyCash = semuaOutlet
    ? mentahAll.pettyCashExpenses
    : f.outletId === 'PUSAT'
      ? []
      : mentahAll.pettyCashExpenses.filter((p: any) => p.outlet_id === f.outletId)

  const hasil = calculateProratedExpenses({
    filter: f,
    rawExpenses: susunBarisPengeluaran(filteredExpenses, filteredPettyCash),
    payrollRecords: aux.payrollRecords || [],
    staffFinancials: aux.staffFinancials || [],
    lastMonthExpenses: aux.lastMonthExpenses || [],
    crewBonusRecords: aux.crewBonusRecords || [],
    outlets: outlets.filter(o => o.type !== 'marketplace' && o.type !== 'online'),
    managerAssignments: aux.managerAssignments || [],
    operationalOutletIds: aux.operationalOutletIds || [],
  })

  let rowsProrataDanKantor = hasil.rows
  if (semuaOutlet) {
    rowsProrataDanKantor = gabungGajiKantor(rowsProrataDanKantor, susunBarisGajiKantor({
      from: f.from,
      to: f.to,
      officePayrollRecords: aux.officePayrollRecords || [],
      officeStaffMonthlyTotal: aux.officeStaffMonthlyTotal || 0,
      currentMonthFirstDay: getJakartaCurrentMonthInfo().firstDay,
    }))
  }

  let barisHr = barisPayrollDariHr({ hr: hr ?? undefined, from: f.from, to: f.to })
  if (barisHr && !semuaOutlet) barisHr = barisHr.filter(r => r.outlet_id === f.outletId)

  const rows = terapkanClosingOpex(gantiPayrollDenganHr(rowsProrataDanKantor, barisHr), {
    from: f.from,
    to: f.to,
    outletId: f.outletId,
  }).rows
  return { rows, semuaOutlet }
}
```
Lalu di `hitungOpexLabaRugi`, hapus blok dari `const { mentahAll, aux, hr } = await getRawOpexRangeBundle(f.from, f.to)` sampai dan termasuk `const computed = jumlahkanOpexLabaRugi(gantiPayrollDenganHr(rows, barisHr), semuaOutlet)`, dan ganti dengan:
```ts
  const { rows } = await susunBarisOpexLabaRugi(filter, outlets)
  const computed = jumlahkanOpexLabaRugi(rows, semuaOutlet)
```
Cek peran, `semuaOutlet`, `f`, kunci memo, pengecekan memo hasil, dan penyimpanan memo di `hitungOpexLabaRugi` tetap seperti sebelumnya.

- [ ] **Step 2: Verifikasi**

Run: `./node_modules/.bin/vitest run src/lib/server/opexLabaRugi.test.ts` → PASS.
Run dari root: `yarn workspace @suka/admin-dashboard type-check` → tanpa error baru.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/lib/server/opexLabaRugi.ts
git commit -m "feat(admin-dashboard): Ringkasan Bisnis memakai closing OPEX September 2026"
```

---

### Task 6: Kartu Buku Kas admin

**Files:**
- Create: `apps/admin-dashboard/src/lib/closing/targetKartuClosing.ts`
- Test: `apps/admin-dashboard/src/lib/closing/targetKartuClosing.test.ts`
- Modify: `apps/admin-dashboard/src/app/dashboard/reports/input-pengeluaran/page.tsx`

**Interfaces:**
- Consumes: `CLOSING_OPEX_INTERNAL_SEPT_2026`, `BARIS_OPEX_OUTLET` (Task 1); `SS_ONLINE_ID`, `GUDANG_SS_ONLINE_ID`, `rentangClosingTepat` (Task 2).
- Produces:
  ```ts
  export type ViewKartuClosing = { jenis: 'outlet'; outletId: string } | { jenis: 'internal' } | { jenis: 'internal_pusat' } | { jenis: 'pusat' }
  export interface KartuClosing { gajiRutin: number; bonusKru: number; bonusManajer: number; lembur: number; nonGaji: number; total: number }
  export function viewKartuDariTarget(target: string): ViewKartuClosing | null
  export function targetKartuClosing(view: ViewKartuClosing): KartuClosing
  export function kartuClosingUntuk(target: string, from: string, to: string): { kartu: KartuClosing | null; catatan: string | null }
  ```

- [ ] **Step 1: Tulis tes (gagal dulu)**

`apps/admin-dashboard/src/lib/closing/targetKartuClosing.test.ts`:
```ts
import { kartuClosingUntuk, targetKartuClosing, viewKartuDariTarget } from './targetKartuClosing'

const BNR = '550e8400-e29b-41d4-a716-446655440001'
const GUDANG = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'

describe('targetKartuClosing', () => {
  it('pemetaan target Buku Kas', () => {
    expect(viewKartuDariTarget('PUSAT')).toEqual({ jenis: 'pusat' })
    expect(viewKartuDariTarget('INTERNAL_OUTLETS')).toEqual({ jenis: 'internal' })
    expect(viewKartuDariTarget('INTERNAL_PUSAT')).toEqual({ jenis: 'internal_pusat' })
    expect(viewKartuDariTarget('ALL_OUTLETS')).toBeNull()
    expect(viewKartuDariTarget('MITRA_OUTLETS')).toBeNull()
    expect(viewKartuDariTarget(BNR)).toEqual({ jenis: 'outlet', outletId: BNR })
    expect(viewKartuDariTarget(GUDANG)).toEqual({ jenis: 'outlet', outletId: 'ss-online' })
    expect(viewKartuDariTarget('550e8400-e29b-41d4-a716-446655440014')).toBeNull()
  })

  it('satu outlet (BNR)', () => {
    expect(targetKartuClosing({ jenis: 'outlet', outletId: BNR })).toEqual({
      gajiRutin: 11202714, bonusKru: 148801, bonusManajer: 128224, lembur: 0, nonGaji: 7900, total: 11487639,
    })
  })

  it('outlet internal (12 kolom)', () => {
    expect(targetKartuClosing({ jenis: 'internal' })).toEqual({
      gajiRutin: 78894292, bonusKru: 2338838, bonusManajer: 2486568, lembur: 0, nonGaji: 85714125, total: 169433823,
    })
  })

  it('kantor pusat', () => {
    expect(targetKartuClosing({ jenis: 'pusat' })).toEqual({
      gajiRutin: 80400404, bonusKru: 0, bonusManajer: 0, lembur: 0, nonGaji: 142439866, total: 222840270,
    })
  })

  it('internal + pusat = jumlah keduanya', () => {
    const k = targetKartuClosing({ jenis: 'internal_pusat' })
    expect(k.total).toBe(169433823 + 222840270)
    expect(k.gajiRutin).toBe(78894292 + 80400404)
  })

  it('hanya untuk rentang tepat September; pilihan tak didukung memberi catatan', () => {
    expect(kartuClosingUntuk(BNR, '2026-09-01', '2026-09-30').kartu?.total).toBe(11487639)
    expect(kartuClosingUntuk(BNR, '2026-09-01', '2026-09-15')).toEqual({ kartu: null, catatan: expect.stringMatching(/1–30 September/) })
    expect(kartuClosingUntuk(BNR, '2026-08-01', '2026-08-31')).toEqual({ kartu: null, catatan: null })
    expect(kartuClosingUntuk('ALL_OUTLETS', '2026-09-01', '2026-09-30')).toEqual({ kartu: null, catatan: expect.stringMatching(/Outlet Internal/) })
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./node_modules/.bin/vitest run src/lib/closing/targetKartuClosing.test.ts`
Expected: FAIL — `Failed to resolve import "./targetKartuClosing"`.

- [ ] **Step 3: Implementasi**

`apps/admin-dashboard/src/lib/closing/targetKartuClosing.ts`:
```ts
import { BARIS_OPEX_OUTLET, CLOSING_OPEX_INTERNAL_SEPT_2026 as C, type BarisOpexOutlet } from './opexClosingInternalSeptember2026'
import { GUDANG_SS_ONLINE_ID, SS_ONLINE_ID, rentangClosingTepat } from './terapkanClosingOpex'

/* Kartu Buku Kas untuk closing OPEX September 2026: angka kartu = target sheet
 * FIXED untuk cakupan yang dipilih. File ini identik dengan versi app finance. */

export type ViewKartuClosing =
  | { jenis: 'outlet'; outletId: string }
  | { jenis: 'internal' }
  | { jenis: 'internal_pusat' }
  | { jenis: 'pusat' }

export interface KartuClosing {
  gajiRutin: number
  bonusKru: number
  bonusManajer: number
  lembur: number
  nonGaji: number
  total: number
}

const CATATAN_SEBAGIAN = 'Closing OPEX September 2026 hanya berlaku untuk rentang 1–30 September; rentang ini memakai data apa adanya.'
const CATATAN_TAK_DIDUKUNG = 'Closing OPEX September 2026 tampil di pilihan Outlet Internal, Internal + Kantor Pusat, Kantor Pusat, atau satu outlet internal.'

export function viewKartuDariTarget(target: string): ViewKartuClosing | null {
  if (target === 'PUSAT') return { jenis: 'pusat' }
  if (target === 'INTERNAL_OUTLETS') return { jenis: 'internal' }
  if (target === 'INTERNAL_PUSAT') return { jenis: 'internal_pusat' }
  const id = target === GUDANG_SS_ONLINE_ID ? SS_ONLINE_ID : target
  return C.outlets[id] ? { jenis: 'outlet', outletId: id } : null
}

function kosong(): KartuClosing {
  return { gajiRutin: 0, bonusKru: 0, bonusManajer: 0, lembur: 0, nonGaji: 0, total: 0 }
}

function tambahOutlet(k: KartuClosing, target: Record<BarisOpexOutlet, number>) {
  for (const b of BARIS_OPEX_OUTLET) {
    const v = target[b]
    if (b === 'gaji_crew_outlet') k.gajiRutin += v
    else if (b === 'bonus_crew') k.bonusKru += v
    else if (b === 'bonus_area_manager' || b === 'bonus_regional_manager') k.bonusManajer += v
    else if (b === 'lembur') k.lembur += v
    else k.nonGaji += v
    k.total += v
  }
}

function tambahPusat(k: KartuClosing) {
  for (const [b, v] of Object.entries(C.pusat.target)) {
    if (b === 'gaji_staff_kantor' || b === 'crew_backup') k.gajiRutin += v
    else k.nonGaji += v
    k.total += v
  }
}

export function targetKartuClosing(view: ViewKartuClosing): KartuClosing {
  const k = kosong()
  if (view.jenis === 'outlet') tambahOutlet(k, C.outlets[view.outletId].target)
  if (view.jenis === 'internal' || view.jenis === 'internal_pusat') {
    for (const o of Object.values(C.outlets)) tambahOutlet(k, o.target)
  }
  if (view.jenis === 'pusat' || view.jenis === 'internal_pusat') tambahPusat(k)
  return k
}

export function kartuClosingUntuk(target: string, from: string, to: string): { kartu: KartuClosing | null; catatan: string | null } {
  const memotong = from <= C.to && to >= C.from
  if (!memotong) return { kartu: null, catatan: null }
  if (!rentangClosingTepat(from, to)) return { kartu: null, catatan: CATATAN_SEBAGIAN }
  const view = viewKartuDariTarget(target)
  if (!view) return { kartu: null, catatan: CATATAN_TAK_DIDUKUNG }
  return { kartu: targetKartuClosing(view), catatan: null }
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `./node_modules/.bin/vitest run src/lib/closing/`
Expected: PASS.

- [ ] **Step 5: Pasang di halaman Buku Kas admin**

Di `apps/admin-dashboard/src/app/dashboard/reports/input-pengeluaran/page.tsx`:

(a) Import:
```ts
import { kartuClosingUntuk } from '@/lib/closing/targetKartuClosing'
```
(b) Setelah memo `summary` (±baris 456) tambahkan:
```ts
  // Closing OPEX September 2026: untuk rentang tepat 1–30 Sep dan cakupan internal/pusat,
  // angka kartu = target sheet FIXED (lib/closing). Daftar transaksi tetap data asli.
  const closingKartu = useMemo(() => kartuClosingUntuk(target, startDate, endDate), [target, startDate, endDate])
  const kartuClosing = closingKartu.kartu
  const nonSalaryTampil = kartuClosing ? kartuClosing.nonGaji : summary.nonSalary
```
(c) Baris pertama di dalam memo `displayCrewBonus`, `displayManagerBonus`, dan `displayRoutineSalary` masing-masing:
```ts
    if (kartuClosing) return kartuClosing.bonusKru
```
```ts
    if (kartuClosing) return kartuClosing.bonusManajer
```
```ts
    if (kartuClosing) return kartuClosing.gajiRutin
```
dan tambahkan `kartuClosing` ke array dependency ketiga memo itu.
(d) Ganti `const displayLembur = lemburData.totalLembur` menjadi:
```ts
  const displayLembur = kartuClosing ? kartuClosing.lembur : lemburData.totalLembur
```
(e) Ganti `const totalCombinedOpex = displaySalary + displayLembur + summary.nonSalary` menjadi `... + nonSalaryTampil`, lalu ganti setiap pemakaian `summary.nonSalary` di kartu "Opex", teks rincian kartu Total OPEX, dan dua properti `totalNonSalary:` di bagian bawah file dengan `nonSalaryTampil` (cari: `grep -n "summary.nonSalary" page.tsx`; semua kemunculan setelah deklarasi `nonSalaryTampil` diganti).
(f) Tampilkan catatan tepat di atas grid kartu ringkasan (cari elemen `<div className={\`grid grid-cols-1 sm:grid-cols-2` yang berisi kartu gaji):
```tsx
      {(kartuClosing || closingKartu.catatan) && (
        <div className={`mb-3 rounded-xl border px-3 py-2 text-xs font-semibold ${kartuClosing ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {kartuClosing
            ? 'Kartu OPEX September 2026 mengikuti laporan closing (sheet FIXED SEPTEMBER 2026). Daftar transaksi di bawah tetap data asli.'
            : closingKartu.catatan}
        </div>
      )}
```

- [ ] **Step 6: Verifikasi**

Run dari root: `yarn workspace @suka/admin-dashboard type-check` → tanpa error baru. `yarn workspace @suka/admin-dashboard test` → jumlah gagal tidak bertambah.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/lib/closing/targetKartuClosing.ts apps/admin-dashboard/src/lib/closing/targetKartuClosing.test.ts apps/admin-dashboard/src/app/dashboard/reports/input-pengeluaran/page.tsx
git commit -m "feat(admin-dashboard): kartu Buku Kas memakai closing OPEX September 2026"
```

---

### Task 7: App Finance — salinan, paritas, Buku Kas

**Files:**
- Create: `apps/finance/src/lib/closing/opexClosingInternalSeptember2026.ts` (salin)
- Create: `apps/finance/src/lib/closing/terapkanClosingOpex.ts` (salin)
- Create: `apps/finance/src/lib/closing/targetKartuClosing.ts` (salin)
- Test: `apps/finance/src/lib/closing/closing.parity.test.ts`
- Modify: `apps/finance/src/app/laporan/buku-kas/page.tsx`

**Interfaces:**
- Consumes: tiga file Task 1, 2, 6 (isi identik).

- [ ] **Step 1: Tulis tes paritas (gagal dulu)**

`apps/finance/src/lib/closing/closing.parity.test.ts`:
```ts
import { readFileSync } from 'fs'
import { resolve } from 'path'

// File closing di finance adalah SALINAN admin-dashboard. Kalau salah satu diubah
// tanpa yang lain, Buku Kas finance tak lagi sama dengan Laba Rugi — tes ini gagal.
const FILES = ['opexClosingInternalSeptember2026.ts', 'terapkanClosingOpex.ts', 'targetKartuClosing.ts']

describe('lib/closing identik dengan admin-dashboard', () => {
  it.each(FILES)('%s', (f) => {
    const norm = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
    const finance = norm(resolve(__dirname, f))
    const admin = norm(resolve(__dirname, '../../../../admin-dashboard/src/lib/closing', f))
    expect(finance).toBe(admin)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run (dari `apps/finance`): `./node_modules/.bin/vitest run src/lib/closing/closing.parity.test.ts` (kalau `.bin` tak ada di app, pakai `../../node_modules/.bin/vitest`).
Expected: FAIL — `ENOENT` untuk ketiga file.

- [ ] **Step 3: Salin file**

```bash
mkdir -p apps/finance/src/lib/closing
cp apps/admin-dashboard/src/lib/closing/opexClosingInternalSeptember2026.ts apps/admin-dashboard/src/lib/closing/terapkanClosingOpex.ts apps/admin-dashboard/src/lib/closing/targetKartuClosing.ts apps/finance/src/lib/closing/
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Expected: PASS (3 tes). Lalu `yarn workspace @suka/finance type-check` dari root → tanpa error baru (`@/lib/expenseRow` dan `@/lib/expenseCategories` ada di finance dengan ekspor yang sama).

- [ ] **Step 5: Pasang di Buku Kas Finance**

Di `apps/finance/src/app/laporan/buku-kas/page.tsx` (variabel `target`, `startDate`, `endDate`, `summary`, `displayCrewBonus`, `displayManagerBonus`, `displayRoutineSalary`, `lemburData`, `displayLembur`, `totalCombinedOpex` bernama sama dengan versi admin):

(a) Import:
```ts
import { kartuClosingUntuk } from '@/lib/closing/targetKartuClosing'
```
(b) Setelah memo `summary` (±baris 321–361) tambahkan:
```ts
  // Closing OPEX September 2026: untuk rentang tepat 1–30 Sep dan cakupan internal/pusat,
  // angka kartu = target sheet FIXED (lib/closing). Daftar transaksi tetap data asli.
  const closingKartu = useMemo(() => kartuClosingUntuk(target, startDate, endDate), [target, startDate, endDate])
  const kartuClosing = closingKartu.kartu
  const nonSalaryTampil = kartuClosing ? kartuClosing.nonGaji : summary.nonSalary
```
(c) Baris pertama di dalam memo `displayCrewBonus` (±363), `displayManagerBonus` (±375), dan `displayRoutineSalary` (±394) masing-masing:
```ts
    if (kartuClosing) return kartuClosing.bonusKru
```
```ts
    if (kartuClosing) return kartuClosing.bonusManajer
```
```ts
    if (kartuClosing) return kartuClosing.gajiRutin
```
dan tambahkan `kartuClosing` ke array dependency ketiga memo itu.
(d) Ganti `const displayLembur = lemburData.totalLembur` (±482) menjadi:
```ts
  const displayLembur = kartuClosing ? kartuClosing.lembur : lemburData.totalLembur
```
(e) Ganti `const totalCombinedOpex = displaySalary + displayLembur + summary.nonSalary` (±483) menjadi `const totalCombinedOpex = displaySalary + displayLembur + nonSalaryTampil`, lalu ganti setiap `summary.nonSalary` sesudahnya dengan `nonSalaryTampil` (±1454–1455, ±1512–1513, ±1533, ±2107, ±2120; cek dengan `grep -n "summary.nonSalary" page.tsx` — sesudah perubahan hanya tersisa di deklarasi `nonSalaryTampil`).
(f) Sisipkan tepat sebelum `<div className={\`grid grid-cols-1 sm:grid-cols-2 ${isPusat && displayCrewBonus === 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3.5 sm:gap-4.5\`}>` (±baris 1142):
```tsx
      {(kartuClosing || closingKartu.catatan) && (
        <div className={`mb-3 rounded-xl border px-3 py-2 text-xs font-semibold ${kartuClosing ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {kartuClosing
            ? 'Kartu OPEX September 2026 mengikuti laporan closing (sheet FIXED SEPTEMBER 2026). Daftar transaksi di bawah tetap data asli.'
            : closingKartu.catatan}
        </div>
      )}
```

Finance tidak punya pilihan *Outlet Internal* / *Internal + Kantor Pusat*; kartu closing otomatis aktif untuk satu outlet internal dan Kantor Pusat, dan *Semua Outlet* menampilkan catatan.

- [ ] **Step 6: Verifikasi**

Run dari root: `yarn workspace @suka/finance type-check` dan `yarn workspace @suka/finance test` → tanpa error/gagal baru.

- [ ] **Step 7: Commit**

```bash
git add apps/finance/src/lib/closing apps/finance/src/app/laporan/buku-kas/page.tsx
git commit -m "feat(finance): Buku Kas memakai closing OPEX September 2026 + tes paritas"
```

---

### Task 8: Perubahan data B1–B6 (dijalankan controller)

**Files:**
- Create: `SS COGS SET/closing-opex-sept2026-B1-B6.sql`

Dijalankan lewat `mcp__supabase__execute_sql` oleh sesi utama, setelah Task 1–7 lulus review dan **atas persetujuan owner pada saat itu**.

- [ ] **Step 1: Tulis arsip SQL**

`SS COGS SET/closing-opex-sept2026-B1-B6.sql`:
```sql
-- ARSIP — perubahan data closing OPEX internal September 2026 (spec §5).
-- Jalankan blok TERAPKAN sekali. Blok BATALKAN mengembalikan nilai lama.

-- ===== TERAPKAN =====
BEGIN;
-- B1 PDAM pusat
INSERT INTO expenses (type, amount, category, outlet_id, description, expense_date, period_month, payment_source)
SELECT 'expense', 972800, 'pdam', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'PDAM Kantor Pusat September 2026', '2026-09-30', '2026-09-01', 'transfer_pusat'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE description = 'PDAM Kantor Pusat September 2026' AND period_month = '2026-09-01');
-- B2 bahan baku pusat -> pengeluaran global
UPDATE expenses SET category = 'pengeluaran_global'
WHERE category = 'bahan_baku' AND outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND id IN (
  '62c9b004-3a56-4002-9b27-779fbedabf4f','e36aeb3b-3453-4352-bb9c-e184ffa4fdf9','219b4ba1-1549-4cc8-8bff-4c313f025cd0',
  'e9e865fd-d540-41b5-83b7-ee8bc4ac65ce','b4dba466-2427-49df-91c6-85e97a3ff6d8','0ea83a1b-46a0-4d3f-9d7e-e958c3684b62');
-- B3a internet Jatiasih, B3b lembur Aby -> Kantor Pusat pengeluaran global
UPDATE expenses SET outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff', category = 'pengeluaran_global'
WHERE id IN ('04596554-8e55-4f7b-9a13-e1bc045a7162','01d62570-a308-4044-9ab4-7a331c9401b7')
  AND outlet_id IN ('550e8400-e29b-41d4-a716-446655440012','550e8400-e29b-41d4-a716-446655440001');
-- B4 biaya GUDANG SS ONLINE -> Kantor Pusat bahan baku
UPDATE expenses SET outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff', category = 'bahan_baku'
WHERE outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91' AND id IN (
  '4af51337-f11a-482d-a4c7-f14f7713fcab','5355e335-c712-4fd2-8595-9e264826f9e6','15a180c9-78e3-4e8b-b872-5e7510b188d1');
-- B5 Indihome SS Dapur -> GUDANG SS ONLINE
UPDATE expenses SET outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'
WHERE id = '3c18a536-afb1-4dd9-8d6f-9f04ea3ca35d' AND outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
-- B6 token listrik kantor
UPDATE expenses SET amount = 4502475
WHERE id = '1d6d2e62-d808-4834-94cb-6c3072c9842b' AND amount = 5002750;
COMMIT;

-- ===== BATALKAN =====
-- BEGIN;
-- DELETE FROM expenses WHERE description = 'PDAM Kantor Pusat September 2026' AND period_month = '2026-09-01';
-- UPDATE expenses SET category = 'bahan_baku' WHERE id IN ('62c9b004-3a56-4002-9b27-779fbedabf4f','e36aeb3b-3453-4352-bb9c-e184ffa4fdf9','219b4ba1-1549-4cc8-8bff-4c313f025cd0','e9e865fd-d540-41b5-83b7-ee8bc4ac65ce','b4dba466-2427-49df-91c6-85e97a3ff6d8','0ea83a1b-46a0-4d3f-9d7e-e958c3684b62');
-- UPDATE expenses SET outlet_id = '550e8400-e29b-41d4-a716-446655440012', category = 'internet' WHERE id = '04596554-8e55-4f7b-9a13-e1bc045a7162';
-- UPDATE expenses SET outlet_id = '550e8400-e29b-41d4-a716-446655440001', category = 'lembur' WHERE id = '01d62570-a308-4044-9ab4-7a331c9401b7';
-- UPDATE expenses SET outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91', category = 'bahan_baku' WHERE id IN ('4af51337-f11a-482d-a4c7-f14f7713fcab','5355e335-c712-4fd2-8595-9e264826f9e6');
-- UPDATE expenses SET outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91', category = 'pengeluaran_outlet' WHERE id = '15a180c9-78e3-4e8b-b872-5e7510b188d1';
-- UPDATE expenses SET outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' WHERE id = '3c18a536-afb1-4dd9-8d6f-9f04ea3ca35d';
-- UPDATE expenses SET amount = 5002750 WHERE id = '1d6d2e62-d808-4834-94cb-6c3072c9842b';
-- COMMIT;
```

- [ ] **Step 2: Jalankan blok TERAPKAN** lewat `execute_sql`.

- [ ] **Step 3: Verifikasi ke DB**

```sql
select category, round(sum(amount))::bigint from expenses
where (outlet_id is null or outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff')
  and expense_date between '2026-09-01' and '2026-09-30' group by 1 order by 1;
```
Expected: `pdam` 972800 · `pln` 4502475 · `bahan_baku` 1504609 · `internet` 2127650 · `ads` 996780. Lalu:
```sql
select outlet_id, category, amount from expenses where id in ('3c18a536-afb1-4dd9-8d6f-9f04ea3ca35d','01d62570-a308-4044-9ab4-7a331c9401b7','04596554-8e55-4f7b-9a13-e1bc045a7162');
```
Expected: SS Dapur di GUDANG SS ONLINE; Aby & Jatiasih di Kantor Pusat kategori `pengeluaran_global`.

- [ ] **Step 4: Commit arsip**

```bash
git add "SS COGS SET/closing-opex-sept2026-B1-B6.sql"
git commit -m "chore(data): arsip perubahan data closing OPEX September 2026 (B1-B6)"
```

---

### Task 9: Cek data hidup

**Files:**
- Create: `apps/admin-dashboard/scripts/closing/vitest.cek.config.mts`
- Create: `apps/admin-dashboard/scripts/closing/cek-closing-opex-sept2026.run.ts`

**Interfaces:**
- Consumes: `susunBarisOpexLabaRugi` (Task 5), `barisOutletDari`, `barisPusatDari`, `AWALAN_ID_PENYESUAIAN`, `GUDANG_SS_ONLINE_ID`, `SS_ONLINE_ID` (Task 2), `CLOSING_OPEX_INTERNAL_SEPT_2026` (Task 1).

- [ ] **Step 1: Config**

`apps/admin-dashboard/scripts/closing/vitest.cek.config.mts`:
```ts
import path from 'path'
import { fileURLToPath } from 'url'

// Hanya untuk cek manual ke DB produksi (baca-saja). Tidak ikut `yarn test`.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '../..')
export default {
  root: APP,
  test: { environment: 'node', include: ['scripts/closing/**/*.run.ts'], testTimeout: 600000 },
  resolve: { alias: { '@': path.resolve(APP, './src') } },
}
```

- [ ] **Step 2: Skrip cek**

`apps/admin-dashboard/scripts/closing/cek-closing-opex-sept2026.run.ts`:
```ts
import { vi, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Baca-saja: menjalankan pipeline OPEX Laba Rugi asli untuk September 2026 dan
// memastikan setelah penyesuaian closing setiap baris = target sheet FIXED.
// Mencetak penyesuaian per outlet supaya pergeseran data September ketahuan.
vi.mock('@/lib/authz', () => ({ requireRole: async () => ({ userId: 'cek', role: 'admin' }), PERAN_KEUANGAN: [] }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }), headers: async () => new Map() }))
vi.mock('server-only', () => ({}))

// Dijalankan dari apps/admin-dashboard (lihat Step 3).
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

test('OPEX September 2026 setelah closing = sheet FIXED', async () => {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const { susunBarisOpexLabaRugi } = await import('@/lib/server/opexLabaRugi')
  const { CLOSING_OPEX_INTERNAL_SEPT_2026: C } = await import('@/lib/closing/opexClosingInternalSeptember2026')
  const { barisOutletDari, barisPusatDari, AWALAN_ID_PENYESUAIAN } = await import('@/lib/closing/terapkanClosingOpex')

  const { data: outlets } = await createServiceClient().from('outlets').select('id,name,type,is_active').neq('type', 'marketplace')
  const { rows } = await susunBarisOpexLabaRugi({ from: C.from, to: C.to, outletId: 'all' }, outlets ?? [])

  const selisih: string[] = []
  for (const [id, o] of Object.entries(C.outlets)) {
    const hasil: Record<string, number> = {}
    const adj: Record<string, number> = {}
    for (const r of rows.filter(r => r.scope === 'outlet' && r.outlet_id === id)) {
      const k = barisOutletDari(r)
      hasil[k] = (hasil[k] ?? 0) + r.amount
      if (r.id.startsWith(AWALAN_ID_PENYESUAIAN)) adj[k] = (adj[k] ?? 0) + r.amount
    }
    console.log(o.nama, 'penyesuaian:', Object.fromEntries(Object.entries(adj).map(([k, v]) => [k, Math.round(v)])))
    for (const [k, v] of Object.entries(o.target)) {
      if (Math.abs((hasil[k] ?? 0) - v) >= 1) selisih.push(`${o.nama} ${k}: ${hasil[k] ?? 0} vs ${v}`)
    }
  }
  const pusat: Record<string, number> = {}
  const adjPusat: Record<string, number> = {}
  for (const r of rows.filter(r => r.scope === 'pusat')) {
    const k = barisPusatDari(r)
    pusat[k] = (pusat[k] ?? 0) + r.amount
    if (r.id.startsWith(AWALAN_ID_PENYESUAIAN)) adjPusat[k] = (adjPusat[k] ?? 0) + r.amount
  }
  console.log('Kantor Pusat penyesuaian:', Object.fromEntries(Object.entries(adjPusat).map(([k, v]) => [k, Math.round(v)])))
  for (const [k, v] of Object.entries(C.pusat.target)) {
    if (Math.abs((pusat[k] ?? 0) - v) >= 1) selisih.push(`Pusat ${k}: ${pusat[k] ?? 0} vs ${v}`)
  }
  expect(selisih).toEqual([])
})
```

- [ ] **Step 3: Jalankan**

Run (dari `apps/admin-dashboard`, TZ WIB):
```bash
TZ=Asia/Jakarta ./node_modules/.bin/vitest run --config scripts/closing/vitest.cek.config.mts
```
Expected: PASS. Lalu `yarn workspace @suka/admin-dashboard type-check` dari root; kalau type-check melaporkan error di `scripts/closing/` (folder `scripts/` ikut `include` tsconfig), tambahkan `"scripts/closing/**"` ke `exclude` di `apps/admin-dashboard/tsconfig.json`. Bandingkan penyesuaian yang tercetak dengan spec §6.4 (setelah B1–B6, penyesuaian HQ hanya `crew_backup` +8.694.636, `gaji_staff_kantor` −2.050.000, `internet` −113.000). Penyesuaian yang jauh berbeda = data September berubah sejak 14 Okt → laporkan ke owner sebelum deploy.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/scripts/closing/vitest.cek.config.mts apps/admin-dashboard/scripts/closing/cek-closing-opex-sept2026.run.ts
# tambahkan apps/admin-dashboard/tsconfig.json bila exclude-nya diubah di Step 3
git commit -m "chore(admin-dashboard): skrip cek closing OPEX September 2026 terhadap DB"
```

---

### Task 10: Deploy & verifikasi (bersama owner)

- [ ] **Step 1:** Push branch `feat/closing-opex-internal-september` dan buka PR ke `main` (izin owner). CI menjalankan type-check + test admin-dashboard & finance.
- [ ] **Step 2:** Merge (izin owner). Workflow `deploy-admin-coolify.yml` dan `deploy-finance-coolify.yml` berjalan otomatis untuk push ke `main` yang menyentuh `apps/admin-dashboard/**` / `apps/finance/**`.
- [ ] **Step 3:** Setelah deploy, bersihkan cache Ringkasan Bisnis (tombol refresh di halaman / `revalidateOwnerDashboardCache`).
- [ ] **Step 4:** Cek browser, rentang 1–30 September 2026:
  - Laba Rugi Internal: OPEX per outlet = baris 50 Excel; rincian OPEX memuat baris "Penyesuaian closing September 2026 — …"; catatan hijau tampil.
  - Laba Rugi rentang 1–15 Sep: catatan kuning, tanpa penyesuaian.
  - Ekspor CSV Laba Rugi September: baris OPEX per outlet = Excel.
  - Ringkasan Bisnis September: kartu OPEX = Laba Rugi Global September.
  - Buku Kas admin, pilihan *Internal + Kantor Pusat*: Total OPEX = 392.274.093; pilihan *Kantor Pusat* = 222.840.270.
  - Buku Kas Finance, Kantor Pusat dan satu outlet (mis. BNR = 11.487.639).
  - Agustus & Oktober di semua layar di atas: angka tidak berubah dibanding sebelum deploy.
- [ ] **Step 5:** Perbarui catatan proyek (CLAUDE.md section sesi + memory) dengan status live.
