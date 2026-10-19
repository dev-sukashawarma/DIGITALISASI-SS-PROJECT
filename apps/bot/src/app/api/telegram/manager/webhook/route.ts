import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'
import { tanyaHermes, kunciProfil } from '@/lib/hermes'
import { ambilTelemetriNyata } from '@/lib/server/telemetriNyata'
import { tanyaAiRouter } from '@/lib/server/aiRouter'
import { buatJawabanDev } from '@/lib/server/devSimulasi'

export const dynamic = 'force-dynamic'

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      is_bot?: boolean
      first_name?: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    text?: string
  }
}

export async function POST(req: NextRequest) {
  // Verifikasi opsional secret token jika dikonfigurasi di webhook
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  const expectedSecret = process.env.TELEGRAM_MANAGER_WEBHOOK_SECRET
  if (expectedSecret && secretHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized webhook secret' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const msg = update.message
  if (!msg || !msg.text || !msg.from) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const text = msg.text.trim()
  const fromId = String(msg.from.id)
  const chatId = String(msg.chat.id)
  const fromUsername = msg.from.username ?? ''
  const fromFirstName = msg.from.first_name ?? 'Rekan'

  try {
    // ─────────────────────────────────────────────────────────── Command /start
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const tokenRaw = parts.length > 1 ? parts[1].trim() : ''

      // KASUS 1: Klik link dengan token rahasia (/start <token>) -> AUTO LINK INSTANT
      if (tokenRaw) {
        const tokenHash = createHash('sha256').update(tokenRaw).digest('hex')
        const admin = supabaseAdmin()

        const { data: linkRes, error: rpcErr } = await admin.rpc('bot_telegram_tautkan', {
          p_token_hash: tokenHash,
          p_telegram_user_id: fromId,
          p_chat_id: chatId,
          p_username: fromUsername,
          p_first_name: fromFirstName,
        })

        if (rpcErr) {
          console.error('[telegram-webhook] RPC bot_telegram_tautkan error:', rpcErr)
          await kirimPesanTelegram(
            chatId,
            '⚠️ Terjadi gangguan saat memproses aktivasi akun. Silakan coba lagi beberapa saat atau hubungi Admin.',
            undefined,
            'manager'
          )
          return NextResponse.json({ ok: true })
        }

        const resObj = (linkRes as { ok?: boolean; reason?: string }) || {}

        if (resObj.ok === true) {
          // Ambil nama staf & role untuk greeting personal
          const { data: linkInfo } = await admin
            .from('bot_telegram_links')
            .select('staff_id, outlet_staff(name, role)')
            .eq('telegram_user_id', fromId)
            .maybeSingle()

          const staff = linkInfo?.outlet_staff as unknown as { name?: string; role?: string } | null
          const staffName = staff?.name || fromFirstName
          const roleLabel = staff?.role === 'developer'
            ? 'Developer'
            : staff?.role === 'regional_manager'
            ? 'Regional Manager'
            : 'Area Manager'

          await kirimPesanTelegram(
            chatId,
            `🎉 *Aktivasi Berhasil!*\n\nHalo *${staffName}*!\nAkun Telegram Anda telah resmi terhubung sebagai *${roleLabel}* Suka Shawarma (sinkron dengan Bot Manager di SuperApp).\n\n` +
            `Mulai saat ini, Anda akan menerima 10 trigger alert operasional otomatis:\n` +
            `• 📋 *Update Finalize Stock Opname* (Real-Time: rincian cabang Sudah Opname, Masih Draft & Belum Opname)\n` +
            `• 🚨 *Alert Cabang Zero Sales / 0 Transaksi* (17:00 WIB untuk AM & 19:30 WIB untuk RM)\n` +
            `• 🛑 *Alert Pembatalan / Void Order POS* (AM & eskalasi RM ≥Rp 50rb / beruntun)\n` +
            `• 📉 *Anomali Penurunan Stok Drastis (≥50%)*\n` +
            `• 📦 *Surat Jalan Menggantung (>2 Jam belum diterima cabang)*\n` +
            `• 👥 *Outlet Understaffed / Izin Mendadak Hari Ini (H-0)*\n` +
            `• 🚨 *Keterlambatan Buka Outlet (+5 menit & eskalasi +30 menit)*\n` +
            `• 💵 *Selisih Kas Closing Shift Kasir (>Rp 20rb AM & >Rp 100rb RM)*\n` +
            `• 🗑️ *Pengajuan Waste Bahan Baku & Sidak Ceklist Harian*\n` +
            `• 📈 *Laporan Omzet Berkala (15:00, 19:30, 22:30 WIB)*\n\n` +
            `Ketik /help untuk melihat daftar trigger & contoh pertanyaan.`,
            'https://manager.sukashawarma.com',
            'manager'
          )
          return NextResponse.json({ ok: true, linked: true })
        }

        // Penanganan Gagal
        if (resObj.reason === 'expired') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Kedaluwarsa*\n\nTautan ini sudah pernah digunakan atau batas waktunya telah habis. Silakan hubungi Admin untuk mendapatkan tautan aktivasi baru.',
            undefined,
            'manager'
          )
        } else if (resObj.reason === 'linked_elsewhere') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Akun Telegram Sudah Terdaftar*\n\nAkun Telegram ini sudah terhubung ke akun staf lain di sistem Suka Shawarma.',
            undefined,
            'manager'
          )
        } else {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Tidak Valid*\n\nFormat token tidak dikenali. Silakan pastikan Anda mengklik tautan resmi dari Admin.',
            undefined,
            'manager'
          )
        }
        return NextResponse.json({ ok: true, linked: false })
      }

      // KASUS 2: Start biasa tanpa token (/start)
      const admin = supabaseAdmin()
      const { data: existingLink } = await admin
        .from('bot_telegram_links')
        .select('staff_id, outlet_staff(name, role, status)')
        .eq('telegram_user_id', fromId)
        .maybeSingle()

      if (existingLink && existingLink.outlet_staff) {
        const staff = existingLink.outlet_staff as unknown as { name?: string; role?: string; status?: string }
        const roleLabel = staff.role === 'developer'
          ? 'Developer'
          : staff.role === 'regional_manager'
          ? 'Regional Manager'
          : 'Area Manager'
        await kirimPesanTelegram(
          chatId,
          `👋 *Selamat Datang Kembali, ${staff.name}!* (${roleLabel})\n\n` +
          `Bot Manager Suka Shawarma siap siaga (tersinkronisasi penuh dengan notifikasi HP & Chat Copilot di SuperApp).\n\n` +
          `Ketik /help untuk melihat 10 trigger otomatis & panduan tanya-jawab AI.`,
          'https://manager.sukashawarma.com',
          'manager'
        )
      } else {
        await kirimPesanTelegram(
          chatId,
          `👋 *Halo ${fromFirstName}!*\n\n` +
          `Akun Telegram Anda belum terhubung dengan akun staf Suka Shawarma.\n\n` +
          `🆔 *Telegram User ID Anda:* \`${fromId}\`\n\n` +
          `💡 *Cara Aktivasi Otomatis:*\n` +
          `Buka menu *Bot Manager* di SuperApp lalu klik tombol *Hubungkan Telegram*, atau mintalah *Tautan Aktivasi Khusus* kepada Admin.`,
          undefined,
          'manager'
        )
      }
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /id
    if (text === '/id' || text.startsWith('/id ')) {
      await kirimPesanTelegram(
        chatId,
        `🆔 *Informasi Akun Telegram Anda:*\n\n` +
        `• *Telegram User ID:* \`${fromId}\`\n` +
        `• *Chat ID:* \`${chatId}\`\n` +
        `• *Username:* ${fromUsername ? `@${fromUsername}` : '-(belum disetel)-'}\n\n` +
        `Berikan User ID ini kepada Admin jika melakukan aktivasi manual.`,
        undefined,
        'manager'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /help
    if (text === '/help' || text.startsWith('/help ')) {
      await kirimPesanTelegram(
        chatId,
        `📖 *Panduan Bot Manager Suka Shawarma (Telegram & SuperApp)*\n\n` +
        `Seluruh trigger otomatis dikirimkan secara paralel ke *Telegram* ini dan ke *Notifikasi HP + Chat Copilot* di SuperApp.\n\n` +
        `🔔 *10 Trigger Otomatis Aktif (RM & AM):*\n` +
        `1. 📋 *Finalize Stock Opname Real-Time* (Daftar Sudah, Draft & Belum Opname)\n` +
        `2. 🚨 *Cabang Zero Sales / 0 Transaksi* (17:00 WIB AM & 19:30 WIB RM)\n` +
        `3. 🛑 *Pembatalan / Void Order POS* (Real-Time)\n` +
        `4. 📉 *Anomali Penurunan Stok ≥50%* (Real-Time)\n` +
        `5. 📦 *Surat Jalan Menggantung >2 Jam* (Tiap 15 menit)\n` +
        `6. 👥 *Izin Mendadak H-0 / Outlet Understaffed* (Real-Time)\n` +
        `7. 🚨 *Outlet Telat Buka* (+5 menit AM & +30 menit RM)\n` +
        `8. 💵 *Selisih Kas Closing Shift* (>Rp 20rb AM & >Rp 100rb RM)\n` +
        `9. 🗑️ *Pengajuan Waste & Sidak Ceklist Harian*\n` +
        `10. 📈 *Rekap Omzet & Kepatuhan Opname Berkala*\n\n` +
        `💬 *Contoh Pertanyaan yang Bisa Anda Ketik Langsung:*\n` +
        `• *"Berapa omzet seluruh cabang hari ini?"*\n` +
        `• *"Cabang mana yang masih 0 transaksi hari ini?"*\n` +
        `• *"Siapa kru yang izin atau telat hari ini?"*\n` +
        `• *"Bandingkan omzet hari ini dengan kemarin"*`,
        'https://manager.sukashawarma.com',
        'manager'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Tanya Jawab Hermes AI 2-Way
    const admin = supabaseAdmin()
    const { data: linkInfo } = await admin
      .from('bot_telegram_links')
      .select('staff_id, outlet_staff(id, name, role, status)')
      .eq('telegram_user_id', fromId)
      .maybeSingle()

    const staff = linkInfo?.outlet_staff as unknown as { id?: string; name?: string; role?: string; status?: string } | null
    if (!staff || staff.status !== 'active') {
      await kirimPesanTelegram(
        chatId,
        '⚠️ Akun Telegram Anda belum terhubung atau status staf tidak aktif. Silakan hubungi Admin atau gunakan tautan aktivasi.',
        undefined,
        'manager'
      )
      return NextResponse.json({ ok: true })
    }

    // Ambil daftar cabang binaan jika role Area Manager
    let cabangBinaanTeks = ''
    if (staff.role === 'area_manager' && staff.id) {
      const { data: outlets } = await admin
        .from('staff_outlets')
        .select('outlet_id, outlets(name)')
        .eq('staff_id', staff.id)
      const namaCabang = ((outlets as unknown as Array<{ outlets?: { name?: string } }>) || [])
        .map((o) => o.outlets?.name)
        .filter(Boolean)
      cabangBinaanTeks = namaCabang.length > 0
        ? `\nCabang Binaan Anda: ${namaCabang.join(', ')}`
        : '\nCabang Binaan: (Belum ada cabang binaan terdaftar)'
    }

    const baseUrl = process.env.HERMES_API_URL
    const kunci = kunciProfil('manager')
    const promptUser = `[Konteks Manajer: Nama: ${staff.name}, Role: ${staff.role}${cabangBinaanTeks}]\nPertanyaan: ${text}`

    let jawabanAi = ''
    if (baseUrl && kunci) {
      try {
        for await (const chunk of tanyaHermes({
          baseUrl,
          kunci,
          profil: 'manager',
          sesiId: `telegram-${fromId}`,
          pesan: promptUser,
        })) {
          jawabanAi += chunk
        }
      } catch (e) {
        console.warn('[telegram-webhook] Hermes gagal, beralih ke AI Router + Telemetri Nyata:', e)
      }
    }

    // Fallback ke AI Router (9Router) + Telemetri Nyata (identik dengan In-App Copilot)
    if (!jawabanAi.trim()) {
      try {
        const telemetri = await ambilTelemetriNyata()
        if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
          for await (const chunk of tanyaAiRouter({
            pesan: promptUser,
            profil: 'manager',
            telemetri,
          })) {
            jawabanAi += chunk
          }
        }
        if (!jawabanAi.trim()) {
          for (const chunk of buatJawabanDev(text, 'ceo', telemetri)) {
            jawabanAi += chunk
          }
        }
      } catch (fallbackErr) {
        console.error('[telegram-webhook] Fallback AI Router gagal:', fallbackErr)
        jawabanAi = '⚠️ Terjadi kendala saat memproses jawaban dengan asisten AI operasional. Silakan coba lagi.'
      }
    }

    if (jawabanAi.trim()) {
      await kirimPesanTelegram(chatId, jawabanAi.trim(), undefined, 'manager')
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[telegram-webhook] Error handling update:', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
