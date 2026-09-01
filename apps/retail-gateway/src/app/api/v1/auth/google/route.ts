import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRetailClient } from '@/lib/supabase'
import { issueSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { id_token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.id_token) {
    return NextResponse.json({ error: 'id_token wajib diisi' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ error: 'Konfigurasi server belum lengkap' }, { status: 500 })
  }

  // Supabase Auth yang memvalidasi ID token ke Google. Anon key dipakai di
  // SERVER, tidak pernah dikirim ke aplikasi.
  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await authClient.auth.signInWithIdToken({
    provider: 'google',
    token: body.id_token,
  })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Login Google gagal' }, { status: 401 })
  }

  const user = data.user
  const retail = createRetailClient()

  const { data: profil, error: profilError } = await retail
    .from('customers')
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, name, email, phone')
    .maybeSingle()

  if (profilError || !profil) {
    return NextResponse.json({ error: 'Gagal menyiapkan profil' }, { status: 500 })
  }

  const { token, expiresAt } = await issueSession(user.id)

  return NextResponse.json({
    token,
    expires_at: expiresAt,
    customer: profil,
  })
}
