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
  session: string
  baseUrl: string
  apiKey?: string
}) {
  try {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/startTyping`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) {
      headers['X-Api-Key'] = apiKey
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ session, chatId }),
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
  const targetBaseUrl =
    baseUrl ||
    process.env.WAHA_BASE_URL ||
    process.env.NEXT_PUBLIC_WAHA_BASE_URL ||
    'http://localhost:3008'

  const targetSession = session || process.env.WAHA_SESSION || 'default'
  const targetApiKey = apiKey || process.env.WAHA_API_KEY || ''

  const chatId = formatPhoneToWahaChatId(phone)
  if (!chatId) {
    return {
      success: false,
      phone,
      error: 'Nomor WhatsApp tidak valid atau kosong',
    }
  }

  // Anti-Spam Layer: Simulate human typing indicator (500ms)
  if (simulateTyping) {
    await sendWahaTypingPresence({
      chatId,
      session: targetSession,
      baseUrl: targetBaseUrl,
      apiKey: targetApiKey,
    })
    await new Promise((r) => setTimeout(r, 600))
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
  const targetBaseUrl =
    baseUrl ||
    process.env.WAHA_BASE_URL ||
    process.env.NEXT_PUBLIC_WAHA_BASE_URL ||
    'http://localhost:3008'
  const targetSession = session || process.env.WAHA_SESSION || 'default'
  const targetApiKey = apiKey || process.env.WAHA_API_KEY || ''

  try {
    const endpoint = `${targetBaseUrl.replace(/\/+$/, '')}/api/sessions/${targetSession}`
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
    const isWorking = data.status === 'WORKING' || data.status === 'STARTING' || data.status === 'SCAN_QR_CODE'

    return {
      online: isWorking,
      session: targetSession,
      status: data.status || 'ONLINE',
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
