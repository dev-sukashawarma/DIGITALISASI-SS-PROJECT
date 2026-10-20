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
  const expectedSecret = process.env.TELEGRAM_FINANCE_WEBHOOK_SECRET
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
  const fromFirstName = msg.from.first_name ?? 'Rekan Finance'

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
              `🎉 *Aktivasi Berhasil!*\n\nHalo *${fromFirstName}*!\nAkun Telegram Anda telah resmi terdaftar untuk mengakses *${invObj.bot_nama || 'Bot Finance'}* Suka Shawarma.\n\n` +
              `Anda sekarang dapat langsung menggunakan bot ini atau ketik /help untuk panduan komando keuangan.`,
              'https://finance.sukashawarma.com',
              'finance'
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
          console.error('[telegram-finance-webhook] RPC bot_telegram_tautkan error:', rpcErr)
          await kirimPesanTelegram(
            chatId,
            '⚠️ Terjadi gangguan saat memproses aktivasi akun finance. Silakan coba lagi beberapa saat atau hubungi Administrator.',
            undefined,
            'finance'
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

          await kirimPesanTelegram(
            chatId,
            `🎉 *Aktivasi Berhasil!*\n\nHalo, *${staffName}*!\nAkun Telegram Anda telah resmi terhubung dengan *Bot Finance* Suka Shawarma.\n\n` +
            `Modul operasional keuangan kini aktif:\n` +
            `• 📑 *Utang Supplier PO* (/utang)\n` +
            `• 💸 *Pengeluaran Kas Kecil & Bulanan* (/pengeluaran)\n` +
            `• 📥 *Status Pencatatan Setoran Kas* (/setoran)\n` +
            `• ⚖️ *Rekap Selisih Kasir Tutup Shift* (/selisih)\n\n` +
            `Ketik /help untuk panduan lengkap atau ajukan pertanyaan keuangan langsung.`,
            'https://finance.sukashawarma.com',
            'finance'
          )
          return NextResponse.json({ ok: true, linked: true })
        }

        // Penanganan Gagal
        if (resObj.reason === 'expired') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Kedaluwarsa*\n\nTautan ini sudah pernah digunakan atau batas waktunya telah habis. Silakan hubungi Administrator untuk tautan aktivasi baru.',
            undefined,
            'finance'
          )
        } else if (resObj.reason === 'linked_elsewhere') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Akun Telegram Sudah Terdaftar*\n\nAkun Telegram ini sudah terhubung ke akun staf lain di sistem Suka Shawarma.',
            undefined,
            'finance'
          )
        } else {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Tidak Valid*\n\nFormat token tidak dikenali. Silakan pastikan Anda mengklik tautan resmi dari Admin Dashboard.',
            undefined,
            'finance'
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
        await kirimPesanTelegram(
          chatId,
          `👋 *Halo, ${staff.name}!* (${staff.role || 'Finance'})\n\n` +
          `Bot Finance Suka Shawarma siaga dan terhubung ke data keuangan operasional.\n\n` +
          `Ketik /help untuk melihat menu perintah cepat atau tanyakan langsung data tagihan, pengeluaran, setoran, atau selisih kasir.`,
          'https://finance.sukashawarma.com',
          'finance'
        )
      } else {
        await kirimPesanTelegram(
          chatId,
          `👋 *Halo, ${fromFirstName}!*\n\n` +
          `Akun Telegram Anda belum terhubung dengan akses Bot Finance Suka Shawarma.\n\n` +
          `🆔 *Telegram User ID Anda:* \`${fromId}\`\n\n` +
          `💡 *Cara Aktivasi:*\n` +
          `Buka *Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram*, lalu buatkan *Tautan Undangan* atau daftarkan ID Telegram Anda ke Whitelist Bot Finance.`,
          undefined,
          'finance'
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
        'finance'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /help
    if (text === '/help' || text.startsWith('/help ')) {
      const admin = supabaseAdmin()
      let barisTriggerDinamis = ''
      try {
        const { data: catalogRows } = await admin
          .from('bot_trigger_catalog')
          .select('judul, jadwal_atau_trigger')
          .eq('bot_slug', 'finance')
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
        // Fallback jika database gagal
      }

      const daftarTriggerTeks =
        barisTriggerDinamis ||
        `1. 💳 *Pengingat Jatuh Tempo PO Supplier* _(Cron Harian 08:15 WIB)_\n` +
        `2. ⏳ *Alert Transaksi Treasury Menunggu Approval* _(Real-Time)_\n` +
        `3. 💵 *Alert Selisih Kasir Tutup Shift Cabang* _(Real-Time)_\n` +
        `4. 💸 *Pengajuan Top Up / Penyesuaian Petty Cash Outlet* _(Real-Time)_\n` +
        `5. 📥 *Notifikasi Input Setoran Kas Outlet* _(Real-Time)_\n` +
        `6. 🛑 *Audit Pembatalan / Void Order POS Bernilai Tinggi* _(Real-Time)_\n` +
        `7. 📊 *Pengingat Closing Buku Akhir Bulan (EOM Hub)* _(Bulanan)_`

      await kirimPesanTelegram(
        chatId,
        `📖 *Panduan Bot Finance Suka Shawarma (Telegram & SuperApp)*\n\n` +
        `Bot Finance bertindak sebagai asisten AI operasional keuangan, treasury, dan rekonsiliasi kas Suka Shawarma.\n\n` +
        `🔔 *Daftar Trigger Otomatis Aktif:*\n` +
        `${daftarTriggerTeks}\n\n` +
        `⚡ *Menu Pintasan Cepat (Slash Commands):*\n` +
        `• /utang - Cek tagihan & utang PO supplier jatuh tempo\n` +
        `• /pengeluaran - Ringkasan pengeluaran kas kecil & beban pusat vs outlet\n` +
        `• /setoran - Status pencatatan setoran kas cabang\n` +
        `• /selisih - Rekap selisih kasir tutup shift POS kemarin\n` +
        `• /new - Mulai sesi percakapan baru\n` +
        `• /id - Cek info akun Telegram Anda\n\n` +
        `💬 *Contoh Pertanyaan yang Bisa Anda Ketik Langsung:*\n` +
        `• *"Berapa utang PO supplier yang jatuh tempo minggu ini?"*\n` +
        `• *"Berapa total pengeluaran bulan ini?"*\n` +
        `• *"Apakah ada outlet yang selisih kasirnya minus kemarin?"*\n` +
        `• *"Bagaimana rekap setoran kas outlet minggu ini?"*`,
        'https://finance.sukashawarma.com',
        'finance'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /new
    if (text === '/new' || text.startsWith('/new ')) {
      await kirimPesanTelegram(
        chatId,
        `🔄 *Sesi Percakapan Baru Dimulai*\n\n` +
        `Konteks percakapan telah direset. Silakan ketik pertanyaan operasional keuangan atau gunakan menu /utang, /pengeluaran, /setoran, /selisih.`,
        'https://finance.sukashawarma.com',
        'finance'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Normalisasi Shortcut Slash Commands
    let queryTeks = text.trim()
    const cmdClean = queryTeks.toLowerCase().split(' ')[0]
    if (cmdClean === '/utang' || cmdClean.startsWith('/utang@')) {
      queryTeks = 'Bagaimana ringkasan utang PO ke supplier dan tagihan yang sudah lewat jatuh tempo hari ini?'
    } else if (cmdClean === '/pengeluaran' || cmdClean.startsWith('/pengeluaran@')) {
      queryTeks = 'Berapa total pengeluaran bulan ini yang terbagi antara outlet dan pusat?'
    } else if (cmdClean === '/setoran' || cmdClean.startsWith('/setoran@')) {
      queryTeks = 'Bagaimana ringkasan pencatatan setoran kas outlet yang diinput admin Finance hari ini dan status rekonsiliasi kas cabang?'
    } else if (cmdClean === '/selisih' || cmdClean.startsWith('/selisih@')) {
      queryTeks = 'Bagaimana rekap selisih kasir dan shift yang belum ditutup kemarin?'
    }

    // ─────────────────────────────────────────────────────────── Tanya Jawab Hermes AI 2-Way
    const admin = supabaseAdmin()

    // 1. Cek apakah staf terdaftar dengan role yang diizinkan (admin_finance, owner, admin, developer)
    const { data: linkInfo } = await admin
      .from('bot_telegram_links')
      .select('staff_id, outlet_staff(id, name, role, status)')
      .eq('telegram_user_id', fromId)
      .maybeSingle()

    const staff = linkInfo?.outlet_staff as unknown as { id?: string; name?: string; role?: string; status?: string } | null
    let userName = staff?.name
    let userRole = staff?.role

    const allowedFinanceRoles = ['admin_finance', 'owner', 'admin', 'developer']
    const hasRoleAccess = staff && staff.status === 'active' && allowedFinanceRoles.includes(staff.role || '')

    if (!hasRoleAccess) {
      // 2. Cek explicit hermes_bot_user_access untuk profil 'finance'
      let hasExplicitAccess = false
      if (staff && staff.status === 'active') {
        try {
          const { data: accessRow } = await admin
            .from('hermes_bot_user_access')
            .select('staff_id')
            .eq('bot_slug', 'finance')
            .eq('staff_id', staff.id)
            .maybeSingle()
          if (accessRow) hasExplicitAccess = true
        } catch {
          // Abaikan
        }
      }

      // 3. Fallback cek standalone whitelist per bot (bot_slug = 'finance')
      let whitelistUser: { nama_pengguna?: string } | null = null
      if (!hasExplicitAccess) {
        try {
          const { data } = await admin
            .from('bot_telegram_whitelist')
            .select('nama_pengguna')
            .eq('bot_slug', 'finance')
            .eq('telegram_user_id', fromId)
            .eq('is_active', true)
            .maybeSingle()
          whitelistUser = data
        } catch {
          // Abaikan jika tabel belum ada di mock unit test
        }
      }

      if (!hasExplicitAccess && !whitelistUser) {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Akun Telegram Anda belum terhubung atau belum memiliki izin akses ke Bot Finance Suka Shawarma. Silakan hubungi Admin.',
          undefined,
          'finance'
        )
        return NextResponse.json({ ok: true })
      }
      userName = whitelistUser?.nama_pengguna || userName || fromFirstName
      userRole = 'pengguna_terotorisasi'
    }

    // Kirim indikasi typing segera dan pertahankan setiap 4 detik selama memproses
    await kirimAksiChatTelegram(chatId, 'typing', 'finance').catch(() => {})
    const typingInterval = setInterval(() => {
      kirimAksiChatTelegram(chatId, 'typing', 'finance').catch(() => {})
    }, 4000)

    try {
      const baseUrl = process.env.HERMES_API_URL
      const kunci = kunciProfil('finance')
      const promptUser = `[Konteks Finance: Nama: ${userName}, Role: ${userRole}]\nPertanyaan: ${queryTeks}`

      let jawabanAi = ''
      // Coba Hermes dengan batas waktu 12 detik agar webhook tidak timeout
      if (baseUrl && kunci) {
        try {
          for await (const chunk of tanyaHermes({
            baseUrl,
            kunci,
            profil: 'finance',
            sesiId: `telegram-finance-${fromId}`,
            pesan: promptUser,
            signal: AbortSignal.timeout(12_000),
          })) {
            jawabanAi += chunk
          }
        } catch (e) {
          console.warn('[telegram-finance-webhook] Hermes gagal atau timeout, beralih ke AI Router:', e)
        }
      }

      // Deteksi jika Hermes menolak karena kendala provider AI atau tool MCP
      if (jawabanAi.trim()) {
        const textLower = jawabanAi.toLowerCase()
        const kendalaHermes =
          textLower.includes('provider authentication failed') ||
          textLower.includes('not connected to any ai provider') ||
          textLower.includes('belum memiliki endpoint') ||
          textLower.includes('belum memiliki tool mcp') ||
          textLower.includes('alat mcp belum tersambung')
        if (kendalaHermes) {
          console.warn('[telegram-finance-webhook] Hermes mengembalikan kendala provider/tool, beralih ke AI Router / telemetri nyata')
          jawabanAi = ''
        }
      }

      // Fallback ke AI Router (9Router) + Telemetri Nyata
      let telemetri: Awaited<ReturnType<typeof ambilTelemetriNyata>> | null = null
      if (!jawabanAi.trim()) {
        try {
          telemetri = await ambilTelemetriNyata()
        } catch (teleErr) {
          console.warn('[telegram-finance-webhook] Gagal mengambil telemetri nyata:', teleErr)
        }

        if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
          try {
            for await (const chunk of tanyaAiRouter({
              pesan: promptUser,
              profil: 'finance',
              telemetri,
              signal: AbortSignal.timeout(15_000),
            })) {
              jawabanAi += chunk
            }
          } catch (routerErr) {
            console.error('[telegram-finance-webhook] AI Router fallback gagal:', routerErr)
          }
        }
      }

      // Fallback simulasi lingkungan dev jika semua AI offline
      if (!jawabanAi.trim()) {
        try {
          for (const chunk of buatJawabanDev(queryTeks, 'finance', telemetri)) {
            jawabanAi += chunk
          }
        } catch {
          jawabanAi = '⚠️ Terjadi kendala saat memproses jawaban operasional keuangan. Silakan ulangi pertanyaan Anda.'
        }
      }

      await kirimPesanTelegram(
        chatId,
        jawabanAi,
        'https://finance.sukashawarma.com',
        'finance'
      )
    } finally {
      clearInterval(typingInterval)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[telegram-finance-webhook] Error memproses webhook:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
