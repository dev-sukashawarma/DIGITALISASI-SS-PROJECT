// supabase/functions/system-health-collector/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { deriveStatus } from './deriveStatus.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceKey)

const FETCH_TIMEOUT_MS = 8000

interface AppTarget {
  name: 'stok' | 'absensi' | 'pos-kasir' | 'distribusi'
  urlEnv: string
}

const APP_TARGETS: AppTarget[] = [
  { name: 'stok', urlEnv: 'STOK_HEALTH_URL' },
  { name: 'absensi', urlEnv: 'ABSENSI_HEALTH_URL' },
  { name: 'pos-kasir', urlEnv: 'POS_KASIR_HEALTH_URL' },
  { name: 'distribusi', urlEnv: 'DISTRIBUSI_HEALTH_URL' },
]

interface HealthLogRow {
  target_type: 'app' | 'supabase' | 'cpanel'
  target_name: string
  status: 'up' | 'degraded' | 'down' | 'unconfigured'
  db_status: 'ok' | 'error' | null
  last_activity_at: string | null
  response_time_ms: number | null
  detail: Record<string, unknown> | null
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkApp(target: AppTarget): Promise<HealthLogRow> {
  const url = Deno.env.get(target.urlEnv)
  if (!url) {
    return {
      target_type: 'app',
      target_name: target.name,
      status: 'unconfigured',
      db_status: null,
      last_activity_at: null,
      response_time_ms: null,
      detail: { reason: `${target.urlEnv} not set` },
    }
  }

  const startedAt = Date.now()
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
    const responseTimeMs = Date.now() - startedAt
    if (!res.ok) {
      return {
        target_type: 'app',
        target_name: target.name,
        status: 'down',
        db_status: null,
        last_activity_at: null,
        response_time_ms: responseTimeMs,
        detail: { httpStatus: res.status },
      }
    }
    const body = await res.json() as { db: 'ok' | 'error'; lastActivity: string | null }
    const status = deriveStatus({ reachable: true, dbStatus: body.db, responseTimeMs })
    return {
      target_type: 'app',
      target_name: target.name,
      status,
      db_status: body.db,
      last_activity_at: body.lastActivity,
      response_time_ms: responseTimeMs,
      detail: null,
    }
  } catch (err) {
    return {
      target_type: 'app',
      target_name: target.name,
      status: 'down',
      db_status: null,
      last_activity_at: null,
      response_time_ms: Date.now() - startedAt,
      detail: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}

async function checkSupabase(): Promise<HealthLogRow> {
  const startedAt = Date.now()
  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/rest/v1/`, FETCH_TIMEOUT_MS, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    const responseTimeMs = Date.now() - startedAt
    const status = deriveStatus({ reachable: res.ok, dbStatus: 'ok', responseTimeMs })
    return {
      target_type: 'supabase',
      target_name: 'supabase-db',
      status,
      db_status: null,
      last_activity_at: null,
      response_time_ms: responseTimeMs,
      detail: res.ok ? null : { httpStatus: res.status },
    }
  } catch (err) {
    return {
      target_type: 'supabase',
      target_name: 'supabase-db',
      status: 'down',
      db_status: null,
      last_activity_at: null,
      response_time_ms: Date.now() - startedAt,
      detail: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}

async function checkCpanel(): Promise<HealthLogRow> {
  const token = Deno.env.get('CPANEL_UAPI_TOKEN')
  const host = Deno.env.get('CPANEL_HOST')
  const user = Deno.env.get('CPANEL_USER')
  if (!token || !host || !user) {
    return {
      target_type: 'cpanel',
      target_name: 'cpanel-server',
      status: 'unconfigured',
      db_status: null,
      last_activity_at: null,
      response_time_ms: null,
      detail: { reason: 'CPANEL_UAPI_TOKEN / CPANEL_HOST / CPANEL_USER not all set' },
    }
  }

  const startedAt = Date.now()
  try {
    const res = await fetchWithTimeout(
      `https://${host}:2083/execute/Quota/get_quota_info`,
      FETCH_TIMEOUT_MS,
      { headers: { Authorization: `cpanel ${user}:${token}` } },
    )
    const responseTimeMs = Date.now() - startedAt
    if (!res.ok) {
      return {
        target_type: 'cpanel',
        target_name: 'cpanel-server',
        status: 'down',
        db_status: null,
        last_activity_at: null,
        response_time_ms: responseTimeMs,
        detail: { httpStatus: res.status },
      }
    }
    const body = await res.json()
    return {
      target_type: 'cpanel',
      target_name: 'cpanel-server',
      status: 'up',
      db_status: null,
      last_activity_at: null,
      response_time_ms: responseTimeMs,
      detail: body,
    }
  } catch (err) {
    return {
      target_type: 'cpanel',
      target_name: 'cpanel-server',
      status: 'down',
      db_status: null,
      last_activity_at: null,
      response_time_ms: Date.now() - startedAt,
      detail: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}

serve(async (_req) => {
  const results = await Promise.allSettled([
    ...APP_TARGETS.map(checkApp),
    checkSupabase(),
    checkCpanel(),
  ])

  const rows: HealthLogRow[] = results
    .filter((r): r is PromiseFulfilledResult<HealthLogRow> => r.status === 'fulfilled')
    .map((r) => r.value)

  const { error } = await admin.from('system_health_log').insert(rows)

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
