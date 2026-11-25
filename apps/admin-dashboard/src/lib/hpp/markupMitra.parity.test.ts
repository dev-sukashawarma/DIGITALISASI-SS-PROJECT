import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

/**
 * Kontrak wajib: markup HPP mitra di-port 1:1 ke LIMA tempat (DB + 4 app) dan
 * konstantanya diduplikasi, bukan diimpor dari satu modul bersama. Kalau salah
 * satu diubah sendirian, Dashboard Kemitraan / Rangkuman Penjualan / layar HPP /
 * bot akan menampilkan angka yang berbeda untuk order yang sama -- gejalanya
 * persis seperti bug kategori `gas` (Session 2026-10-27).
 *
 * Tes ini menggagalkan CI sebelum perbedaan itu sempat di-deploy.
 *
 * Aturan yang dijaga (keputusan owner 25 Nov 2026, sumber
 * "SS COGS OCT 2026 v2.2 12 persen.xlsx" tab OFFLINE sel P3 = MARKUP MITRA 0,12;
 * menggantikan 0,15 yang diputuskan 11 Nov 2026):
 *   mulai 1 Nov 2026 HPP mitra = (HPP + OPEX) x 1,12 untuk SEMUA outlet mitra,
 *   termasuk MITRA CILEUNGSI.
 */

const REPO = resolve(__dirname, '../../../../..')
const MARKUP = '1.12'
const MULAI = '2026-11-01'

/** Pembawa markup yang SADAR TANGGAL: wajib memuat angka markup + tanggal mulai. */
const BERBASIS_TANGGAL = [
  'apps/admin-dashboard/src/lib/hpp/fetchHpp.ts',
  'apps/admin-dashboard/src/lib/posReport/compute.ts',
  'apps/admin-dashboard/src/app/actions/mitraPnl.ts',
  'apps/finance/src/lib/hpp/fetchHpp.ts',
  'apps/finance/src/lib/posReport/compute.ts',
  'apps/HR/src/lib/posReport/compute.ts',
  'apps/manager/src/lib/laba-rugi/hpp/fetchHpp.ts',
  'apps/marcom/src/lib/laba-rugi/hpp/fetchHpp.ts',
  'apps/marcom/src/lib/penjualan/posReport/compute.ts',
  'apps/manager/src/app/page.tsx',
  'apps/manager/src/app/reports/page.tsx',
  'apps/bot/src/lib/server/telemetriNyata.ts',
] as const

/**
 * Layar yang menampilkan HPP "sekarang" saja (tanpa parameter tanggal):
 * wajib memuat angka markup, tetapi tidak perlu tanggal mulai.
 */
const LAYAR_TANPA_TANGGAL = [
  'apps/admin-dashboard/src/app/dashboard/resep/HppDashboardView.tsx',
  'apps/admin-dashboard/src/app/dashboard/resep/OutletPricingView.tsx',
  'apps/manager/src/app/resep/HppDashboardView.tsx',
  'apps/manager/src/app/resep/OutletPricingView.tsx',
] as const

const MIGRATION_DB = 'supabase/migrations/20261125200000_mitra_markup_12_persen_november.sql'

const baca = (rel: string) => {
  const p = resolve(REPO, rel)
  expect(existsSync(p), `berkas tidak ada: ${rel}`).toBe(true)
  return readFileSync(p, 'utf8')
}

describe('Paritas markup HPP mitra lintas app + DB', () => {
  it.each([...BERBASIS_TANGGAL])('%s memuat markup 1,12 dan tanggal mulai 1 Nov 2026', (rel) => {
    const src = baca(rel)
    expect(src, `${rel} tidak memuat markup ${MARKUP}`).toContain(MARKUP)
    expect(src, `${rel} tidak memuat tanggal mulai ${MULAI}`).toContain(MULAI)
  })

  it.each([...LAYAR_TANPA_TANGGAL])('%s memuat markup 1,12', (rel) => {
    expect(baca(rel), `${rel} tidak memuat markup ${MARKUP}`).toContain(MARKUP)
  })

  it('migration DB memuat markup 1,12 + tanggal mulai, dan menjaga penjaga owner summary', () => {
    const sql = baca(MIGRATION_DB)
    expect(sql).toContain(MARKUP)
    expect(sql).toContain(MULAI)
    // Penjaga wajib: get_owner_dashboard_summary kehilangan salah satu SET ini
    // berarti kembali kena statement timeout 8 dtk (Session 2026-09-25/26).
    expect(sql).toContain('plan_cache_mode')
    expect(sql).toContain('search_path')
  })

  it('tidak ada lagi layar HPP yang memakai pola lama "Cileungsi ? x1,1 : x1,0"', () => {
    for (const rel of LAYAR_TANPA_TANGGAL) {
      const src = baca(rel)
      expect(
        /MITRA_CILEUNGSI_OUTLET_ID\s*\?\s*Math\.round\([^)]*\*\s*1\.1\s*\)/.test(src),
        `${rel} masih memakai cabang Cileungsi x1,1 di layar`,
      ).toBe(false)
    }
  })

  it('kolom HPP Mitra di tabel Resep & HPP memakai markup, bukan HPP pusat mentah', () => {
    // Bug 13 Nov 2026: konstanta 1,15 ada di berkas, tapi kolom HPP/Profit Mitra
    // menampilkan Math.round(hppPusat) -- sisa aturan Oktober x1,00.
    for (const rel of [
      'apps/admin-dashboard/src/app/dashboard/resep/HppDashboardView.tsx',
      'apps/manager/src/app/resep/HppDashboardView.tsx',
    ]) {
      const src = baca(rel)
      expect(
        /mitraHpp\s*=\s*[^;]*Math\.round\(\s*ch\.hppPusat\s*\)/.test(src),
        `${rel}: HPP Mitra di tabel masih = HPP pusat tanpa markup`,
      ).toBe(false)
      expect(src).toMatch(/mitraHpp\s*=\s*[^;]*hitungHppMitraUi\(\s*ch\.hppPusat\s*\)/)
    }
  })

  it('kedua salinan posReport/compute.ts tetap identik byte-per-byte', () => {
    const norm = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()
    expect(norm(baca('apps/finance/src/lib/posReport/compute.ts'))).toBe(
      norm(baca('apps/admin-dashboard/src/lib/posReport/compute.ts')),
    )
  })

  it('tidak ada pembawa markup yang masih memakai angka lama 1,15', () => {
    for (const rel of [...BERBASIS_TANGGAL, ...LAYAR_TANPA_TANGGAL]) {
      expect(/MITRA_MARKUP_\w*\s*=\s*1\.15/.test(baca(rel)), `${rel} masih 1,15`).toBe(false)
    }
  })
})
