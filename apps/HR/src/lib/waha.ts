/**
 * WAHA (WhatsApp HTTP API) Client & Helper Functions
 * Includes WhatsApp Anti-Spam & Anti-Ban Protection Mechanisms
 * Reference: https://waha.devlike.pro/
 */

export interface WahaSendTextParams {
  phone: string // Raw phone number, e.g., '08123456789' or '628123456789'
  text: string
  session?: string
  baseUrl?: string
  apiKey?: string
  simulateTyping?: boolean
}

export interface WahaSendFileParams {
  phone: string
  fileBase64: string // Base64 or Data URL of the file
  filename: string
  mimetype?: string
  caption?: string
  session?: string
  baseUrl?: string
  apiKey?: string
}

export interface WahaSendResult {
  success: boolean
  phone: string
  error?: string
  messageId?: string
}

export interface WahaSessionStatus {
  online: boolean
  session: string
  status: string
  error?: string
  phone?: string
  pushName?: string
  engine?: string
  state?: string
}

/**
 * Normalizes Indonesian phone numbers into WAHA format (e.g. 628123456789@c.us)
 */
export function formatPhoneToWahaChatId(rawPhone: string): string | null {
  if (!rawPhone) return null
  let clean = rawPhone.replace(/[^0-9]/g, '').trim()
  if (!clean) return null

  // If starts with '0', replace with '62'
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1)
  } else if (clean.startsWith('8')) {
    clean = '628' + clean.slice(1)
  } else if (clean.startsWith('+62')) {
    clean = clean.replace('+62', '62')
  }

  // Minimum valid length for Indonesian phone is 10 digits (6281234567)
  if (clean.length < 10) return null

  // Ensure @c.us suffix for WAHA single contact chat
  return clean.includes('@') ? clean : `${clean}@c.us`
}

/**
 * Clean phone number for display (e.g. +62 812-3456-789)
 */
