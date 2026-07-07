import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const token = searchParams.get('token')

    if (!id || !token) {
      return new NextResponse('Invalid request: Missing parameters', { status: 400 })
    }

    // We must use a service role key here because the SPV might not be logged in to this domain on their phone browser
    // But for security, we only change status to approved if the token perfectly matches.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase env vars")
      return new NextResponse('Server configuration error', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify token
    const { data: topup, error: fetchError } = await supabase
      .from('petty_cash_topups')
      .select('id, status, approval_token, amount')
      .eq('id', id)
      .single()

    if (fetchError || !topup) {
      return new NextResponse(
        generateHtmlMsg('Top Up Tidak Ditemukan', 'Data top up tidak ditemukan atau ID salah.', false),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (topup.status === 'approved') {
      return new NextResponse(
        generateHtmlMsg('Sudah Disetujui', 'Top up ini sudah disetujui sebelumnya.', true),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (topup.status === 'rejected') {
      return new NextResponse(
        generateHtmlMsg('Sudah Ditolak', 'Top up ini sebelumnya sudah ditolak.', false),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Check token
    if (topup.approval_token !== token) {
      return new NextResponse(
        generateHtmlMsg('Token Tidak Valid', 'Token persetujuan tidak valid atau sudah kadaluarsa.', false),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Approve the top up
    const { error: updateError } = await supabase
      .from('petty_cash_topups')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error(updateError)
      return new NextResponse(
        generateHtmlMsg('Gagal', 'Terjadi kesalahan saat menyimpan persetujuan.', false),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    return new NextResponse(
      generateHtmlMsg('Top Up Berhasil Disetujui', `Pengajuan dana operasional sebesar Rp ${topup.amount.toLocaleString('id-ID')} telah berhasil disetujui. Silakan minta kasir untuk mengecek saldo.`, true),
      { headers: { 'Content-Type': 'text/html' } }
    )

  } catch (error) {
    console.error("Error approving top up:", error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

function generateHtmlMsg(title: string, message: string, isSuccess: boolean) {
  const icon = isSuccess 
    ? `<svg style="width:64px;height:64px;color:#10B981;margin:0 auto 16px" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
    : `<svg style="width:64px;height:64px;color:#F43F5E;margin:0 auto 16px" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  
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
      <a href="javascript:window.close();" class="btn">Tutup Halaman</a>
    </div>
  </body>
  </html>
  `
}
