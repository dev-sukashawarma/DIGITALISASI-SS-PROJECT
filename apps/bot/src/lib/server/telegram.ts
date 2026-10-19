import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin(timeoutMs?: number) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server belum dikonfigurasi.')
  return createClient(url, key, {
    auth: { persistSession: false },
    ...(timeoutMs ? {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
        }),
      },
    } : {}),
  })
}

export async function stafBolehPakaiBotApaPun(staffId: string): Promise<boolean> {
  const admin = supabaseAdmin()
  const [{ data: access, error: accessError }, { data: stokis, error: stokisError }] = await Promise.all([
    admin.from('hermes_bot_user_access').select('staff_id').eq('staff_id', staffId).limit(1),
    admin.from('bot_telegram_access').select('staff_id').eq('staff_id', staffId).limit(1),
  ])
  if (accessError || stokisError) throw new Error('Daftar akses bot Telegram tidak tersedia.')
  return !!access?.length || !!stokis?.length
}

export function urlAplikasiDiizinkan(value: unknown, app: 'stok' | 'distribusi'): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || value.length > 500) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (url.hostname !== `${app}.sukashawarma.com`) return null
    return url.toString()
  } catch {
    return null
  }
}

export async function kirimPesanTelegram(chatId: string, text: string, url?: string, profil: 'stokis' | 'hrd' = 'stokis') {
  const token = profil === 'hrd' ? process.env.TELEGRAM_HRD_BOT_TOKEN : process.env.TELEGRAM_STOKIST_BOT_TOKEN
  if (!token) throw new Error(`Token bot ${profil} belum dikonfigurasi.`)
  const message = `${text}${url ? `\n\n${url}` : ''}`
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 4000), disable_web_page_preview: true }),
    cache: 'no-store',
    signal: AbortSignal.timeout(7_000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.ok !== true) {
    throw new Error(`Telegram sendMessage gagal (${response.status}): ${result?.description || 'unknown error'}`)
  }
}
