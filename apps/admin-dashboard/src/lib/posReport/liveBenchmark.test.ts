// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { laporanPosUntukScope } from './laporan'
import { clearPrepared } from './prepared'
import { addDaysStr, jakartaDate } from '@/lib/ownerDashboardCache'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const env: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

describe.skipIf(!process.env.RUN_LIVE_BENCHMARK)('Live Database Benchmark — Rangkuman Penjualan', () => {
  it('measures real data fetching and computation across 7days, thisMonth, 30days, custom, and all-time', async () => {
    const env = loadEnvLocal()
    const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    expect(url).toBeTruthy()
    expect(key).toBeTruthy()

    const supabase = createClient(url!, key!, {
      auth: { persistSession: false },
    })

    const today = jakartaDate(new Date())
    const ranges = [
      { name: 'Hari Ini (today)', from: today, to: today },
      { name: '7 Hari Terakhir (7days)', from: addDaysStr(today, -7), to: today },
      { name: 'Bulan Ini (thisMonth)', from: `${today.slice(0, 8)}01`, to: today },
      { name: '30 Hari Terakhir (30days)', from: addDaysStr(today, -30), to: today },
      { name: 'Kustom Tanggal (Bulan Lalu)', from: '2026-09-01', to: '2026-09-30' },
      { name: 'Semua Waktu (all)', from: '2000-01-01', to: today },
    ]

    const scope = { supabase, scopeKey: 'all', allowedOutletIds: 'all' as const }

    console.log(`\n=== LIVE BENCHMARK START (today WIB = ${today}) ===`)
    for (const r of ranges) {
      clearPrepared()
      const tCold0 = performance.now()
      const resCold = await laporanPosUntukScope(
        {
          from: r.from,
          to: r.to,
          outlets: ['all'],
          channels: ['all'],
          paymentMethod: 'all',
          search: '',
          page: 1,
          pageSize: 10,
          isPawoonVisible: new Date(r.from) < new Date('2026-08-01'),
        },
        scope
      )
      const tColdMs = performance.now() - tCold0

      // Warm cache (same filter -> prepared hit)
      const tWarm0 = performance.now()
      await laporanPosUntukScope(
        {
          from: r.from,
          to: r.to,
          outlets: ['all'],
          channels: ['all'],
          paymentMethod: 'all',
          search: '',
          page: 2,
          pageSize: 10,
          isPawoonVisible: new Date(r.from) < new Date('2026-08-01'),
        },
        scope
      )
      const tWarmMs = performance.now() - tWarm0

      // Filter change (channel filter change -> decodedPastDayMemo + rangeAuxMemo hit, 0 DB queries, recomputes analytics)
      const tFilter0 = performance.now()
      await laporanPosUntukScope(
        {
          from: r.from,
          to: r.to,
          outlets: ['all'],
          channels: ['food_apps'],
          paymentMethod: 'all',
          search: '',
          page: 1,
          pageSize: 10,
          isPawoonVisible: new Date(r.from) < new Date('2026-08-01'),
        },
        scope
      )
      const tFilterMs = performance.now() - tFilter0

      // Warm range re-open (clearPrepared -> simulates switching date filters and coming back, or another user opening same range)
      clearPrepared()
      const tReopen0 = performance.now()
      await laporanPosUntukScope(
        {
          from: r.from,
          to: r.to,
          outlets: ['all'],
          channels: ['all'],
          paymentMethod: 'all',
          search: '',
          page: 1,
          pageSize: 10,
          isPawoonVisible: new Date(r.from) < new Date('2026-08-01'),
        },
        scope
      )
      const tReopenMs = performance.now() - tReopen0

      const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)
      console.log(
        `[${r.name}] range=${r.from}..${r.to} | orders=${resCold.orderCount} (completed=${resCold.analytics.completedCount}) | Gross=Rp${resCold.analytics.grossRevenue.toLocaleString('id-ID')} | COLD=${tColdMs.toFixed(0)}ms | WARM(Page2)=${tWarmMs.toFixed(2)}ms | FILTER(FoodApps)=${tFilterMs.toFixed(0)}ms | REOPEN(Range)=${tReopenMs.toFixed(0)}ms | Heap=${memMb}MB`
      )
    }
    console.log(`=== LIVE BENCHMARK END ===\n`)
  }, 120_000)
})
