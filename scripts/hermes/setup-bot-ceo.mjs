#!/usr/bin/env node
/**
 * ==============================================================================
 * setup-bot-ceo.mjs — Skrip Otomatisasi Setting Bot Telegram CEO (J.A.R.V.I.S.)
 * ==============================================================================
 * Dijalankan via:
 *   node scripts/hermes/setup-bot-ceo.mjs [TOKEN_BOT]
 *
 * Tugas Otomatis:
 * 1. Mendaftarkan Webhook Telegram ke https://agents.sukashawarma.com/api/telegram/ceo/webhook
 * 2. Mendaftarkan Menu Perintah (Slash Commands) Eksekutif J.A.R.V.I.S.
 * 3. Memeriksa status Webhook di server Telegram (getWebhookInfo)
 * ==============================================================================
 */

import readline from 'node:readline'

const WEBHOOK_URL = 'https://agents.sukashawarma.com/api/telegram/ceo/webhook'

const CEO_COMMANDS = [
  { command: 'start', description: 'Mulai bot & aktivasi akun eksekutif' },
  { command: 'help', description: 'Panduan & ringkasan komando eksekutif' },
  { command: 'omzet', description: 'Omzet & ranking cabang hari ini' },
  { command: 'kemarin', description: 'Evaluasi & ranking cabang kemarin' },
  { command: 'buka', description: 'Cek cabang buka & belum transaksi' },
  { command: 'absensi', description: 'Presensi kru & staf operasional' },
  { command: 'stok', description: 'Status stok gudang pusat & outlet' },
  { command: 'finance', description: 'Rekonsiliasi kas & arus keuangan' },
  { command: 'status', description: 'Executive daily briefing & sistem' },
  { command: 'new', description: 'Mulai sesi percakapan baru' },
  { command: 'id', description: 'Lihat ID & info akun Telegram' },
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
  console.log('   🤖 OTOMATISASI SETUP BOT CEO J.A.R.V.I.S.          ')
  console.log('======================================================\n')

  let token = process.argv[2] || process.env.TELEGRAM_CEO_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN

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

    console.log('\n[2/3] 📋 Mendaftarkan Menu Perintah (Slash Commands) Eksekutif...')
    const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: CEO_COMMANDS }),
    })
    const cmdJson = await cmdRes.json()
    if (cmdJson.ok) {
      console.log('      ✅ Menu Slash Commands Eksekutif BERHASIL didaftarkan:')
      CEO_COMMANDS.forEach((c) => {
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
    console.log('   🎉 SETUP BOT CEO TELEGRAM BERHASIL 100%!           ')
    console.log('======================================================')
    console.log('\nLangkah selanjutnya:')
    console.log('1. Buka Bot Telegram di HP Anda dan ketik /start')
    console.log('2. Buka Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram untuk mengelola whitelist atau tautan undangan.')
    console.log('3. Saat mengetik "/", menu komando eksekutif akan langsung muncul otomatis!\n')
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan jaringan:', err.message)
    process.exit(1)
  }
}

main()
