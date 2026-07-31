import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireApprover } from '@/lib/authz'

export const dynamic = 'force-dynamic'

const BYPASS_APPROVER_ROLES = ['spv', 'leader', 'admin', 'regional_manager']

const APPROVAL_ERROR_MESSAGES: Record<string, string> = {
  not_logged_in: 'Anda harus login terlebih dahulu di aplikasi pos-kasir sebelum menyetujui/menolak, lalu buka link ini lagi.',
  wrong_role: 'Akun Anda tidak berwenang menyetujui bypass absensi ini.',
  self_approval: 'Anda tidak bisa menyetujui/menolak pengajuan bypass Anda sendiri.',
  outlet_mismatch: 'Pengajuan ini di luar cakupan outlet Anda.',
}

// Data dari DB (reason/nama kasir/nama outlet) diketik manusia dan TIDAK boleh
// masuk mentah ke HTML: halaman ini dibuka SPV/owner, dan cookie sesi di sini
// ber-domain '.sukashawarma.com' (berlaku di semua app, umur 1 tahun).
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Lapis kedua: halaman ini tak butuh JS sama sekali, jadi matikan eksekusi skrip
// apa pun. Menutup seluruh kelas XSS, bukan cuma titik interpolasi yang sudah diketahui.
const HTML_HEADERS = {
  'Content-Type': 'text/html',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
} as const

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return new NextResponse('Invalid request: Missing parameters', { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return new NextResponse('Server configuration error', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch Bypass Request data
    const { data: request, error: fetchError } = await supabase
      .from('bypass_requests')
      .select('id, status, requested_by_name, requested_by, reason, created_at, outlets(name)')
      .eq('id', id)
      .single()

    if (fetchError || !request) {
      return new NextResponse(
        generateHtmlMsg('Pengajuan Tidak Ditemukan', 'Data pengajuan bypass tidak ditemukan atau ID salah.', false),
        { headers: HTML_HEADERS }
      )
    }

    // Gerbang otorisasi: siapa pun yang tahu URL ini bukan berarti berhak
    // menyetujui — link WA dikirim ke SPV, tapi kasir yang mengajukan tetap
    // bisa membuka link yang sama. Cek dilakukan di GET (agar form aksi tak
    // pernah ditampilkan ke yang tak berhak) DAN diulang di POST (di bawah).
    const gateCheck = await requireApprover(BYPASS_APPROVER_ROLES, request.requested_by)
    if (!gateCheck.ok) {
      return new NextResponse(
        generateHtmlMsg('Tidak Berwenang', APPROVAL_ERROR_MESSAGES[gateCheck.reason], false),
        { headers: HTML_HEADERS }
      )
    }

    if (request.status === 'approved') {
      return new NextResponse(
        generateHtmlMsg('Sudah Disetujui', 'Bypass absensi ini sudah disetujui sebelumnya.', true),
        { headers: HTML_HEADERS }
      )
    }

    if (request.status === 'rejected') {
      return new NextResponse(
        generateHtmlMsg('Sudah Ditolak', 'Bypass absensi ini sebelumnya sudah ditolak.', true),
        { headers: HTML_HEADERS }
      )
    }

    const outletName = request.outlets ? (request.outlets as any).name : 'Outlet'

    // Render Confirmation Page
    const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Persetujuan Bypass Absensi</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: white; padding: 32px 24px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; width: 100%; }
        h1 { color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 20px 0; }
        .details { text-align: left; background: #f9fafb; padding: 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e5e7eb; }
        .details p { margin: 0 0 12px 0; font-size: 14px; color: #4B5563; }
        .details p:last-child { margin: 0; }
        .details strong { color: #111827; display: block; font-size: 16px; margin-top: 4px; }
        .btn-group { display: flex; gap: 12px; }
        .btn { flex: 1; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; border: none; transition: opacity 0.2s; }
        .btn:active { transform: scale(0.98); }
        .btn-approve { background-color: #10B981; color: white; }
        .btn-reject { background-color: #EF4444; color: white; }
        form { margin: 0; flex: 1; display: flex; }
      </style>
    </head>
    <body>
      <div class="card">
        <svg style="width:56px;height:56px;color:#F59E0B;margin:0 auto 16px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1>Konfirmasi Bypass Absensi</h1>
        
        <div class="details">
          <p>Outlet:<strong>${esc(outletName)}</strong></p>
          <p>Kasir:<strong>${esc(request.requested_by_name)}</strong></p>
          <p>Alasan:<strong>${esc(request.reason || '-')}</strong></p>
        </div>

        <div class="btn-group">
          <form method="POST" action="/api/bypass/approve?id=${encodeURIComponent(id)}">
            <input type="hidden" name="action" value="reject">
            <button type="submit" class="btn btn-reject">Tolak</button>
          </form>
          <form method="POST" action="/api/bypass/approve?id=${encodeURIComponent(id)}">
            <input type="hidden" name="action" value="approve">
            <button type="submit" class="btn btn-approve">Setujui</button>
          </form>
        </div>
      </div>
    </body>
    </html>
    `
    return new NextResponse(html, { headers: HTML_HEADERS })

  } catch (error) {
    console.error("Error fetching bypass request details:", error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return new NextResponse('Invalid request: Missing parameters', { status: 400 })
    }

    const formData = await req.formData()
    const action = formData.get('action') // 'approve' or 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return new NextResponse('Invalid action', { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) return new NextResponse('Server configuration error', { status: 500 })
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify status
    const { data: request, error: fetchError } = await supabase
      .from('bypass_requests')
      .select('status, requested_by')
      .eq('id', id)
      .single()

    if (fetchError || !request) {
      return new NextResponse(
        generateHtmlMsg('Validasi Gagal', 'Data tidak ditemukan.', false),
        { headers: HTML_HEADERS }
      )
    }

    // Cek ulang di POST -- GET cuma menampilkan form, mutasi sebenarnya
    // terjadi di sini, jadi ini yang WAJIB jadi baris pertahanan terakhir.
    const gateCheck = await requireApprover(BYPASS_APPROVER_ROLES, request.requested_by)
    if (!gateCheck.ok) {
      return new NextResponse(
        generateHtmlMsg('Tidak Berwenang', APPROVAL_ERROR_MESSAGES[gateCheck.reason], false),
        { headers: HTML_HEADERS }
      )
    }

    if (request.status !== 'pending') {
      return new NextResponse(
        generateHtmlMsg('Sudah Diproses', `Pengajuan bypass ini sudah ${request.status === 'approved' ? 'disetujui' : 'ditolak'}.`, request.status === 'approved'),
        { headers: HTML_HEADERS }
      )
    }

    // Process Update
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateError } = await supabase
      .from('bypass_requests')
      .update({ 
        status: newStatus,
        resolved_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      return new NextResponse(
        generateHtmlMsg('Gagal', 'Terjadi kesalahan saat menyimpan pembaruan.', false),
        { headers: HTML_HEADERS }
      )
    }

    if (action === 'approve') {
      return new NextResponse(
        generateHtmlMsg('Berhasil Disetujui', 'Bypass absensi telah disetujui. POS Kasir akan otomatis terbuka.', true),
        { headers: HTML_HEADERS }
      )
    } else {
      return new NextResponse(
        generateHtmlMsg('Berhasil Ditolak', 'Bypass absensi telah ditolak.', true),
        { headers: HTML_HEADERS }
      )
    }

  } catch (error) {
    console.error("Error processing bypass action:", error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

function generateHtmlMsg(title: string, message: string, isSuccess: boolean) {
  const icon = isSuccess 
    ? `<svg style="width:64px;height:64px;color:#10B981;margin:0 auto 16px" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
    : `<svg style="width:64px;height:64px;color:#EF4444;margin:0 auto 16px" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  
  return `
  <!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Suka Shawarma</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
      .card { background: white; padding: 32px 24px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-align: center; max-width: 400px; width: 100%; }
      h1 { color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 8px 0; }
      p { color: #4B5563; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5; }
      .btn { display: inline-block; background-color: #2563EB; color: white; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; transition: background-color 0.2s; }
      .btn:hover { background-color: #1D4ED8; }
    </style>
  </head>
  <body>
    <div class="card">
      ${icon}
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="https://app.sukashawarma.com" class="btn">Tutup Halaman</a>
    </div>
  </body>
  </html>
  `
}
