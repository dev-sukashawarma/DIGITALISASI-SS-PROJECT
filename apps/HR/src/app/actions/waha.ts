'use server'

import { sendWahaText, sendWahaFile, checkWahaSessionStatus } from '@/lib/waha'
import { buildSalarySlipWhatsAppMessage, buildSalarySlipCoverNote } from '@/lib/whatsappSalarySlip'
import { MONTH_NAMES } from '@/lib/format'
import type { PayrollRecord } from '@/lib/types'

export interface BulkSendItemResult {
  recordId: string
  staffName: string
  phone: string
  success: boolean
  error?: string
  warning?: string
  pdfSent?: boolean
  messageId?: string
}

export interface SingleWahaSendResult {
  success: boolean
  textSuccess: boolean
  pdfSuccess?: boolean
  error?: string
  warning?: string
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
 * Server Action: Broadcast salary slips via WAHA with 4-Layer Anti-Spam Protections + Optional PDF attachments
 */
export async function sendBulkWahaSalarySlips(
  records: PayrollRecord[],
  options?: {
    customHeaderNote?: string
    sendPdfFile?: boolean // default: true
    minDelayMs?: number // default 3500ms
    maxDelayMs?: number // default 7000ms
    batchSize?: number // pause every N messages (default 8)
    batchCooldownMs?: number // cooldown pause duration (default 20000ms)
    baseUrl?: string
    session?: string
    apiKey?: string
  }
): Promise<BulkSendSummary> {
  const minDelay = options?.minDelayMs ?? 3500
  const maxDelay = options?.maxDelayMs ?? 7000
  const batchSize = options?.batchSize ?? 8
  const batchCooldown = options?.batchCooldownMs ?? 20000
  const shouldSendPdf = options?.sendPdfFile ?? true

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

    // Layer 2: Pesan teks (Cover note ringkas jika lampirkan PDF, rincian penuh jika teks saja)
    let messageText = shouldSendPdf
      ? buildSalarySlipCoverNote(slip)
      : buildSalarySlipWhatsAppMessage(slip)

    if (options?.customHeaderNote) {
      messageText = `📢 *Pemberitahuan HR:*\n${options.customHeaderNote.trim()}\n\n` + messageText
    }

    // Layer 3: Simulasi mengetik (typing presence) + Pengiriman Pesan via WAHA
    const res = await sendWahaText({
      phone,
      text: messageText,
      baseUrl: options?.baseUrl,
      session: options?.session,
      apiKey: options?.apiKey,
      simulateTyping: true,
    })

    if (res.success) {
      // Lampirkan Dokumen PDF Resmi (A5) jika opsi aktif
      if (shouldSendPdf) {
        let pdfSent = false
        let pdfErrorMsg: string | undefined = undefined

        try {
          const { generateSalarySlipPdfBase64 } = await import('@/lib/pdfSalarySlip')
          const { base64, filename } = await generateSalarySlipPdfBase64(slip)

          // Jeda natural sebelum kirim file lampiran
          await sleep(1500)

          const monthName = MONTH_NAMES[slip.period_month - 1] || slip.period_month
          const fileRes = await sendWahaFile({
            phone,
            fileBase64: base64,
            filename,
            caption: `📄 Dokumen Resmi Slip Gaji — ${staffName} (${monthName} ${slip.period_year})`,
            baseUrl: options?.baseUrl,
            session: options?.session,
            apiKey: options?.apiKey,
          })

          if (!fileRes.success) {
            pdfSent = false
            pdfErrorMsg = fileRes.error
            console.warn(`[WAHA] Lampiran PDF gagal terkirim untuk ${staffName}: ${fileRes.error}`)
          } else {
            pdfSent = true
          }
        } catch (pdfErr: any) {
          pdfSent = false
          pdfErrorMsg = pdfErr.message
          console.error(`[WAHA] Gagal generate PDF untuk ${staffName}:`, pdfErr)
        }

        if (pdfSent) {
          successCount++
          results.push({
            recordId: slip.id,
            staffName,
            phone,
            success: true,
            pdfSent: true,
            messageId: res.messageId,
          })
        } else {
          failedCount++
          results.push({
            recordId: slip.id,
            staffName,
            phone,
            success: false,
            pdfSent: false,
            error: `Pesan teks terkirim, namun PDF gagal: ${pdfErrorMsg || 'Gagal lampirkan dokumen'}`,
            warning: `Pesan teks terkirim, namun PDF gagal: ${pdfErrorMsg || 'Gagal lampirkan dokumen'}`,
            messageId: res.messageId,
          })
        }
      } else {
        successCount++
        results.push({
          recordId: slip.id,
          staffName,
          phone,
          success: true,
          pdfSent: false,
          messageId: res.messageId,
        })
      }
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
      if ((i + 1) % batchSize === 0) {
        await sleep(batchCooldown)
      } else {
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
 * Server Action: Kirim satu slip gaji individual via WAHA (+ Dokumen PDF)
 */
export async function sendSingleWahaSalarySlip(
  slip: PayrollRecord,
  options?: {
    customHeaderNote?: string
    sendPdfFile?: boolean // default: true
    baseUrl?: string
    session?: string
    apiKey?: string
  }
): Promise<SingleWahaSendResult> {
  const phone = slip.outlet_staff?.phone || ''
  if (!phone) {
    return { success: false, textSuccess: false, error: 'Nomor WhatsApp staf belum terdaftar di database' }
  }

  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const shouldSendPdf = options?.sendPdfFile ?? true
  let messageText = shouldSendPdf
    ? buildSalarySlipCoverNote(slip)
    : buildSalarySlipWhatsAppMessage(slip)

  if (options?.customHeaderNote) {
    messageText = `📢 *Pemberitahuan HR:*\n${options.customHeaderNote.trim()}\n\n` + messageText
  }

  const textRes = await sendWahaText({
    phone,
    text: messageText,
    baseUrl: options?.baseUrl,
    session: options?.session,
    apiKey: options?.apiKey,
    simulateTyping: true,
  })

  if (!textRes.success) {
    return { success: false, textSuccess: false, error: textRes.error }
  }

  if (shouldSendPdf) {
    try {
      const { generateSalarySlipPdfBase64 } = await import('@/lib/pdfSalarySlip')
      const { base64, filename } = await generateSalarySlipPdfBase64(slip)

      // Jeda natural sebelum kirim file lampiran
      await sleep(1500)

      const monthName = MONTH_NAMES[slip.period_month - 1] || slip.period_month
      const fileRes = await sendWahaFile({
        phone,
        fileBase64: base64,
        filename,
        caption: `📄 Dokumen Resmi Slip Gaji — ${staffName} (${monthName} ${slip.period_year})`,
        baseUrl: options?.baseUrl,
        session: options?.session,
        apiKey: options?.apiKey,
      })

      if (!fileRes.success) {
        console.error(`[WAHA] PDF send failed for single slip ${staffName}:`, fileRes.error)
        return {
          success: false,
          textSuccess: true,
          pdfSuccess: false,
          error: `Pesan teks berhasil, namun PDF gagal terkirim: ${fileRes.error}`,
          warning: `Pesan teks berhasil, namun PDF gagal terkirim: ${fileRes.error}`,
          messageId: textRes.messageId,
        }
      }
    } catch (err: any) {
      console.warn(`[WAHA] PDF generate failed for single slip ${staffName}:`, err)
      return {
        success: false,
        textSuccess: true,
        pdfSuccess: false,
        error: `Pesan teks berhasil, namun PDF gagal diproses: ${err.message}`,
        warning: `Pesan teks berhasil, namun PDF gagal diproses: ${err.message}`,
        messageId: textRes.messageId,
      }
    }
  }

  return {
    success: true,
    textSuccess: true,
    pdfSuccess: shouldSendPdf ? true : undefined,
    messageId: textRes.messageId,
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

/**
 * Server Action: Send a single test message
 */
export async function testSendWahaMessage(params: {
  phone: string
  text: string
  baseUrl?: string
  session?: string
  apiKey?: string
}) {
  return await sendWahaText({
    phone: params.phone,
    text: params.text,
    baseUrl: params.baseUrl,
    session: params.session,
    apiKey: params.apiKey,
    simulateTyping: true,
  })
}
