import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'

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
            `🎉 *Aktivasi Berhasil!*\n\nHalo *${staffName}*!\nAkun Telegram Anda telah resmi terhubung sebagai *${roleLabel}* Suka Shawarma.\n\n` +
            `Mulai saat ini, Anda akan menerima alert operasional otomatis:\n` +
            `• 🚨 Keterlambatan buka outlet (+5 menit)\n` +
            `• 💵 Selisih kas closing kasir\n` +
            `• 🗑️ Pengajuan waste bahan baku\n` +
            `• 📋 Laporan sidak ceklist harian\n` +
            `• 📦 Monitoring kepatuhan stok opname\n` +
            `• 📈 Laporan omzet berkala (15:00, 19:30, 22:30 WIB)\n\n` +
            `Ketik /help untuk melihat wewenang dan contoh pertanyaan.`,
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
          `Bot Manager Suka Shawarma siap siaga. Sistem akan mengirimkan notifikasi operasional dan laporan omzet berkala langsung ke sini.\n\n` +
          `Ketik /help untuk panduan atau langsung ketik pertanyaan seputar omzet dan cabang binaan Anda.`,
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
          `Mintalah *Tautan Aktivasi Khusus* kepada Admin, lalu klik tautan tersebut untuk menghubungkan akun secara otomatis.`,
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
        `📖 *Panduan Bot Manager Suka Shawarma*\n\n` +
        `Bot ini memantau operasional cabang dan melayani tanya jawab dua arah via AI Hermes.\n\n` +
        `📌 *Perintah Cepat:*\n` +
        `• /start : Memeriksa status akun & sambutan\n` +
        `• /id : Melihat ID Telegram Anda\n` +
        `• /help : Panduan ini\n\n` +
        `💬 *Contoh Pertanyaan yang Bisa Anda Tanyakan:*\n` +
        `• *"Berapa omzet cabang Jakal hari ini?"*\n` +
        `• *"Menu terlaris di Babarsari minggu ini apa saja?"*\n` +
        `• *"Siapa kru yang belum absen di cabang Seturan?"*\n` +
        `• *"Cabang mana yang belum selesai stok opname malam ini?"*\n` +
        `• *"Cek stok daging sapi di cabang Monjali"*`,
        'https://manager.sukashawarma.com',
        'manager'
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true, ignored: true })
  } catch (err: unknown) {
    console.error('[telegram-webhook] Error handling update:', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
