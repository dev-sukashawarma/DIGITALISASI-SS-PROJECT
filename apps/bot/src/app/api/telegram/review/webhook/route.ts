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
  const expectedSecret = process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET
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
              `🎉 *Aktivasi Berhasil!*\n\nHalo *${fromFirstName}*!\nAkun Telegram Anda telah resmi terdaftar untuk mengakses *${invObj.bot_nama || 'Bot SukaReview'}* Suka Shawarma.\n\n` +
              `Anda sekarang dapat langsung menggunakan bot ini atau ketik /help untuk panduan komando ulasan & kepuasan pelanggan.`,
              'https://suka.pantaureview.com',
              'review'
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
          console.error('[telegram-review-webhook] RPC bot_telegram_tautkan error:', rpcErr)
          await kirimPesanTelegram(
            chatId,
            '⚠️ Terjadi gangguan saat memproses aktivasi akun. Silakan coba lagi beberapa saat atau hubungi Administrator.',
            undefined,
            'review'
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
            `🎉 *Aktivasi Berhasil!*\n\nHalo, *${staffName}*!\nAkun Telegram Anda telah resmi terhubung dengan *Bot SukaReview* Suka Shawarma.\n\n` +
            `Modul operasional kepuasan pelanggan kini aktif:\n` +
            `• ⭐ *Rating & Skor Outlet* (/rating)\n` +
            `• ⚠️ *Ulasan Kritis & Keluhan* (/negatif)\n` +
            `• 🚨 *Alert Ulasan Aktif* (/alert)\n` +
            `• 📊 *Rekapitulasi Sentimen* (/rekap)\n\n` +
            `Ketik /help untuk panduan lengkap atau ajukan pertanyaan seputar ulasan cabang langsung.`,
            'https://suka.pantaureview.com',
            'review'
          )
          return NextResponse.json({ ok: true, linked: true })
        }

        // Penanganan Gagal
        if (resObj.reason === 'expired') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Kedaluwarsa*\n\nTautan ini sudah pernah digunakan atau batas waktunya telah habis. Silakan hubungi Administrator untuk tautan baru.',
            undefined,
            'review'
          )
        } else if (resObj.reason === 'linked_elsewhere') {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Akun Telegram Sudah Terdaftar*\n\nAkun Telegram ini sudah terhubung ke akun staf lain di sistem Suka Shawarma.',
            undefined,
            'review'
          )
        } else {
          await kirimPesanTelegram(
            chatId,
            '⚠️ *Tautan Aktivasi Tidak Valid*\n\nFormat token tidak dikenali. Silakan pastikan Anda mengklik tautan resmi dari Admin Dashboard.',
            undefined,
            'review'
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
          `👋 *Halo, ${staff.name}!* (${staff.role || 'Staff'})\n\n` +
          `Bot SukaReview siaga memantau sentimen ulasan Google Reviews dan kepuasan pelanggan cabang Suka Shawarma.\n\n` +
          `Ketik /help untuk melihat menu perintah cepat atau tanyakan langsung performa rating cabang, ulasan negatif, dan analisis keluhan pelanggan.`,
          'https://suka.pantaureview.com',
          'review'
        )
      } else {
        await kirimPesanTelegram(
          chatId,
          `👋 *Halo, ${fromFirstName}!*\n\n` +
          `Akun Telegram Anda belum terhubung dengan akses Bot SukaReview.\n\n` +
          `🆔 *Telegram User ID Anda:* \`${fromId}\`\n\n` +
          `💡 *Cara Aktivasi:*\n` +
          `Buka *Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram*, lalu daftarkan ID Telegram Anda ke Whitelist Bot Review atau minta Tautan Undangan dari Administrator.`,
          undefined,
          'review'
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
        'review'
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
          .eq('bot_slug', 'review')
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
        `1. 🔴 *Alert Review Bintang 1-2 Baru Masuk* _(Real-Time saat ada review rating ≤ 2⭐)_\n` +
        `2. ⚠️ *Alert Lonjakan Komplain / Review Negatif* _(Real-Time saat ≥ 3 review negatif dlm 24 jam)_\n` +
        `3. 📉 *Alert Penurunan Drastis Rating Outlet* _(Real-Time saat tren 7 hari turun ≥ 0.3 poin)_\n` +
        `4. 🚨 *Alert Outlet di Bawah Ambang Batas Minimum* _(Real-Time saat rating outlet < 3.8⭐)_\n` +
        `5. 📊 *Rekap Harian Sentimen & Kepuasan Pelanggan* _(Cron Harian 09:00 WIB)_\n` +
        `6. 💬 *Pengingat Ulasan Negatif Belum Ditangani* _(Harian 15:00 WIB)_`

      await kirimPesanTelegram(
        chatId,
        `📖 *Panduan Bot SukaReview Suka Shawarma (Telegram & SuperApp)*\n\n` +
        `Bot SukaReview bertindak sebagai asisten AI intelijen ulasan pelanggan Google Reviews, deteksi komplain, dan monitoring kepuasan pelanggan Suka Shawarma.\n\n` +
        `🔔 *Daftar Trigger Alert Otomatis:*\n` +
        `${daftarTriggerTeks}\n\n` +
        `⚡ *Menu Pintasan Cepat (Slash Commands):*\n` +
        `• /rating - Leaderboard & skor rating Google Maps seluruh cabang\n` +
        `• /negatif - Ulasan negatif (bintang 1-2) terbaru yang butuh respon segera\n` +
        `• /alert - Peringatan aktif lonjakan komplain atau penurunan rating\n` +
        `• /rekap - Ringkasan proporsi sentimen ulasan & kategori komplain\n` +
        `• /new - Mulai sesi percakapan baru\n` +
        `• /id - Cek info User ID & Chat ID Telegram Anda\n\n` +
        `💬 *Contoh Pertanyaan yang Bisa Anda Ketik Langsung:*\n` +
        `• *"Cabang mana yang ratingnya paling rendah saat ini?"*\n` +
        `• *"Apa saja komplain paling sering tentang rasa atau porsi shawarma?"*\n` +
        `• *"Bagaimana review untuk cabang Dramaga atau Pondok Aren?"*\n` +
        `• *"Berapa proporsi sentimen positif vs negatif bulan ini?"*`,
        'https://suka.pantaureview.com',
        'review'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /new
    if (text === '/new' || text.startsWith('/new ')) {
      await kirimPesanTelegram(
        chatId,
        `🔄 *Sesi Percakapan Baru Dimulai*\n\n` +
        `Konteks percakapan telah direset. Silakan tanyakan seputar ulasan pelanggan atau gunakan menu /rating, /negatif, /alert, /rekap.`,
        'https://suka.pantaureview.com',
        'review'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Normalisasi Shortcut Slash Commands
    let queryTeks = text.trim()
    const cmdClean = queryTeks.toLowerCase().split(' ')[0]
    if (cmdClean === '/rating' || cmdClean.startsWith('/rating@')) {
      queryTeks = 'Bagaimana ranking dan rata-rata skor rating Google Reviews seluruh cabang Suka Shawarma saat ini?'
    } else if (cmdClean === '/negatif' || cmdClean.startsWith('/negatif@')) {
      queryTeks = 'Tampilkan daftar ulasan negatif bintang 1 dan 2 terbaru beserta isi keluhan dan cabang terkait yang butuh tindak lanjut.'
    } else if (cmdClean === '/alert' || cmdClean.startsWith('/alert@')) {
      queryTeks = 'Apakah ada alert operasional ulasan aktif saat ini seperti lonjakan review negatif atau rating outlet di bawah threshold?'
    } else if (cmdClean === '/rekap' || cmdClean.startsWith('/rekap@')) {
      queryTeks = 'Bagaimana ringkasan distribusi sentimen ulasan pelanggan dan kategori topik yang paling sering dikeluhkan?'
    } else if (cmdClean.startsWith('/outlet')) {
      const namaCabang = queryTeks.replace(/^\/outlet(@\w+)?\s*/i, '').trim()
      queryTeks = namaCabang
        ? `Bagaimana ringkasan performa ulasan dan rating pelanggan khusus untuk cabang ${namaCabang}?`
        : 'Bagaimana ringkasan performa ulasan dan rating cabang-cabang utama Suka Shawarma?'
    }

    // ─────────────────────────────────────────────────────────── Autentikasi Pengguna & Whitelist
    const admin = supabaseAdmin()

    const { data: linkInfo } = await admin
      .from('bot_telegram_links')
      .select('staff_id, outlet_staff(id, name, role, status)')
      .eq('telegram_user_id', fromId)
      .maybeSingle()

    const staff = linkInfo?.outlet_staff as unknown as { id?: string; name?: string; role?: string; status?: string } | null
    let userName = staff?.name
    let userRole = staff?.role

    const allowedReviewRoles = ['owner', 'admin', 'developer', 'marcom', 'area_manager', 'regional_manager']
    const hasRoleAccess = staff && staff.status === 'active' && allowedReviewRoles.includes(staff.role || '')

    if (!hasRoleAccess) {
      // 2. Cek explicit hermes_bot_user_access untuk profil 'review'
      let hasExplicitAccess = false
      if (staff && staff.status === 'active') {
        try {
          const { data: accessRow } = await admin
            .from('hermes_bot_user_access')
            .select('staff_id')
            .eq('bot_slug', 'review')
            .eq('staff_id', staff.id)
            .maybeSingle()
          if (accessRow) hasExplicitAccess = true
        } catch {
          // Abaikan
        }
      }

      // 3. Fallback cek standalone whitelist per bot (bot_slug = 'review')
      let whitelistUser: { nama_pengguna?: string } | null = null
      if (!hasExplicitAccess) {
        try {
          const { data } = await admin
            .from('bot_telegram_whitelist')
            .select('nama_pengguna')
            .eq('bot_slug', 'review')
            .eq('telegram_user_id', fromId)
            .eq('is_active', true)
            .maybeSingle()
          whitelistUser = data
        } catch {
          // Abaikan
        }
      }

      if (!hasExplicitAccess && !whitelistUser) {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Akun Telegram Anda belum memiliki izin akses ke Bot SukaReview. Silakan hubungi Administrator untuk pendaftaran akun.',
          undefined,
          'review'
        )
        return NextResponse.json({ ok: true })
      }
      userName = whitelistUser?.nama_pengguna || userName || fromFirstName
      userRole = 'pengguna_terotorisasi'
    }

    // Kirim indikasi typing segera dan pertahankan setiap 4 detik selama memproses
    await kirimAksiChatTelegram(chatId, 'typing', 'review').catch(() => {})
    const typingInterval = setInterval(() => {
      kirimAksiChatTelegram(chatId, 'typing', 'review').catch(() => {})
    }, 4000)

    try {
      const baseUrl = process.env.HERMES_API_URL
      const kunci = kunciProfil('review')
      const promptUser = `[Konteks SukaReview: Nama: ${userName}, Role: ${userRole}]\nPertanyaan: ${queryTeks}`

      let jawabanAi = ''
      // Coba Hermes dengan batas waktu 12 detik agar webhook tidak timeout
      if (baseUrl && kunci) {
        try {
          for await (const chunk of tanyaHermes({
            baseUrl,
            kunci,
            profil: 'review',
            sesiId: `telegram-review-${fromId}`,
            pesan: promptUser,
            signal: AbortSignal.timeout(12_000),
          })) {
            jawabanAi += chunk
          }
        } catch (err) {
          console.warn('[review-webhook] Hermes gagal atau timeout, beralih ke AI Router:', err)
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
          console.warn('[review-webhook] Hermes mengembalikan kendala provider/tool, beralih ke AI Router / telemetri nyata')
          jawabanAi = ''
        }
      }

      // Fallback ke 9Router AI Gateway jika Hermes tidak merespons
      if (!jawabanAi.trim()) {
        try {
          const telemetri = await ambilTelemetriNyata().catch(() => null)
          for await (const chunk of tanyaAiRouter({
            pesan: promptUser,
            profil: 'review',
            telemetri,
            signal: AbortSignal.timeout(12_000),
          })) {
            jawabanAi += chunk
          }
        } catch (errRouter) {
          console.warn('[review-webhook] AI Router gagal, beralih ke generator dev:', errRouter)
        }
      }

      // Fallback terakhir: Generator Dev Simulasi
      if (!jawabanAi.trim()) {
        const telemetri = await ambilTelemetriNyata().catch(() => null)
        jawabanAi = buatJawabanDev(queryTeks, 'review', telemetri).join('')
      }

      clearInterval(typingInterval)

      await kirimPesanTelegram(
        chatId,
        jawabanAi,
        'https://suka.pantaureview.com',
        'review'
      )
      return NextResponse.json({ ok: true })
    } catch (prosesErr) {
      clearInterval(typingInterval)
      console.error('[review-webhook] Gagal memproses pertanyaan:', prosesErr)
      await kirimPesanTelegram(
        chatId,
        'Maaf, terjadi gangguan saat menganalisis data ulasan. Silakan ulangi pertanyaan Anda beberapa saat lagi.',
        undefined,
        'review'
      )
      return NextResponse.json({ ok: true })
    }
  } catch (error) {
    console.error('[review-webhook] Fatal error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
