'use server'

import { sendWahaText, checkWahaSessionStatus } from '@/lib/waha'
import { buildSalarySlipWhatsAppMessage } from '@/lib/pdfSalarySlip'
import type { PayrollRecord } from '@/lib/types'

export interface BulkSendItemResult {
  recordId: string
  staffName: string
  phone: string
  success: boolean
  error?: string
  messageId?: string
}

export interface BulkSendSummary {
  total: number
  successCount: number
  failedCount: number
  results: BulkSendItemResult[]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Returns a random integer between min and max (inclusive) for natural human jitter delay
 */
function getRandomJitter(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

/**
 * Server Action: Broadcast salary slips via WAHA with 4-Layer Anti-Spam Protections
 */
export async function sendBulkWahaSalarySlips(
  records: PayrollRecord[],
  options?: {
    customHeaderNote?: string
    minDelayMs?: number // default 1500ms
    maxDelayMs?: number // default 3500ms
    batchSize?: number // pause every N messages (default 10)
    batchCooldownMs?: number // cooldown pause duration (default 5000ms)
    baseUrl?: string
    session?: string
    apiKey?: string
  }
): Promise<BulkSendSummary> {
  const minDelay = options?.minDelayMs ?? 1500
  const maxDelay = options?.maxDelayMs ?? 3500
  const batchSize = options?.batchSize ?? 10
  const batchCooldown = options?.batchCooldownMs ?? 5000

  const results: BulkSendItemResult[] = []
  let successCount = 0
  let failedCount = 0

  for (let i = 0; i < records.length; i++) {
    const slip = records[i]
    const staffName = slip.outlet_staff?.name || 'Karyawan'
    const phone = slip.outlet_staff?.phone || ''

    // Layer 1: Validasi nomor WA sebelum hit API (hindari spamming invalid payload)
    if (!phone) {
      failedCount++
      results.push({
        recordId: slip.id,
        staffName,
        phone: '-',
        success: false,
        error: 'Nomor WhatsApp staf belum terdaftar di database',
      })
      continue
    }

    // Layer 2: Pesan 100% unik per individu (Nama, NIK/ID, Rincian Komponen, Timestamp)
    let messageText = buildSalarySlipWhatsAppMessage(slip)
    if (options?.customHeaderNote) {
      messageText = `📢 *Pemberitahuan HR:*\n${options.customHeaderNote.trim()}\n\n` + messageText
    }

    // Layer 3: Simulasi mengetik (typing presence) + Pengiriman via WAHA
    const res = await sendWahaText({
      phone,
      text: messageText,
      baseUrl: options?.baseUrl,
      session: options?.session,
      apiKey: options?.apiKey,
      simulateTyping: true,
    })

    if (res.success) {
      successCount++
      results.push({
        recordId: slip.id,
        staffName,
        phone,
        success: true,
        messageId: res.messageId,
      })
    } else {
      failedCount++
      results.push({
        recordId: slip.id,
        staffName,
        phone,
        success: false,
        error: res.error || 'Gagal mengirim pesan',
      })
    }

    // Layer 4: Batch Cooldown & Natural Random Jitter Delay
    if (i < records.length - 1) {
      // Jeda istirahat panjang tiap kelipatan batchSize (mis. tiap 10 pesan istirahat 5 detik)
      if ((i + 1) % batchSize === 0) {
        await sleep(batchCooldown)
      } else {
        // Jeda acak manusiawi (1.5s - 3.5s)
        const jitter = getRandomJitter(minDelay, maxDelay)
        await sleep(jitter)
      }
    }
  }

  return {
    total: records.length,
    successCount,
    failedCount,
    results,
  }
}

/**
 * Server Action: Check if WAHA endpoint is reachable
 */
export async function getWahaStatus(config?: {
  baseUrl?: string
  session?: string
  apiKey?: string
}) {
  return await checkWahaSessionStatus(config?.baseUrl, config?.session, config?.apiKey)
}
