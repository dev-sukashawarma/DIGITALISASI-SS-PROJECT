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

// Penyesuaian yang diharapkan (spec §6.4, data 14 Okt setelah B2–B6). Kalau data September
// berubah sesudah closing, angka ini tak lagi cocok dan cek gagal — laporkan ke owner.
// Kolom: gaji crew, bonus crew, bonus AM+RM, pengeluaran outlet, lembur, internet.
const PENYESUAIAN_DIHARAPKAN: Record<string, [number, number, number, number, number, number]> = {
  'SS Online': [6630000, 0, 0, 0, 0, 0],
  'SUKA SHAWARMA BNR': [-4630001, 0, 53824, 0, -50000, -51500],
  'SUKA SHAWARMA EMPANG': [-225000, -16498, -169796, 325000, -325000, 0],
  'SUKA SHAWARMA CIMANGGU': [-1420000, -77568, -141796, 100000, -100000, 0],
  'SUKA SHAWARMA DEPOK SUKMAJAYA': [-560000, 1632, -23588, 50000, -150000, 0],
  'SUKA SHAWARMA JAGAKARSA': [-1384589, -11250, -25126, 0, 0, 0],
  'SUKA SHAWARMA BEJI': [-564334, -40284, 30474, 0, 0, 0],
  'SUKA SHAWARMA SAWANGAN (INTERNAL)': [0, 0, 0, 0, 0, 0],
  'SUKA SHAWARMA PAJAJARAN': [-1795250, -102850, 62524, 0, 0, 0],
  'SUKA SHAWARMA JATIWARINGIN': [-653500, 130800, 39374, 50000, -50000, 0],
  'SUKA SHAWARMA CIRENDEU': [-185257, -12700, 37874, 0, 0, 0],
  'SUKA SHAWARMA DRAMAGA': [-1420000, -45350, -96, 250000, -250000, 0],
}
const PENYESUAIAN_PUSAT_DIHARAPKAN: Record<string, number> = { crew_backup: 8694636, gaji_staff_kantor: -2050000, internet: -113000 }

test('OPEX September 2026 setelah closing = sheet FIXED', async () => {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const { susunBarisOpexLabaRugi } = await import('@/lib/server/opexLabaRugi')
  const { CLOSING_OPEX_INTERNAL_SEPT_2026: C } = await import('@/lib/closing/opexClosingInternalSeptember2026')
  const { barisOutletDari, barisPusatDari, AWALAN_ID_PENYESUAIAN, GUDANG_SS_ONLINE_ID, SS_ONLINE_ID } = await import('@/lib/closing/terapkanClosingOpex')

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
    const a = (k: string) => adj[k] ?? 0
    const nyata = [a('gaji_crew_outlet'), a('bonus_crew'), a('bonus_area_manager') + a('bonus_regional_manager'),
      a('pengeluaran_outlet'), a('lembur'), a('internet')]
    const lain = Object.keys(adj).filter(k => !['gaji_crew_outlet', 'bonus_crew', 'bonus_area_manager',
      'bonus_regional_manager', 'pengeluaran_outlet', 'lembur', 'internet'].includes(k) && Math.abs(adj[k]) >= 1)
    const harap = PENYESUAIAN_DIHARAPKAN[o.nama]
    if (!harap) selisih.push(`${o.nama}: tidak ada di tabel penyesuaian §6.4`)
    else nyata.forEach((v, i) => { if (Math.abs(v - harap[i]) >= 1) selisih.push(`Drift ${o.nama} kolom ${i}: ${Math.round(v)} vs ${harap[i]}`) })
    for (const k of lain) selisih.push(`Drift ${o.nama} ${k}: penyesuaian ${Math.round(adj[k])} tak terduga`)
  }

  // Outlet non-mitra di luar daftar closing yang masih punya OPEX September membuat
  // Laba Rugi Internal tidak sama dengan Excel (barisnya ikut mentah di atas total closing).
  const tipe = new Map((outlets ?? []).map(o => [o.id, o.type]))
  const luar: Record<string, number> = {}
  for (const r of rows.filter(r => r.scope === 'outlet')) {
    const id = r.outlet_id === GUDANG_SS_ONLINE_ID ? SS_ONLINE_ID : (r.outlet_id ?? '')
    if (C.outlets[id] || tipe.get(id) === 'mitra' || tipe.get(id) === 'test') continue
    const kunci = `${r.outlet_name ?? id} (${tipe.get(id) ?? '?'})`
    luar[kunci] = (luar[kunci] ?? 0) + r.amount
  }
  for (const [k, v] of Object.entries(luar)) if (Math.abs(v) >= 1) selisih.push(`Di luar daftar closing: ${k} ${Math.round(v)}`)
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
  for (const k of new Set([...Object.keys(adjPusat), ...Object.keys(PENYESUAIAN_PUSAT_DIHARAPKAN)])) {
    if (Math.abs((adjPusat[k] ?? 0) - (PENYESUAIAN_PUSAT_DIHARAPKAN[k] ?? 0)) >= 1) {
      selisih.push(`Drift Pusat ${k}: ${Math.round(adjPusat[k] ?? 0)} vs ${PENYESUAIAN_PUSAT_DIHARAPKAN[k] ?? 0}`)
    }
  }
  expect(selisih).toEqual([])
})
