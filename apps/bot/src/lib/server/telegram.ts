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

export function urlAplikasiDiizinkan(
  value: unknown,
  app: 'stok' | 'distribusi' | 'manager' | 'hr' | 'ceo' | 'admin' | 'finance' | 'review'
): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || value.length > 500) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (app === 'ceo') {
      if (url.hostname !== 'agents.sukashawarma.com' && url.hostname !== 'admin.sukashawarma.com') return null
      return url.toString()
    }
    if (app === 'review') {
      if (
        url.hostname !== 'review.sukashawarma.com' &&
        url.hostname !== 'sukareview.sukashawarma.com' &&
        url.hostname !== 'agents.sukashawarma.com' &&
        url.hostname !== 'suka.pantaureview.com'
      ) return null
      return url.toString()
    }
    if (url.hostname !== `${app}.sukashawarma.com`) return null
    return url.toString()
  } catch {
    return null
  }
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function formatPesanTelegramHtml(raw: string): string {
  if (!raw) return ''
  // Batasi panjang pesan sebelum formatting agar tidak melampaui batas 4096 karakter Telegram
  let text = raw.length > 3800 ? `${raw.slice(0, 3800)}\n\n...(pesan dipotong)` : raw
  text = text.replace(/\r\n/g, '\n')

  // Hapus alert block github directive: > [!NOTE], [!IMPORTANT], dsb
  text = text.replace(/^[ \t]*>[ \t]*\[!(?:NOTE|IMPORTANT|WARNING|TIP|CAUTION)\][ \t]*\n?/gim, '')
  text = text.replace(/\[!(?:NOTE|IMPORTANT|WARNING|TIP|CAUTION)\][ \t]*/gi, '')

  // Lindungi code blocks (```...```)
  const codeBlocks: string[] = []
  text = text.replace(/```(?:([a-zA-Z0-9_-]+)?\n)?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    const escaped = escapeHtml(code.trimEnd())
    codeBlocks.push(lang ? `<pre><code class="language-${lang}">${escaped}</code></pre>` : `<pre><code>${escaped}</code></pre>`)
    return `@@@CODE_BLOCK_${idx}@@@`
  })

  // Lindungi inline code (`...`)
  const inlineCodes: string[] = []
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`)
    return `@@@INLINE_CODE_${idx}@@@`
  })

  const formatInline = (t: string): string => {
    let s = escapeHtml(t)
    // Links: [label](url)
    s = s.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    // Bold: **text** atau __text__
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    s = s.replace(/__(.+?)__/g, '<b>$1</b>')
    // Italic: *text* (hindari snake_case kata_kunci)
    s = s.replace(/(^|[^\w*])\*([^*\n]+?)\*([^\w*]|$)/g, '$1<i>$2</i>$3')
    // Strikethrough: ~~text~~
    s = s.replace(/~~(.+?)~~/g, '<s>$1</s>')
    return s
  }

  const lines = text.split('\n')
  const resultLines: string[] = []
  let quoteBuffer: string[] = []

  const flushQuote = () => {
    if (quoteBuffer.length > 0) {
      resultLines.push(`<blockquote>${quoteBuffer.map(formatInline).join('\n')}</blockquote>`)
      quoteBuffer = []
    }
  }

  for (const line of lines) {
    const quoteMatch = line.match(/^[ \t]*>[ \t]?(.*)$/)
    if (quoteMatch) {
      quoteBuffer.push(quoteMatch[1])
      continue
    }
    flushQuote()

    const headerMatch = line.match(/^[ \t]*#{1,6}[ \t]+(.*)$/)
    if (headerMatch) {
      resultLines.push(`<b>${formatInline(headerMatch[1])}</b>`)
      continue
    }

    const listMatch = line.match(/^([ \t]*)[-*][ \t]+(.*)$/)
    if (listMatch) {
      resultLines.push(`${listMatch[1]}• ${formatInline(listMatch[2])}`)
      continue
    }

    resultLines.push(formatInline(line))
  }
  flushQuote()

  let formatted = resultLines.join('\n')
  formatted = formatted.replace(/@@@CODE_BLOCK_(\d+)@@@/g, (_, i) => codeBlocks[Number(i)] || '')
  formatted = formatted.replace(/@@@INLINE_CODE_(\d+)@@@/g, (_, i) => inlineCodes[Number(i)] || '')
  return formatted.replace(/\n{3,}/g, '\n\n').trim()
}

