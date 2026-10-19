#!/usr/bin/env node
/**
 * ==============================================================================
 * daftarkan-commands.mjs — Mendaftarkan Menu Slash Command ke Telegram Bot API
 * ==============================================================================
 * Penggunaan:
 *   node scripts/hermes/daftarkan-commands.mjs [TOKEN_BOT]
 *
 * Contoh:
 *   node scripts/hermes/daftarkan-commands.mjs 123456789:ABCdefGhIJKlm...
 * ==============================================================================
 */

import readline from 'node:readline'

const DAFTAR_COMMANDS = [
  { command: 'start', description: 'Mulai bot & aktivasi akun' },
  { command: 'help', description: 'Panduan & 10 trigger alert operasional' },
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
  console.log('   📋 DAFTARKAN MENU SLASH COMMANDS TELEGRAM BOT     ')
  console.log('======================================================\n')

  let token = process.argv[2] || process.env.TELEGRAM_MANAGER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN

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

  console.log('\n📡 Mengirim perintah setMyCommands ke Telegram Bot API...')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: DAFTAR_COMMANDS }),
    })

    const json = await res.json()

    if (!json.ok) {
      console.error(`\n❌ Gagal mendaftarkan commands: ${json.description || 'Unknown error'}`)
      process.exit(1)
    }

    console.log('\n✅ BERHASIL! Menu slash commands telah aktif di Telegram:')
    DAFTAR_COMMANDS.forEach((c) => {
      console.log(`   • /${c.command} - ${c.description}`)
    })
    console.log('\nSilakan buka aplikasi Telegram Anda. Saat mengetik "/", menu opsi akan langsung muncul!\n')
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan jaringan:', err.message)
    process.exit(1)
  }
}

main()
