#!/usr/bin/env node
/**
 * ==============================================================================
 * setup-bot-finance.mjs — Skrip Otomatisasi Setting Bot Telegram Finance
 * ==============================================================================
 * Dijalankan via:
 *   node scripts/hermes/setup-bot-finance.mjs [TOKEN_BOT]
 *
 * Tugas Otomatis:
 * 1. Mendaftarkan Webhook Telegram ke https://agents.sukashawarma.com/api/telegram/finance/webhook
 * 2. Mendaftarkan Menu Perintah (Slash Commands) Operasional Keuangan
 * 3. Memeriksa status Webhook di server Telegram (getWebhookInfo)
 * ==============================================================================
 */

import readline from 'node:readline'

const WEBHOOK_URL = 'https://agents.sukashawarma.com/api/telegram/finance/webhook'

const FINANCE_COMMANDS = [
  { command: 'start', description: 'Mulai bot & aktivasi akun finance' },
  { command: 'help', description: 'Panduan & ringkasan operasional finance' },
  { command: 'utang', description: 'Tagihan & utang PO supplier jatuh tempo' },
  { command: 'pengeluaran', description: 'Pengeluaran kas kecil & operasional' },
  { command: 'setoran', description: 'Status pencatatan setoran kas cabang' },
  { command: 'selisih', description: 'Rekap selisih kasir tutup shift POS' },
  { command: 'new', description: 'Mulai sesi percakapan baru' },
  { command: 'id', description: 'Lihat ID & info akun Telegram Anda' },
]

function tanya(rl, pertanyaan) {
  return new Promise((resolve) => {
    rl.question(pertanyaan, (jawaban) => {
      resolve(jawaban.trim())
    })
  })
}

async function main() {
  console.log('\n======================================================')
  console.log('   💰 OTOMATISASI SETUP BOT FINANCE SUKA SHAWARMA     ')
  console.log('======================================================\n')

  let token = process.argv[2] || process.env.TELEGRAM_FINANCE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    token = await tanya(rl, '👉 Masukkan Token Bot Telegram Finance dari @BotFather: ')
    rl.close()
  }

  if (!token || !/^\d{8,12}:[A-Za-z0-9_-]{30,50}$/.test(token)) {
    console.error('\n❌ Format token bot Telegram tidak valid. Contoh format: 7123456789:AAFnk...')
    process.exit(1)
  }

  console.log('\n[1/3] 📡 Mendaftarkan Webhook ke Telegram API...')
  console.log(`      Target Webhook: ${WEBHOOK_URL}`)

  try {
    const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(WEBHOOK_URL)}&drop_pending_updates=true`
    const res = await fetch(setWebhookUrl)
    const json = await res.json()

    if (!json.ok) {
      console.error(`\n❌ Gagal mendaftarkan webhook: ${json.description || 'Unknown error'}`)
      process.exit(1)
    }

    console.log('      ✅ Webhook BERHASIL didaftarkan!')

    console.log('\n[2/3] 📋 Mendaftarkan Menu Perintah (Slash Commands)...')
    const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: FINANCE_COMMANDS }),
    })
    const cmdJson = await cmdRes.json()
    if (cmdJson.ok) {
      console.log('      ✅ Menu Slash Commands BERHASIL didaftarkan ke Telegram:')
      FINANCE_COMMANDS.forEach((c) => {
        console.log(`         • /${c.command} - ${c.description}`)
      })
    } else {
      console.log(`      ⚠️ Gagal daftarkan commands: ${cmdJson.description || 'Unknown'}`)
    }

    console.log('\n[3/3] 🔍 Memeriksa Status Webhook di Telegram...')
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const info = await infoRes.json()

    if (info.ok && info.result) {
      console.log(`      • URL Terdaftar     : ${info.result.url}`)
      console.log(`      • Custom Certificate: ${info.result.has_custom_certificate ? 'Ya' : 'Tidak (SSL Publik Standar)'}`)
      console.log(`      • Pending Updates   : ${info.result.pending_update_count || 0}`)
      if (info.result.last_error_message) {
        console.log(`      ⚠️ Catatan error terakhir: ${info.result.last_error_message}`)
      }
    }

    console.log('\n======================================================')
    console.log('   🎉 SETUP BOT FINANCE BERHASIL 100%!                ')
    console.log('======================================================')
    console.log('\nLangkah selanjutnya:')
    console.log('1. Pastikan TELEGRAM_FINANCE_BOT_TOKEN disetel di Coolify (environment runtime app Bot).')
    console.log('2. Buka Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram')
    console.log('   (https://admin.sukashawarma.com/dashboard/sistem/bot-telegram)')
    console.log('   Pilih "Bot Finance" lalu bagikan Tautan Undangan atau daftarkan ID Telegram staf finance.')
    console.log('3. Staf Finance atau Admin dapat langsung chat di Telegram atau klik /start!\n')
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan jaringan:', err.message)
    process.exit(1)
  }
}

main()
