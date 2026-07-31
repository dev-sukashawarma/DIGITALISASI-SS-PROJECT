import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireApprover } from '@/lib/authz'

export const dynamic = 'force-dynamic'

const TOPUP_APPROVER_ROLES = ['leader', 'spv', 'regional_manager']

const APPROVAL_ERROR_MESSAGES: Record<string, string> = {
  not_logged_in: 'Anda harus login terlebih dahulu di aplikasi pos-kasir sebelum menyetujui/menolak, lalu buka link ini lagi.',
  wrong_role: 'Akun Anda tidak berwenang menyetujui top up ini (khusus Leader outlet).',
  self_approval: 'Anda tidak bisa menyetujui/menolak pengajuan top up Anda sendiri.',
  outlet_mismatch: 'Pengajuan ini di luar cakupan outlet Anda.',
}

// description diketik kasir dan TIDAK boleh masuk mentah ke HTML: halaman ini
// dibuka owner, dan cookie sesi di sini ber-domain '.sukashawarma.com'
// (berlaku di semua app, umur 1 tahun).
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

// Perbandingan constant-time, seragam dengan /api/orders/update-status.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const token = searchParams.get('token')

    if (!id || !token) {
      return new NextResponse('Invalid request: Missing parameters', { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return new NextResponse('Server configuration error', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch Topup data
    const { data: topup, error: fetchError } = await supabase
      .from('petty_cash_topups')
      .select(`
        id, status, approval_token, amount, description, created_at, created_by, outlet_id
      `)
      .eq('id', id)
      .single()

    if (fetchError || !topup) {
      return new NextResponse(
        generateHtmlMsg('Top Up Tidak Ditemukan', 'Data top up tidak ditemukan atau link tidak valid.', false),
        { headers: HTML_HEADERS }
      )
    }

    // Token divalidasi SEBELUM status diperiksa. Kalau dibalik, pemegang `id`
    // saja (tanpa token yang benar) tetap bisa memastikan pengajuan itu ada dan
    // tahu posisinya di alur persetujuan -- oracle yang memudahkan penyalahgunaan lain.
    // Pesan galatnya sengaja sama dengan "tidak ditemukan" agar tak membocorkan
    // mana yang salah: id-nya, atau token-nya.
    if (!timingSafeEqual(String(topup.approval_token ?? ''), token)) {
      return new NextResponse(
        generateHtmlMsg('Top Up Tidak Ditemukan', 'Data top up tidak ditemukan atau link tidak valid.', false),
        { headers: HTML_HEADERS }
      )
    }

    // Gerbang otorisasi: token yang valid saja tidak cukup -- kasir pemohon
    // ikut membuat token itu di browsernya sendiri (kasir/shift/page.tsx),
    // jadi dia tetap tahu token walau tak seharusnya bisa approve.
    const gateCheck = await requireApprover(TOPUP_APPROVER_ROLES, topup.created_by, topup.outlet_id)
    if (!gateCheck.ok) {
      return new NextResponse(
        generateHtmlMsg('Tidak Berwenang', APPROVAL_ERROR_MESSAGES[gateCheck.reason], false),
        { headers: HTML_HEADERS }
      )
    }

    if (topup.status === 'approved') {
      return new NextResponse(
        generateHtmlMsg('Sudah Disetujui', 'Top up ini sudah disetujui sebelumnya.', true),
        { headers: HTML_HEADERS }
      )
    }

    if (topup.status === 'rejected') {
      return new NextResponse(
        generateHtmlMsg('Sudah Ditolak', 'Top up ini sebelumnya sudah ditolak.', true),
        { headers: HTML_HEADERS }
      )
    }

    // Render Confirmation Page
    const amountStr = `Rp ${topup.amount.toLocaleString('id-ID')}`
    
    const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Persetujuan Top Up</title>
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
        <svg style="width:56px;height:56px;color:#3B82F6;margin:0 auto 16px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1>Konfirmasi Top Up</h1>
        
        <div class="details">
          <p>Nominal:<strong>${amountStr}</strong></p>
          <p>Alasan:<strong>${esc(topup.description || '-')}</strong></p>
        </div>

        <div class="btn-group">
          <form method="POST" action="/api/topup/approve?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}">
            <input type="hidden" name="action" value="reject">
            <button type="submit" class="btn btn-reject">Tolak</button>
          </form>
          <form method="POST" action="/api/topup/approve?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}">
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
    console.error("Error fetching top up details:", error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const token = searchParams.get('token')

    if (!id || !token) {
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

    // Verify token & status
    const { data: topup, error: fetchError } = await supabase
      .from('petty_cash_topups')
      .select('status, approval_token, amount, created_by, outlet_id')
      .eq('id', id)
      .single()

    if (fetchError || !topup || !timingSafeEqual(String(topup.approval_token ?? ''), token)) {
      return new NextResponse(
        generateHtmlMsg('Validasi Gagal', 'Data tidak ditemukan atau link tidak valid.', false),
        { headers: HTML_HEADERS }
      )
    }

    // Cek ulang di POST -- GET cuma menampilkan form, mutasi sebenarnya
    // terjadi di sini, jadi ini yang WAJIB jadi baris pertahanan terakhir.
    const gateCheck = await requireApprover(TOPUP_APPROVER_ROLES, topup.created_by, topup.outlet_id)
    if (!gateCheck.ok) {
      return new NextResponse(
        generateHtmlMsg('Tidak Berwenang', APPROVAL_ERROR_MESSAGES[gateCheck.reason], false),
        { headers: HTML_HEADERS }
      )
    }

    if (topup.status !== 'pending') {
      return new NextResponse(
        generateHtmlMsg('Sudah Diproses', `Pengajuan ini sudah ${topup.status === 'approved' ? 'disetujui' : 'ditolak'}.`, topup.status === 'approved'),
        { headers: HTML_HEADERS }
      )
    }

    // Process Update
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateError } = await supabase
      .from('petty_cash_topups')
      .update({ 
        status: newStatus,
        approved_at: new Date().toISOString()
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
        generateHtmlMsg('Berhasil Disetujui', `Pengajuan dana sebesar Rp ${topup.amount.toLocaleString('id-ID')} telah disetujui.`, true),
        { headers: HTML_HEADERS }
      )
    } else {
      return new NextResponse(
        generateHtmlMsg('Berhasil Ditolak', 'Pengajuan dana telah ditolak.', true),
        { headers: HTML_HEADERS }
      )
    }

  } catch (error) {
    console.error("Error processing top up action:", error)
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
