import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  wibDateHour,
  baseLabel,
  prevWibDate,
  formatWibDateHuman,
} from '@/lib/period'
import type { BoardPayload, BoardRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Angka hari ini berubah terus. */
const TODAY_TTL_MS = 25_000
/** Baseline hanya berubah saat jam WIB berganti. */
const BASELINE_TTL_MS = 60 * 60 * 1000

type TodayRow = {
  outlet_id: string
  outlet_name: string
  pcs: number
  trx: number
  omzet: number
}

type BaselineRow = {
  outlet_id: string
  pcs_avg: number | null
  trx_avg: number | null
  omzet_avg: number | null
  divisor: number
}

/** Outlet aktif dengan `type` di luar himpunan yang dikenal papan (guard drift). */
type UnexpectedOutletRow = {
  id: string
  name: string
  type: string | null
}

type Cached<T> = { key: string; at: number; value: T }

let todayCache: Cached<TodayRow[]> | null = null
let baselineCache: Cached<BaselineRow[]> | null = null
let unexpectedOutletCache: Cached<UnexpectedOutletRow[]> | null = null

// In-flight dedup: N pemanggil konkuren untuk key yang sama menunggu SATU RPC
let todayInFlight: { key: string; promise: Promise<TodayRow[]> } | null = null
let baselineInFlight: { key: string; promise: Promise<BaselineRow[]> } | null = null
let unexpectedOutletInFlight: { key: string; promise: Promise<UnexpectedOutletRow[]> } | null =
  null

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set. ' +
        'Di Docker, secret server-only WAJIB di-ARG+ENV ulang di stage runner.',
    )
  }
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

async function fetchToday(date: string, hour: number): Promise<TodayRow[]> {
  const key = `${date}:${hour}`
  const now = Date.now()
  if (todayCache && todayCache.key === key && now - todayCache.at < TODAY_TTL_MS) {
    return todayCache.value
  }
  if (todayInFlight && todayInFlight.key === key) {
    return todayInFlight.promise
  }
  const promise = (async () => {
    const { data, error } = await getClient().rpc('get_sales_board_today', {
      p_date: date,
      p_hour: hour,
    })
    if (error) throw new Error(`get_sales_board_today: ${error.message}`)
    if (!data || data.length === 0) {
      throw new Error('get_sales_board_today: RPC mengembalikan nol baris outlet')
    }
    const value = data as TodayRow[]
    todayCache = { key, at: Date.now(), value }
    return value
  })()
  todayInFlight = { key, promise }
  try {
    return await promise
  } finally {
    if (todayInFlight && todayInFlight.promise === promise) {
      todayInFlight = null
    }
  }
}

async function fetchBaseline(date: string, hour: number): Promise<BaselineRow[]> {
  const key = `${date}:${hour}`
  const now = Date.now()
  if (baselineCache && baselineCache.key === key && now - baselineCache.at < BASELINE_TTL_MS) {
    return baselineCache.value
  }
  if (baselineInFlight && baselineInFlight.key === key) {
    return baselineInFlight.promise
  }
  const promise = (async () => {
    const { data, error } = await getClient().rpc('get_sales_board_baseline', {
      p_date: date,
      p_hour: hour,
    })
    if (error) throw new Error(`get_sales_board_baseline: ${error.message}`)
    const value = (data ?? []) as BaselineRow[]
    baselineCache = { key, at: Date.now(), value }
    return value
  })()
  baselineInFlight = { key, promise }
  try {
    return await promise
  } finally {
    if (baselineInFlight && baselineInFlight.promise === promise) {
      baselineInFlight = null
    }
  }
}

/** Tipe outlet yang DIKENAL papan */
const KNOWN_OUTLET_TYPES = [
  'outlet',
  'mitra',
  'office',
  'gudang',
  'system',
  'marketplace',
  'test',
] as const

