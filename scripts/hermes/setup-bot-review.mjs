#!/usr/bin/env node
/**
 * ==============================================================================
 * setup-bot-review.mjs — Skrip Otomatisasi Setting Bot Telegram SukaReview
 * ==============================================================================
 * Dijalankan via:
 *   node scripts/hermes/setup-bot-review.mjs [TOKEN_BOT]
 *   atau: yarn workspace @suka/bot setup:bot:review
 *
 * Tugas Otomatis:
 * 1. Mendaftarkan Webhook Telegram ke https://agents.sukashawarma.com/api/telegram/review/webhook
 * 2. Mendaftarkan Menu Perintah (Slash Commands) Intelijen Ulasan & Kepuasan Pelanggan
 * 3. Memeriksa status Webhook di server Telegram (getWebhookInfo)
 * ==============================================================================
 */

import readline from 'node:readline'

const WEBHOOK_URL = 'https://agents.sukashawarma.com/api/telegram/review/webhook'

const REVIEW_COMMANDS = [
  { command: 'start', description: 'Mulai bot & aktivasi akun SukaReview' },
  { command: 'help', description: 'Panduan & 6 trigger alert ulasan pelanggan' },
  { command: 'rating', description: 'Leaderboard & skor rating Google cabang' },
  { command: 'negatif', description: 'Ulasan negatif bintang 1-2 & keluhan kritis' },
  { command: 'alert', description: 'Status peringatan aktif lonjakan komplain' },
  { command: 'rekap', description: 'Rekapitulasi sentimen ulasan & topik keluhan' },
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
  console.log('   ⭐ OTOMATISASI SETUP BOT SUKAREVIEW SUKA SHAWARMA   ')
  console.log('======================================================\n')

  let token = process.argv[2] || process.env.TELEGRAM_REVIEW_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    token = await tanya(rl, '👉 Masukkan Token Bot Telegram Review dari @BotFather: ')
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
      body: JSON.stringify({ commands: REVIEW_COMMANDS }),
    })
    const cmdJson = await cmdRes.json()
    if (cmdJson.ok) {
      console.log('      ✅ Menu Slash Commands BERHASIL didaftarkan ke Telegram:')
      REVIEW_COMMANDS.forEach((c) => {
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
    console.log('   🎉 SETUP BOT SUKAREVIEW SELESAI!')
    console.log('======================================================\n')
    console.log('Langkah berikutnya:')
    console.log('1. Pastikan TELEGRAM_REVIEW_BOT_TOKEN dan TELEGRAM_REVIEW_SEND_SECRET disetel di Coolify apps/bot')
    console.log('2. Buka bot di Telegram, ketik /start untuk mencoba.')
    console.log('3. Staf/Admin dapat didaftarkan di Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram.\n')
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan jaringan saat setup bot:', err.message)
    process.exit(1)
  }
}

main()