export function bersihkanMarkdown(raw: string): string {
  if (!raw) return ''
  let text = raw.replace(/\r\n/g, '\n')
  text = text.replace(/^[ \t]*>[ \t]*\[!(?:NOTE|IMPORTANT|WARNING|TIP|CAUTION)\][ \t]*\n?/gim, '')
  text = text.replace(/\[!(?:NOTE|IMPORTANT|WARNING|TIP|CAUTION)\][ \t]*/gi, '')
  text = text.replace(/^[ \t]*>[ \t]?/gm, '')
  text = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
  text = text.replace(/^[ \t]*[-*][ \t]+/gm, '• ')
  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  text = text.replace(/__(.+?)__/g, '$1')
  text = text.replace(/(^|[^\w*])\*([^*\n]+?)\*([^\w*]|$)/g, '$1$2$3')
  text = text.replace(/~~(.+?)~~/g, '$1')
  text = text.replace(/`([^`\n]+)`/g, '$1')
  text = text.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, '$1')
  text = text.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
  return text.slice(0, 4000).trim()
}

export async function kirimPesanTelegram(
  chatId: string,
  text: string,
  url?: string,
  profil: 'stokis' | 'hrd' | 'manager' | 'ceo' | 'finance' | 'review' = 'stokis'
) {
  const token = profil === 'hrd'
    ? process.env.TELEGRAM_HRD_BOT_TOKEN
    : profil === 'manager'
    ? (process.env.TELEGRAM_MANAGER_BOT_TOKEN || process.env.TELEGRAM_STOKIST_BOT_TOKEN)
    : profil === 'ceo'
    ? (process.env.TELEGRAM_CEO_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
    : profil === 'finance'
    ? (process.env.TELEGRAM_FINANCE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
    : profil === 'review'
    ? (process.env.TELEGRAM_REVIEW_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
    : process.env.TELEGRAM_STOKIST_BOT_TOKEN
  if (!token) throw new Error(`Token bot ${profil} belum dikonfigurasi.`)

  const hasInlineButton = !!(url && (url.startsWith('https://') || url.startsWith('http://')))
  // Jika URL sudah dijadikan inline keyboard button, jangan tempel URL mentah lagi di ujung pesan
  const rawMessage = hasInlineButton ? text.trim() : `${text.trim()}${url ? `\n\n${url}` : ''}`
  const htmlMessage = formatPesanTelegramHtml(rawMessage)

  const bodyPayload: Record<string, unknown> = {
    chat_id: chatId,
    text: htmlMessage,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (hasInlineButton) {
    bodyPayload.reply_markup = {
      inline_keyboard: [[{ text: '🔗 Buka di Dashboard', url }]],
    }
  }

  let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
    cache: 'no-store',
    signal: AbortSignal.timeout(7_000),
  })
  let result = await response.json().catch(() => null)

  // Fallback: Jika Telegram menolak parsing HTML (HTTP 400 entity parse error), kirim ulang sebagai plain text bersih
  if (!response.ok && response.status === 400 && String(result?.description || '').toLowerCase().includes("can't parse entities")) {
    console.warn(`[telegram] Parse HTML ditolak (${result?.description}), fallback ke plain text bersih`)
    const plainText = bersihkanMarkdown(rawMessage)
    bodyPayload.text = plainText
    delete bodyPayload.parse_mode

    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    })
    result = await response.json().catch(() => null)
  }

  if (!response.ok || result?.ok !== true) {
    throw new Error(`Telegram sendMessage gagal (${response.status}): ${result?.description || 'unknown error'}`)
  }
}

export async function kirimAksiChatTelegram(
  chatId: string,
  action: 'typing' | 'upload_photo' | 'record_video' | 'choose_sticker' = 'typing',
  profil: 'stokis' | 'hrd' | 'manager' | 'ceo' | 'finance' | 'review' = 'stokis'
) {
  const token = profil === 'hrd'
    ? process.env.TELEGRAM_HRD_BOT_TOKEN
    : profil === 'manager'
    ? (process.env.TELEGRAM_MANAGER_BOT_TOKEN || process.env.TELEGRAM_STOKIST_BOT_TOKEN)
    : profil === 'ceo'
    ? (process.env.TELEGRAM_CEO_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
    : profil === 'finance'
    ? (process.env.TELEGRAM_FINANCE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
    : profil === 'review'
    ? (process.env.TELEGRAM_REVIEW_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
    : process.env.TELEGRAM_STOKIST_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    })
  } catch {
    // Ignore error
  }
}
