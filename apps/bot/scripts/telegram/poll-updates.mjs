const token = process.env.TELEGRAM_STOKIST_BOT_TOKEN
const secret = process.env.TELEGRAM_STOKIST_WEBHOOK_SECRET
const appUrl = process.env.TELEGRAM_STOKIST_INTERNAL_URL || 'http://127.0.0.1:3000'

if (!token || !secret) {
  console.error('[stokist] Polling tidak dimulai: TELEGRAM_STOKIST_BOT_TOKEN dan TELEGRAM_STOKIST_WEBHOOK_SECRET wajib diisi.')
  process.exit(1)
}

const api = `https://api.telegram.org/bot${token}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function telegram(method, body) {
  const response = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.ok !== true) {
    throw new Error(`${method} gagal (${response.status}): ${result?.description || 'respons tidak valid'}`)
  }
  return result.result
}

async function mulai() {
  // Telegram hanya mengizinkan satu cara menerima update untuk satu bot.
  // Hapus webhook lama dan pertahankan antrean update yang belum diproses.
  await telegram('deleteWebhook', { drop_pending_updates: false })
  await telegram('setMyCommands', { commands: [
    { command: 'start', description: 'Hubungkan akun Stokist' },
    { command: 'help', description: 'Bantuan bot Stokist' },
    { command: 'stop', description: 'Berhenti menerima alert' },
  ] })
  console.log('[stokist] Telegram polling aktif.')

  let offset
  let retryMs = 1_000
  while (!process.exitCode) {
    try {
      const updates = await telegram('getUpdates', {
        ...(offset === undefined ? {} : { offset }),
        timeout: 30,
        allowed_updates: ['message'],
      })
      retryMs = 1_000

      for (const update of updates) {
        const response = await fetch(`${appUrl}/api/telegram/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-bot-api-secret-token': secret,
          },
          body: JSON.stringify(update),
          signal: AbortSignal.timeout(70_000),
        })
        if (!response.ok) {
          console.error(`[stokist] Update ${update.update_id} belum diproses (HTTP ${response.status}); akan dicoba ulang.`)
          break
        }
        offset = update.update_id + 1
      }
    } catch (error) {
      console.error(`[stokist] Koneksi polling terganggu: ${error instanceof Error ? error.message : 'error tidak diketahui'}`)
      await sleep(retryMs)
      retryMs = Math.min(retryMs * 2, 30_000)
    }
  }
}

mulai().catch((error) => {
  console.error(`[stokist] Polling gagal dimulai: ${error instanceof Error ? error.message : 'error tidak diketahui'}`)
  process.exitCode = 1
})
