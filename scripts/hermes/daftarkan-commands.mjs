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

const COMMANDS_MAP = {
  ceo: [
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
    { command: 'id', description: 'Lihat ID & info akun Telegram Anda' },
  ],
  manager: [
    { command: 'start', description: 'Mulai bot & aktivasi akun' },
    { command: 'help', description: 'Panduan & 10 trigger alert operasional' },
    { command: 'omzet', description: 'Cek omzet & ranking cabang hari ini' },
    { command: 'buka', description: 'Cek cabang buka & belum transaksi' },
    { command: 'absen', description: 'Presensi & kedisiplinan kru outlet' },
    { command: 'stok', description: 'Status stok opname & bahan baku' },
    { command: 'sidak', description: 'Kepatuhan ceklist & audit cabang' },
    { command: 'new', description: 'Mulai sesi percakapan baru' },
    { command: 'id', description: 'Lihat ID & info akun Telegram Anda' },
  ],
  hrd: [
    { command: 'start', description: 'Mulai bot & aktivasi akun' },
    { command: 'help', description: 'Panduan & alert SDM / HRD' },
    { command: 'absen', description: 'Presensi & keterlambatan hari ini' },
    { command: 'cuti', description: 'Pengajuan cuti & perizinan staf' },
    { command: 'kasbon', description: 'Monitoring kasbon aktif per cabang' },
    { command: 'new', description: 'Mulai sesi percakapan baru' },
    { command: 'id', description: 'Lihat ID & info akun Telegram Anda' },
  ],
  stokis: [
    { command: 'start', description: 'Mulai bot & aktivasi akun' },
    { command: 'help', description: 'Panduan & alert stok & distribusi' },
    { command: 'stok', description: 'Saldo stok bahan gudang & cabang' },
    { command: 'opname', description: 'Status kepatuhan stok opname' },
    { command: 'suratjalan', description: 'Status pengiriman logistik cabang' },
    { command: 'new', description: 'Mulai sesi percakapan baru' },
    { command: 'id', description: 'Lihat ID & info akun Telegram Anda' },
  ],
  finance: [
    { command: 'start', description: 'Mulai bot & aktivasi akun finance' },
    { command: 'help', description: 'Panduan & ringkasan operasional keuangan' },
    { command: 'utang', description: 'Tagihan & utang PO supplier jatuh tempo' },
    { command: 'pengeluaran', description: 'Pengeluaran kas kecil & operasional' },
    { command: 'setoran', description: 'Status pencatatan setoran kas cabang' },
    { command: 'selisih', description: 'Rekap selisih kasir tutup shift POS' },
    { command: 'new', description: 'Mulai sesi percakapan baru' },
    { command: 'id', description: 'Lihat ID & info akun Telegram Anda' },
  ],
}

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

  let botType = 'manager'
  let token = ''

  // Cek argumen --bot <nama>
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--bot' && process.argv[i + 1]) {
      botType = process.argv[i + 1].toLowerCase()
      i++
    } else if (!token && !process.argv[i].startsWith('--')) {
      token = process.argv[i]
    }
  }

  if (!token) {
    if (botType === 'ceo') {
      token = process.env.TELEGRAM_CEO_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    } else if (botType === 'finance') {
      token = process.env.TELEGRAM_FINANCE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    } else if (botType === 'hrd') {
      token = process.env.TELEGRAM_HRD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    } else if (botType === 'stokis') {
      token = process.env.TELEGRAM_STOKIST_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    } else {
      token = process.env.TELEGRAM_MANAGER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  if (!token) {
    token = await tanya(rl, '👉 Masukkan Token Bot Telegram dari @BotFather: ')
  }

  if (!process.argv.includes('--bot')) {
    const pilihanBot = await tanya(rl, '👉 Pilih profil bot (1: CEO / J.A.R.V.I.S., 2: Manager, 3: HRD, 4: Stokis) [default: 1]: ')
    if (pilihanBot === '1' || pilihanBot.toLowerCase() === 'ceo') botType = 'ceo'
    else if (pilihanBot === '3' || pilihanBot.toLowerCase() === 'hrd') botType = 'hrd'
    else if (pilihanBot === '4' || pilihanBot.toLowerCase() === 'stokis') botType = 'stokis'
    else if (pilihanBot === '2' || pilihanBot.toLowerCase() === 'manager') botType = 'manager'
    else if (pilihanBot === '') botType = 'ceo'
  }
  rl.close()

  const DAFTAR_COMMANDS = COMMANDS_MAP[botType] || COMMANDS_MAP.manager

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
