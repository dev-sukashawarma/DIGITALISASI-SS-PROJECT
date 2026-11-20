'use server'

import { createClient as createServiceSupabase } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceSupabase(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getClientIp(): Promise<string> {
  const h = await headers()
  const raw =
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]
  const ip = raw?.trim()
  return ip && ip.length <= 64 && /^[a-fA-F0-9.:]+$/.test(ip) ? ip : 'unknown'
}

export async function signIn(prevState: any, formData: FormData) {
  const startedAt = Date.now()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '').trim()

  if (!email || !password || email.length > 160 || password.length > 256) {
    return { error: 'Email dan kata sandi wajib diisi.' }
  }

  const clientIp = await getClientIp()
  const admin = getAdminClient()

  if (admin) {
    const { data: rateData } = await admin.rpc('check_login_rate_limit', {
      p_ip: clientIp,
      p_identifier: email,
    })
    if (rateData && (rateData as { allowed?: boolean }).allowed === false) {
      return { error: 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa menit.' }
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data?.user) {
    if (admin) {
      await admin.rpc('record_login_attempt', {
        p_ip: clientIp,
        p_identifier: email,
        p_success: false,
      })
    }
    const remaining = 280 - (Date.now() - startedAt)
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
    return { error: 'Email atau kata sandi salah.' }
  }

  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('status')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!staff || staff.status !== 'active') {
    await supabase.auth.signOut().catch(() => {})
    return { error: 'Akun Anda tidak aktif atau tidak berwenang mengakses sistem ini.' }
  }

  if (admin) {
    await admin.rpc('record_login_attempt', {
      p_ip: clientIp,
      p_identifier: email,
      p_success: true,
    })
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  redirect(portalUrl)
}
