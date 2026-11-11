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
 * Aturan yang dijaga (keputusan owner 11 Nov 2026, sumber "HPP NOVEMBER.xlsx"
 * tab OFFLINE sel P3 = MARKUP MITRA 0,15 "FIXED"):
 *   mulai 1 Nov 2026 HPP mitra = (HPP + OPEX) x 1,15 untuk SEMUA outlet mitra,
 *   termasuk MITRA CILEUNGSI.
 */

const REPO = resolve(__dirname, '../../../../..')
const MARKUP = '1.15'
const MULAI = '2026-11-01'

/** Pembawa markup yang SADAR TANGGAL: wajib memuat angka markup + tanggal mulai. */
const BERBASIS_TANGGAL = [
  'apps/admin-dashboard/src/lib/hpp/fetchHpp.ts',
  'apps/admin-dashboard/src/lib/posReport/compute.ts',
  'apps/admin-dashboard/src/app/actions/mitraPnl.ts',
  'apps/finance/src/lib/posReport/compute.ts',
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

const MIGRATION_DB = 'supabase/migrations/20261111101413_mitra_markup_15_persen_november.sql'

const baca = (rel: string) => {
  const p = resolve(REPO, rel)
  expect(existsSync(p), `berkas tidak ada: ${rel}`).toBe(true)
  return readFileSync(p, 'utf8')
}

describe('Paritas markup HPP mitra lintas app + DB', () => {
  it.each([...BERBASIS_TANGGAL])('%s memuat markup 1,15 dan tanggal mulai 1 Nov 2026', (rel) => {
    const src = baca(rel)
    expect(src, `${rel} tidak memuat markup ${MARKUP}`).toContain(MARKUP)
    expect(src, `${rel} tidak memuat tanggal mulai ${MULAI}`).toContain(MULAI)
  })

  it.each([...LAYAR_TANPA_TANGGAL])('%s memuat markup 1,15', (rel) => {
    expect(baca(rel), `${rel} tidak memuat markup ${MARKUP}`).toContain(MARKUP)
  })

  it('migration DB memuat markup 1,15 + tanggal mulai, dan menjaga penjaga owner summary', () => {
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

  it('kedua salinan posReport/compute.ts tetap identik byte-per-byte', () => {
    const norm = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()
    expect(norm(baca('apps/finance/src/lib/posReport/compute.ts'))).toBe(
      norm(baca('apps/admin-dashboard/src/lib/posReport/compute.ts')),
    )
  })
})
