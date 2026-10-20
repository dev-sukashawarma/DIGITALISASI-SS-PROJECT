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
  const expectedSecret = process.env.TELEGRAM_CEO_WEBHOOK_SECRET
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
  const fromFirstName = msg.from.first_name ?? 'Sir'

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
              `🎉 *Aktivasi Berhasil!*\n\nSalam, *${fromFirstName}*!\nAkun Telegram Anda telah resmi terdaftar untuk mengakses *${invObj.bot_nama || 'J.A.R.V.I.S. // Bot CEO'}* Suka Shawarma.\n\n` +
              `Pusat komando eksekutif kini siaga. Anda dapat langsung memberikan instruksi atau ketik /help untuk ringkasan menu perintah.`,
              'https://agents.sukashawarma.com',
              'ceo'
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
          console.error('[telegram-ceo-webhook] RPC bot_telegram_tautkan error:', rpcErr)
          await kirimPesanTelegram(
            chatId,
            '⚠️ Terjadi gangguan saat memproses aktivasi akun eksekutif. Silakan coba lagi beberapa saat atau hubungi Administrator.',
            undefined,
            'ceo'
          )
          return NextResponse.json({ ok: true })
        }

        const resObj = (linkRes as { ok?: boolean; reason?: string }) || {}

        if (resObj.ok === true) {
          const { data: linkInfo } = await admin
            .from('bot_telegram_links')
            .select('staff_id, outlet_staff(name, role)')
            .eq('telegram_user_id', fromId)
            .maybeSingle()

          const staff = linkInfo?.outlet_staff as unknown as { name?: string; role?: string } | null
          const staffName = staff?.name || fromFirstName
          const roleLabel = staff?.role === 'developer'
            ? 'Developer'
            : staff?.role === 'admin'
            ? 'Administrator'
            : 'Owner / Executive'

          await kirimPesanTelegram(
            chatId,
            `🎉 *Aktivasi Eksekutif Berhasil!*\n\nSalam, *${staffName}*!\nAkun Telegram Anda telah resmi terhubung dengan *J.A.R.V.I.S. // Bot CEO* Suka Shawarma (${roleLabel}).\n\n` +
            `Satelit telemetri dan modul kecerdasan buatan kini online:\n` +
            `• 📊 *Real-Time Sales & POS Leaderboard* (Omzet, AOV, dan porsi menu)\n` +
            `• 🟢 *Monitoring Buka/Tutup Cabang* (Deteksi outlet nol transaksi)\n` +
            `• ⏱️ *Presensi Kru & SDM* (Kedisiplinan, keterlambatan, dan perizinan)\n` +
            `• 🥩 *Gudang Pusat & Stok Bahan* (Katalog bahan dan buffer aman)\n` +
            `• 💰 *Finance & Rekonsiliasi Kas* (Gross sales dan mutasi operasional)\n` +
            `• ⚡ *Executive Daily Briefing* (Diagnostik menyeluruh sistem)\n\n` +
            `Ketik /help untuk panduan perintah atau langsung ajukan pertanyaan bisnis Anda, Sir.`,
            'https://agents.sukashawarma.com',
            'ceo'
          )
          return NextResponse.json({ ok: true, linked: true })
        }

        // Penanganan Gagal
        if (resObj.reason === 'expired') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Kedaluwarsa*\n\nTautan ini sudah pernah digunakan atau batas waktunya telah habis. Silakan hubungi Administrator untuk tautan aktivasi baru.',
            undefined,
            'ceo'
          )
        } else if (resObj.reason === 'linked_elsewhere') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Akun Telegram Sudah Terdaftar*\n\nAkun Telegram ini sudah terhubung ke akun staf lain di sistem Suka Shawarma.',
            undefined,
            'ceo'
          )
        } else {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Tidak Valid*\n\nFormat token tidak dikenali. Silakan pastikan Anda mengklik tautan resmi dari Admin Dashboard.',
            undefined,
            'ceo'
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
          : staff.role === 'admin'
          ? 'Administrator'
          : 'Owner / Executive'
        await kirimPesanTelegram(
          chatId,
          `👋 *Salam Hormat, ${staff.name}!* (${roleLabel})\n\n` +
          `J.A.R.V.I.S. Command Centre online dan terhubung ke database live Suka Shawarma.\n\n` +
          `Ketik /help untuk daftar komando pintasan eksekutif, atau berikan instruksi bisnis langsung, Sir.`,
          'https://agents.sukashawarma.com',
          'ceo'
        )
      } else {
        await kirimPesanTelegram(
          chatId,
          `👋 *Salam, ${fromFirstName}!*\n\n` +
          `Akun Telegram Anda belum terhubung dengan akses eksekutif Bot CEO Suka Shawarma.\n\n` +
          `🆔 *Telegram User ID Anda:* \`${fromId}\`\n\n` +
          `💡 *Cara Aktivasi:*\n` +
          `Buka *Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram*, lalu buatkan *Tautan Undangan* atau daftarkan ID Telegram Anda ke Whitelist Bot CEO.`,
          undefined,
          'ceo'
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
        `Gunakan User ID ini untuk pendaftaran whitelist di Admin Dashboard.`,
        undefined,
        'ceo'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /help
    if (text === '/help' || text.startsWith('/help ')) {
      let barisTriggerDinamis = ''
      try {
        const admin = supabaseAdmin()
        const { data: catalogRows } = await admin
          .from('bot_trigger_catalog')
          .select('judul, jadwal_atau_trigger')
          .or('bot_slug.eq.ceo,target_role.in.(owner,admin)')
          .eq('is_active', true)
          .order('urutan', { ascending: true })

        if (Array.isArray(catalogRows) && catalogRows.length > 0) {
          const seen = new Set<string>()
          const uniqueRows = catalogRows.filter((r: { judul?: string }) => {
            if (!r.judul || seen.has(r.judul)) return false
            seen.add(r.judul)
            return true
          })
          barisTriggerDinamis = uniqueRows
            .map(
              (r: { judul?: string; jadwal_atau_trigger?: string }, idx: number) =>
                `${idx + 1}. *${r.judul}* _(${r.jadwal_atau_trigger})_`
            )
            .join('\n')
        }
      } catch {
        // Gunakan daftar default jika query katalog gagal
      }

      const daftarTriggerTeks =
        barisTriggerDinamis ||
        `1. 📊 *Rekapitulasi & Ranking Penjualan Kemarin* _(04:00 WIB)_\n` +
        `2. 📢 *Ringkasan Kinerja Marketing & Promo Kemarin* _(04:01 WIB)_\n` +
        `3. 🏢 *Laporan Presensi Staf HQ* _(08:30 WIB)_\n` +
        `4. 👥 *Laporan Presensi Kru Seluruh Outlet* _(14:00 WIB)_\n` +
        `5. 📈 *Flash Report Penjualan Sore* _(16:00 WIB)_\n` +
        `6. ⚠️ *Eskalasi Outlet Rp 0 Transaksi di Prime Time* _(19:30 WIB)_\n` +
        `7. 🌙 *Laporan Penutupan & Omzet Final Harian* _(22:00 WIB)_\n` +
        `8. ⏳ *Eskalasi Cut-Off Stok Opname Malam* _(22:30 WIB)_\n` +
        `9. 📋 *Notifikasi Rekap Finalize Stok Opname Cabang* _(Real-Time)_\n` +
        `10. 🛑 *Eskalasi Void POS Berisiko Tinggi ≥Rp 50rb* _(Real-Time)_\n` +
        `11. 💵 *Eskalasi Selisih Kas Closing >Rp 100rb* _(Real-Time)_\n` +
        `12. 🚨 *Eskalasi Outlet Telat Buka ≥30 Menit* _(Jam Buka Cabang)_\n` +
        `13. 🥩 *Eskalasi Pengajuan Waste Bahan >Rp 150rb* _(Real-Time)_\n` +
        `14. 💓 *Heartbeat & Diagnostik VPS / Supabase* _(Tiap 2 Jam)_\n` +
        `15. 🚨 *Alert Darurat Server / Database Down* _(Tiap 2 Menit)_`

      await kirimPesanTelegram(
        chatId,
        `📖 *Panduan Komando Eksekutif J.A.R.V.I.S. (Bot CEO)*\n\n` +
        `Bot CEO bertindak sebagai pusat komando strategis, analitik penjualan, dan eksekutif AI Suka Shawarma yang terhubung langsung ke seluruh stasiun operasional.\n\n` +
        `⚡ *Menu Pintasan Cepat (Slash Commands):*\n` +
        `• /omzet - Cek penjualan, AOV & ranking cabang hari ini\n` +
        `• /kemarin - Rekapitulasi & evaluasi omzet cabang kemarin\n` +
        `• /buka - Cek cabang buka & cabang 0 transaksi\n` +
        `• /absensi - Presensi kru outlet & staf kantor pusat\n` +
        `• /stok - Katalog bahan baku & stok gudang pusat\n` +
        `• /finance - Ringkasan kas, OPEX & rekonsiliasi keuangan\n` +
        `• /status - Executive Daily Briefing & diagnostik sistem\n` +
        `• /new - Mulai sesi percakapan baru\n` +
        `• /id - Cek info akun Telegram Anda\n\n` +
        `🔔 *Katalog Pemicu & Notifikasi Otomatis Eksekutif:*\n` +
        daftarTriggerTeks + '\n\n' +
        `💬 *Contoh Instruksi yang Bisa Anda Ketik Langsung:*\n` +
        `• *"Tampilkan semua outlet hari ini"*\n` +
        `• *"Omzet kemarin berapa?"*\n` +
        `• *"Cabang mana yang paling sepi dan paling ramai?"*\n` +
        `• *"Siapa saja yang telat atau alpa hari ini?"*\n` +
        `• *"Bagaimana kondisi arus kas dan rekonsiliasi hari ini?"*\n` +
        `• *"Status report menyeluruh"*`,
        'https://agents.sukashawarma.com',
        'ceo'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /new
    if (text === '/new' || text.startsWith('/new ')) {
      await kirimPesanTelegram(
        chatId,
        `🔄 *Sesi Percakapan Baru Dimulai*\n\n` +
        `Konteks memori percakapan telah direset. Silakan berikan instruksi baru atau gunakan menu /omzet, /kemarin, /buka, /absensi, /stok, /finance, /status.`,
        'https://agents.sukashawarma.com',
        'ceo'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Normalisasi Shortcut Slash Commands
    let queryTeks = text.trim()
    const cmdClean = queryTeks.toLowerCase().split(' ')[0]
    if (cmdClean === '/omzet' || cmdClean.startsWith('/omzet@')) {
      queryTeks = 'Berapa omzet seluruh cabang hari ini dan peringkat penjualannya?'
    } else if (cmdClean === '/kemarin' || cmdClean.startsWith('/kemarin@')) {
      queryTeks = 'Bagaimana rekapitulasi dan peringkat penjualan seluruh cabang kemarin?'
    } else if (cmdClean === '/buka' || cmdClean.startsWith('/buka@')) {
      queryTeks = 'Cabang mana yang sudah buka dan mana yang belum ada transaksi hari ini?'
    } else if (cmdClean === '/absensi' || cmdClean.startsWith('/absensi@') || cmdClean === '/absen' || cmdClean.startsWith('/absen@')) {
      queryTeks = 'Bagaimana status kehadiran, keterlambatan, dan perizinan staf hari ini?'
    } else if (cmdClean === '/stok' || cmdClean.startsWith('/stok@')) {
      queryTeks = 'Bagaimana status stok gudang pusat dan katalog bahan baku hari ini?'
    } else if (cmdClean === '/finance' || cmdClean.startsWith('/finance@')) {
      queryTeks = 'Bagaimana ringkasan keuangan, kas operasional, dan rekonsiliasi hari ini?'
    } else if (cmdClean === '/status' || cmdClean.startsWith('/status@')) {
      queryTeks = 'Berikan status report menyeluruh sistem operasional dan ringkasan eksekutif hari ini.'
    }

    // ─────────────────────────────────────────────────────────── Tanya Jawab Hermes AI 2-Way
    const admin = supabaseAdmin()

    // 1. Cek apakah staf terdaftar dengan role eksekutif (owner, admin, developer)
    const { data: linkInfo } = await admin
      .from('bot_telegram_links')
      .select('staff_id, outlet_staff(id, name, role, status)')
      .eq('telegram_user_id', fromId)
      .maybeSingle()

    const staff = linkInfo?.outlet_staff as unknown as { id?: string; name?: string; role?: string; status?: string } | null
    let userName = staff?.name
    let userRole = staff?.role

    const allowedExecutiveRoles = ['owner', 'admin', 'developer']
    const isExecutiveRole = staff && staff.status === 'active' && allowedExecutiveRoles.includes(staff.role || '')

    if (!isExecutiveRole) {
      // 2. Cek explicit hermes_bot_user_access untuk profil 'ceo'
      let hasExplicitAccess = false
      if (staff && staff.status === 'active') {
        try {
          const { data: accessRow } = await admin
            .from('hermes_bot_user_access')
            .select('staff_id')
            .eq('bot_slug', 'ceo')
            .eq('staff_id', staff.id)
            .maybeSingle()
          if (accessRow) hasExplicitAccess = true
        } catch {
          // Abaikan
        }
      }

      // 3. Fallback cek standalone whitelist per bot (bot_slug = 'ceo')
      let whitelistUser: { nama_pengguna?: string } | null = null
      if (!hasExplicitAccess) {
        try {
          const { data } = await admin
            .from('bot_telegram_whitelist')
            .select('nama_pengguna')
            .eq('bot_slug', 'ceo')
            .eq('telegram_user_id', fromId)
            .eq('is_active', true)
            .maybeSingle()
          whitelistUser = data
        } catch {
          // Abaikan jika query gagal
        }
      }

      if (!hasExplicitAccess && !whitelistUser) {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Akun Telegram Anda belum terhubung atau tidak memiliki wewenang eksekutif Bot CEO. Silakan hubungi Administrator.',
          undefined,
          'ceo'
        )
        return NextResponse.json({ ok: true })
      }

      if (whitelistUser) {
        userName = whitelistUser.nama_pengguna
        userRole = 'eksekutif_terotorisasi'
      }
    }

    // Kirim indikasi typing segera dan pertahankan setiap 4 detik selama memproses
    await kirimAksiChatTelegram(chatId, 'typing', 'ceo').catch(() => {})
    const typingInterval = setInterval(() => {
      kirimAksiChatTelegram(chatId, 'typing', 'ceo').catch(() => {})
    }, 4000)

    try {
      const baseUrl = process.env.HERMES_API_URL
      const kunci = kunciProfil('ceo')
      const promptUser = `[Konteks Eksekutif: Nama: ${userName || fromFirstName}, Role: ${userRole || 'Executive'}]\nPertanyaan: ${queryTeks}`

      let jawabanAi = ''
      // Coba Hermes dengan batas waktu 12 detik agar webhook tidak timeout
      if (baseUrl && kunci) {
        try {
          for await (const chunk of tanyaHermes({
            baseUrl,
            kunci,
            profil: 'ceo',
            sesiId: `telegram-ceo-${fromId}`,
            pesan: promptUser,
            signal: AbortSignal.timeout(12_000),
          })) {
            jawabanAi += chunk
          }
        } catch (e) {
          console.warn('[telegram-ceo-webhook] Hermes gagal atau timeout, beralih ke AI Router + Telemetri Nyata:', e)
        }
      }

      // Fallback ke AI Router (9Router) + Telemetri Nyata (identik dengan In-App Executive Copilot)
      if (!jawabanAi.trim()) {
        let telemetri = null
        try {
          telemetri = await ambilTelemetriNyata()
        } catch (teleErr) {
          console.warn('[telegram-ceo-webhook] Gagal mengambil telemetri nyata:', teleErr)
        }

        if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
          try {
            for await (const chunk of tanyaAiRouter({
              pesan: promptUser,
              profil: 'ceo',
              telemetri,
              signal: AbortSignal.timeout(8_000),
            })) {
              jawabanAi += chunk
            }
          } catch (fallbackErr) {
            console.warn('[telegram-ceo-webhook] Fallback AI Router gagal atau timeout:', fallbackErr)
          }
        }

        // Jika AI Router juga kosong atau gagal, gunakan analisis cerdas telemetri langsung
        if (!jawabanAi.trim()) {
          try {
            for (const chunk of buatJawabanDev(queryTeks, 'ceo', telemetri)) {
              jawabanAi += chunk
            }
          } catch (simErr) {
            console.error('[telegram-ceo-webhook] buatJawabanDev gagal:', simErr)
            jawabanAi = '⚠️ Terjadi kendala saat memproses jawaban eksekutif. Silakan ulangi pertanyaan Anda, Sir.'
          }
        }
      }

      if (jawabanAi.trim()) {
        await kirimPesanTelegram(chatId, jawabanAi.trim(), undefined, 'ceo')
      } else {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Maaf Sir, sistem belum dapat memproses instruksi tersebut. Silakan ketik perintah seputar omzet, status cabang, atau presensi.',
          undefined,
          'ceo'
        )
      }
    } finally {
      clearInterval(typingInterval)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[telegram-ceo-webhook] Error handling update:', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
