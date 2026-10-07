// Server MCP baca-saja untuk Hermes Agent. Spec: docs/superpowers/specs/2026-10-07-hermes-api-design.md
// Gerbang SATU-SATUNYA = kunci (lib/hermes/server/autentikasi). Middleware sengaja dilewati.
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { autentikasi, catatLog } from '@/lib/hermes/server/autentikasi'
import { konteksHermes } from '@/lib/hermes/server/konteks'
import { bangunAlatMcp } from '@/lib/hermes/registry'
import { tanganiPesan } from '@/lib/hermes/mcp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const mulai = Date.now()
  let svc: any
  try {
    svc = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  let auth
  try {
    auth = await autentikasi(req.headers, svc)
  } catch (e) {
    console.error('[hermes] autentikasi galat:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
  if (!auth.ok) {
    await catatLog(svc, { kunciId: auth.kunciId, prefix: auth.prefix, alat: null, status: 'ditolak', alasan: auth.alasan, ip: auth.ip, durasiMs: Date.now() - mulai })
    return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status })
  }

  let pesan: unknown
  try {
    pesan = await req.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 })
  }

  const sekarang = new Date()
  const { jawaban, log } = await tanganiPesan(pesan, {
    scope: auth.scope,
    alat: bangunAlatMcp(() => konteksHermes(svc, sekarang)),
  })

  if (log) {
    await catatLog(svc, { kunciId: auth.kunciId, prefix: auth.prefix, alat: log.alat, status: log.status, alasan: log.alasan, ip: auth.ip, durasiMs: Date.now() - mulai })
  }
  const { error: errPakai } = await svc.from('hermes_api_key').update({ terakhir_dipakai_at: sekarang.toISOString() }).eq('id', auth.kunciId)
  if (errPakai) console.error('[hermes] gagal mencatat terakhir_dipakai_at:', errPakai.message)

  if (!jawaban) return new NextResponse(null, { status: 202 })
  return NextResponse.json(jawaban)
}

// Tanpa aliran SSE: GET/DELETE tidak didukung (spesifikasi MCP mengizinkan 405).
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
