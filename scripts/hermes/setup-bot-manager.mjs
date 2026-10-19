#!/usr/bin/env node
/**
 * ==============================================================================
 * setup-bot-manager.mjs — Skrip Otomatisasi Setting Bot Telegram Manager
 * ==============================================================================
 * Dijalankan via:
 *   node scripts/hermes/setup-bot-manager.mjs [TOKEN_BOT]
 *
 * Tugas Otomatis:
 * 1. Mendaftarkan Webhook Telegram ke https://agents.sukashawarma.com/api/telegram/manager/webhook
 * 2. Memeriksa status Webhook di server Telegram (getWebhookInfo)
 * 3. Menampilkan daftar link aktivasi Telegram untuk AM & RM siap kirim ke WhatsApp
 * ==============================================================================
 */

import readline from 'node:readline'

const WEBHOOK_URL = 'https://agents.sukashawarma.com/api/telegram/manager/webhook'

function tanya(rl, pertanyaan) {
  return new Promise((resolve) => {
    rl.question(pertanyaan, (jawaban) => {
      resolve(jawaban.trim())
    })
  })
}

async function main() {
  console.log('\n======================================================')
  console.log('   🤖 OTOMATISASI SETUP BOT MANAGER SUKA SHAWARMA     ')
  console.log('======================================================\n')

  let token = process.argv[2] || process.env.TELEGRAM_MANAGER_BOT_TOKEN

  if (!token) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    token = await tanya(rl, '👉 Masukkan Token Bot Telegram dari @BotFather: ')
    rl.close()
  }

  if (!token || !/^\d{8,12}:[A-Za-z0-9_-]{30,50}$/.test(token)) {
    console.error('\n❌ Format token bot Telegram tidak valid. Contoh format: 7123456789:AAFnk...')
    process.exit(1)
  }

  console.log('\n[1/2] 📡 Mendaftarkan Webhook ke Telegram API...')
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
    const commandsPayload = {
      commands: [
        { command: 'start', description: 'Mulai bot & aktivasi akun' },
        { command: 'help', description: 'Panduan & 10 trigger alert operasional' },
        { command: 'new', description: 'Mulai sesi percakapan baru' },
        { command: 'id', description: 'Lihat ID & info akun Telegram' },
      ],
    }
    const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commandsPayload),
    })
    const cmdJson = await cmdRes.json()
    if (cmdJson.ok) {
      console.log('      ✅ Menu Slash Commands BERHASIL didaftarkan ke Telegram!')
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
    console.log('   🎉 SETUP BOT TELEGRAM BERHASIL 100%!               ')
    console.log('======================================================')
    console.log('\nLangkah selanjutnya:')
    console.log('1. Push perubahan kode ke branch main (GitHub Actions otomatis deploy ke Coolify):')
    console.log('   git add . && git commit -m "feat(bot): add manager telegram webhook and activation" && git push origin main')
    console.log('\n2. Minta AM & RM klik link aktivasi masing-masing (dihasilkan dari SQL query).')
    console.log('   Begitu staf klik START di Telegram, akun langsung aktif otomatis!\n')
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan jaringan:', err.message)
    process.exit(1)
  }
}

main()