export function formatPhoneDisplay(rawPhone?: string | null): string {
  if (!rawPhone) return '-'
  let clean = rawPhone.replace(/[^0-9]/g, '').trim()
  if (clean.startsWith('0')) clean = '62' + clean.slice(1)
  if (clean.startsWith('62')) {
    return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`
  }
  return rawPhone
}

export const DEFAULT_WAHA_BASE_URL = 'https://blast.sukashawarma.com'
export const DEFAULT_WAHA_SESSION = 'HR'
export const DEFAULT_WAHA_API_KEY = 'waha_sukashawarma_secret_2026'

export function getWahaConfig(config?: {
  baseUrl?: string
  session?: string
  apiKey?: string
}) {
  const targetBaseUrl = (
    config?.baseUrl ||
    process.env.WAHA_BASE_URL ||
    process.env.NEXT_PUBLIC_WAHA_BASE_URL ||
    DEFAULT_WAHA_BASE_URL
  ).replace(/\/+$/, '')

  const targetSession =
    config?.session ||
    process.env.WAHA_SESSION ||
    DEFAULT_WAHA_SESSION

  const targetApiKey =
    config?.apiKey ||
    process.env.WAHA_API_KEY ||
    DEFAULT_WAHA_API_KEY

  return { targetBaseUrl, targetSession, targetApiKey }
}

/**
 * Anti-Spam: Simulate "typing..." presence on WhatsApp before sending message
 */
export async function sendWahaTypingPresence({
  chatId,
  session,
  baseUrl,
  apiKey,
}: {
  chatId: string
  session?: string
  baseUrl?: string
  apiKey?: string
}) {
  try {
    const { targetBaseUrl, targetSession, targetApiKey } = getWahaConfig({ baseUrl, session, apiKey })
    const endpoint = `${targetBaseUrl}/api/startTyping`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (targetApiKey) {
      headers['X-Api-Key'] = targetApiKey
      headers['Authorization'] = `Bearer ${targetApiKey}`
    }
    await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ session: targetSession, chatId }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {})
  } catch {
    // Ignore presence errors, fail-safe
  }
}

/**
 * Anti-Spam: Stop typing indicator
 */
export async function sendWahaStopTyping({
  chatId,
  session,
  baseUrl,
  apiKey,
}: {
  chatId: string
  session?: string
  baseUrl?: string
  apiKey?: string
}) {
  try {
    const { targetBaseUrl, targetSession, targetApiKey } = getWahaConfig({ baseUrl, session, apiKey })
    const endpoint = `${targetBaseUrl}/api/stopTyping`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (targetApiKey) {
      headers['X-Api-Key'] = targetApiKey
      headers['Authorization'] = `Bearer ${targetApiKey}`
    }
    await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ session: targetSession, chatId }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {})
  } catch {
    // Ignore presence errors, fail-safe
  }
}

/**
 * Send a single WhatsApp text message via WAHA with anti-spam protections
 */
export async function sendWahaText({
  phone,
  text,
  session,
  baseUrl,
  apiKey,
  simulateTyping = true,
}: WahaSendTextParams): Promise<WahaSendResult> {
  const { targetBaseUrl, targetSession, targetApiKey } = getWahaConfig({ baseUrl, session, apiKey })

  const chatId = formatPhoneToWahaChatId(phone)
  if (!chatId) {
    return {
      success: false,
      phone,
      error: 'Nomor WhatsApp tidak valid atau kosong',
    }
  }

  // Anti-Spam Layer: Simulate human typing indicator (1.2s - 1.8s)
  if (simulateTyping) {
    await sendWahaTypingPresence({
      chatId,
      session: targetSession,
      baseUrl: targetBaseUrl,
      apiKey: targetApiKey,
    })
    await new Promise((r) => setTimeout(r, 1200 + Math.floor(Math.random() * 600)))
  }

  try {
    const endpoint = `${targetBaseUrl.replace(/\/+$/, '')}/api/sendText`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (targetApiKey) {
      headers['X-Api-Key'] = targetApiKey
      headers['Authorization'] = `Bearer ${targetApiKey}`
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: targetSession,
        chatId,
        text,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return {
        success: false,
        phone,
        error: `WAHA Error HTTP ${res.status}: ${errBody || res.statusText}`,
      }
    }

    const data = await res.json().catch(() => ({}))
    return {
      success: true,
      phone,
      messageId: data?.id || data?.messageId || 'SENT',
    }
  } catch (err: any) {
    return {
      success: false,
      phone,
      error: err.name === 'TimeoutError' ? 'Koneksi ke WAHA timeout (15s)' : (err.message || 'Gagal menghubungi server WAHA'),
    }
  } finally {
    if (simulateTyping) {
      sendWahaStopTyping({
        chatId,
        session: targetSession,
        baseUrl: targetBaseUrl,
        apiKey: targetApiKey,
      }).catch(() => {})
    }
  }
}

/**
 * Send a document or media file (e.g. PDF salary slip) via WAHA POST /api/sendFile
 */
export async function sendWahaFile({
  phone,
  fileBase64,
  filename,
  mimetype = 'application/pdf',
  caption,
  session,
  baseUrl,
  apiKey,
}: WahaSendFileParams): Promise<WahaSendResult> {
  const { targetBaseUrl, targetSession, targetApiKey } = getWahaConfig({ baseUrl, session, apiKey })

  const chatId = formatPhoneToWahaChatId(phone)
  if (!chatId) {
    return {
      success: false,
      phone,
      error: 'Nomor WhatsApp tidak valid atau kosong',
    }
  }

  // WAHA WebJS engine uses window.WWebJS.mediaInfoToFile which decodes via atob(data).
  // atob() strictly requires raw base64 string (without "data:...;base64," prefix).
  let cleanBase64 = fileBase64
  if (cleanBase64.includes('base64,')) {
    cleanBase64 = cleanBase64.split('base64,')[1]
  }

  try {
    const endpoint = `${targetBaseUrl}/api/sendFile`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (targetApiKey) {
      headers['X-Api-Key'] = targetApiKey
      headers['Authorization'] = `Bearer ${targetApiKey}`
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: targetSession,
        chatId,
        file: {
          mimetype,
          filename,
          data: cleanBase64,
        },
        caption: caption || '',
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return {
        success: false,
        phone,
        error: `WAHA Error HTTP ${res.status}: ${errBody || res.statusText}`,
      }
    }

    const data = await res.json().catch(() => ({}))
    return {
      success: true,
      phone,
      messageId: data?.id || data?.messageId || 'SENT',
    }
  } catch (err: any) {
    return {
      success: false,
      phone,
      error: err.name === 'TimeoutError' ? 'Koneksi ke WAHA timeout (30s)' : (err.message || 'Gagal mengirim file via WAHA'),
    }
  }
}

/**
 * Check WAHA session health/status
 */
export async function checkWahaSessionStatus(
  baseUrl?: string,
  session?: string,
  apiKey?: string
): Promise<WahaSessionStatus> {
  const { targetBaseUrl, targetSession, targetApiKey } = getWahaConfig({ baseUrl, session, apiKey })

  try {
    const endpoint = `${targetBaseUrl}/api/sessions/${targetSession}`
    const headers: Record<string, string> = {}
    if (targetApiKey) {
      headers['X-Api-Key'] = targetApiKey
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return {
        online: false,
        session: targetSession,
        status: `HTTP ${res.status}`,
        error: `Server WAHA merespons status ${res.status}`,
      }
    }

    const data = await res.json().catch(() => ({}))
    const isWorking = data.status === 'WORKING'

    return {
      online: isWorking,
      session: targetSession,
      status: data.status || (isWorking ? 'WORKING' : 'ONLINE'),
      phone: data.me?.id ? data.me.id.split('@')[0] : undefined,
      pushName: data.me?.pushName || undefined,
      engine: data.engine?.engine || undefined,
      state: data.engine?.state || undefined,
    }
  } catch (err: any) {
    return {
      online: false,
      session: targetSession,
      status: 'OFFLINE',
      error: err.message || 'Tidak dapat terhubung ke server WAHA',
    }
  }
}

/**
 * Restart WAHA session
 */
export async function restartWahaSession(
  baseUrl?: string,
  session?: string,
  apiKey?: string
): Promise<{ success: boolean; message: string }> {
  const { targetBaseUrl, targetSession, targetApiKey } = getWahaConfig({ baseUrl, session, apiKey })

  try {
    const endpoint = `${targetBaseUrl}/api/sessions/${targetSession}/restart`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (targetApiKey) {
      headers['X-Api-Key'] = targetApiKey
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      return { success: false, message: `Gagal restart sesi: ${err || res.statusText}` }
    }

    return { success: true, message: `Sesi ${targetSession} berhasil direstart.` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal menghubungi server WAHA' }
  }
}

/**
 * Get live screenshot from WAHA (useful to see QR code or WhatsApp Web status)
 */
export async function getWahaScreenshot(
  baseUrl?: string,
  session?: string,
  apiKey?: string
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  const { targetBaseUrl, targetSession, targetApiKey } = getWahaConfig({ baseUrl, session, apiKey })

  try {
    const endpoint = `${targetBaseUrl}/api/screenshot?session=${targetSession}`
    const headers: Record<string, string> = {}
    if (targetApiKey) {
      headers['X-Api-Key'] = targetApiKey
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return { success: false, error: `Gagal mengambil screenshot (HTTP ${res.status})` }
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    return { success: true, dataUrl: `data:${contentType};base64,${base64}` }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengambil screenshot WAHA' }
  }
}
