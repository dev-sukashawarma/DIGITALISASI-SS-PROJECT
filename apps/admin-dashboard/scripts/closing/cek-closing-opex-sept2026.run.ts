import { vi, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Baca-saja: menjalankan pipeline OPEX Laba Rugi asli untuk September 2026 dan
// memastikan setelah penyesuaian closing setiap baris = target sheet FIXED.
// Mencetak penyesuaian per outlet supaya pergeseran data September ketahuan.
vi.mock('@/lib/authz', () => ({ requireRole: async () => ({ userId: 'cek', role: 'admin' }), PERAN_KEUANGAN: [] }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }), headers: async () => new Map() }))
vi.mock('server-only', () => ({}))

// Dijalankan dari apps/admin-dashboard. ENV_FILE boleh menunjuk .env.local lain (mis. dari worktree).
const env = fs.readFileSync(process.env.ENV_FILE || path.resolve(process.cwd(), '.env.local'), 'utf8')
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
