import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { kirimAksiChatTelegram, kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'
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
        const admin = supabaseAdmin()

        // 1A. Jika diawali 'inv_', proses sebagai kode undangan mandiri
        if (tokenRaw.startsWith('inv_')) {
          const { data: inviteRes } = await admin.rpc('bot_telegram_redeem_invite_code', {
            p_code: tokenRaw,
            p_telegram_user_id: fromId,
            p_nama: fromFirstName,
            p_username: fromUsername,
          })

          const invObj = (inviteRes as { ok?: boolean; reason?: string; bot_nama?: string }) || {}
          if (invObj.ok === true) {
            await kirimPesanTelegram(
              chatId,
              `🎉 *Aktivasi Berhasil!*\n\nHalo *${fromFirstName}*!\nAkun Telegram Anda telah resmi terdaftar untuk mengakses *${invObj.bot_nama || 'Bot Manager'}* Suka Shawarma.\n\n` +
              `Anda sekarang dapat langsung menggunakan bot ini atau ketik /help untuk panduan.`,
              'https://manager.sukashawarma.com',
              'manager'
            )
            return NextResponse.json({ ok: true, linked: true })
          }
        }

        // 1B. Fallback ke tautan token staf lama
        const tokenHash = createHash('sha256').update(tokenRaw).digest('hex')

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
          : staff.role === 'admin_hr'
          ? 'Admin HR'
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
      let barisTriggerDinamis = ''
      try {
        const admin = supabaseAdmin(3_000)
        const { data: linkRow } = await admin
          .from('bot_telegram_links')
          .select('outlet_staff(role)')
          .eq('telegram_user_id', fromId)
          .maybeSingle()
        const staffRole = (linkRow?.outlet_staff as unknown as { role?: string } | null)?.role
        const targetRole =
          staffRole === 'regional_manager'
            ? 'regional_manager'
            : staffRole === 'admin_hr'
            ? 'admin_hr'
            : 'area_manager'

        const { data: catalogRows } = await admin
          .from('bot_trigger_catalog')
          .select('judul, jadwal_atau_trigger')
          .eq('target_role', targetRole)
          .eq('is_active', true)
          .order('urutan', { ascending: true })

        if (Array.isArray(catalogRows) && catalogRows.length > 0) {
          barisTriggerDinamis = catalogRows
            .map((r: { judul?: string; jadwal_atau_trigger?: string }, idx: number) =>
              `${idx + 1}. *${r.judul}* _(${r.jadwal_atau_trigger})_`
            )
            .join('\n')
        }
      } catch {
        // Gunakan daftar default jika query katalog gagal
      }

      const daftarTriggerTeks =
        barisTriggerDinamis ||
        `1. 📋 *Finalize Stock Opname Real-Time* (Daftar Sudah, Draft & Belum Opname)\n` +
        `2. 🚨 *Cabang Zero Sales / 0 Transaksi* (17:00 WIB AM & 19:30 WIB RM)\n` +
        `3. 🛑 *Pembatalan / Void Order POS* (Real-Time)\n` +
        `4. 📉 *Anomali Penurunan Stok ≥50%* (Real-Time)\n` +
        `5. 📦 *Surat Jalan Menggantung >2 Jam* (Tiap 15 menit)\n` +
        `6. 👥 *Izin Mendadak H-0 / Outlet Understaffed* (Real-Time)\n` +
        `7. 🚨 *Outlet Telat Buka* (+5 menit AM & +30 menit RM)\n` +
        `8. 💵 *Selisih Kas Closing Shift* (>Rp 20rb AM & >Rp 100rb RM)\n` +
        `9. 🗑️ *Pengajuan Waste & Sidak Ceklist Harian*\n` +
        `10. 📈 *Rekap Omzet & Kepatuhan Opname Berkala*`

      await kirimPesanTelegram(
        chatId,
        `📖 *Panduan Bot Manager Suka Shawarma (Telegram & SuperApp)*\n\n` +
        `Seluruh trigger otomatis dikirimkan secara paralel ke *Telegram* ini dan ke *Notifikasi HP + Chat Copilot* di SuperApp.\n\n` +
        `🔔 *Daftar Trigger Otomatis Aktif:*\n` +
        `${daftarTriggerTeks}\n\n` +
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

    // 1. Cek apakah staf terdaftar
    const { data: linkInfo } = await admin
      .from('bot_telegram_links')
      .select('staff_id, outlet_staff(id, name, role, status)')
      .eq('telegram_user_id', fromId)
      .maybeSingle()

    const staff = linkInfo?.outlet_staff as unknown as { id?: string; name?: string; role?: string; status?: string } | null
    let userName = staff?.name
    let userRole = staff?.role

    if (!staff || staff.status !== 'active') {
      // 2. Fallback cek standalone whitelist per bot
      let whitelistUser: { nama_pengguna?: string } | null = null
      try {
        const { data } = await admin
          .from('bot_telegram_whitelist')
          .select('nama_pengguna')
          .eq('telegram_user_id', fromId)
          .maybeSingle()
        whitelistUser = data
      } catch {
        // Abaikan jika tabel belum ada di mock unit test
      }

      if (!whitelistUser) {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Akun Telegram Anda belum terhubung atau status staf tidak aktif. Silakan hubungi Admin atau gunakan tautan aktivasi.',
          undefined,
          'manager'
        )
        return NextResponse.json({ ok: true })
      }
      userName = whitelistUser.nama_pengguna
      userRole = 'pengguna_terotorisasi'
    }

    // Kirim indikasi typing segera dan pertahankan setiap 4 detik selama memproses
    await kirimAksiChatTelegram(chatId, 'typing', 'manager').catch(() => {})
    const typingInterval = setInterval(() => {
      kirimAksiChatTelegram(chatId, 'typing', 'manager').catch(() => {})
    }, 4000)

    try {
      // Ambil daftar cabang binaan jika role Area Manager
      let cabangBinaanTeks = ''
      if (staff?.role === 'area_manager' && staff.id) {
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
      const promptUser = `[Konteks Manajer: Nama: ${userName}, Role: ${userRole}${cabangBinaanTeks}]\nPertanyaan: ${text}`

      let jawabanAi = ''
      // Coba Hermes dengan batas waktu 12 detik agar webhook tidak timeout
      if (baseUrl && kunci) {
        try {
          for await (const chunk of tanyaHermes({
            baseUrl,
            kunci,
            profil: 'manager',
            sesiId: `telegram-${fromId}`,
            pesan: promptUser,
            signal: AbortSignal.timeout(12_000),
          })) {
            jawabanAi += chunk
          }
        } catch (e) {
          console.warn('[telegram-webhook] Hermes gagal atau timeout, beralih ke AI Router + Telemetri Nyata:', e)
        }
      }

      // Fallback ke AI Router (9Router) + Telemetri Nyata (identik dengan In-App Copilot)
      if (!jawabanAi.trim()) {
        let telemetri = null
        try {
          telemetri = await ambilTelemetriNyata()
        } catch (teleErr) {
          console.warn('[telegram-webhook] Gagal mengambil telemetri nyata:', teleErr)
        }

        if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
          try {
            for await (const chunk of tanyaAiRouter({
              pesan: promptUser,
              profil: 'manager',
              telemetri,
              signal: AbortSignal.timeout(8_000),
            })) {
              jawabanAi += chunk
            }
          } catch (fallbackErr) {
            console.warn('[telegram-webhook] Fallback AI Router gagal atau timeout:', fallbackErr)
          }
        }

        // Jika AI Router juga kosong atau gagal, gunakan analisis cerdas telemetri langsung
        if (!jawabanAi.trim()) {
          try {
            for (const chunk of buatJawabanDev(text, 'manager', telemetri)) {
              jawabanAi += chunk
            }
          } catch (simErr) {
            console.error('[telegram-webhook] buatJawabanDev gagal:', simErr)
            jawabanAi = '⚠️ Terjadi kendala saat memproses jawaban operasional. Silakan ulangi pertanyaan Anda.'
          }
        }
      }

      if (jawabanAi.trim()) {
        await kirimPesanTelegram(chatId, jawabanAi.trim(), undefined, 'manager')
      } else {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Maaf, sistem belum dapat memproses pertanyaan tersebut. Silakan ketik pertanyaan seputar omzet, status cabang, atau presensi.',
          undefined,
          'manager'
        )
      }
    } finally {
      clearInterval(typingInterval)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[telegram-webhook] Error handling update:', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