async function fetchUnexpectedOutlets(date: string, hour: number): Promise<UnexpectedOutletRow[]> {
  const key = `${date}:${hour}`
  const now = Date.now()
  if (
    unexpectedOutletCache &&
    unexpectedOutletCache.key === key &&
    now - unexpectedOutletCache.at < BASELINE_TTL_MS
  ) {
    return unexpectedOutletCache.value
  }
  if (unexpectedOutletInFlight && unexpectedOutletInFlight.key === key) {
    return unexpectedOutletInFlight.promise
  }
  const promise = (async () => {
    const knownList = KNOWN_OUTLET_TYPES.join(',')
    const { data, error } = await getClient()
      .from('outlets')
      .select('id, name, type')
      .eq('is_active', true)
      .or(`type.is.null,type.not.in.(${knownList})`)
    if (error) throw new Error(`fetchUnexpectedOutlets: ${error.message}`)
    const value = (data ?? []) as UnexpectedOutletRow[]
    unexpectedOutletCache = { key, at: Date.now(), value }
    return value
  })()
  unexpectedOutletInFlight = { key, promise }
  try {
    return await promise
  } finally {
    if (unexpectedOutletInFlight && unexpectedOutletInFlight.promise === promise) {
      unexpectedOutletInFlight = null
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const modeParam = searchParams.get('mode') // 'today' | 'yesterday'

  const { date: todayDate, hour } = wibDateHour(new Date())

  try {
    const [today, baseline, unexpectedOutlets] = await Promise.all([
      fetchToday(todayDate, hour),
      fetchBaseline(todayDate, hour),
      fetchUnexpectedOutlets(todayDate, hour),
    ])

    if (unexpectedOutlets.length > 0) {
      const names = unexpectedOutlets
        .map((o) => `${o.name} (type=${o.type ?? 'null'})`)
        .join(', ')
      console.error(`[board] outlet type tak dikenal, papan dihentikan: ${names}`)
      throw new Error('unexpected outlet type detected')
    }

    const totalPcsToday = today.reduce((acc, r) => acc + Number(r.pcs ?? 0), 0)

    // Logika Fallback Kemarin:
    // Jika belum ada penjualan hari ini (totalPcsToday === 0) dan user tidak memaksa ?mode=today,
    // ATAU jika user eksplisit meminta ?mode=yesterday:
    const shouldUseYesterday =
      modeParam === 'yesterday' || (modeParam !== 'today' && totalPcsToday === 0)

    if (shouldUseYesterday) {
      const yesterdayDate = prevWibDate(todayDate)
      const [yesterday, yesterdayBase] = await Promise.all([
        fetchToday(yesterdayDate, 23),
        fetchBaseline(yesterdayDate, 23),
      ])

      const totalPcsYesterday = yesterday.reduce((acc, r) => acc + Number(r.pcs ?? 0), 0)

      // Jika data kemarin ada penjualan:
      if (totalPcsYesterday > 0 || modeParam === 'yesterday') {
        const baseByOutlet = new Map(yesterdayBase.map((b) => [b.outlet_id, b]))
        const divisorFromDb = yesterdayBase[0]?.divisor ?? 0

        const rows: BoardRow[] = yesterday.map((t) => {
          const b = baseByOutlet.get(t.outlet_id)
          return {
            outletId: t.outlet_id,
            outletName: t.outlet_name,
            pcsToday: Number(t.pcs ?? 0),
            trxToday: Number(t.trx ?? 0),
            omzetToday: Number(t.omzet ?? 0),
            pcsBase: b?.pcs_avg == null ? null : Number(b.pcs_avg),
            trxBase: b?.trx_avg == null ? null : Number(b.trx_avg),
            omzetBase: b?.omzet_avg == null ? null : Number(b.omzet_avg),
          }
        })

        const payload: BoardPayload = {
          date: yesterdayDate,
          hour: 23,
          baseLabel: baseLabel(yesterdayDate),
          baseDivisor: divisorFromDb,
          generatedAt: new Date().toISOString(),
          rows,
          isYesterday: true,
          yesterdayDate,
          yesterdayLabel: formatWibDateHuman(yesterdayDate),
          todayDate,
        }

        return NextResponse.json(payload, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    }

    // Default: Hari ini
    const baseByOutlet = new Map(baseline.map((b) => [b.outlet_id, b]))
    const divisorFromDb = baseline[0]?.divisor ?? 0

    const rows: BoardRow[] = today.map((t) => {
      const b = baseByOutlet.get(t.outlet_id)
      return {
        outletId: t.outlet_id,
        outletName: t.outlet_name,
        pcsToday: Number(t.pcs ?? 0),
        trxToday: Number(t.trx ?? 0),
        omzetToday: Number(t.omzet ?? 0),
        pcsBase: b?.pcs_avg == null ? null : Number(b.pcs_avg),
        trxBase: b?.trx_avg == null ? null : Number(b.trx_avg),
        omzetBase: b?.omzet_avg == null ? null : Number(b.omzet_avg),
      }
    })

    const payload: BoardPayload = {
      date: todayDate,
      hour,
      baseLabel: baseLabel(todayDate),
      baseDivisor: divisorFromDb,
      generatedAt: new Date().toISOString(),
      rows,
      isYesterday: false,
      yesterdayDate: prevWibDate(todayDate),
      yesterdayLabel: formatWibDateHuman(prevWibDate(todayDate)),
      todayDate,
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengambil data papan'
    console.error('[board]', message)
    return NextResponse.json({ error: 'Gagal mengambil data papan' }, { status: 503 })
  }
}
