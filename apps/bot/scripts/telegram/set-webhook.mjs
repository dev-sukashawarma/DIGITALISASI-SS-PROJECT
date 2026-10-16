const token = process.env.TELEGRAM_STOKIST_BOT_TOKEN
const secret = process.env.TELEGRAM_STOKIST_WEBHOOK_SECRET
const baseUrl = (process.env.TELEGRAM_STOKIST_WEBHOOK_URL || 'https://agents.sukashawarma.com').replace(/\/$/, '')

if (!token || !secret) {
  console.error('Set TELEGRAM_STOKIST_BOT_TOKEN dan TELEGRAM_STOKIST_WEBHOOK_SECRET terlebih dahulu.')
  process.exit(1)
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error('TELEGRAM_STOKIST_WEBHOOK_SECRET harus 1–256 karakter: huruf, angka, _ atau -.')
  process.exit(1)
}
if (!baseUrl.startsWith('https://')) {
  console.error('TELEGRAM_STOKIST_WEBHOOK_URL harus HTTPS publik.')
  process.exit(1)
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: `${baseUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false,
  }),
})
const result = await response.json()
if (!response.ok || !result.ok) {
  console.error(`setWebhook gagal (${response.status}): ${result.description || 'unknown error'}`)
  process.exit(1)
}

const commands = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ commands: [
    { command: 'start', description: 'Hubungkan akun Stokist' },
    { command: 'help', description: 'Bantuan bot Stokist' },
    { command: 'stop', description: 'Berhenti menerima alert' },
  ] }),
})
const commandsResult = await commands.json()
if (!commands.ok || !commandsResult.ok) {
  console.error(`setMyCommands gagal (${commands.status}): ${commandsResult.description || 'unknown error'}`)
  process.exit(1)
}
console.log(`Webhook bot Stokist aktif di ${baseUrl}/api/telegram/webhook`)
